# N6 工作單：event_reminder 通知派送 Cron

> **狀態：v2（修正 PR #117 GPT review 提出的 5 點）**
> **關聯進度：** WORKING.md Item 83 N6
> **前置條件：** migration 042 已執行 ✅、N4 + N5 已 merge ✅、PR #117 v1 已 merge ✅

---

## 背景

Migration 042 建立了 `notifications` table（N3）。  
N4/N5 完成了前台讀取 UI（未讀計數、通知列表、標記已讀）。  
N6 負責「**何時把通知資料 INSERT 進去**」：由一支 Vercel Cron job 掃描 `reminders` 表，對即將到來的活動派送 `event_reminder` 通知。

---

## 範圍（N6）

### 做

- 新路由：`GET /api/cron/dispatch-reminders`
- `vercel.json` 加入新 cron 排程（每小時頂部觸發）
- 派送 `reminder_type IN ('day_before', 'week_before')` 的通知
- 成功派送後將 `reminders.is_sent = true`
- 使用 `ON CONFLICT (user_id, dedupe_key) DO NOTHING` 防重複

### 不做（本輪明確排除）

- `hour_before` reminder type（需要解析 `events.time` 文字欄位 + timezone，另開 N6b）
- 推播（APNs / FCM / Web Push）
- Email 通知
- 歷史 reminder 補送（backfill）
- `followed_idol_new_event` 通知（N7 另行規劃）
- 自動 approve / publish

---

## 技術設計

### 1. Cron 排程

```json
// vercel.json — 新增（現有 sync-candidates 排程保留不動）
{
  "path": "/api/cron/dispatch-reminders",
  "schedule": "0 * * * *"
}
```

- **每小時第 0 分觸發**（UTC），Asia/Taipei 各整點觸發
- 冪等：重跑不會重複送（`ON CONFLICT DO NOTHING` + `is_sent` flag）

### 2. 查詢邏輯

```sql
SELECT
  r.id            AS reminder_id,
  r.user_id,
  r.event_id,
  r.type          AS reminder_type,
  e.idol_id,
  e.idol_name,
  e.title         AS event_title,
  e.date          AS event_date
FROM reminders r
JOIN events e ON e.id = r.event_id
WHERE r.is_sent = false
  AND e.is_published = true
  AND e.trust_level IN ('official', 'media')
  AND (
    (r.type = 'day_before'  AND e.date = (CURRENT_DATE + INTERVAL '1 day')::date)
    OR
    (r.type = 'week_before' AND e.date = (CURRENT_DATE + INTERVAL '7 days')::date)
  )
```

> **時區策略（N6 v1）**：以 Supabase DB server `CURRENT_DATE` 為準，只做 **date-level reminder**。
> 不宣稱完整涵蓋 Taipei timezone — 邊界（午夜前後）的時間誤差視為可接受。
> Hour-level / timezone-aware 派送一律留到 **N6b**，本輪不處理。
> `hour_before` 類型：本輪查詢條件不包含，這些 reminders 的 `is_sent` 維持 false，待 N6b 接手。

### 3. 通知文字格式

| reminder_type | title | body |
|---|---|---|
| `day_before` | `《{event_title}》明天登場！` | `{idol_name} 的活動明天即將開始，記得準備好！` |
| `week_before` | `《{event_title}》下週登場！` | `{idol_name} 的活動一週後即將開始，可以開始安排計畫了。` |

- `title` / `body` 欄位最長 255 chars；如 event_title 超長，截至 80 char 加 `…`
- `idol_id`：來自 `events.idol_id`，存入 notifications（可 NULL 若未來 event 沒有 idol）

### 4. dedupe_key 設計

```
dedupe_key = `event_reminder:${event_id}:${reminder_type}`
```

> **為什麼帶 reminder_type？**
> 同一使用者對同一活動可同時設 `week_before` 與 `day_before`，兩者應該各送一則通知（前者是「下週要到了」，後者是「明天就到了」），不應互相擋掉。若 dedupe_key 只用 `event_reminder:{event_id}`，第二則會被 unique constraint 擋住。
>
> 反之，同一個 (user, event, reminder_type) 組合若已派送過，再次嘗試插入時 `ON CONFLICT DO NOTHING` 應該擋掉 — 這是 dedupe 的目的。

### 5. 派送流程（TypeScript 實作指引）

```
① 呼叫 getSupabaseServiceClient()（繞過 RLS）
② 執行查詢，取得待派送清單（N 筆）
③ 若 N = 0，直接回 200 { dispatched: 0, skipped_dedup: 0, marked_sent: 0 }
④ 批次建構 notifications 陣列：
   dedupe_key = `event_reminder:${event_id}:${reminder_type}`
   payload = { reminder_type }
⑤ supabase
     .from('notifications')
     .upsert(notificationsArray, {
       onConflict: 'user_id,dedupe_key',
       ignoreDuplicates: true,
     })
     .select('id, user_id, event_id, payload')
   → 回傳的 rows 即為「實際新插入」的筆數（被 dedup 擋掉的不會回）
⑥ 依步驟 ⑤ 的結果決定哪些 reminders 要標 is_sent = true：
   - 屬於「成功插入」的 reminder → 標 is_sent = true
   - 屬於「dedup conflict 略過」的 reminder → 也標 is_sent = true
     （因為對應 notification 已存在於 DB，這個 reminder 算已完成派送職責）
   - 屬於「真正錯誤」（網路 / DB error）的 reminder → 不要動 is_sent，下個 cron 重試
   實作建議：把 ⑤ 包在 try/catch，整個批次成功才執行批次 UPDATE；
   若批次失敗則整批 reminders 都不標 is_sent。
⑦ 回傳：
   {
     dispatched: insertedCount,                  // 步驟 ⑤ 回傳 rows 數
     skipped_dedup: N - insertedCount,           // 已存在於 notifications 的數
     marked_sent: N                              // 步驟 ⑥ 更新筆數（dispatched + skipped_dedup）
   }
```

> **注意**：Supabase JS v2 的 `.upsert(..., { ignoreDuplicates: true })` 等效於 `ON CONFLICT DO NOTHING`。`.select()` 接在後面只會回傳實際寫入的 rows，方便比對哪些 reminders 屬於「新插入」vs「dedup 略過」。

### 6. 路由介面

```
GET /api/cron/dispatch-reminders
Authorization: Bearer {CRON_SECRET}

Response 200:
{
  ok: true,
  trigger: 'vercel-cron',
  dispatched: number,        // 實際新插入的 notifications 筆數
  skipped_dedup: number,     // 因 ON CONFLICT 略過的筆數
  marked_sent: number        // reminders 標記 is_sent=true 的筆數
}

Response 401: { ok: false, error: '未授權：Authorization header 無效' }
Response 500: { ok: false, error: '...' }
```

### 7. 環境變數

不需要新的 env var。使用既有：
- `SUPABASE_SERVICE_ROLE_KEY`（service_role JWT，`eyJ...` 開頭）
- `CRON_SECRET`（Vercel Cron Authorization header）

### 8. 新增檔案

| 路徑 | 說明 |
|---|---|
| `src/app/api/cron/dispatch-reminders/route.ts` | 路由主體 |
| `vercel.json` | 新增 cron 條目（修改） |

> `WORKING.md` migration 狀態欄不需更新（本工作單不含新 migration）。

---

## 驗收條件

1. `npm run build` 通過（TypeScript 型別無誤）
2. 路由回 401 when `Authorization` header 不正確
3. 路由回 500 when `SUPABASE_SERVICE_ROLE_KEY` 未設定
4. 回 200 `{ dispatched: 0, ... }` when 沒有符合條件的 reminders
5. **單筆派送**：手動在 Supabase 插入一筆 reminder（`day_before`，event.date = tomorrow，`is_sent = false`），呼叫路由後：
   - `notifications` 新增一筆
   - `reminders.is_sent` 改為 true
   - 再次呼叫路由：回 `{ dispatched: 0, skipped_dedup: 0, marked_sent: 0 }`
     （該 reminder 已 is_sent = true，查詢階段就被排除；本次無任何待派送 reminder）
6. **Dedupe 驗證（需另外造資料）**：若要驗證 ON CONFLICT 路徑，建立第二筆 reminder（**同 user_id + 同 event_id + 同 reminder_type**，但 `is_sent = false`，例如直接 UPDATE 把第一筆改回 false 即可），呼叫路由後：
   - 因 (user_id, dedupe_key) 已存在，notifications 不會新增
   - 回 `{ dispatched: 0, skipped_dedup: 1, marked_sent: 1 }`
   - 該 reminder 仍被標 `is_sent = true`（dedup 略過也算完成派送）
7. **同活動雙 reminder_type 不互擋**：同一 user_id + 同一 event_id 同時設 `week_before` 與 `day_before`：
   - 一週前 cron 跑時：插入 `event_reminder:{event_id}:week_before` 通知
   - 一天前 cron 跑時：插入 `event_reminder:{event_id}:day_before` 通知
   - notifications 表最終應有 **兩筆** 不同的通知，不因 dedupe 互相擋掉

---

## 不在本輪範圍內的已知後續工作

| 代號 | 說明 |
|---|---|
| N6b | `hour_before` 派送（需 timezone-aware 時間解析） |
| N7 | `followed_idol_new_event` 派送（偶像有新活動時通知追蹤用戶） |

---

*工作單 v1 草稿 by Claude Opus 4.5 — 2026-05-22*
*工作單 v2 修正（PR #117 GPT audit）by Claude Opus 4.5 — 2026-05-22*

---

## v2 修正摘要（vs PR #117 v1）

| # | 項目 | v1 → v2 |
|---|---|---|
| 1 | dedupe_key | `event_reminder:{event_id}` → `event_reminder:{event_id}:{reminder_type}`（避免同活動 week/day 互擋） |
| 2 | is_sent 更新規則 | 新增明確規則：insert 成功 ✅ / dedup 略過 ✅ / 真正錯誤 ❌（不標） |
| 3 | 驗收條件 5 | 修正第二次呼叫的預期值（is_sent 已 true → 查不到，應為 0/0/0） |
| 4 | 時區描述 | 收斂為 date-level only，不宣稱涵蓋 Taipei timezone |
| 5 | 驗收條件 7 | 新增：同活動同 user 雙 reminder_type 不互擋 |
