# Idol Rhythm — 專案進度備份與交接文件

> 最後更新：2026-05-15
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
| CLAUDE.md 強化 | 整合 AGENTS.md 核心規範 + Karpathy 編碼原則 |

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
- Admin 限定：`events` 寫入、`event_candidates` 讀寫（需 JWT custom claim `user_role = 'admin'`）

> ⚠️ Admin RLS 生效前，需先在 Supabase 設定 JWT custom claim（Hook 或 Edge Function）。

---

## 4. 前台讀 Supabase 進度

| 頁面 | 資料來源 | 說明 |
|---|---|---|
| `/schedule` 行程頁 | ✅ Supabase（fallback mock） | `getPublishedEvents()`，dynamic rendering |
| `/idols` 偶像頁 | ✅ Supabase（fallback mock） | `getActiveIdols()`，Server + IdolsClient 拆分 |
| `/events/[id]` 詳情頁 | ✅ Supabase（fallback mock） | `getEventById()`，支援 UUID + ev-XXX 雙格式 |
| `/` 首頁 | ✅ Supabase（fallback mock） | `Promise.all` 並行，HomePersonalized 改 props |
| `/favorites` 收藏頁 | ✅ Supabase（fallback mock） | `getPublishedEvents()`，Server + FavoritesClient 拆分 |
| `/me` 個人頁 | ⏳ localStorage | 純本機，需登入後才考慮接 Supabase |

### Supabase read functions（src/lib/supabase/events.ts）

| 函式 | 說明 | 使用頁面 |
|---|---|---|
| `getPublishedEvents()` | 讀 events（is_published + trust_level 過濾）+ JOIN idols + event_sources | `/schedule`、`/`、`/favorites` |
| `getActiveIdols()` | 讀 idols（is_active = true） | `/idols`、`/` |
| `getEventById(id)` | 讀單筆 event（同上過濾）+ JOIN | `/events/[id]` |
| `getEventSources(eventId)` | 讀特定 event 的所有來源 | 備用（詳情頁目前未獨立呼叫） |

> 所有函式在 env 未設定或查詢失敗時均安全回傳空陣列 / null，不影響 build 與靜態頁面。

---

## 5. 目前仍是 mock / local 的部分

| 項目 | 現況 |
|---|---|
| mock 資料 | 仍保留 `mockEvents.ts` / `mockIdols.ts` 作為所有頁面的 fallback |
| 個人化資料 | localStorage，僅存在瀏覽器本機，重置即消失 |
| `/me` 個人頁 | localStorage only，尚未接 Supabase |
| 使用者登入 | 尚未實作（Supabase Auth 待接入） |
| Admin 後台 | 尚未建立（`/admin/*` 頁面尚未存在） |
| AI 搜尋 / 整理 | 尚未實作 |
| 真實資料自動更新 | 尚未實作 |

---

## 6. 下一步方向（優先順序）

> 所有前台頁面已接 Supabase，mock fallback 仍保留。

| 優先 | 目標 | 說明 |
|---|---|---|
| **第一** | 真實 seed 資料補充 | 補足更多 events（尤其台灣本地活動）讓 Demo 更真實 |
| **第二** | Supabase Auth 接入 | 讓 localStorage 狀態可雲端同步（user_follows / saved_events / reminders） |
| **第三** | Admin 後台 | 事件候選池審核介面（高風險任務，需 GPT 工作單） |
| **之後** | AI 搜尋 / 爬蟲 / 推播 | 需架構設計後才執行 |

---

## 7. 重要 commit 紀錄

| Commit | 說明 |
|---|---|
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
| Admin 角色設定 | `auth.jwt() ->> 'user_role' = 'admin'` 需在 Supabase Auth Hook 設定，未設定前 admin RLS 全部不通過 |

---

## 9. 重要檔案索引

| 檔案 | 說明 |
|---|---|
| `AGENTS.md` | AI 助手工作守則（主要規範文件） |
| `CLAUDE.md` | Claude Code CLI 入口規範 |
| `SUPABASE_SCHEMA.md` | Schema 規劃草稿（tables / enums / RLS / 7 階段計畫） |
| `supabase/migrations/001_initial_schema.sql` | 正式 schema migration |
| `supabase/seed.sql` | Demo seed data（idempotent） |
| `src/lib/supabase/client.ts` | Supabase client 工廠（env 缺失時回傳 null） |
| `src/lib/supabase/events.ts` | 4 個唯讀查詢函式 + row 轉換邏輯 |
| `src/lib/mockIdols.ts` | 前台 fallback mock 偶像資料 |
| `src/lib/mockEvents.ts` | 前台 fallback mock 活動資料 |
| `src/lib/appState.ts` | localStorage 個人化狀態管理 |
| `src/app/schedule/page.tsx` | 行程頁（已接 Supabase，dynamic） |
| `src/app/idols/page.tsx` | 偶像頁 Server Component（已接 Supabase） |
| `src/app/idols/IdolsClient.tsx` | 偶像頁 Client Component（搜尋 / 追蹤互動） |
| `src/app/events/[id]/page.tsx` | 詳情頁（已接 Supabase，支援 UUID + ev-XXX） |
| `src/app/favorites/page.tsx` | 收藏頁 Server Component（已接 Supabase） |
| `src/app/favorites/FavoritesClient.tsx` | 收藏頁 Client Component（localStorage favorites / reminders） |
| `src/components/HomePersonalized.tsx` | 首頁個人化（接受 events + idols props，hydration 安全） |
| `src/app/layout.tsx` | 根 layout（metadata、PWA manifest） |
| `public/manifest.json` | PWA manifest |
| `.env.example` | 環境變數範例（不含任何 key） |
