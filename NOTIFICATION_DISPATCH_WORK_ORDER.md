# N6 工作單：event_reminder 通知派送 Cron

> **狀態：待 GPT review**
> **關聯進度：** WORKING.md Item 83 N6
> **前置條件：** migration 042 已執行 ✅、N4 + N5 已 merge ✅

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

> `CURRENT_DATE` 以 Supabase DB server（UTC）為基準。
> `day_before`：活動 date 等於明天 UTC date，涵蓋 Taipei 時區（UTC+8）同一曆日的所有活動。
> `hour_before`：本輪略過，下一個 cron 迴圈不處理，`is_sent` 維持 false，待 N6b 補上。

### 3. 通知文字格式

| reminder_type | title | body |
|---|---|---|
| `day_before` | `《{event_title}》明天登場！` | `{idol_name} 的活動明天即將開始，記得準備好！` |
| `week_before` | `《{event_title}》下週登場！` | `{idol_name} 的活動一週後即將開始，可以開始安排計畫了。` |

- `title` / `body` 欄位最長 255 chars；如 event_title 超長，截至 80 char 加 `…`
- `idol_id`：來自 `events.idol_id`，存入 notifications（可 NULL 若未來 event 沒有 idol）

### 4. 派送流程（TypeScript 實作指引）

```
① 呼叫 getSupabaseServiceClient()（繞過 RLS）
② 執行查詢，取得待派送清單（N 筆）
③ 若 N = 0，直接回 200 { dispatched: 0 }
④ 批次建構 notifications 陣列：
   dedupe_key = `event_reminder:${event_id}`
   payload = { reminder_type }
⑤ supabase
     .from('notifications')
     .insert(notificationsArray)
     .onConflict(['user_id', 'dedupe_key'])   // ← Supabase JS v2 語法
   → 取得 count（實際插入筆數）
⑥ 更新 reminders.is_sent = true（批次 IN reminder_ids）
   → 無論步驟 ⑤ 是否衝突都更新（防止下次重跑）
⑦ 回傳 { dispatched: insertedCount, skipped_dedup: N - insertedCount, marked_sent: N }
```

> **注意**：Supabase JS v2 的 `.upsert()` 支援 `ignoreDuplicates: true`，等效於 `ON CONFLICT DO NOTHING`，建議用此語法。

### 5. 路由介面

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

### 6. 環境變數

不需要新的 env var。使用既有：
- `SUPABASE_SERVICE_ROLE_KEY`（service_role JWT，`eyJ...` 開頭）
- `CRON_SECRET`（Vercel Cron Authorization header）

### 7. 新增檔案

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
5. 手動在 Supabase 插入一筆 reminder（`day_before`，event.date = tomorrow，`is_sent = false`），呼叫路由後：
   - `notifications` 新增一筆
   - `reminders.is_sent` 改為 true
   - 再次呼叫路由：`dispatched: 0, skipped_dedup: 1`（第二次插入被 dedupe 擋住，但 is_sent 已是 true 故查不到）

---

## 不在本輪範圍內的已知後續工作

| 代號 | 說明 |
|---|---|
| N6b | `hour_before` 派送（需 timezone-aware 時間解析） |
| N7 | `followed_idol_new_event` 派送（偶像有新活動時通知追蹤用戶） |

---

*工作單草稿 by Claude Opus 4.5 — 2026-05-22*
