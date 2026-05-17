# Idol Rhythm｜GPT × Claude Code 工作守則

> 本文件供 GPT 與 Claude Code 協作時共同遵守。
> 每次開始任務前請先確認目前工作目錄，再閱讀相關任務說明。

---

## 1. 專案邊界

本專案是：

| 項目 | 值 |
|------|-----|
| 專案名稱 | 偶像節奏 Idol Rhythm 星動時刻 |
| 本地路徑 | `~/Desktop/idol-rhythm` |
| GitHub repo | https://github.com/davidliu260-source/idol-rhythm |
| 技術 | Next.js 14 App Router + TypeScript + Tailwind CSS |
| 目前階段 | 後台主幹 + 前台會員完整；AI/爬蟲 pipeline J0–J4 已完成（手動匯入、BLACKPINK fetcher、AI 解析、去重）|

任何 Idol Rhythm 相關任務都必須在以下目錄執行：

```
~/Desktop/idol-rhythm
```

**不得在以下專案中修改 Idol Rhythm 相關內容：**

- `~/Desktop/ming-app`
- Omens / Ming 相關 repo
- 其他無關 repo

每次開始任務前，Claude Code 必須先執行 `pwd` 確認目前工作目錄。

---

## 2. 角色分工

### GPT 負責

- 產品方向與 MVP 範圍判斷
- 任務拆解與 Claude Code 工作單撰寫
- 驗收標準定義
- 回報內容檢查
- 下一步優先級排序
- 判斷哪些功能應該延後

**GPT 不直接修改 repo 檔案。**

### Claude Code 負責

- 讀取現有程式碼
- 修改任務指定的檔案
- 建立必要的新檔案
- 執行 `npm run build`
- `git add` 相關檔案（不含 `.claude/`）
- `git commit`
- `git push origin main`
- 按格式回報修改內容與結果

**Claude Code 不應自行擴大產品範圍。**

---

## 3. 任務執行原則

每次任務必須小而明確。

Claude Code 收到任務後應依序執行：

1. 確認目前目錄是 `~/Desktop/idol-rhythm`
2. 讀取相關現有檔案
3. 判斷任務影響範圍
4. 只修改任務要求的檔案
5. 不加入任務外功能或額外抽象層
6. 執行 `npm run build`
7. 只 `git add` 相關檔案（見第 7 節）
8. `git commit`
9. `git push origin main`
10. 按第 9 節格式回報

如果任務不需要修改程式碼（例如純文件任務），也必須明確回報「未修改程式碼」。

---

## 4. 禁止範圍蔓延

在未被明確要求前，**不得加入以下功能**：

- 付款 / 訂閱
- AI 搜尋 / 自動爬蟲（寫入 event_candidates 的 pipeline）
- 真實推播通知
- 社群功能（留言、按讚、轉發）
- 粉絲論壇 / 電商
- 大量圖片授權
- 官方藝人合作功能
- 多語系國際版
- 地圖模式完整版
- Apple Sign-In（需 Apple Developer $99/年，上 App Store 前再做）

**目前已實作的範圍：**

- 前台：偶像列表 / 活動時間軸 / 活動卡片 / 活動詳情 / 來源可信度 / Demo 標示
- 前台會員：Email magic link + Google OAuth + Email/Password 三種登入、登出
- 持久化（登入後 Supabase 雲端 / 未登入 localStorage fallback）：
  - 收藏活動 `saved_events`
  - 提醒活動 `reminders`
  - 追蹤偶像 `user_follows`
- 後台 admin：Events、Idols、Candidates 三線 CRUD + 發布 / 啟用 / 審核
- AI/爬蟲 pipeline（J1–J4）：
  - J1：`/admin/event-candidates/new` 手動匯入表單
  - J2：BLACKPINK 官方 tour 頁面 fetcher + Admin 手動觸發按鈕
  - J3：`/admin/event-candidates/parse` AI 解析公告（Claude Haiku）
  - J4：`source_hash` SHA-256 去重（migrations 016 + 017）

**仍需 GPT 工作單才能擴大的方向**：見 section 12 的待辦清單。

---

## 5. 資料可信度規則

前台正式頁面**只能顯示**：

- `official` / 官方確認
- `media` / 媒體確認

**不得在使用者可見頁面顯示：**

- `pending` / 待確認
- 粉絲傳聞
- 論壇截圖
- 未標來源整理文
- 社群轉傳但未確認資料

`pending` 資料在 `event_candidates` 後台候選池審核流程中流轉，admin 可在 `/admin/event-candidates` 審核並 approve 成草稿 event。**不得渲染到**首頁、行程頁、收藏頁或活動詳情頁。

技術實作上使用 `VISIBLE_TRUST_LEVELS: TrustLevel[] = ['official', 'media']`，所有查詢函式一律過濾。

---

## 6. Demo data 規則

前台優先讀 Supabase（events / idols / event_sources），失敗時 fallback 為 `src/lib/mockEvents.ts` / `mockIdols.ts`。

不論資料來源是 Supabase seed 還是 fallback mock，目前都仍是 demo 性質（非真實官方公告）。UI **必須清楚標示**：

```
⚠️ Demo 展示資料｜目前為展示資料，非真實官方行程
```

此標示需出現在：首頁頂部、行程頁頂部、活動詳情頁內容區。

**不得讓使用者誤以為資料是真實官方公告。**

資料可以使用真實藝人名稱作為展示，但不能假裝是真實公告。Demo 標示要等到接入真實官方資料來源後才能移除。

---

## 7. Git 規則

每次任務完成後必須依序執行：

```bash
npm run build
git checkout -b feature/<phase-name>
git status
git add <只加相關檔案>
git commit -m "..."
git push origin feature/<phase-name>
gh pr create --title "..." --body "..."
# 等 GPT 在 GitHub 上 audit → 確認後 merge to main
git status   # 確認成功
```

**品管流程（2026-05-17 起）**：
所有任務完成後一律開 feature branch，推送後開 PR，等 GPT 在 GitHub 審查無誤後才 merge to main。不得直接 push to main。

**不得提交：**

- `.claude/`
- `node_modules/`
- `.next/`
- 無關暫存檔
- 其他 repo 的檔案

`package-lock.json` 應該提交。

---

## 8. Commit message 規則

Commit message 必須簡短清楚，反映本次變更的核心目的。

**格式建議（已用範例）：**

```
Initialize Idol Rhythm MVP foundation
Add npm lockfile
Polish Idol Rhythm MVP demo experience
Prepare Idol Rhythm data models
Document Idol Rhythm collaboration workflow
Persist demo interactions locally
Add Supabase schema draft
Add admin event management draft
```

**不要使用模糊訊息：**

```
update / fix / changes / misc / wip
```

---

## 9. 回報格式

Claude Code 每次完成任務後，**必須回報以下所有項目**：

1. 修改檔案
2. 新增檔案
3. Build 結果
4. Commit message
5. Commit hash
6. Push 是否成功
7. 完成項目清單
8. 仍是 mock 的部分
9. 是否有任何 UI / 行為改變
10. 需要人工測試的項目
11. 下一步建議

如果 push 失敗，必須明確說明原因，**不得假裝成功**。

---

## 10. 任務失敗處理

### Build 失敗

1. **不得 commit**
2. 先修正 TypeScript / 編譯錯誤
3. 再重新執行 `npm run build`
4. Build 成功後才能 commit / push

### 遇到不確定細節

| 情境 | 處理方式 |
|------|---------|
| 不影響核心方向的小細節（命名、樣式微調） | 做合理假設並繼續，回報中說明 |
| 影響產品方向 / 資料結構 / 後端 / 安全性 / 付款 / 登入 / AI 成本的決策 | **停下來回報，等待確認後再執行** |

---

## 11. 高風險變更規則

以下任務屬於高風險，**必須先經 GPT 拆解成明確工作單後才能執行**：

- Supabase schema / migration / RLS policy
- Auth / admin 權限設定
- 真實資料來源接入
- AI 搜尋 / 爬蟲
- 推播通知
- 付款整合
- 大量重構或刪除資料
- 修改 repo 結構
- 部署設定（Vercel / CI/CD）

**不得自行開始高風險任務。**

---

## 12. 推薦工作順序

| 階段 | 內容 | 狀態 |
|------|------|------|
| 1 | MVP foundation — 頁面骨架、mock data、元件 | ✅ 完成 |
| 2 | UI polish + demo data 補強 | ✅ 完成 |
| 3 | 資料模型整理（types.ts、型別收斂） | ✅ 完成 |
| 4 | 前端互動 localStorage（收藏、追蹤持久化） | ✅ 完成 |
| 5 | Supabase schema 定義（migrations 001–010） | ✅ 完成（已全部執行） |
| 6 | Admin 後台基礎設施（登入、guard、dashboard、清單） | ✅ 完成 |
| 7 | Admin Events 管理（新增 / 編輯 / 發布 / 下架） | ✅ 完成（migrations 003–007） |
| 8 | 前台讀 Supabase（全頁接真實資料，fallback mock） | ✅ 完成 |
| 9 | Admin Idols 管理（列表 / 詳情 / 新增 / 編輯） | ✅ 完成（migrations 008–010，Phase H1–H3） |
| 10 | Admin Idols：啟用 / 停用（is_active toggle） | ✅ 完成（migration 011，Phase H4） |
| 11 | event_candidates 候選池審核（approve / reject MVP） | ✅ 完成（migration 012，Phase I） |
| 12 | 前台 Auth Milestone 1：Email magic link + 收藏持久化 | ✅ 完成（migration 013） |
| 13 | 前台 Auth Milestone 2：加入 Google OAuth 登入 | ✅ 完成（不需 migration） |
| 14 | 前台 reminders 持久化 Milestone 2 | ✅ 完成（migration 014） |
| 15 | 前台 Auth Milestone 3：Email + Password 登入 / 註冊 | ✅ 完成（不需 migration） |
| 16 | 前台 user_follows 持久化 Milestone 4 | ✅ 完成（migration 015） |
| 17 | J0：AI pipeline 設計文件 | ✅ 完成（`cf1bd6a`，`AI_PIPELINE_PLAN.md`） |
| 18 | J1：手動匯入候選表單 | ✅ 完成（`4c1baf0`，migration 016） |
| 19 | J2：BLACKPINK 官方 tour fetcher | ✅ 完成（`acf7952`） |
| 20 | J4：source_hash 去重強化 | ✅ 完成（`2c2ec1c`，migration 017） |
| 21 | J3：AI 解析公告（Claude Haiku）| ✅ 完成（`3cd09f2`，ANTHROPIC_API_KEY） |
| 22 | 個人化首頁（用 user_follows 過濾 timeline + reminders 顯示 UI 倒數區塊） | 🔲 待辦 |
| 23 | J5：Cron 自動觸發 | 🔲 待辦（需 GPT 工作單，高風險） |
| 24 | J6：多來源 fetcher 擴充 | 🔲 待辦（需 GPT 工作單） |
| 25 | 忘記密碼 / 改密碼 / 帳號設定頁 | 🔲 待辦 |
| 26 | Apple Sign-In（上 App Store 前再做）| 🔲 待辦 |

**不得跳過前面階段直接做大型系統。**

---

## 13. 人工驗收規則

每次 Claude Code 完成後，使用者應先人工確認：

- [ ] 本地頁面 `http://localhost:3000` 能否打開
- [ ] 底部導航是否正常（五個 tab active 狀態）
- [ ] 首頁五個區塊是否顯示正確
- [ ] 活動卡片資訊是否好讀
- [ ] 活動詳情頁是否能打開
- [ ] `pending` 資料是否沒有出現在前台
- [ ] Demo data 標示是否清楚顯示
- [ ] 手機版 spacing 是否正常（最大寬度 448px）

人工驗收後，再決定下一個任務。

---

## 14. 專案目前狀態紀錄

### ✅ 已完成

**前台 MVP**
- Next.js 14 + TypeScript + Tailwind CSS 專案初始化
- GitHub repo 建立並 push（`davidliu260-source/idol-rhythm`）
- 前台六頁（`/` / `/schedule` / `/idols` / `/events/[id]` / `/favorites` / `/me`）
- 底部導航（5 tab，admin 頁面自動隱藏）
- `src/lib/types.ts` — 統一型別定義（Idol / Event / TrustLevel / EventCandidate 等）
- mock idols data（10 組）、mock events data（24 筆，7 大 EventType，3 層 TrustLevel）
- 活動卡片（full + compact 兩種模式，含操作列）
- 活動詳情頁（AI 摘要 mock、票務/串流區塊）
- Demo data 標示（首頁 / 行程頁 / 詳情頁）
- 前台過濾 `pending`（只顯示 official / media）
- 首頁五區塊（今日不能錯過 / 本週重點 / 我的倒數 / 最近可看 / 最新情報）

**Supabase 基礎設施**
- `src/lib/supabase/client.ts` — 公開 anon client
- `src/lib/supabase/serverClient.ts` — Server Component 用 server client
- `src/lib/supabase/browserClient.ts` — Client Component 用 browser client
- `src/lib/supabase/events.ts` — 前台讀取：`getPublishedEvents` / `getActiveIdols` / `getEventById` / `getEventSources`
- `src/lib/supabase/adminAuth.ts` — `getCurrentAdmin()`：查 `admin_users` 驗管理員身份
- `src/lib/supabase/adminStats.ts` — `getAdminStats()`：Dashboard 統計數字
- `src/lib/supabase/auth.ts` — `getCurrentUser()`：取前台一般使用者（不是 admin）

**資料庫 Migrations（001–017）**
- `001_initial_schema.sql` — 完整表格 + RLS + 枚舉
- `002_admin_users.sql` — `admin_users` 表 + SELECT policy
- `003_admin_users_write_policy.sql` — INSERT policy（events / event_sources）+ GRANT
- `004_admin_users_read_idols_policy.sql` — idols SELECT policy（admin 讀偶像下拉）
- `005_admin_users_read_drafts_policy.sql` — events + event_sources SELECT policy（admin 讀草稿）
- `006_admin_users_publish_events_policy.sql` — events column-level GRANT UPDATE (is_published, published_at) + UPDATE policy
- `007_admin_users_edit_draft_events_policy.sql` — events content GRANT UPDATE + draft UPDATE policy；event_sources GRANT DELETE + DELETE policy
- `008_admin_users_insert_idols_policy.sql` — GRANT INSERT ON idols + INSERT policy
- `009_grant_anon_read_idols.sql` — GRANT SELECT ON idols TO anon（修正前台讀取）
- `010_admin_users_update_idols_basic_policy.sql` — idols content fields GRANT UPDATE + UPDATE policy（slug / is_active 排除）
- `011_admin_users_toggle_idol_active_policy.sql` — GRANT UPDATE (is_active) ON idols（Phase H4）✅ 已執行
- `012_admin_users_review_event_candidates_policy.sql` — event_candidates GRANT SELECT + GRANT UPDATE(review_status, reviewer_note, approved_event_id) + admin_users SELECT/UPDATE policy（Phase I）✅ 已執行
- `013_authenticated_saved_events_grants.sql` — saved_events GRANT SELECT / INSERT / DELETE TO authenticated（Milestone 1）✅ 已執行
- `014_authenticated_reminders_grants.sql` — reminders GRANT SELECT / INSERT / DELETE TO authenticated（提醒持久化）✅ 已執行
- `015_authenticated_user_follows_grants.sql` — user_follows GRANT SELECT / INSERT / DELETE TO authenticated（追蹤偶像持久化）✅ 已執行
- `016_admin_users_insert_event_candidates_policy.sql` — event_candidates GRANT INSERT + INSERT RLS policy（J1 手動匯入 + J3 AI 解析寫入）✅ 已執行
- `017_event_candidates_dedupe_fields.sql` — ADD COLUMN source_hash text + raw_data jsonb；CREATE UNIQUE INDEX WHERE source_hash IS NOT NULL（J4 去重）✅ 已執行

**Admin 後台（全功能，已完成）**
- `/admin/login` — Email 登入，session cookie
- `/admin` — Dashboard（統計數字 + auth guard + 診斷面板）
- `/admin/events` — 活動清單（含草稿 / 已發布狀態）
- `/admin/events/[id]` — 活動詳情（發布 / 下架按鈕）
- `/admin/events/new` — 新增草稿活動（INSERT events + event_sources）
- `/admin/events/[id]/edit` — 草稿編輯（UPDATE events + DELETE/INSERT sources）
- `/admin/idols` — 偶像列表（含 is_active 狀態）
- `/admin/idols/[id]` — 偶像詳情 + 啟用 / 停用按鈕 + 「編輯偶像資料」連結
- `/admin/idols/new` — 新增偶像（INSERT idols，slug 自動生成 + 格式驗證）
- `/admin/idols/[id]/edit` — 編輯偶像基本資料（slug 不可改）
- `/admin/event-candidates` — 候選活動列表（pending / approved / rejected 三組統計）+ 新增候選按鈕 + AI 解析按鈕 + CrawlerButton
- `/admin/event-candidates/[id]` — 候選詳情 + Approve（建立草稿 event）+ Reject 按鈕 + source_hash 顯示
- `/admin/event-candidates/new` — 手動匯入候選表單（J1，含偶像下拉、來源欄位、source_hash 計算）
- `/admin/event-candidates/parse` — AI 解析公告頁（J3，貼文 → AI 預覽 → 確認寫入候選池）

**AI / 爬蟲 Pipeline（J1–J4 已完成）**
- `src/lib/crawlers/sourceHash.ts` — SHA-256 source_hash 計算（URL 優先 / fallback 欄位組合）
- `src/lib/crawlers/blackpinkOfficialTour.ts` — BLACKPINK 官方 tour 頁 HTML parser（cheerio）
- `src/lib/ai/parseCandidate.ts` — Claude Haiku wrapper（slug 解析、JSON 提取、enum 驗證）
- `src/app/api/admin/crawlers/blackpink-tour/run/route.ts` — POST 手動觸發 fetcher（admin guard + 去重 + 統計回應）
- `src/app/api/admin/ai/parse-candidate/route.ts` — POST AI 解析（admin guard + 取 known_idols + 呼叫 Claude）
- `src/app/admin/event-candidates/CrawlerButton.tsx` — 觸發 BLACKPINK fetcher 的 client button
- `src/app/admin/event-candidates/parse/ParseClient.tsx` — AI 解析表單 + 預覽 + 確認寫入
- `src/app/admin/event-candidates/parse/actions.ts` — `commitAiCandidate` server action（re-validate + source_hash + redirect）

**前台（已接 Supabase，全頁 fallback mock）**
- `/`、`/schedule`、`/idols`、`/events/[id]`、`/favorites`、`/me` — 全部優先讀 Supabase，失敗時 fallback mock data

**前台會員系統（Milestone 1–4 已完成）**
- `/login` — 三種登入入口並列：
  - Google OAuth（最上方，最快路徑）
  - 「密碼」tab：Email + Password 登入 / 註冊（最小長度 8 字元）
  - 「Magic Link」tab：Email magic link 寄送
- `/auth/callback` — Route Handler，magic link / OAuth 共用，`exchangeCodeForSession` 換 cookie session
- `/me` — 兩態：未登入顯示登入提示；登入顯示 email + 登出按鈕 + 三大統計
- `/favorites` — 兩態：未登入顯示登入提示；登入讀取 Supabase `saved_events`
- `src/lib/appState.tsx` — 三個個人化資料皆為 dual-mode：
  - `favorites` (event UUID) → `saved_events`
  - `reminders` (event UUID) → `reminders`（DB 預設 type = 'day_before'）
  - `following` (idol slug，hook 內翻譯成 UUID) → `user_follows`
  - anon 模式全部 fallback 到 localStorage，登入後切換到 Supabase
- **同 email identity linking**：Supabase 預設行為，magic link / Google / password 同 email 共用同一個 auth.users row
- **Open-redirect 防護**：`/login` 和 `/auth/callback` 的 `next` 參數都拒絕外部網址與 `//` 開頭
- **未做的部分**：忘記密碼 / 改密碼 / 帳號設定頁 / Apple Sign-In

**外部服務設定（人工，已完成）**
- Supabase Auth → Providers：
  - Email：Enabled（含 magic link + password）
  - Google：Enabled，Client ID/Secret 已貼
- Supabase Auth → URL Configuration：
  - Site URL：`https://idol-rhythm.vercel.app`
  - Redirect URLs：vercel domain + `http://localhost:3000/auth/callback`
- Google Cloud（idol-rhythm-496505 project）：
  - OAuth Consent Screen：External / Testing
  - OAuth Client (Web)：Authorized redirect URI = Supabase callback
  - Test users：手動加入
- **Confirm Email 設定**：依需求調整（開發階段可關閉以加速測試；正式上線前建議開啟）

### 🔲 待實作

- 個人化首頁（用 user_follows 過濾 timeline、reminders 顯示 UI 倒數）
- 忘記密碼 / 改密碼 / 帳號設定頁 / provider 管理 UI
- J5：Cron 自動觸發 fetcher（需 GPT 工作單 + CRON_SECRET）
- J6：多來源 fetcher 擴充（第二、三來源）
- Apple Sign-In（要 Apple Developer $99/年，上 App Store 前再考慮）
- Google OAuth 從 Testing 切到 Production（要對外開放給陌生使用者時再做）
- Supabase Email 改用 custom SMTP（Resend）以避開內建 rate limit

### ❌ 明確不規劃（已評估後決定不做）

- **真實 email / push / cron 提醒發送**：UI 倒數提醒已能涵蓋核心需求；外部通知需 cron + 付費 SMTP + 模板 + 重試邏輯，工作量是 UI 提醒的 5–10 倍，使用者開啟率低，CP 值不足。`reminders` 表保留 `is_sent` 欄位作為未來預留，但本階段不實作 dispatch 邏輯。

### ⚠️ 環境設定

- `.env.local`：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`ANTHROPIC_API_KEY` ✅
- Vercel env：Supabase keys ✅；`ANTHROPIC_API_KEY`（Production + Preview）✅；`ANTHROPIC_MODEL`（可選，預設 claude-haiku-4-5-20251001）
- Supabase admin 帳號：已建立，已加入 `admin_users` ✅
- Supabase Auth Google Provider：Enabled，Client ID/Secret 已設定 ✅
- Supabase Auth Email Provider：Enabled（含 magic link + password）✅
- Supabase Auth URL Configuration：Site URL + Redirect URLs（vercel + localhost）✅
- Google Cloud OAuth Client：已建立，redirect URI 指向 Supabase callback ✅
- Google Cloud Test users：已加入測試帳號 ✅
- migrations 001–015：全部已執行 ✅
- migration 016（event_candidates INSERT policy）：✅ 已執行
- migration 017（source_hash + raw_data 欄位）：✅ 已執行

---

## 15. 目錄結構參考

```
src/
├── app/
│   ├── layout.tsx                        # Root layout（含 BottomNav）
│   ├── page.tsx                          # 首頁 /（5 個區塊）
│   ├── error.tsx / global-error.tsx / not-found.tsx
│   ├── schedule/page.tsx                 # 行程時間軸 /schedule
│   ├── idols/
│   │   ├── page.tsx                      # 偶像列表（Supabase + fallback mock）
│   │   └── IdolsClient.tsx               # 搜尋 / 追蹤互動（'use client'）
│   ├── events/[id]/page.tsx              # 活動詳情 /events/:id
│   ├── favorites/
│   │   ├── page.tsx
│   │   └── FavoritesClient.tsx           # 收藏頁（兩態：未登入提示 / 已登入讀 Supabase）
│   ├── me/
│   │   ├── page.tsx
│   │   └── MeClient.tsx                  # 個人頁（兩態：未登入提示 / 已登入 email + 登出）
│   ├── login/
│   │   ├── page.tsx                      # 登入頁（Server Component，sanitize next param）
│   │   └── LoginForm.tsx                 # 登入表單（Google 按鈕 + Email magic link）
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                  # Magic link / OAuth callback，exchangeCodeForSession
│   └── admin/
│       ├── page.tsx                      # Dashboard /admin（auth guard + 診斷）
│       ├── login/
│       │   ├── page.tsx
│       │   └── LoginForm.tsx             # 登入表單（'use client'，cookie session）
│       ├── events/
│       │   ├── page.tsx                  # 活動清單
│       │   ├── [id]/
│       │   │   ├── page.tsx              # 活動詳情（發布 / 下架按鈕）
│       │   │   ├── actions.ts            # publishEvent / unpublishEvent
│       │   │   └── edit/
│       │   │       ├── page.tsx          # 草稿編輯（admin guard + 預填）
│       │   │       ├── EditEventForm.tsx # 草稿編輯表單（'use client'）
│       │   │       └── actions.ts        # updateDraftEvent
│       │   └── new/
│       │       ├── page.tsx
│       │       ├── NewEventForm.tsx      # 新增草稿表單（'use client'）
│       │       └── actions.ts            # createEvent
│       ├── idols/
│       │   ├── page.tsx                  # 偶像列表（含 is_active 狀態）
│       │   ├── [id]/
│       │   │   ├── page.tsx              # 偶像詳情 + 啟用/停用 + 編輯連結
│       │   │   ├── actions.ts            # activateIdol / deactivateIdol（Phase H4）
│       │   │   └── edit/
│       │   │       ├── page.tsx          # 偶像編輯（admin guard + 預填）
│       │   │       ├── EditIdolForm.tsx  # 偶像編輯表單（slug disabled）
│       │   │       └── actions.ts        # updateIdol
│       │   └── new/
│       │       ├── page.tsx
│       │       ├── NewIdolForm.tsx       # 新增偶像表單（slug 自動生成）
│       │       └── actions.ts            # createIdol
│       └── event-candidates/
│           ├── page.tsx                  # 候選列表（pending 優先排序 + 三組統計 + AI解析 + CrawlerButton）
│           ├── CrawlerButton.tsx         # BLACKPINK fetcher 觸發按鈕（'use client'）
│           ├── [id]/
│           │   ├── page.tsx              # 候選詳情 + Approve / Reject 按鈕 + source_hash
│           │   └── actions.ts            # approveCandidate / rejectCandidate（Phase I）
│           ├── new/
│           │   ├── page.tsx              # 手動匯入表單頁（J1）
│           │   ├── NewCandidateForm.tsx  # 手動匯入表單（'use client'）
│           │   └── actions.ts            # createCandidate（source_hash + raw_data）
│           └── parse/
│               ├── page.tsx              # AI 解析公告頁（J3，admin guard）
│               ├── ParseClient.tsx       # 解析表單 + 預覽 + 確認寫入（'use client'）
│               └── actions.ts            # commitAiCandidate（re-validate + redirect）
├── components/
│   ├── BottomNav.tsx                     # 底部導航（admin 路由自動隱藏）
│   ├── EventCard.tsx                     # 活動卡片（full / compact）
│   ├── EventDetailActions.tsx
│   ├── EventTypeBadge.tsx
│   ├── HomePersonalized.tsx
│   └── SourceBadge.tsx
└── lib/
    ├── types.ts                          # 所有核心型別
    ├── appState.tsx                      # 應用狀態：user / favorites / reminders / following 三個雙模式 controller
    ├── mockIdols.ts / mockEvents.ts      # Fallback mock 資料
    ├── supabase/
    │   ├── client.ts                     # 公開 anon client
    │   ├── serverClient.ts               # Server Component cookie client
    │   ├── browserClient.ts              # Client Component cookie client
    │   ├── events.ts                     # 前台讀取函式（published + trusted only）
    │   ├── auth.ts                       # getCurrentUser()（前台使用者，Milestone 1）
    │   ├── adminAuth.ts                  # getCurrentAdmin()
    │   └── adminStats.ts                 # getAdminStats()
    ├── crawlers/
    │   ├── sourceHash.ts                 # SHA-256 source_hash（URL 優先 / fallback 組合）
    │   └── blackpinkOfficialTour.ts      # BLACKPINK 官方 tour 頁 HTML parser（cheerio）
    └── ai/
        └── parseCandidate.ts             # Claude Haiku wrapper（slug 解析、JSON 提取、enum 驗證）

supabase/
├── migrations/
│   ├── 001_initial_schema.sql            # 完整表格、枚舉、RLS
│   ├── 002_admin_users.sql               # admin_users 表
│   ├── 003_admin_users_write_policy.sql  # events + event_sources INSERT
│   ├── 004_admin_users_read_idols_policy.sql
│   ├── 005_admin_users_read_drafts_policy.sql
│   ├── 006_admin_users_publish_events_policy.sql
│   ├── 007_admin_users_edit_draft_events_policy.sql
│   ├── 008_admin_users_insert_idols_policy.sql
│   ├── 009_grant_anon_read_idols.sql
│   ├── 010_admin_users_update_idols_basic_policy.sql
│   ├── 011_admin_users_toggle_idol_active_policy.sql       # Phase H4：is_active GRANT ✅
│   ├── 012_admin_users_review_event_candidates_policy.sql  # Phase I：candidates GRANT + policies ✅
│   ├── 013_authenticated_saved_events_grants.sql           # Milestone 1：補 saved_events GRANT ✅
│   ├── 014_authenticated_reminders_grants.sql              # Milestone 2 reminders：補 reminders GRANT ✅
│   ├── 015_authenticated_user_follows_grants.sql           # Milestone 4：補 user_follows GRANT ✅
│   ├── 016_admin_users_insert_event_candidates_policy.sql  # J1/J3：candidates INSERT policy ⚠️ 待確認
│   └── 017_event_candidates_dedupe_fields.sql              # J4：source_hash + raw_data + unique index ⚠️ 待確認
└── seed.sql                              # 種子資料（已執行，含 3 筆 pending candidates）
```

---

## 16. 型別概覽（Phase 3 整理後）

```ts
// src/lib/types.ts

type EventType = 'concert' | 'ticketing' | 'livestream' | 'streaming' | 'media' | 'brand' | 'official'
type EventSubType = 'fanmeet' | 'fansign' | 'musicshow' | 'variety' | 'interview' | 'award' | 'release' | 'announcement' | 'magazine'
type EventStatus = 'confirmed' | 'tentative' | 'cancelled' | 'postponed'
type TrustLevel = 'official' | 'media' | 'pending'
type SourceType = 'official_sns' | 'official_website' | 'media_outlet' | 'fan_account' | 'community' | 'unknown'

interface EventSource { level: TrustLevel; label: string; url?: string; type?: SourceType }

interface Event {
  id: string; idolId: string; idolName: string
  title: string; type: EventType; subType?: EventSubType; status: EventStatus
  date: string; time?: string; location?: string; country: string; countryFlag: string
  source: EventSource; description: string; isFavorited: boolean
  ticketUrl?: string; streamUrl?: string; tags: string[]
}
```

---

## 17. 設計規範

### 色彩 Token（tailwind.config.ts）

| Token | 色碼 | 說明 |
|-------|------|------|
| `bg` | `#08080f` | 主底色 |
| `card` | `#0f0f1e` | 卡片底 |
| `card-border` | `#1e1e36` | 邊框 |
| `primary` | `#e91e8c` | 主色（熱粉）|
| `primary-dim` | `rgba(233,30,140,0.15)` | 主色半透明 |
| `violet` | `#8b5cf6` | 輔色 |
| `text-base` | `#f0f0ff` | 主文字 |
| `muted` | `#6b6b9a` | 次文字 |

### 元件慣例

- 卡片：`rounded-2xl border border-card-border bg-card`
- 主色按鈕：`bg-primary text-white rounded-xl`
- 次要按鈕：`border border-card-border bg-transparent text-muted`
- 底部安全距離：頁面加 `pb-24`
- 最大寬度：`max-w-md`（448px）mobile-first

### Server / Client Component

- 預設 Server Component（無 `'use client'`）
- 需要 `useState` / `usePathname` 的元件才加 `'use client'`
- 目前需要 client：`BottomNav`、`idols/page.tsx`、`EventCard`

---

## 18. 本地開發

```bash
cd ~/Desktop/idol-rhythm
npm install
npm run dev      # http://localhost:3000
npm run build    # 生產版本 build（每次 commit 前必須通過）
```
