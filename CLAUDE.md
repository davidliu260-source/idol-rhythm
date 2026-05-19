# Idol Rhythm — Claude Code / Codex 工作規範

> **適用對象：Claude Code CLI、Codex、任何 AI coding agent。**
> 本文件是唯一維護中的規範與索引，其他 MD 檔案為輔助參考。

---

## 專案資訊

| 項目 | 值 |
|---|---|
| 專案名稱 | Idol Rhythm / 星動時刻 |
| 本地路徑 | `~/Desktop/idol-rhythm` |
| GitHub | `davidliu260-source/idol-rhythm` |
| 技術棧 | Next.js 14 App Router + TypeScript + Tailwind CSS + Supabase |
| 目前階段 | S1 / C1 / I1a / I1b-A / J7d-A / 忘記密碼 / M1a / admin 刪除草稿 / M1b 第一批 + 第二批（51 個主流 K-pop 藝人）/ trust_level 單一真相 / Supabase SSR middleware / 後台 4 頁 filter tabs + 搜尋 pilot / 後台 idols「缺資料」tab / I1b-B AI 搜圖（Wikimedia + 可重搜）/ I1b-C avatar 來源紀錄 + 多色 placeholder / 前台 polish 6 改動（filter 軸 / 查看全部 / 連結待補 / 收藏搜尋 / chip scroll / 偶像詳情頁）完成。下一步建議：J7d-B（resolve 按鈕）、M2 跨來源去重、47 帳號設定、或站內通知系統 |
| 輔助參考 | `ADMIN_ROADMAP.md`（後台分階段開發路線）、`AI_PIPELINE_PLAN.md`（爬蟲架構設計文件）|

---

## 每次任務前

1. 確認 `pwd` 是 `~/Desktop/idol-rhythm`，避免在錯誤目錄操作
2. **先確認邊界再動手**：任務有歧義時，先回報疑問點，等確認後才實作
3. 只做任務明確要求的事，不猜測未來需求、不預先抽象、不順手重構
4. **不得修改** ming-app、Omens 或任何非 idol-rhythm 專案
5. **更新任何 MD 索引時，CLAUDE.md 必須同步更新**（AGENTS.md 已廢棄，不需維護）

---

## 資料可見性規則（每次都要遵守）

前台正式頁面**只能顯示** `trust_level = official` 或 `media` 的資料。

- `pending` 資料只能進 `event_candidates` 候選池，**不得渲染到任何使用者可見頁面**
- 所有 Supabase query 必須 filter `is_published = true` + `trust_level IN ('official', 'media')`
- UI 必須在首頁、行程頁、詳情頁顯示 Demo data 標示（`⚠️ Demo 展示資料`）

---

## 禁止自行加入的功能

未被明確要求前，**不得加入**：

- 使用者登入 / 會員系統（已完成的部分除外）
- 付款 / 訂閱
- 真實推播通知
- 社群功能（留言、按讚）
- 後台管理介面（除非任務明確指定）
- 多語系 / 地圖完整版

---

## 高風險任務

以下任務**必須先等 GPT 工作單確認後才能執行**：

- Supabase schema / migration / RLS 變更
- Auth / admin 權限設定
- 真實資料來源接入
- AI / 爬蟲 / 推播
- 付款整合
- 大量重構或刪除資料
- 部署設定（Vercel / CI/CD）

---

## 每次任務後

1. 執行 `npm run build`，**build 失敗不得 commit**，先修正再重 build
2. `git add` 只加本輪相關檔案，**不得提交**：`.claude/`、`node_modules/`、`.next/`、`.env.local`、其他 repo 的檔案
3. `package-lock.json` 應該提交
4. Commit message 簡短清楚，反映變更核心目的；禁止 `update / fix / changes / wip`
5. **開 feature branch + PR（品管流程）**：
   ```bash
   git checkout -b feature/<phase-name>
   git add <相關檔案>
   git commit -m "簡短說明本輪變更目的"
   git push origin feature/<phase-name>
   gh pr create \
     --base main \
     --head feature/<phase-name> \
     --title "<phase-name>: 簡短說明" \
     --body "$(cat <<'EOF'
   ## 本輪變更
   - <bullet>

   ## 測試方式
   - <bullet>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```
   指令執行完成後，終端機會輸出 PR 網址，將此連結回報給使用者，等 GPT 在 GitHub 上 audit 確認無誤後再 merge to main。
6. 回報（必填）：修改檔案、build 結果、feature branch 名稱、commit hash、**PR 連結**

---

## 遇到不確定時

| 情境 | 處理方式 |
|---|---|
| 命名、樣式微調等小細節 | 做合理假設並繼續，回報中說明 |
| 影響資料結構 / 產品方向 / 安全性 / 付款 / 登入 的決策 | **停下來，等確認後再執行** |
| Build 失敗 | 修正錯誤，重新 build，不得 commit 失敗版本 |

---

## 編碼原則（Karpathy）

- **Simplicity First**：只實作本輪明確要求的功能，不加「備用」邏輯
- **Surgical Changes**：只動必要的檔案與行數，保持現有風格與 pattern
- **Goal-Driven**：每輪以可驗證的成功條件為目標（build 通過、畫面正確、commit hash），達到即停止

---

## 偵錯與重大修改原則（從實戰學到）

- **Read before write**：改 bug 前先讀完相關流程的所有檔案 + 註解，特別注意 `TODO` / `later phase` / `to be added` 字樣 — 那很可能就是答案
  - 反例：PR #49 / #50 / #51 三輪都在症狀治療，因為沒先讀 `serverClient.ts` 註解；註解早寫了「Session refresh happens via middleware (to be added in a later phase)」，PR #52 才補上 middleware，才是根因
- **修了 2 次還沒中就停下重讀**：不要連開 3 個症狀治療 PR；第二次修錯時主動承認假設可能有問題，重新讀整個流程
- **完成 ≠ 結束**：build pass、commit、push 都不等於實際運作。Silent-hang（Promise 不 resolve 也不 reject）、catch 沒命中、async finally 沒跑 都算未完成。預設懷疑「表面平靜」
- **長 session 主動 checkpoint**：累積 5+ PRs 時主動整理一次成果盤點；換主題前先 summary，避免後面迷路

---

## K-pop 資料 / 來源搜尋原則

idol-rhythm 的資料品質直接決定爬蟲匹配率與前台正確性。搜尋藝人活動 / 公司歸屬 / 來源網站時必須遵守：

- **單藝人一次搜一個**：禁止 bundled query（"A B C latest activity"）— 大新聞會被稀釋成「找不到」。每個藝人獨立查詢。
  - 反例：第一次搜「2PM SF9 ONEUS MONSTA X latest 2025 2026」回報 2PM 沒新動作，實際上 2PM 2026 有兩個 dome 級巡演（Tokyo Dome + Inspire Arena Incheon）。
- **「沒搜到 ≠ 不活躍」**：英文搜尋空手而回時，**改用韓文關鍵字再搜一次**（如 `투피엠 콘서트 2025`、`컴백`、`완전체 활동`）。韓文媒體通常比英文早且完整。
- **新出道團 / 改公司 / 解約消息**至少查兩個獨立來源確認（Wikipedia + 韓文新聞 / 官方公告），不靠單一聚合站。
  - 反例：CORTIS 第一次盤點漏掉（2025/8 出道，HYBE/BigHit 第三團，破百萬銷量）。
- **預設「都收」勝過「我來判斷該停用誰」**：is_active 預設為 true。dormant 偶像在 kpopofficial 聚合來源命中後若加上「偶像目前停用」reviewer_note 之類的機制再說（目前未實作；之前討論過的選項 B）。**不要靠我手動判斷活躍度去 UPDATE is_active**。

---

## 接手須知（給下一個 session 的 Claude）

進來新工作時，**先讀本檔**，然後：

1. **找出使用者要做哪個代號**（例如 I1b-B、M1a、J7d-B）— 從進度索引找狀態 🔒 / 🔲 的項目
2. **若是 🔒「待 GPT 工作單」**：使用者會貼 GPT review 結論給你，再開實作 PR
3. **若是 🔲「待辦」且不涉 migration / Storage / RLS**：可直接開 feature branch 實作
4. **若是 🔲 但涉及 migration / Storage / RLS / AI / 爬蟲 / 付款**：先寫工作單草案 PR，等使用者拿給 GPT review

**工作流程：**
- 每個任務：`git fetch origin main && git checkout -b feature/<phase> origin/main`
- 寫 code → `npm run build` 必過 → `git add` 只加本任務檔案 → commit → push → `gh pr create`
- 涉及 migration：SQL 檔放 `supabase/migrations/`，使用者手動到 Supabase SQL Editor 執行
- PR merge ≠ migration 已執行；migration 要使用者再去 Supabase 跑

**Worktree 注意：** 本 repo 開 worktree 在 `.claude/worktrees/<name>`，無法直接 `git checkout main`。改用 `git fetch origin main && git checkout -b <new-branch> origin/main`。

---

## 已完成進度索引

| # | 階段 | 說明 | 狀態 |
|---|---|---|---|
| 1 | MVP foundation | 頁面骨架、mock data、元件 | ✅ |
| 2 | UI polish | demo data 補強、暗色主題 | ✅ |
| 3 | 資料模型 | types.ts、型別收斂 | ✅ |
| 4 | localStorage 個人化 | 收藏、追蹤、提醒持久化 | ✅ |
| 5 | Supabase schema | migrations 001–010 | ✅ |
| 6 | Admin 後台基礎 | 登入、guard、dashboard | ✅ |
| 7 | Admin Events 管理 | 新增 / 編輯 / 發布 / 下架（migrations 003–007）| ✅ |
| 8 | 前台接 Supabase | 全頁 fallback mock | ✅ |
| 9 | Admin Idols 管理 | H1–H3（migrations 008–010）| ✅ |
| 10 | is_active toggle | Phase H4（migration 011）| ✅ |
| 11 | Candidates 審核 | Approve / Reject（migration 012）| ✅ |
| 12 | Auth Milestone 1 | Email magic link + saved_events（migration 013）| ✅ |
| 13 | Auth Milestone 2 | Google OAuth | ✅ |
| 14 | Auth Milestone 3 | Email + Password 登入 / 註冊 | ✅ |
| 15 | Auth Milestone 4 | user_follows 持久化（migration 015）| ✅ |
| 16 | J0 | AI pipeline 設計文件 | ✅ |
| 17 | J1 | 手動匯入候選表單（migration 016）| ✅ |
| 18 | J2 | BLACKPINK 官方 tour fetcher | ✅ |
| 19 | J4 | source_hash 去重（migration 017）| ✅ |
| 20 | J3 | AI 解析公告（Claude Haiku）| ✅ |
| 21 | J5 | Vercel Cron dry-run 觸發 | ✅ |
| 22 | J5b | Cron 安全寫入 event_candidates（migration 018）| ✅ |
| 23 | J6a | crawler_sources table + admin UI（migration 019）| ✅ |
| 24 | J6b | crawler_sources RLS + Blackpink 整合（migration 020）| ✅ |
| 25 | J6c→J6d | JYP 平台化 fetcher jyp_schedule（migrations 021/022）| ✅ |
| 26 | J6e | Cron fan-out 跨所有 active sources | ✅ |
| 27 | J6f | 12 個月視窗 + 過去日期過濾 | ✅ |
| 28 | J7a | Stray Kids 種子（migration 023，PR #16）| ✅ migration 已執行 |
| 29 | J7b | 批量審核 UI（approve / reject）| ✅ PR #17 merged |
| 30 | J7e | 批量發布 + trust_level 切換 | ✅ PR #18 merged |
| 31 | J7c | 過期候選清理 | ✅ PR #19 merged |
| 32 | 個人化首頁 | user_follows 過濾 timeline + 倒數 UI | ✅ 早期完成（PR #8 `42e0d42`）|
| 33 | S1 | 行程篩選器修正：真實偶像資料 + 篩選功能正常 | ✅ PR #21 merged |
| 34 | C1 | 個人行事曆：月曆視圖 + 登入後收藏活動整合 | ✅ PR #22 merged（含 #23–#26 連續修補：EventCard Link 重構、stopPropagation、mock UUID 防護）|
| 35 | Remove mock fallback | 前台不再 fallback mock，純 Supabase 資料 | ✅ PR #27 merged |
| 36 | I1a | 藝人頭像基礎：migration 025 加 avatar_url + 後台手動 URL + IdolAvatar 元件 + 前台 5 處替換（/idols、首頁追蹤 strip、首頁倒數卡、EventCard compact/full、/me 追蹤、/events/[id] hero — 詳情頁補在 PR #38）| ✅ PR #31 + #38 merged |
| 37 | J7d-A | 候選內容變更偵測：migration 026 加 content_hash + needs_recheck，fetcher 偵測 + 標旗（不動 review_status / approved_event_id / raw 欄位），後台 badge | ✅ PR #34 merged |
| 38 | I1b-A | 藝人頭像 Storage 手動上傳：migration 027 建 public bucket idol-avatars + RLS、後台檔案上傳 server action、EditIdolForm 上傳 UI（保留手動 URL 逃生口）| ✅ PR #36 merged |
| 39 | 忘記密碼 | /forgot-password + /reset-password 兩頁 + LoginForm 加連結；走 Supabase resetPasswordForEmail + updateUser；無 migration | ✅ PR #37 merged |
| 40 | I1b-B | 後台 AI 搜圖（Wikimedia 第一版，admin 必選一張）+ 可編輯關鍵字再搜 + sharp 512x512 webp 縮圖 | ✅ PR #63 + #64 merged（不接 Google CSE，純 Wikimedia 無 key）|
| 41 | J7d-B | resolve 按鈕（admin 清 needs_recheck）+ 需重審篩選 tab + approved event 自動同步策略 | 🔲 待辦（J7d-A 跑一段時間累積實況後決定；後台「需重審」tab 已在 PR #54 鋪好顯示路徑）|
| 42 | M1a | 多藝人聚合爬蟲框架（kpopofficial.com）：A 加 idols.alt_names、B idolMatcher + parser/fetcher、C seed crawler_sources + 接 cron fan-out | ✅ PR #40 + #41 + #42 merged（migrations 028 + 029 已執行）|
| 42.5 | admin 刪除草稿 | /admin/events 工具列加批量刪除草稿按鈕（migration 030 GRANT DELETE + RLS）| ✅ PR #43 merged（migration 030 已執行）|
| 43 | M1b 第一批 | JYP 系 5 個團（ITZY/NMIXX/DAY6/Xdinary Heroes/2PM）+ 1 個 solo（J.Y. Park）+ JYP schedule 來源；只需 migrations 031/032 | ✅ PR #45 + #46 merged（migrations 031 + 032 已執行）|
| 43.5 | trust_level 單一真相 | 修「設官方+發布」後前台仍顯示「待確認」的 bug；rowToEvent 改用 events.trust_level，event_sources.level backfill | ✅ PR #47 merged（migration 033 已執行）|
| 43.6 | Supabase SSR middleware | 補上 src/middleware.ts 自動 refresh session cookies；修 /me /favorites 卡載入 / 顯示未登入；前置三輪嘗試（PR #49/#50/#51）都是症狀治療 | ✅ PR #52 merged（無 migration）|
| 43.7 | 後台 4 頁 filter tabs + 搜尋 pilot | /admin/events、/admin/idols、/admin/event-candidates、/admin/sources 加入 tabs（含 counts）+ 搜尋框 + 空狀態提示；不動審核 / 發布 / 詳情邏輯 | ✅ PR #48 + #53 + #54 + #55 merged（無 migration）|
| 44 | M1b 第二批 | 主流 K-pop 51 個（HYBE / SM / YG / Starship / KQ / WAKEONE / S2 / THEBLACKLABEL / F&F / Modhaus / Cube / FNC / WM / RBW + SM/YG 經典團）；公司歸屬照 2026/05 校正（fromis_9/AKMU/Kep1er/BIBI 修正）；含 035 HYBE 前綴正規化 | ✅ PR #58 + #59 + #60 merged（migrations 034 + 035 + 036 已執行）|
| 45 | 補新藝人 UI | 51+ 個藝人需補 avatar / 描述 / 主色；後台「缺資料」filter tab 已就緒，AI 搜圖能加速處理 | 🔲 持續中（人工處理）|
| 45.5 | 後台 idols「缺資料」filter tab | tab 顯示 avatar/description 任一缺漏的藝人，琥珀色提示 + 卡片內「缺頭像/缺描述」徽章 | ✅ PR #62 merged |
| 45.6 | I1b-C avatar 來源紀錄 + 安全 placeholder | migration 037 加 5 個 avatar_source_* 欄位；三種上傳路徑（手動上傳 / AI 搜圖 / 手動 URL）自動寫 provider；IdolAvatar 改用 name-hash 12 色 fallback（修「前台頭像全部同色」）| ✅ PR #65 merged（migration 037 已執行）|
| 45.7 | 前台 polish 批 | F1 /idols filter 軸改公司分 / F2 首頁 section「查看全部 N 場」/ F3 /events/[id] 連結待補 placeholder / F4 /favorites 加搜尋 / F-scroll /schedule 藝人 chip 滾動指示 | ✅ PR #66 merged（無 migration）|
| 45.8 | F5 /idols/[slug] 偶像詳情頁 | 前台公開偶像詳情：hero（avatar/agency/idol.color 漸層）+ meta + 描述 + 即將/已結束活動列表 + 追蹤按鈕；停用偶像 404 隱私保護 | ✅ PR #67 merged（無 migration）|
| 46 | M2 | 跨來源活動去重（event_key soft-hash，同演唱會多來源合併）| 🔲 待辦（當實際有跨來源重複發生再做）|
| 47 | 帳號設定 | 改 email、刪除帳號、2FA | 🔲 待辦 |
| 48 | M3 | Custom SMTP / Resend（上線前避免 rate limit）| 🔲 待辦 |
| 49 | Apple Sign-In | 上 App Store 前再做 | 🔲 待辦 |
| 50 | 站內通知系統 | 鈴鐺 + 通知列表頁 + 通知設定 toggle，整合 /me 通知設定 + 未來 PWA / native push | 🔲 待辦（替代 email 寄送）|

---

## Migration 索引

| Migration | 說明 | 狀態 |
|---|---|---|
| 001 | 完整 schema（tables + enums + RLS 21 條）| ✅ 已執行 |
| 002 | admin_users table + GRANT + self-read policy | ✅ 已執行 |
| 003 | events + event_sources INSERT policy | ✅ 已執行 |
| 004 | idols SELECT policy（admin 讀偶像下拉）| ✅ 已執行 |
| 005 | events + event_sources SELECT policy（admin 讀草稿）| ✅ 已執行 |
| 006 | events column-level GRANT UPDATE (is_published, published_at) + UPDATE policy | ✅ 已執行 |
| 007 | events content GRANT UPDATE + draft UPDATE；event_sources GRANT DELETE | ✅ 已執行 |
| 008 | GRANT INSERT ON idols + INSERT policy | ✅ 已執行 |
| 009 | GRANT SELECT ON idols TO anon（修正前台讀取）| ✅ 已執行 |
| 010 | idols content fields GRANT UPDATE + UPDATE policy | ✅ 已執行 |
| 011 | GRANT UPDATE (is_active) ON idols（Phase H4）| ✅ 已執行 |
| 012 | event_candidates GRANT SELECT/UPDATE + admin SELECT/UPDATE policy | ✅ 已執行 |
| 013 | saved_events GRANT SELECT/INSERT/DELETE TO authenticated | ✅ 已執行 |
| 014 | reminders GRANT SELECT/INSERT/DELETE TO authenticated | ✅ 已執行 |
| 015 | user_follows GRANT SELECT/INSERT/DELETE TO authenticated | ✅ 已執行 |
| 016 | event_candidates GRANT INSERT + INSERT RLS policy | ✅ 已執行 |
| 017 | ADD COLUMN source_hash + raw_data；unique index（J4）| ✅ 已執行 |
| 018 | GRANT SELECT/INSERT/UPDATE ON event_candidates TO service_role（J5b）| ✅ 已執行 |
| 019 | crawler_sources table（J6a）| ✅ 已執行 |
| 020 | crawler_sources RLS + service_role GRANT（J6b）| ✅ 已執行 |
| 021 | Seed TWICE idol + JYP schedule source（J6c）| ✅ 已執行 |
| 022 | ADD COLUMN config jsonb；TWICE → parser_type='jyp_schedule'（J6d）| ✅ 已執行 |
| 023 | Seed Stray Kids idol + JYP schedule source（J7a）| ✅ 已執行 |
| 024 | GRANT SELECT ON events + event_sources TO anon（修復前台 0 筆活動）| ✅ 已執行 |
| 025 | ADD COLUMN idols.avatar_url + GRANT UPDATE（I1a）| ✅ 已執行 |
| 026 | ADD COLUMN event_candidates.content_hash + needs_recheck + 部分索引 + GRANT UPDATE（J7d-A）| ✅ 已執行 |
| 027 | Storage bucket idol-avatars + 4 條 RLS policy（I1b-A，public read、admin write）| ✅ 已執行 |
| 028 | ADD COLUMN idols.alt_names text[] + GRANT UPDATE（M1a-A，聚合爬蟲名稱匹配）| ✅ 已執行 |
| 029 | Seed crawler_sources for kpopofficial-concerts（M1a-C）| ✅ 已執行 |
| 030 | GRANT DELETE ON events + admin_delete_draft_events RLS（後台刪除草稿）| ✅ 已執行 |
| 031 | Seed 5 JYP 藝人 + JYP schedule sources（ITZY/NMIXX/DAY6/Xdinary Heroes/2PM）| ✅ 已執行 |
| 032 | Seed J.Y. Park idol + JYP schedule source（第一個 solo entry）| ✅ 已執行 |
| 033 | UPDATE event_sources.level = events.trust_level（trust_level 單一真相 backfill）| ✅ 已執行 |
| 034 | Seed 27 個主流 K-pop 藝人（BTS / SEVENTEEN / aespa / NCT / IVE / ATEEZ / KATSEYE 等）| ✅ 已執行 |
| 035 | UPDATE HYBE sub-label agency 加「HYBE /」前綴（修 /admin/idols HYBE filter 命中失敗）| ✅ 已執行 |
| 036 | Seed 24 個 Tier 2 / 經典藝人（&TEAM / TAEYANG / ROSÉ / EXO / SHINee / BIGBANG / MAMAMOO 等）| ✅ 已執行 |
| 037 | ADD COLUMN idols.avatar_source_url / provider / license / author / note + GRANT UPDATE（I1b-C）| ✅ 已執行 |

---

## Env 設定

| 環境變數 | 本地 `.env.local` | Vercel Production | Vercel Preview |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ |
| `ANTHROPIC_API_KEY` | ✅ | ✅ | ✅ |
| `CRON_SECRET` | ✅ | ✅ | — |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ❌ 不可設 |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` 必須是 Supabase → Settings → API → `service_role` 的 JWT（`eyJ...`），不是 `sb_secret_...`。絕不可加 `NEXT_PUBLIC_` 前綴，不可進版控，不可設在 Preview 環境。

---

## 目錄結構

```
src/
├── middleware.ts                                # Supabase SSR session refresh（每個 request）
├── app/
│   ├── layout.tsx / page.tsx / error.tsx / not-found.tsx
│   ├── schedule/page.tsx
│   ├── idols/
│   │   ├── page.tsx + IdolsClient.tsx          # 列表 + agency filter（PR #66 F1）
│   │   └── [slug]/page.tsx + FollowIdolButton.tsx   # 偶像詳情頁（PR #67 F5）
│   ├── events/[id]/page.tsx                    # 含 ticket/stream「連結待補」placeholder（PR #66 F3）
│   ├── favorites/page.tsx + FavoritesClient.tsx
│   ├── me/page.tsx + MeClient.tsx
│   ├── login/page.tsx + LoginForm.tsx
│   ├── auth/callback/route.ts
│   └── admin/
│       ├── page.tsx                          # Dashboard
│       ├── login/page.tsx + LoginForm.tsx
│       ├── events/
│       │   ├── page.tsx + EventsClient.tsx     # filter tabs + 搜尋（PR #48）
│       │   ├── [id]/page.tsx + actions.ts
│       │   ├── [id]/edit/page.tsx + EditEventForm.tsx + actions.ts
│       │   └── new/page.tsx + NewEventForm.tsx + actions.ts
│       ├── idols/
│       │   ├── page.tsx + IdolsClient.tsx      # filter tabs + 搜尋 +「缺資料」tab（PR #53 / #62）
│       │   ├── [id]/page.tsx + actions.ts
│       │   ├── [id]/edit/page.tsx + EditIdolForm.tsx + actions.ts + AiImageSearchModal.tsx
│       │   └── new/page.tsx + NewIdolForm.tsx + actions.ts
│       ├── sources/
│       │   ├── page.tsx + SourcesClient.tsx    # 爬蟲來源列表 + tabs + 搜尋（PR #55）
│       │   └── [id]/page.tsx + RunSourceButton.tsx   # 詳情 + 手動觸發（J6b）
│       └── event-candidates/
│           ├── page.tsx + CandidatesClient.tsx # filter tabs + 搜尋（PR #54）
│           ├── CrawlerButton.tsx
│           ├── [id]/page.tsx + actions.ts
│           ├── new/page.tsx + NewCandidateForm.tsx + actions.ts
│           └── parse/page.tsx + ParseClient.tsx + actions.ts
├── components/
│   ├── BottomNav.tsx
│   ├── EventCard.tsx
│   ├── EventDetailActions.tsx
│   ├── EventTypeBadge.tsx
│   ├── HomePersonalized.tsx
│   └── SourceBadge.tsx
└── lib/
    ├── types.ts
    ├── appState.tsx
    ├── mockIdols.ts / mockEvents.ts
    ├── supabase/
    │   ├── client.ts                         # anon client（前台唯讀）
    │   ├── serverClient.ts                   # cookie server client
    │   ├── browserClient.ts                  # cookie browser client
    │   ├── serviceClient.ts                  # service_role（cron 專用）
    │   ├── events.ts                         # getPublishedEvents / getActiveIdols / getEventById / getIdolBySlug
    │   ├── auth.ts                           # getCurrentUser()
    │   ├── adminAuth.ts                      # getCurrentAdmin()
    │   └── adminStats.ts                     # getAdminStats()
    ├── imageSearch/
    │   └── wikimedia.ts                      # Wikimedia / Wikipedia image search（I1b-B 第一版）
    ├── crawlers/
    │   ├── sourceHash.ts                     # SHA-256 source_hash
    │   ├── contentHash.ts                    # SHA-256 content_hash（J7d-A drift 偵測）
    │   ├── crawlerSource.ts                  # getCrawlerSourceByKey()、updateRunStatus()
    │   ├── idolMatcher.ts                    # 聚合來源 idol 名稱匹配（M1a-B，含 alt_names）
    │   ├── blackpinkOfficialTour.ts          # BLACKPINK HTML parser（cheerio）
    │   ├── jypSchedule.ts                    # JYP JSON API 通用 parser
    │   ├── runJypScheduleFetcher.ts          # jyp_schedule fetcher（12 個月，config.groupId）
    │   ├── kpopofficialConcerts.ts           # kpopofficial.com HTML parser（M1a-B）
    │   └── runKpopofficialConcertsFetcher.ts # kpopofficial 聚合 fetcher（M1a-B + C）
    └── ai/
        └── parseCandidate.ts                 # Claude Haiku wrapper

supabase/
├── migrations/001–033（見 Migration 索引）
└── seed.sql

public/manifest.json
vercel.json                                   # Cron "0 1 * * *"（09:00 Taipei）
```

---

## API Routes 索引

| Route | 方法 | 說明 |
|---|---|---|
| `/api/cron/sync-candidates` | GET | Vercel Cron fan-out（J6e；Bearer CRON_SECRET；dispatch by parser_type）|
| `/api/admin/crawlers/blackpink-tour/run` | POST | BLACKPINK 手動觸發（admin guard）|
| `/api/admin/crawlers/jyp-schedule/run` | POST | JYP 手動觸發（body: {sourceKey}）|
| `/api/admin/crawlers/twice-schedule/run` | POST | 相容 shim → jyp-schedule('twice-jyp-schedule')|
| `/api/admin/crawlers/kpopofficial-concerts/run` | POST | kpopofficial 聚合手動觸發（admin guard；body: {sourceKey}）|
| `/api/admin/ai/parse-candidate` | POST | AI 解析公告（admin guard + Claude Haiku）|
| `/api/admin/idols/[id]/ai-search-image` | GET | I1b-B 後台 AI 搜圖（Wikimedia；admin guard；?q= 自訂關鍵字）|
| `/api/admin/event-candidates/bulk-review` | POST | 批量 approve / reject 候選（J7b）|
| `/api/admin/events/bulk-publish` | POST | 批量發布 / 下架 / 刪除草稿 + trust_level 切換（J7e + PR #43）|
| `/api/admin/event-candidates/cleanup-expired` | POST | 一鍵清理 pending + detected_date < today 候選（J7c）|
| `/auth/callback` | GET | Magic link / OAuth callback |

---

## 設計規範

### 色彩 Token（tailwind.config.ts）

| Token | 色碼 | 說明 |
|---|---|---|
| `bg` | `#08080f` | 主底色 |
| `card` | `#0f0f1e` | 卡片底 |
| `card-border` | `#1e1e36` | 邊框 |
| `primary` | `#e91e8c` | 主色（熱粉）|
| `violet` | `#8b5cf6` | 輔色 |
| `text-base` | `#f0f0ff` | 主文字 |
| `muted` | `#6b6b9a` | 次文字 |

### 元件慣例

- 卡片：`rounded-2xl border border-card-border bg-card`
- 主色按鈕：`bg-primary text-white rounded-xl`
- 次要按鈕：`border border-card-border bg-transparent text-muted`
- 底部安全距離：`pb-24`；最大寬度：`max-w-md`（448px）mobile-first
- 預設 Server Component；需要 `useState` / `usePathname` 才加 `'use client'`
