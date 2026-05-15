# Idol Rhythm — 專案進度備份與交接文件

> 最後更新：2026-05-15（Phase F 發布 / 下架流程完成）
> 本文件紀錄目前 Idol Rhythm 的完成進度、Supabase 狀態與下一步建議。

---

## 1. 專案基本資訊

| 項目 | 內容 |
|---|---|
| 專案名稱 | Idol Rhythm / 星動時刻 |
| GitHub | https://github.com/davidliu260-source/idol-rhythm |
| Vercel URL | https://idol-rhythm.vercel.app |
| Supabase project | idol-rhythm |
| Supabase region | ap-southeast-2（Sydney） |
| 技術棧 | Next.js 14 App Router + TypeScript + Tailwind CSS + Supabase |

---

## 2. 目前已完成

| 項目 | 說明 |
|---|---|
| MVP 前台頁面 | 首頁、行程頁、偶像頁、詳情頁、個人頁、收藏頁 |
| UI polish | 暗色主題、Tailwind 客製色彩、Trust Badge、倒數顯示 |
| Demo data 標示 | 前台所有 mock 資料已標示「示範資料」提示 |
| localStorage 個人化 | 追蹤偶像、收藏活動、設定提醒，儲存於瀏覽器本機 |
| Vercel 部署 | 已部署，`npm run build` 全通過 |
| AGENTS.md | Claude / AI 助手工作守則（任務範圍、高風險任務流程） |
| CLAUDE.md | Claude Code CLI 入口規範（工作前後 checklist） |
| SUPABASE_SCHEMA.md | 10 張 tables、10 個 enum、RLS 草稿、7 階段接入計畫 |
| `supabase/migrations/001_initial_schema.sql` | 完整 schema migration（已硬化，含 RLS 21 條 policy） |
| `supabase/seed.sql` | 10 idols + 21 events + 21 event_sources + 3 event_candidates |
| Supabase tables 建立 | 10 張 tables 已在 Supabase 建立完成 |
| Supabase seed 匯入 | seed data 已執行匯入，資料已確認 |
| Supabase env 設定 | .env.local + Vercel env 均已設定（URL + anon key） |
| Supabase read client | `src/lib/supabase/client.ts` + `src/lib/supabase/events.ts` 已建立 |
| /schedule 接 Supabase | 行程頁優先讀 Supabase，fallback mock，已設為 dynamic rendering |
| /idols 接 Supabase | 偶像頁拆 Server Component + IdolsClient，`getActiveIdols()` fallback MOCK_IDOLS |
| /events/[id] 接 Supabase | 詳情頁支援 UUID 與 ev-XXX 雙格式，`getEventById()` fallback mock |
| / 首頁接 Supabase | async Server Component，Promise.all 並行抓 events + idols，HomePersonalized 改為 props |
| /favorites 接 Supabase | 拆 Server Component + FavoritesClient，`getPublishedEvents()` fallback mock，localStorage 保留 |
| /me 接 Supabase | 拆 Server Component + MeClient，`Promise.all` 並行抓 idols + events，統計數字改為動態 |
| dev:clean 指令 | `package.json` 新增清除 .next 快取後重啟的指令，解決本地 CSS 掉光問題 |
| CLAUDE.md 強化 | 整合 AGENTS.md 核心規範 + Karpathy 編碼原則 |
| `@supabase/ssr` 套件 | 新增 `^0.10.3`，提供 `createBrowserClient` / `createServerClient` cookie-based session 支援 |
| Admin auth library | `browserClient.ts`（cookie-based，SignIn 用）、`serverClient.ts`（Server Component 讀 session）、`adminAuth.ts`（getCurrentAdmin + 診斷）、`adminStats.ts`（4 個只讀計數） |
| `supabase/migrations/002_admin_users.sql` | admin_users table + GRANT SELECT to authenticated + RLS self-read policy |
| `ADMIN_ROADMAP.md` | 分階段 Admin 後台開發路線圖 |
| `ADMIN_WRITE_PLAN.md` | Admin 寫入計畫（Method B：admin_users table 方案） |
| `/admin` Dashboard | 只讀概覽 + Auth 診斷面板（DiagRow）+ 管理員驗證 banner |
| `/admin/login` | Email + password 登入頁，使用 `createBrowserClient` 儲存 session 至 cookie |
| `/admin/events` | 後台活動列表，管理員可見「新增草稿活動」按鈕 |
| `/admin/events/[id]` | 後台活動詳情只讀預覽（trust badge、來源、票務連結等） |
| `/admin/events/new` | 草稿新增表單，**閉環已完成並人工驗收** |
| BottomNav 隱藏 | `/admin/*` 所有路由均隱藏前台底部導覽列 |
| Admin session 修正 | 修正 localStorage vs cookie session 不互通問題，確認 Server Component 能讀取登入狀態 |
| Admin GRANT 修正 | 補上 `GRANT SELECT ON TABLE admin_users TO authenticated`，解決 PostgreSQL 42501 permission denied |
| `supabase/migrations/003_admin_users_write_policy.sql` | events + event_sources 的 INSERT policy（admin_users-based）+ GRANT INSERT |
| `supabase/migrations/004_admin_users_read_idols_policy.sql` | idols 的 SELECT policy（admin_users-based）+ GRANT SELECT，修正偶像下拉 42501 |
| `supabase/migrations/005_admin_users_read_drafts_policy.sql` | events + event_sources 的 SELECT policy（admin_users-based）+ GRANT SELECT，讓 admin 可讀草稿 |
| Admin events/new 偶像選單修正 | `getIdolsForForm()` 加入 error 捕捉，空值 / 錯誤時頁面顯示紅色提示而非 silent fail |
| Admin events/new tags 修正 | 空白 tags 改傳 `[]` 而非 `null`，修正 `[23502] not-null constraint` 錯誤 |
| Admin events/[id] 草稿讀取修正 | 改用 `getAdminEvent()`（server client，不加 is_published filter），讓詳情頁可讀草稿 |
| 後台新增草稿活動閉環 | admin 登入 → 填表 → INSERT events（is_published=false）→ INSERT event_sources → redirect /admin/events/[id] → 讀取草稿詳情，全流程人工驗收通過 |
| `supabase/migrations/006_admin_users_publish_events_policy.sql` | events 的 UPDATE policy（admin_users-based，USING + WITH CHECK）+ column-level GRANT UPDATE (is_published, published_at, updated_at) |
| `/admin/events/[id]/actions.ts` | Server Actions：`publishEvent` / `unpublishEvent`，雙重防線（getCurrentAdmin + RLS），revalidatePath 涵蓋前後台 |
| Admin 發布 / 下架流程（Phase F） | Admin 在 `/admin/events/[id]` 可一鍵發布（is_published=true, published_at=now）或下架（is_published=false, published_at=null），前台即時反映 |

---

## 3. Supabase 目前狀態

### Tables（10 張）

| Table | 說明 |
|---|---|
| `idols` | 偶像資料，含 slug、色彩、分類 |
| `events` | 活動資料，含 trust_level、is_published |
| `event_sources` | 活動來源，一事件可多來源 |
| `user_follows` | 使用者追蹤偶像（需登入） |
| `saved_events` | 使用者收藏活動（需登入） |
| `reminders` | 使用者活動提醒（需登入） |
| `event_candidates` | AI / 爬蟲候選池，等待 admin 審核 |
| `event_clicks` | 活動點擊紀錄（匿名可寫） |
| `source_clicks` | 來源點擊紀錄（匿名可寫） |
| `user_activity_logs` | 使用者行為紀錄（需登入） |

### Seed data 筆數（已確認匯入）

| 資料 | 筆數 | 說明 |
|---|---|---|
| idols | 10 | 全部 is_active = TRUE |
| events | 21 | 全部 is_published = TRUE，trust_level = official / media |
| event_sources | 21 | 一對一對應每筆 event |
| event_candidates | 3 | review_status = pending，不顯示於前台 |

> ✅ pending 候選資料僅存在 `event_candidates`，前台 RLS 與 query filter 均排除。

### Env 設定狀態

| 環境 | NEXT_PUBLIC_SUPABASE_URL | NEXT_PUBLIC_SUPABASE_ANON_KEY |
|---|---|---|
| 本地 `.env.local` | ✅ 已設定 | ✅ 已設定 |
| Vercel（idol-rhythm project） | ✅ 已設定 | ✅ 已設定 |

> ⚠️ `.env.local` 不可提交版控。service role key / secret key 絕對不可進版控或貼入任何程式碼。

### RLS

- 公開讀取：`events`（is_published + trust_level official/media）、`idols`（is_active）、`event_sources`
- 登入讀寫：`user_follows`、`saved_events`、`reminders`、`user_activity_logs`
- Admin 身份：`admin_users` table（`user_id` + `is_active = true`），不依賴 JWT custom claim
- Admin 讀取 idols：migration 004（`GRANT SELECT + "idols: admin_users select"` policy）
- Admin 讀取 events / event_sources（含草稿）：migration 005（`GRANT SELECT + admin_users select` policies）
- Admin 寫入 events / event_sources：migration 003（`GRANT INSERT + admin_users insert` policies）

> ✅ migrations 003、004、005 均已執行，後台新增草稿活動閉環已完成並人工驗收。

### Admin 認證狀態

| 項目 | 狀態 |
|---|---|
| `admin_users` table | ✅ 已建立（migration 002 已執行） |
| `GRANT SELECT` to authenticated | ✅ 已補上（解決 42501 錯誤） |
| Admin session cookie | ✅ 已修正（使用 `createBrowserClient`） |
| Admin guard（getCurrentAdmin） | ✅ 已建立，Server Component 可讀取登入狀態 |
| Admin write RLS（migration 003） | ✅ 已執行，events + event_sources INSERT 可寫入 |
| Admin read idols RLS（migration 004） | ✅ 已執行，偶像下拉選單正常 |
| Admin read drafts RLS（migration 005） | ✅ 已執行，/admin/events/[id] 可讀草稿 |
| 後台新增草稿活動閉環 | ✅ 人工驗收通過（2026-05-15） |
| Admin update events RLS（migration 006） | ⏳ 程式碼已推送，待人工在 Supabase SQL Editor 執行 |
| Admin 發布 / 下架流程（Phase F） | ✅ 程式碼完成（`cf4049a`），待 migration 006 執行後人工驗收 |

---

## 4. 前台讀 Supabase 進度

| 頁面 | 資料來源 | 說明 |
|---|---|---|
| `/schedule` 行程頁 | ✅ Supabase（fallback mock） | `getPublishedEvents()`，dynamic rendering |
| `/idols` 偶像頁 | ✅ Supabase（fallback mock） | `getActiveIdols()`，Server + IdolsClient 拆分 |
| `/events/[id]` 詳情頁 | ✅ Supabase（fallback mock） | `getEventById()`，支援 UUID + ev-XXX 雙格式 |
| `/` 首頁 | ✅ Supabase（fallback mock） | `Promise.all` 並行，HomePersonalized 改 props |
| `/favorites` 收藏頁 | ✅ Supabase（fallback mock） | `getPublishedEvents()`，Server + FavoritesClient 拆分 |
| `/me` 個人頁 | ✅ Supabase（fallback mock） | `Promise.all` 並行抓 idols + events，MeClient 處理 localStorage 統計 |

### Supabase read functions（src/lib/supabase/events.ts）

| 函式 | 說明 | 使用頁面 |
|---|---|---|
| `getPublishedEvents()` | 讀 events（is_published + trust_level 過濾）+ JOIN idols + event_sources | `/schedule`、`/`、`/favorites`、`/me` |
| `getActiveIdols()` | 讀 idols（is_active = true） | `/idols`、`/`、`/me` |
| `getEventById(id)` | 讀單筆 event（同上過濾）+ JOIN | `/events/[id]` |
| `getEventSources(eventId)` | 讀特定 event 的所有來源 | 備用（詳情頁目前未獨立呼叫） |

> 所有函式在 env 未設定或查詢失敗時均安全回傳空陣列 / null，不影響 build 與靜態頁面。

---

## 5. 目前仍是 mock / local 的部分

| 項目 | 現況 |
|---|---|
| mock 資料 | 仍保留 `mockEvents.ts` / `mockIdols.ts` 作為所有頁面的 fallback |
| 個人化資料 | localStorage，僅存在瀏覽器本機，重置即消失（following / favorites / reminders） |
| 使用者登入 | 尚未實作（Supabase Auth 待接入，前台非 admin 使用者登入流程尚未建立） |
| Admin 發布 / 下架草稿 | ✅ Phase F 完成（`cf4049a`）；migration 006 待人工執行 |
| Admin 編輯草稿 | 尚未實作（Phase G：edit form + UPDATE policy，需獨立工作單） |
| Admin 刪除草稿 | 禁止實作（需獨立工作單 + GPT 審查） |
| AI 搜尋 / 整理 | 尚未實作 |
| 真實資料自動更新 | 尚未實作 |

---

## 6. 下一步方向（優先順序）

> ✅ 所有前台頁面均已接 Supabase，mock fallback 完整保留。
> ✅ Admin 後台完成：Dashboard、登入、列表、詳情、新增表單、發布 / 下架流程。
> ✅ migrations 003、004、005 均已執行；migration 006 程式碼已推送，待人工執行。

| 優先 | 目標 | 說明 |
|---|---|---|
| **⏳ 待完成** | 執行 migration 006 + 驗收 Phase F | 在 Supabase SQL Editor 執行後，人工測試發布 / 下架流程 |
| **第一** | 草稿編輯（Phase G） | `/admin/events/[id]/edit`，修改已建立草稿（需獨立工作單 + UPDATE policy） |
| **第二** | 真實 seed 資料補充 | 補足更多 events（尤其台灣本地活動）讓 Demo 更真實 |
| **第三** | 前台 Supabase Auth 接入 | 讓 localStorage 狀態可雲端同步（user_follows / saved_events / reminders） |
| **之後** | AI 搜尋 / 爬蟲 / 推播 | 需架構設計後才執行 |

> ⛔ 明確禁止（未被工作單授權前不得實作）：完整 CRUD、草稿刪除、批量操作、event_candidates approve/reject、AI auto-publish。

### 本地開發 CSS 問題

Next.js 14 App Router 在長時間使用或切換 branch 後，`.next` 快取可能失效，導致 Tailwind 樣式完全消失。

| 情境 | 指令 |
|---|---|
| 日常開發 | `npm run dev` |
| CSS 掉光 / pull 新 code 後 / 切換 branch 後 | `npm run dev:clean` |

---

## 7. 重要 commit 紀錄

| Commit | 說明 |
|---|---|
| `cf4049a` | Add admin publish/unpublish controls for events（Phase F：migration 006 + Server Actions + UI） |
| `070edc6` | Polish admin event detail page with draft info（草稿詳情頁完整資訊，Reviewer 審查通過） |
| `cb43a76` | Fix admin event detail page reading draft events（getAdminEvent，不加 is_published filter） |
| `8fbfd30` | Fix tags null constraint in admin event form（空 tags 改傳 `[]`） |
| `3b0a37a` | Add admin users read draft policies（migration 005，events + event_sources SELECT） |
| `0313095` | Add admin users read idols policy（migration 004，idols SELECT，修正偶像下拉 42501） |
| `f30156e` | Fix admin event idol selector（getIdolsForForm 加入 error 捕捉） |
| `c9acaf4` | Add admin users insert policies（migration 003，events + event_sources INSERT） |
| `b6ada6b` | Add admin draft event form（/admin/events/new 完整新增表單） |
| 以上為後台草稿閉環里程碑 | — |
| `61c5ac7` | Update PROJECT_STATUS.md: all pages on Supabase, dev:clean note |
| `7184732` | Improve local dev CSS reliability（dev:clean 指令） |
| `47436e9` | Read profile stats from Supabase |
| `7a86edf` | Update PROJECT_STATUS.md to reflect current Supabase integration |
| `814b12f` | Read favorites events from Supabase |
| `ab2446c` | Read homepage data from Supabase |
| `9b4d54a` | Read event detail from Supabase |
| `35108e3` | Read idols page from Supabase with mock fallback |
| `ba70f2e` | Consolidate core rules into CLAUDE.md from AGENTS.md |
| `4e8d1da` | Apply Karpathy coding principles to CLAUDE.md |
| `7fc4d11` | Read schedule events from Supabase |
| `56ea725` | Add Supabase read client foundation |
| `152a71d` | Document current Idol Rhythm project status |
| `04fc900` | Fix Supabase seed data quality |
| `9ed7115` | Add Supabase seed data |
| `7eb0f93` | Harden initial Supabase schema migration |

---

## 8. 重要注意事項

| 規則 | 說明 |
|---|---|
| 不要混到 ming-app | 工作前確認 `pwd` 是 `~/Desktop/idol-rhythm` |
| 不要提交 `.claude/` | git add 只加本輪相關檔案 |
| 不要貼 API key | `.env.local` 不得進入版控；service role key 只能用於後端 / Edge Function |
| 高風險任務 | 涉及 schema 變更、刪除資料、大幅架構調整時，需先等 GPT 工作單 |
| 前台資料可見性 | 前台只能顯示 `trust_level = official / media` 且 `is_published = TRUE` 的活動 |
| pending 資料隔離 | `trust_level = pending` 的資料只能進 `event_candidates` 候選池，不得直接進 `events` |
| Admin 角色設定 | 使用 `admin_users` table（Method B），不依賴 JWT custom claim |
| Admin write RLS | migrations 003–005 已執行：INSERT（003）、idols SELECT（004）、draft SELECT（005）均完成；migration 006（UPDATE）程式碼已推送，待人工執行 |
| Admin 禁止項目 | 完整 CRUD、草稿刪除、批量操作、event_candidates approve、AI auto-publish 均禁止，需獨立工作單才可實作 |

---

## 9. 重要檔案索引

| 檔案 | 說明 |
|---|---|
| `AGENTS.md` | AI 助手工作守則（主要規範文件） |
| `CLAUDE.md` | Claude Code CLI 入口規範 |
| `ADMIN_ROADMAP.md` | Admin 後台分階段開發路線圖 |
| `ADMIN_WRITE_PLAN.md` | Admin 寫入計畫（Method B：admin_users table） |
| `SUPABASE_SCHEMA.md` | Schema 規劃草稿（tables / enums / RLS / 7 階段計畫） |
| `supabase/migrations/001_initial_schema.sql` | 正式 schema migration（已執行） |
| `supabase/migrations/002_admin_users.sql` | admin_users table + GRANT + RLS（已執行） |
| `supabase/migrations/003_admin_users_write_policy.sql` | events + event_sources INSERT policy（已執行） |
| `supabase/migrations/004_admin_users_read_idols_policy.sql` | idols SELECT policy（已執行） |
| `supabase/migrations/005_admin_users_read_drafts_policy.sql` | events + event_sources SELECT policy（已執行） |
| `supabase/migrations/006_admin_users_publish_events_policy.sql` | events UPDATE policy + column-level GRANT（⏳ 待人工執行） |
| `supabase/seed.sql` | Demo seed data（idempotent） |
| `src/lib/supabase/client.ts` | Supabase client 工廠（localStorage-based，前台唯讀用） |
| `src/lib/supabase/browserClient.ts` | cookie-based browser client（`createBrowserClient`，admin 登入 / 寫入用） |
| `src/lib/supabase/serverClient.ts` | cookie-based server client（`createServerClient`，Server Component 讀 session） |
| `src/lib/supabase/adminAuth.ts` | `getCurrentAdmin()` — 驗證 admin 身份 + 診斷資訊 |
| `src/lib/supabase/adminStats.ts` | 4 個只讀 count 查詢（idols、events、upcoming、candidates） |
| `src/lib/supabase/events.ts` | 4 個唯讀查詢函式 + row 轉換邏輯 |
| `src/lib/mockIdols.ts` | 前台 fallback mock 偶像資料 |
| `src/lib/mockEvents.ts` | 前台 fallback mock 活動資料 |
| `src/lib/appState.ts` | localStorage 個人化狀態管理 |
| `src/app/admin/page.tsx` | Admin Dashboard（只讀 + auth guard + 診斷面板） |
| `src/app/admin/login/page.tsx` | 管理員登入頁（Server wrapper） |
| `src/app/admin/login/LoginForm.tsx` | 登入表單（`createBrowserClient`，cookie session） |
| `src/app/admin/events/page.tsx` | 後台活動列表（isAdmin 顯示新增按鈕） |
| `src/app/admin/events/[id]/page.tsx` | 後台活動詳情：Admin 見發布 / 下架按鈕，非 admin 見只讀 banner |
| `src/app/admin/events/[id]/actions.ts` | Server Actions：publishEvent / unpublishEvent（getCurrentAdmin 雙重防線） |
| `src/app/admin/events/new/page.tsx` | 新增草稿活動頁（isAdmin guard） |
| `src/app/admin/events/new/NewEventForm.tsx` | 新增草稿活動表單（待 migration 003 解 RLS） |
| `src/app/schedule/page.tsx` | 行程頁（已接 Supabase，dynamic） |
| `src/app/idols/page.tsx` | 偶像頁 Server Component（已接 Supabase） |
| `src/app/idols/IdolsClient.tsx` | 偶像頁 Client Component（搜尋 / 追蹤互動） |
| `src/app/events/[id]/page.tsx` | 詳情頁（已接 Supabase，支援 UUID + ev-XXX） |
| `src/app/favorites/page.tsx` | 收藏頁 Server Component（已接 Supabase） |
| `src/app/favorites/FavoritesClient.tsx` | 收藏頁 Client Component（localStorage favorites / reminders） |
| `src/app/me/page.tsx` | 個人頁 Server Component（已接 Supabase） |
| `src/app/me/MeClient.tsx` | 個人頁 Client Component（localStorage 統計 + 追蹤偶像列表） |
| `src/components/HomePersonalized.tsx` | 首頁個人化（接受 events + idols props，hydration 安全） |
| `src/components/BottomNav.tsx` | 前台底部導覽（/admin/* 路由自動隱藏） |
| `src/app/layout.tsx` | 根 layout（metadata、PWA manifest） |
| `public/manifest.json` | PWA manifest |
| `.env.example` | 環境變數範例（不含任何 key） |
