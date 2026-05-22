# Notification Data Model Work Order (N2)

> Scope: 規劃 v1 通知系統的資料模型與 migration 草案。
>
> Status: work order only. 本文件**不執行 migration、不寫 runtime / server helper、不改 UI、不接 push runtime、不改現有 `reminders` 行為**。
>
> Depends on: `NOTIFICATION_SYSTEM_WORK_ORDER.md`（N1，已 merged via PR #111）
>
> Created: 2026-05-22

---

## 為何要先做這個

N1 已定義產品邊界（reminder vs notification、首頁鈴鐺 / `/me` / 未來 `/notifications` 分工、v1 只支援兩類通知）。
要往下實作，第一步必須把 schema 釘死，再開 migration PR、再寫 query helper、最後接 UI。

本工作單目的：
- 把 v1 通知系統的資料模型與 read state 規則具體寫清楚
- 提供 migration 草案 SQL 給 review，但**不放進 `supabase/migrations/`**，等本文件 approved 後再開 migration PR
- 為下一輪 PR（query helper + 鈴鐺 unread count）提供可預期的查詢介面

---

## 本輪不做

- ❌ 執行 migration（草案 SQL 只在本文件，不進 `supabase/migrations/`）
- ❌ 寫 query helper / server action
- ❌ 改 `/me` 或鈴鐺 UI
- ❌ 改 `/api/cron/sync-candidates` 或任何 runtime
- ❌ 改現有 `reminders` schema / RLS / 行為
- ❌ 任何 push runtime / APNs / FCM / email
- ❌ 自動翻譯 / AI 生成通知文案

---

## v1 範圍回顧（來自 N1）

v1 通知系統只支援兩種來源：

| type | 觸發條件 | 唯一性原則 |
|---|---|---|
| `event_reminder` | 使用者對某 event 設過 reminder，且活動在 24 小時內開始 | 每個 (user, event) 只能有一則 |
| `followed_idol_new_event` | 使用者追蹤的 idol 出現新的 `is_published=true` 活動 | 每個 (user, event) 只能有一則 |

未來 v2 才會擴充其他類型（票務開賣、活動內容異動、來源公告摘要等）。

---

## 建議資料表：`notifications`

```sql
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null,           -- 'event_reminder' | 'followed_idol_new_event'
  event_id      uuid references public.events(id) on delete cascade,
  idol_id       uuid references public.idols(id)  on delete set null,
  title         text not null,
  body          text,
  payload       jsonb not null default '{}'::jsonb,
  dedupe_key    text not null,           -- 見「dedupe 規則」
  read_at       timestamptz,             -- null = 未讀
  delivered_at  timestamptz not null default now(),  -- 進入 inbox 的時間
  created_at    timestamptz not null default now(),
  constraint notifications_type_check
    check (type in ('event_reminder', 'followed_idol_new_event'))
);
```

### 欄位設計理由

- **`user_id`** ON DELETE CASCADE：刪帳號時連 notifications 一起清。
- **`type`** 用 `text + check constraint`，**不開 enum**：未來新增 type 不需要 ALTER TYPE，加 check 即可；migration 風險低。
- **`event_id`** 可空：保留未來「非活動類通知」彈性（例如系統公告）。v1 兩種 type 都會帶 event_id，不會違反 NOT NULL 邏輯，但 schema 不限制以保留擴充空間。
- **`idol_id`** ON DELETE SET NULL：偶像被停用 / 刪除（雖然目前流程沒刪）時，通知本身仍留下，只是 idol 連結消失。
- **`title` / `body`**：先存純文字。中文文案由 server-side 派送邏輯生成（v3+），v2 先用 fallback 模板。
- **`payload`**：jsonb，存型別專屬的補充資料（例如未來「票務開賣」要帶 ticket URL）。v1 兩種 type 暫不需要，但欄位先留好避免之後 ALTER TABLE。
- **`dedupe_key`**：見下方專節。
- **`read_at`**：null = 未讀。**刻意不用 boolean** — timestamp 同時記錄「何時被讀過」，可用於未來「已讀超過 N 天自動歸檔」。
- **`delivered_at`**：通知進入 inbox 的時間，與 `created_at` 同值（v1 沒有延遲投遞），但保留欄位讓 v2 排程派送（例如「活動前 24 小時才投遞」）能填正確 timestamp。
- **`created_at`**：DB 寫入時間（debug / 追蹤用，與 delivered_at 之後可能拆開）。

---

## Dedupe 規則

### 目標
同一通知**最多只進 inbox 一次**，避免：
- 同一 event 重複跑 reminder cron 時連續產生多則
- followed_idol fan-out 同一 event 對同一 user 重複觸發

### 規則

`dedupe_key` 由 server 派送邏輯生成（v1 兩種 type 都用同樣公式）：

```
dedupe_key = type || ':' || event_id
```

範例：
- `event_reminder:2c1b...uuid`
- `followed_idol_new_event:2c1b...uuid`

### 唯一索引

```sql
create unique index notifications_user_dedupe_uidx
  on public.notifications (user_id, dedupe_key);
```

派送邏輯使用 `INSERT ... ON CONFLICT (user_id, dedupe_key) DO NOTHING`，重跑 cron 不會產生重複。

**注意：** v2 如果加入「同一活動的票務開賣 + 活動提醒」這種不同 channel 的通知，type 不同 → dedupe_key 不同 → 可共存，不需要改 schema。

---

## Read state 模型

| 狀態 | 條件 |
|---|---|
| 未讀 | `read_at IS NULL` |
| 已讀 | `read_at IS NOT NULL` |

### 操作
- **標已讀單則**：`UPDATE notifications SET read_at = now() WHERE id = ? AND user_id = auth.uid() AND read_at IS NULL`
- **全部已讀**：`UPDATE notifications SET read_at = now() WHERE user_id = auth.uid() AND read_at IS NULL`
- **刪除**：v1 不提供刪除 API。已讀的通知留在 DB；之後可加 cron 清 30+ 天舊已讀通知（v2 再決定）。

### Unread count 查詢
```sql
select count(*)
  from notifications
 where user_id = auth.uid()
   and read_at is null;
```

預期效能：見下方 index 設計。

---

## Index 建議

```sql
-- 1. 列表頁主索引：使用者倒序看通知
create index notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

-- 2. unread count 加速：partial index 只含未讀
create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- 3. dedupe 唯一索引（前面已列）
create unique index notifications_user_dedupe_uidx
  on public.notifications (user_id, dedupe_key);
```

`partial index` 對未讀計數很重要 — 已讀資料量會慢慢長大，但 unread set 通常很小（< 50 筆），partial index 永遠快。

---

## RLS / GRANT 草案

```sql
alter table public.notifications enable row level security;

-- 使用者只能讀自己的通知
create policy "notifications_own_select"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

-- 使用者只能更新自己的通知（標已讀用）
-- 限制只能改 read_at 欄位 → 透過 column-level GRANT 控制
create policy "notifications_own_update"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 沒有 INSERT / DELETE policy — client 不可直接寫入或刪除
-- 派送由 service_role 在 server-side 寫入

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
```

### 設計理由
- **Client 只能讀自己的 + 標已讀**：寫入完全由 server-side 派送邏輯（service_role）負責，避免任何「偽造別人通知」風險。
- **Column-level GRANT 限制 client 只能改 `read_at`**：即使 client 帶 `read_at = null` 又夾帶其他欄位（如 title）也會被擋。
- **沒有 client INSERT**：v1 不允許「使用者自己建一則通知」這種行為。

---

## 與 `reminders` 表的關係

兩個表**完全獨立**，互不寫入對方。

| 表 | 語意 | 由誰寫 | 由誰讀 |
|---|---|---|---|
| `reminders` | 使用者偏好（我想被提醒這個活動）| Client（已存在）| Server-side 派送邏輯（讀來決定要不要送 event_reminder 通知）|
| `notifications` | 已派送的通知 inbox | Server-side（service_role）| Client（讀自己的 + 標已讀）|

派送邏輯（**v3 才實作**）會：
1. 找 24 小時內開始 + 使用者有 reminder 的活動 → 對應 user 派送 `event_reminder`
2. 找 user 追蹤的 idol 的新 `is_published=true` 活動 → 派送 `followed_idol_new_event`

寫入時用 `INSERT ... ON CONFLICT DO NOTHING`，dedupe_key 保證不重複。

---

## 未在本工作單範圍

以下項目 v1 不做，但**特別點出來避免未來誤動**：

| 項目 | 為什麼 v1 不做 |
|---|---|
| `notification_preferences` 表 | v1 通知類型只有 2 種，全部使用者預設都收。v2 加類型 / 加 per-user toggle 時再建表。 |
| Push token 表 | v1 沒接 native push。等真的要做 PWA / app 時再建。 |
| Ban list / mute / snooze | v2+。 |
| 通知分類 tabs 的後端支援 | v1 type 就兩種，UI 不需要 server-side 分類查詢。 |
| 匿名使用者本地通知 | 已在 N1 確認 v1 不承諾匿名通知。 |
| 翻譯 / AI 文案生成 | v3 派送階段才討論；v1/v2 用伺服器端固定模板生成 title / body。 |

---

## 對前台 / 後台目前 UI 的影響

**不影響。** 本工作單只規劃資料模型；UI 改動由後續 N3+ PR 處理：
- 首頁鈴鐺目前讀 `reminders.length` → 待 N4 改讀 `notifications` unread count
- `/me` 目前 UI shell → 待 N4 加入「最近通知 / 前往通知頁」入口
- `/notifications` 頁面 → N5 才建立

---

## 草案 SQL（reference only，不放 `supabase/migrations/`）

如下完整 SQL 放在本工作單供 review 使用。本輪**不會**寫進 `supabase/migrations/`。
等本工作單 approved 後，下一個 PR 才會：
1. 把這段 SQL 拆成正式 migration 檔（編號從 `042` 開始，依當時最新狀況決定）
2. 加 migration 標頭註解（用途、依賴、可回滾性等）
3. 等使用者手動到 Supabase SQL Editor 執行

```sql
-- ============================================================
-- notifications table for in-app notification inbox (v1)
-- ============================================================

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null,
  event_id      uuid references public.events(id) on delete cascade,
  idol_id       uuid references public.idols(id)  on delete set null,
  title         text not null,
  body          text,
  payload       jsonb not null default '{}'::jsonb,
  dedupe_key    text not null,
  read_at       timestamptz,
  delivered_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint notifications_type_check
    check (type in ('event_reminder', 'followed_idol_new_event'))
);

-- Indexes
create index notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

create unique index notifications_user_dedupe_uidx
  on public.notifications (user_id, dedupe_key);

-- RLS
alter table public.notifications enable row level security;

create policy "notifications_own_select"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications_own_update"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- GRANT
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
```

---

## 開放問題（給 GPT review 確認）

1. **`type` 用 text+check vs enum**：本工作單選 text+check（擴充友善）。是否認可？
2. **`dedupe_key` 公式 `type:event_id` 是否夠用**：v1 兩種 type 都只對應一個 event。若 v2 出現「非 event-bound」通知（如系統公告）需另定義 key 公式，但本工作單先不處理。
3. **`delivered_at` 預設 `now()`**：v1 派送是即時的，所以 = `created_at`。是否值得保留欄位？建議保留，未來 v2 排程派送時 `delivered_at` 才會 > `created_at`。
4. **是否需要 `archived_at`**：v1 沒提供刪除 / 封存功能，目前不加。已讀通知保留即可，未來 v2 加自動清理 cron 時再考慮 archived_at 還是真刪。
5. **追蹤偶像通知的時機點**：建議在「活動進 `events` 表並 `is_published = true`」之後派送，而不是進 `event_candidates` 階段。確認方向。
6. **追蹤偶像通知的回追範圍**：使用者「今天才追蹤某偶像」時，是否要追溯該偶像過去 N 天內的新發布活動？v1 建議不追溯（只通知未來新建的活動），但 GPT 可裁定。

---

## 建議下一步 PR 順序

| PR | 內容 | 是否需 GPT review |
|---|---|---|
| **N2（本 PR）** | 資料模型工作單 + 草案 SQL | ✅ |
| N3 | 正式 migration 檔（042 或之後）+ 使用者手動執行 SQL | 不需（純執行 N2 approved 後的 SQL）|
| N4 | server-side query helper（unread count / list / mark read）+ 首頁鈴鐺接 unread count + `/me` 加通知入口 | 不需（純 UI / query）|
| N5 | `/notifications` 頁面（list + mark-all-read + 分類 tabs）| 不需 |
| N6 | 派送機制 — `event_reminder` cron job（24 小時前掃 reminders + 寫 notifications）| ✅（cron / 派送節奏需 review）|
| N7 | 派送機制 — `followed_idol_new_event`（接在發布成功的 server action 後派送）| ✅ |

---

## 結論

本工作單把 v1 通知系統的資料模型釘到 SQL 等級，並把 RLS / GRANT / index / dedupe 規則列清楚。

GPT review 通過後，N3 直接照本文件「草案 SQL」段落寫成正式 migration 檔即可，schema 不應再有大改。

若有任何 schema 層面的 review 意見，請在本 PR 提出，避免 N3 migration 反覆改動。
