# 工作單：通知排程資料庫權限（migration 061）

> 日期：2026-11-10　撰寫：Claude Code（PM）　風險等級：**high-risk**（資料庫權限變更）
> 狀態：**Dave 已核准（2026-11-10），採用整張表 SELECT 版本**。Codex 已開 PR #200（PM 審查通過：SQL 與本單逐字相同、只新增 1 個檔案）。待 Dave merge → SQL Editor 手動執行 → 驗收。
> 本文件不含任何金鑰。

---

## 一句話

替後台程式（service_role）補上**讀** `events`、`reminders`、`user_follows` 三張表，以及**只改** `reminders.is_sent` 一個欄位的權限。這樣「活動提醒」和「追蹤偶像新活動通知」兩個每日排程才能正常跑，不再天天失敗。

---

## 為什麼要改（真因與證據）

| 證據 | 結果 |
|---|---|
| Vercel 正式環境日誌（最近 7 天） | `dispatch-reminders`、`dispatch-new-event-notifications` **7/7 天都回 500**；`sync-candidates` 7/7 天回 200 |
| 用本機 service_role 金鑰重跑排程的讀取步驟（只讀） | `events`、`reminders`、`user_follows` 都回 `42501 permission denied`；`notifications` 讀得到 |
| `notifications` 表 | **0 筆**，從來沒有寄出過通知 |
| repo migrations 盤點 | 這個專案每張表都要個別授權給 service_role：`event_candidates`（018）、`crawler_sources`（020）、`idols`（039）、`notifications`（042）都有授權，**這三張表從來沒有** |

結論：不是金鑰壞掉，是權限從一開始就沒給。兩個排程很可能從 5 月上線起就沒成功過。

打個比方：排程就像拿著員工證的工讀生。員工證本身是真的（金鑰有效），可是門禁系統只開了「通知」那個房間給他，「活動」「提醒」「追蹤」三個房間從來沒有登記他的卡，所以每天到門口都被擋下來。這個比方有一點不準：真的門禁會在被擋時響警報，這個系統只在日誌裡留一筆 500，沒有人會收到通知，所以一直沒人發現。

---

## 改什麼

### migration 內容（提案，核准後由 Codex 建檔）

檔名：`supabase/migrations/061_grant_service_role_notification_crons.sql`

```sql
-- 061: 補 service_role 對兩個通知排程所需資料表的最小權限
-- 只新增權限，不改資料、不改 RLS、不動 anon / authenticated。
-- GRANT 可重複執行，結果相同（idempotent）。

BEGIN;

-- 兩個排程都要讀活動
GRANT SELECT ON public.events TO service_role;

-- dispatch-reminders：讀未寄出的提醒
GRANT SELECT ON public.reminders TO service_role;

-- dispatch-reminders：寄出後只把 is_sent 改成 true，其他欄位一律不能改
GRANT UPDATE (is_sent) ON public.reminders TO service_role;

-- dispatch-new-event-notifications：讀誰追蹤了哪個偶像
GRANT SELECT ON public.user_follows TO service_role;

COMMIT;
```

### 每一條權限對應到哪一行程式

| 權限 | 誰用 | 程式位置 |
|---|---|---|
| `SELECT events` | 兩個排程 | `dispatch-reminders/route.ts:140-157`（透過 `events!inner` 合併讀取）；`dispatch-new-event-notifications/route.ts:137-143` |
| `SELECT reminders` | 活動提醒 | `dispatch-reminders/route.ts:140-157` |
| `UPDATE (is_sent) reminders` | 活動提醒 | `dispatch-reminders/route.ts:243-246`（`.update({ is_sent: true }).in('id', …)`） |
| `SELECT user_follows` | 新活動通知 | `dispatch-new-event-notifications/route.ts:170-173` |
| `notifications` 的讀寫 | 兩個排程 | 042 已經授權過，本單不動 |

### 刻意**不給**的權限

- 三張表的 `INSERT`、`DELETE`，以及 `events`、`user_follows` 的 `UPDATE`：排程用不到。
- `reminders` 除了 `is_sent` 以外的欄位：不能改。
- `saved_events`：service_role 也沒有權限，但目前沒有任何程式需要，不順手開。
- `anon`、`authenticated` 的權限，以及所有 RLS 規則：完全不動。

### 「最小權限」的取捨

SELECT 給整張表的讀取權限，沒有只給指定欄位。原因：只給欄位的話，排程以後只要多讀一個欄位就會再次 `permission denied`，而且同樣只會安靜地回 500，也就是今天這個問題的翻版。讀取本身不會改到任何資料，service_role 也只存在伺服器端（Vercel 正式環境，sensitive 變數）。

寫入的部分就嚴格限縮：只開 `reminders.is_sent` 這一個欄位。

如果審查後仍然希望 SELECT 也限縮到欄位，替代版本如下（排程目前用到的欄位全部列入）：

```sql
GRANT SELECT (id, idol_id, idol_name, title, type, date, published_at, is_published, trust_level) ON public.events TO service_role;
GRANT SELECT (id, user_id, event_id, type, is_sent) ON public.reminders TO service_role;
GRANT SELECT (user_id, idol_id, created_at) ON public.user_follows TO service_role;
GRANT UPDATE (is_sent) ON public.reminders TO service_role;
```

---

## 影響範圍與風險

| 項目 | 說明 |
|---|---|
| 誰會用到新權限 | 全站搜尋過，只有這兩個排程用 service_role 讀這三張表，其他功能不受影響 |
| 上線後使用者會看到什麼 | 符合條件的使用者會在站內 `/notifications` 頁看到通知。**沒有 email、沒有手機推播** |
| 會不會一次湧出一大堆舊通知 | 不會。活動提醒只在活動日期**剛好是明天**（前一天提醒）或**剛好 7 天後**（前一週提醒）時才寄（`dispatch-reminders/route.ts:177-178`）；新活動通知只看最近 25 小時內發布的活動，而且不會補發追蹤之前就發布的活動 |
| 會不會重複寄 | 不會。`notifications` 有唯一索引 `(user_id, dedupe_key)`（042），重跑也只會寫一次 |
| 費用 | 沒有額外費用。排程本來就每天在跑，只是從失敗變成成功 |
| **操作錯專案的風險** | 這台 Mac 的 Supabase 指令工具（CLI）登入的是 **telegram-bot 帳號**。本單**禁止**使用 `supabase` 指令（包括 `db push`）。只能在 **Chrome** 打開 idol-rhythm 的 SQL Editor 手動執行，執行前確認網址列有專案代號 `rdrthazsonkefggedbjr` |

---

## 執行步驟（Dave 核准後才開始）

1. **PM 派 Codex 實作票**（見附錄）：只建立 `061` 這一個 migration 檔，PR 標 `high-risk`。
2. **PM 審 PR**：確認 SQL 跟本單完全一致、沒有多出其他檔案。
3. **Dave merge PR**：merge 只是把檔案存進 repo，**不會**自動改資料庫。程式碼沒變，Vercel 部署不影響網站行為。
4. **Dave 跑「執行前檢查」SQL**（下面的 A1、A2，只讀）：確認專案正確、目前權限是 false，並先知道第一天大概會寄出幾則提醒。
5. **Dave 在 Chrome 的 SQL Editor 貼上 061 全文執行**。
6. **Dave 跑「執行後檢查」SQL**（A3），把結果截圖給 PM。
7. **PM 跑本機唯讀探測**，再隔天看排程日誌（驗收 B、C）。
8. **PM 更新 WORKING.md**：migration 061 狀態改成已執行，並把 N6／N7「已完成」的紀錄改正。

---

## 驗收

> SQL Editor 一次只會顯示最後一個查詢的結果，所以下面每一段請**分開貼、分開執行**。

### A1　執行前：確認目前權限（預期全部 false）

```sql
select
  has_table_privilege('service_role', 'public.events', 'SELECT')        as events_select,
  has_table_privilege('service_role', 'public.reminders', 'SELECT')     as reminders_select,
  has_table_privilege('service_role', 'public.user_follows', 'SELECT')  as follows_select,
  has_column_privilege('service_role', 'public.reminders', 'is_sent', 'UPDATE') as is_sent_update;
```

### A2　執行前：預估第一天會寄出幾則提醒（只讀）

```sql
select r.type, count(*) as will_send
from reminders r
join events e on e.id = r.event_id
where r.is_sent = false
  and e.is_published
  and e.trust_level in ('official', 'media')
  and (
    (r.type = 'day_before'  and e.date = (now() at time zone 'utc')::date + 1) or
    (r.type = 'week_before' and e.date = (now() at time zone 'utc')::date + 7)
  )
group by r.type;
```

（沒有任何一列結果，就代表當天不會寄出提醒，這是正常的。）

### A3　執行後：確認權限剛好開對（前 4 欄要 true，後 2 欄要 false）

```sql
select
  has_table_privilege('service_role', 'public.events', 'SELECT')        as events_select,
  has_table_privilege('service_role', 'public.reminders', 'SELECT')     as reminders_select,
  has_table_privilege('service_role', 'public.user_follows', 'SELECT')  as follows_select,
  has_column_privilege('service_role', 'public.reminders', 'is_sent', 'UPDATE') as is_sent_update,
  has_column_privilege('service_role', 'public.reminders', 'user_id', 'UPDATE') as user_id_update_should_be_false,
  has_table_privilege('service_role', 'public.events', 'INSERT')        as events_insert_should_be_false;
```

### B　PM 本機唯讀探測

用本機 service_role 金鑰分別讀 `events`、`reminders`、`user_follows` 各 1 筆，三張表都不再出現 `permission denied`。只讀，不寫入。

### C　排程回 200

套用後的隔天，Vercel 日誌裡：
- `dispatch-reminders`（台北 09:30）回 **200**
- `dispatch-new-event-notifications`（台北 10:00）回 **200**

沒有符合條件的資料時，排程會回 200 加上 `dispatched: 0`，這也算通過。

### D　notifications 有寫入（需要一筆測試資料）

排程只有「剛好碰到條件」才會寫入，所以要刻意製造一筆：

1. Dave 用自己的測試帳號，在網站上替一個**活動日期是 7 天後**（或明天）的已發布活動設定提醒。
2. 等下一次 09:30（台北）排程跑完。
3. 驗收（只讀）：

```sql
select type, dedupe_key, created_at
from notifications
order by created_at desc
limit 5;
```

預期出現一筆 `type = event_reminder`、`dedupe_key = event_reminder:{活動ID}:week_before`（或 `day_before`），網站 `/notifications` 頁也看得到這則通知。

新活動通知（`followed_idol_new_event`）的寫入驗收，等下一次後台發布新活動時順便確認：測試帳號要**先追蹤**該偶像，**再發布**活動，隔天 10:00 後檢查。

> 如果不想等排程，也可以手動觸發一次排程。但這會寫入正式資料庫，必須 Dave 另外明確同意，本單預設不做。

---

## 出問題怎麼撤回

在 Chrome 的 idol-rhythm SQL Editor 執行：

```sql
BEGIN;
REVOKE UPDATE (is_sent) ON public.reminders FROM service_role;
REVOKE SELECT ON public.user_follows FROM service_role;
REVOKE SELECT ON public.reminders FROM service_role;
REVOKE SELECT ON public.events FROM service_role;
COMMIT;
```

- 撤回後會回到今天的狀態：兩個排程每天回 500，其他功能不受影響，因為沒有別的程式用 service_role 讀這三張表。
- 已經寫入的通知會留著，不會自己消失。如果真的要刪，要另外問 Dave，本單不包含刪除資料。
- 撤回後再跑一次 A1，四欄都應該回到 false。

---

## 不在本單範圍

- `saved_events` 的 service_role 權限：沒有程式需要，不開。
- 排程失敗時沒有任何警報：建議之後另開一張票（例如失敗時寫一筆管理員看得到的紀錄）。
- `sync-candidates` 每天的警告（別名「nct 127」同時對到 NCT 和 NCT 127）：另案處理。
- WORKING.md 的錯誤紀錄（Hobby／Pro、N6／N7 狀態）：PM 在步驟 8 一起修。

---

## 附錄：Codex 實作票（Dave 核准本單後才派）

```text
【派工單 M061】補 service_role 給通知排程的最小權限（high-risk）

■ 開工
  cd ~/Desktop/idol-rhythm
  git fetch origin main
  git checkout -b feature/m061-notification-cron-grants origin/main

■ 真因
兩個通知排程（dispatch-reminders、dispatch-new-event-notifications）每天回 500。
service_role 讀 events、reminders、user_follows 時被拒（42501 permission denied），
這三張表從來沒有授權給 service_role。

■ 只做一件事
新增 supabase/migrations/061_grant_service_role_notification_crons.sql，
內容與本工作單「migration 內容」一節完全一致
（BEGIN; 四條 GRANT; COMMIT;），檔頭註解比照 018_grant_service_role_event_candidates.sql 的格式，
寫明目的、只新增權限、可重複執行。

■ 限制
- 只能新增這一個檔案；不改任何 src/、其他 migration、RLS、文件
- 不得使用 supabase CLI（這台 Mac 的 CLI 登入的是別的專案）
- 不得連線、不得執行 SQL、不得 apply、不得自行 merge

■ 驗收
1. npm run build 通過
2. git diff --stat origin/main 只出現這一個檔案（貼輸出）
3. 貼出完整檔案內容到 PR 說明

■ PR 規則
- commit message 例：「Grant service role read access for notification crons」
- git push origin feature/m061-notification-cron-grants
- gh pr create --base main --label high-risk，標題「m061: 補通知排程所需的 service_role 權限」
- PR 說明寫明：merge 不會改資料庫，migration 由 Owner 在 Supabase SQL Editor 手動執行
- 回報：PR 連結、commit hash
```
