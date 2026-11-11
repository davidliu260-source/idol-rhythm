# N7 work order: followed_idol_new_event 通知派送

> **狀態：v2，待 GPT review / 待 approve 實作**
> **關聯進度：** WORKING.md Item 85 N7
> **前置條件：** migration 042 已執行；N6 cron 實作需已 merge 並完成基本驗收後，才可進 N7 runtime。

---

## 背景

N6 完成了 `event_reminder` 派送（用戶自行設定的活動提醒）。
N7 負責第二種通知類型：**`followed_idol_new_event`** — 當用戶追蹤的偶像有新活動被 admin 發布時，自動通知該用戶。

觸發條件不同：
- N6：用戶主動設 reminder, cron 定時掃描, 近期活動才通知
- N7：admin 發布活動, 比對追蹤名單, 每日批次派送

---

## 範圍 (N7)

### 做

- 新路由 `GET /api/cron/dispatch-new-event-notifications`
- `vercel.json` 加入新 cron 排程 (每日一次)
- 掃描近 N 小時內新發布的活動 (`published_at >= NOW() - INTERVAL`)
- 對每位追蹤該活動 idol 的用戶, INSERT `followed_idol_new_event` 通知
- `dedupe_key = followed_idol_new_event:{event_id}` 配合 `(user_id, dedupe_key)` UNIQUE constraint 防重複
- 使用 `ON CONFLICT (user_id, dedupe_key) DO NOTHING`

### 不做 (本輪明確排除)

- 推播 (APNs / FCM / Web Push)
- Email 通知
- 即時觸發 (publish 後立刻派送; 留到未來 webhook / edge function)
- 回追舊活動 (backfill: `user_follows.created_at` 之前發布的活動不補送)
- 自動發布 / 自動 approve
- 通知設定 toggle (未來 N8)

---

## 技術設計

### 1. Cron 排程

```json
// vercel.json -- 新增 (現有兩個排程保留不動)
{
  "path": "/api/cron/dispatch-new-event-notifications",
  "schedule": "0 2 * * *"
}
```

- 每日 02:00 UTC (10:00 Taipei) 觸發, 與 dispatch-reminders (01:30 UTC) 錯開 30 分鐘
- Vercel Hobby plan: daily only, 不能 sub-daily
- 冪等: ON CONFLICT DO NOTHING 防重複

### 2. 掃描視窗

```
掃描視窗 = 過去 25 小時 (比 24 小時多 1 小時緩衝, 容忍 cron 延遲)
published_at >= NOW() - INTERVAL '25 hours'
```

> 為什麼 25 小時而非 24 小時?
> Vercel Cron 不保證整點準時觸發, 可能延遲數分鐘至數十分鐘。
> 25 小時視窗確保即使前一次 cron 晚了 60 分鐘, 新發布的活動仍不會漏掉。
> 重複計算由 `ON CONFLICT DO NOTHING` 消除, 不影響正確性。

### 3. 查詢邏輯

```sql
SELECT
  e.id            AS event_id,
  e.idol_id,
  e.idol_name,
  e.title         AS event_title,
  e.type          AS event_type,
  e.date          AS event_date,
  e.published_at,
  uf.user_id
FROM events e
JOIN user_follows uf ON uf.idol_id = e.idol_id
WHERE e.is_published = true
  AND e.trust_level IN ('official', 'media')
  AND e.published_at >= NOW() - INTERVAL '25 hours'
  AND e.published_at IS NOT NULL
  -- v1 不回追: 只通知在用戶追蹤之後發布的活動
  AND e.published_at >= uf.created_at
```

> `e.published_at >= uf.created_at` 確保:
> 若用戶今天才追蹤某偶像, 不會收到該偶像一年前就已發布的舊活動通知。
> 若活動在用戶追蹤之前已發布, 則不派送。

### 4. dedupe_key 設計

```
dedupe_key = followed_idol_new_event:{event_id}
```

> **為什麼不帶 user_id?**
> `notifications` table 本身已有 `user_id` 欄位, 且 unique constraint 是 `(user_id, dedupe_key)`。
> 因此 `dedupe_key = followed_idol_new_event:{event_id}` 配合 user_id 欄位,
> 即可確保同一用戶對同一活動只收到一則通知。
> 不需要把 user_id 再嵌入 dedupe_key。

### 5. 通知文字格式

| 欄位 | 內容 |
|---|---|
| `title` | `{idol_name} 有新活動!` |
| `body` | `《{event_title}》{event_date_label}` |

- `{event_date_label}`: 活動日期的中文簡短描述, 例如 `2026/07/12` 或 `2026 年 7 月`
- `event_title` 超過 80 字元時截斷加 `...`
- `idol_name` 不截斷

範例:
```
title: "aespa 有新活動!"
body:  "《aespa WORLD TOUR 2026》2026/07/12"
```

### 6. 派送流程 (TypeScript 實作指引)

```
1. getSupabaseServiceClient() (繞過 RLS)
2. 執行查詢, 取得 (event, user) 組合清單 (N 筆)
3. 若 N = 0, 回 200 { dispatched: 0, skipped_dedup: 0 }
4. 批次建構 notifications 陣列:
   dedupe_key = followed_idol_new_event:{event_id}
   payload = { event_type, event_date }
5. supabase
     .from('notifications')
     .upsert(notificationsPayload, {
       onConflict: 'user_id,dedupe_key',
       ignoreDuplicates: true,
     })
     .select('id')
   -- 回傳實際插入的 rows (dedup 略過的不回)
6. 回傳:
   {
     dispatched: insertedCount,
     skipped_dedup: N - insertedCount
   }
```

> N7 **不需要** `is_sent` flag (reminders 表才有), 此 cron 不操作 reminders。
> 重複防護完全依賴 notifications 的 `(user_id, dedupe_key)` UNIQUE constraint。

### 7. 路由介面

```
GET /api/cron/dispatch-new-event-notifications
Authorization: Bearer {CRON_SECRET}

Response 200:
{
  ok: true,
  trigger: 'vercel-cron',
  dispatched: number,      // 實際新插入的 notifications 筆數
  skipped_dedup: number    // 因 ON CONFLICT 略過的筆數
}

Response 401: { ok: false, error: '未授權: Authorization header 無效' }
Response 500: { ok: false, error: '...' }
```

### 8. 環境變數

不需要新的 env var, 使用既有:
- `SUPABASE_SERVICE_ROLE_KEY` (service_role JWT, `eyJ...` 開頭)
- `CRON_SECRET` (Vercel Cron Authorization header)

### 9. 新增 / 修改檔案

| 路徑 | 說明 |
|---|---|
| `src/app/api/cron/dispatch-new-event-notifications/route.ts` | 路由主體 (新增) |
| `vercel.json` | 新增 cron 條目 (修改) |

---

## 邊界案例說明

| 案例 | 處理方式 |
|---|---|
| 同一用戶追蹤多個偶像, 某活動是聯合演出 (一個 event, 多個 idol) | events 表一筆活動只對應一個 `idol_id`; 聯合演出需 admin 為每個偶像各建一筆活動才會各自觸發通知 -- 這是 v1 限制, 屬可接受 |
| 用戶在追蹤後 1 分鐘內, cron 跑到之前 admin 又下架該活動 (`is_published = false`) | 下架後 `is_published = false`, 查詢條件過濾掉, 不派送 |
| 活動 `published_at` 為 NULL (早期未記錄) | 查詢條件 `published_at IS NOT NULL` 排除, 不派送 |
| admin 重新發布 (先下架再發布) | `published_at` 不更新 (由 admin 寫入時決定; v1 不處理「重新發布」場景) |
| 活動 `trust_level` 為 `pending` (不可見) | `trust_level IN ('official', 'media')` 過濾掉, 不派送 |

---

## 驗收條件

1. `npm run build` 通過 (TypeScript 型別無誤)
2. 路由回 401 when `Authorization` header 不正確
3. 路由回 500 when `SUPABASE_SERVICE_ROLE_KEY` 未設定
4. 無符合條件的新發布活動時: 回 `{ dispatched: 0, skipped_dedup: 0 }`
5. **單筆派送**: 手動在 Supabase 將一筆 event 的 `published_at` 設為 1 小時前, 且有用戶追蹤該 idol:
   - 呼叫路由 -> `notifications` 新增一筆 (type = `followed_idol_new_event`)
   - 再次呼叫 -> `{ dispatched: 0, skipped_dedup: 1 }` (dedupe 攔截)
6. **不回追**: 用戶追蹤時間晚於 `published_at` 的活動不應出現在通知中
7. **未追蹤用戶不收通知**: 只有追蹤該活動 idol 的用戶才收到

---

## 不在本輪範圍內的已知後續工作

| 代號 | 說明 |
|---|---|
| N6b | `hour_before` 派送 (需 timezone-aware 時間解析) |
| N8 | 通知設定 toggle (用戶可關閉特定類型通知) |
| N9 | PWA / Web Push / APNs 真實推播 |
| publish webhook | admin 發布時即時觸發派送 (取代每日 cron batch) |

---

*work order v2 by Claude Opus 4.7 -- 2026-05-22*
