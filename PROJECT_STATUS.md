# Idol Rhythm — 專案進度備份與交接文件

> 最後更新：2026-05-14
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
| Supabase seed 匯入 | seed data 已執行匯入 |

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

### Seed data 筆數

| 資料 | 筆數 |
|---|---|
| idols | 10 |
| events（is_published = TRUE） | 21 |
| event_sources | 21 |
| event_candidates（review_status = pending） | 3 |

### RLS

- 公開讀取：`events`（is_published + trust_level official/media）、`idols`（is_active）、`event_sources`
- 登入讀寫：`user_follows`、`saved_events`、`reminders`、`user_activity_logs`
- Admin 限定：`events` 寫入、`event_candidates` 讀寫（需 JWT custom claim `user_role = 'admin'`）

> ⚠️ Admin RLS 生效前，需先在 Supabase 設定 JWT custom claim（Hook 或 Edge Function）。

---

## 4. 目前仍是 mock / local 的部分

| 項目 | 現況 |
|---|---|
| 前台資料來源 | 仍主要讀取 `src/lib/mockIdols.ts` / `src/lib/mockEvents.ts` |
| 個人化資料 | localStorage，僅存在瀏覽器本機，重置即消失 |
| Supabase read | 尚未接入前台（schema + seed 已就緒，等待 Phase 4） |
| 使用者登入 | 尚未實作（Supabase Auth 待接入） |
| Admin 後台 | 尚未建立（`/admin/*` 頁面尚未存在） |
| AI 搜尋 / 整理 | 尚未實作 |
| 真實資料自動更新 | 尚未實作 |

---

## 5. 下一步建議順序

| Phase | 內容 | 前提 |
|---|---|---|
| **Phase 4a** | 建立 Supabase read client（`@supabase/supabase-js`） | ✅ Schema + seed 已完成 |
| **Phase 4b** | 設定 `.env.local` + Vercel env（`SUPABASE_URL` / `SUPABASE_ANON_KEY`） | Phase 4a |
| **Phase 4c** | 首頁 / 行程 / 詳情頁改讀 Supabase，移除 mock data 依賴 | Phase 4b |
| **Phase 5** | 極簡 admin 後台（`/admin/events`、`/admin/idols` CRUD） | Phase 4c + JWT claim 設定 |
| **Phase 6** | `event_candidates` review 介面（候選池 → event approve 流程） | Phase 5 |
| **Phase 6b** | `idol_candidates` 候選池（新偶像提案審核） | Phase 6 |
| **Phase 7** | AI 自動整理 / 自動更新（爬蟲 + AI 整理 → candidates） | Phase 6 完成後 |

> ⚠️ Phase 5 以後每個階段均屬高風險任務，需先經 GPT 拆解工作單確認範圍後才能執行。

---

## 6. 重要注意事項

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

## 7. 重要檔案索引

| 檔案 | 說明 |
|---|---|
| `AGENTS.md` | AI 助手工作守則（主要規範文件） |
| `CLAUDE.md` | Claude Code CLI 入口規範 |
| `SUPABASE_SCHEMA.md` | Schema 規劃草稿（tables / enums / RLS / 7 階段計畫） |
| `supabase/migrations/001_initial_schema.sql` | 正式 schema migration |
| `supabase/seed.sql` | Demo seed data（idempotent） |
| `src/lib/mockIdols.ts` | 前台暫用 mock 偶像資料 |
| `src/lib/mockEvents.ts` | 前台暫用 mock 活動資料 |
| `src/lib/appState.ts` | localStorage 個人化狀態管理 |
| `src/app/layout.tsx` | 根 layout（metadata、PWA manifest） |
| `public/manifest.json` | PWA manifest |
