# Idol Rhythm — WORKING.md

> 工作排程、進度索引、migration 狀態、API / 目錄 / 設計索引。
> 執行規則與安全邊界請看 `CLAUDE.md`；本檔只放「目前做到哪裡、下一步做什麼」。

---

## 專案狀態快照

| 項目 | 值 |
|---|---|
| 目前階段 | S1 / C1 / I1a / I1b-A / J7d-A / 忘記密碼 / M1a / admin 刪除草稿 / M1b 第一批 + 第二批 + M1b-3（75 個 active idol）/ trust_level 單一真相 / Supabase SSR middleware / 後台 4 頁 filter tabs + 搜尋 pilot / 後台 idols「缺資料」tab / I1b-B AI 搜圖（Wikimedia + 可重搜）/ I1b-C avatar 來源紀錄 + 多色 placeholder / 前台 polish 6 改動 / #45 description + color 補齊 / Source Inventory A / YG crawler 工作單 / YG artist schedule crawler / 中文顯示 + 快閃店資料模型 / 後台中文欄位 / 前台中文顯示 / 活動類型 icon / 摘要 fallback / 中文生成工作單 / 候選 + 草稿單筆繁中生成 / 繁中欄位標記已審閱 / WAKEONE crawler 工作單 / SMTOWN crawler 工作單 / UI-1 `/schedule` Cassette Archive v3 完成。下一步建議：UI-2 `/schedule` 搜尋 + 月份展開 + 小扁框活動列，之後接 Weverse 技術探測工作單；另有「後台用戶統計」待排程 |
| 輔助參考 | `ADMIN_ROADMAP.md`（後台分階段開發路線）、`AI_PIPELINE_PLAN.md`（爬蟲架構設計文件）、`SOURCE_INVENTORY_A.md`（官方來源盤點研究附件；不是流程索引，流程仍以本檔為準）、`MAINSTREAM_ARTIST_SEED_WORK_ORDER.md`（主流漏網藝人 seed 工作單；只做規劃）、`CHINESE_GENERATION_WORK_ORDER.md`（繁中顯示文案生成工作單；只做規劃） |

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
| 45 | 補新藝人 UI | 51+ 個藝人需補 avatar / 描述 / 主色；後台「缺資料」filter tab 已就緒，AI 搜圖能加速處理。2026-05-19 已手動補齊所有現有 active idols 的 description / color，並刪除測試髒資料 `test` / `少女時代(slug)`；目前主要剩 avatar 人工補圖 | 🔲 持續中（avatar 人工處理）|
| 45.5 | 後台 idols「缺資料」filter tab | tab 顯示 avatar/description 任一缺漏的藝人，琥珀色提示 + 卡片內「缺頭像/缺描述」徽章 | ✅ PR #62 merged |
| 45.6 | I1b-C avatar 來源紀錄 + 安全 placeholder | migration 037 加 5 個 avatar_source_* 欄位；三種上傳路徑（手動上傳 / AI 搜圖 / 手動 URL）自動寫 provider；IdolAvatar 改用 name-hash 12 色 fallback（修「前台頭像全部同色」）| ✅ PR #65 merged（migration 037 已執行）|
| 45.7 | 前台 polish 批 | F1 /idols filter 軸改公司分 / F2 首頁 section「查看全部 N 場」/ F3 /events/[id] 連結待補 placeholder / F4 /favorites 加搜尋 / F-scroll /schedule 藝人 chip 滾動指示 | ✅ PR #66 merged（無 migration）|
| 45.8 | F5 /idols/[slug] 偶像詳情頁 | 前台公開偶像詳情：hero（avatar/agency/idol.color 漸層）+ meta + 描述 + 即將/已結束活動列表 + 追蹤按鈕；停用偶像 404 隱私保護 | ✅ PR #67 merged（無 migration）|
| 46 | M2 | 跨來源活動去重（event_key soft-hash，同演唱會多來源合併）| 🔲 待辦（當實際有跨來源重複發生再做）|
| 47 | 帳號設定 | 改 email、刪除帳號、2FA | 🔲 待辦 |
| 48 | M3 | Custom SMTP / Resend（上線前避免 rate limit）| 🔲 待辦 |
| 49 | Apple Sign-In | 上 App Store 前再做 | 🔲 待辦 |
| 50 | 站內通知系統 | 鈴鐺 + 通知列表頁 + 通知設定 toggle，整合 /me 通知設定 + 未來 PWA / native push | 🔲 待辦（替代 email 寄送）|
| 51 | Source Inventory A | 官方來源盤點研究附件：覆蓋現有 55 個 active idol、M1b-3 seed 候選、BLACKPINK/BTS/BIGBANG 等 solo / 分隊來源；標出 P0 crawler 候選（JYP extension / YG schedule / WAKEONE notice / SMTOWN notice / Weverse 技術探測）。文件在 `SOURCE_INVENTORY_A.md`，但工作流程索引仍以本檔為準 | ✅ PR #70 merged（無 migration / 無 DB 變更 / 無 crawler）|
| 52 | M1b-3 | migration 038：依 Source Inventory A 新增 20 個 solo / 獨立藝人 / 分隊 / 大團成員（Rain、IU、TAEYEON、G-DRAGON、BLACKPINK solo、BTS solo、NCT 分隊、PLAVE、(G)I-DLE、STAYC），並修 aespa agency typo（`SSM Entertainment` → `SM Entertainment`）| ✅ PR #72 merged（migration 038 已執行；目前 75 個 active idol）|
| 53 | YG crawler 工作單 | `CRAWLER_WORK_ORDER_YG.md`：設計 YG artist schedule / notice crawler，覆蓋 BLACKPINK group / BABYMONSTER / TREASURE；不含 BLACKPINK solo / THEBLACKLABEL；只做工作單，未寫 crawler | ✅ PR #73 merged（無 migration / 無 DB 變更 / 無 crawler）|
| 54 | 快閃店搜尋與呈現 | 新增 pop-up store / 快閃店 類活動的搜尋、資料分類與前台呈現。需先評估 `event_type` / `sub_type` 是否已有可承載欄位；若需新增 enum 或 filter，先寫工作單與 migration SQL。來源上可從 official notice / brand collaboration / ticketing secondary 抓候選，trust_level 仍須保守 | 🔲 待辦（可能涉及 migration / UI / crawler filter）|
| 55 | 後台用戶統計 | Admin analytics：未來用戶數、註冊趨勢、活躍用戶、收藏 / 追蹤 / reminder 使用量、來源候選審核漏斗等。需先定義指標與隱私邊界；讀 auth.users 可能需要 service_role 或 Supabase admin API，不可暴露到 client | 🔲 待辦（先工作單，再實作 dashboard）|
| 56 | YG artist schedule crawler | `yg_artist_schedule` 官方來源 crawler：走 YG `/api/artist/schedule/list/{artistId}/{year}/{month}` JSON endpoint，覆蓋 BLACKPINK group / BABYMONSTER / TREASURE；接入 cron/manual sync fan-out；migration 040 seed 三個 official crawler_sources；只進 event_candidates，不自動審核 / 發布 | ✅ PR #77 merged（migration 040 已執行）|
| 57 | 中文顯示 + 快閃店資料模型工作單 | `DISPLAY_LOCALIZATION_AND_POPUP_WORK_ORDER.md`：規劃原文保留、中文展示欄位、AI/規則中文摘要、人工覆寫、快閃店日期區間與地點模型、sub_type 擴充、活動類型圖示系統與後續 PR 拆分；僅工作單，未改 DB / UI / crawler | ✅ PR #78 merged（無 migration）|
| 58 | 主流漏網藝人 seed 工作單 | `MAINSTREAM_ARTIST_SEED_WORK_ORDER.md`：規劃 Lee Young Ji、QWER、BIBI、Jay Park、Kwon Eunbi、Chungha、Sunmi、Baekhyun 等 P0/P1/P2 seed 候選；只做研究與後續 PR 拆分，不改 DB / migration / UI / crawler | ✅ PR #81 merged（無 migration）|
| 59 | 中文顯示 + 快閃店資料模型 migration | migration 041：新增 events / event_candidates 中文展示欄位、translation metadata、日期區間、細分地點欄位，並擴充 `event_sub_type` 支援 `popup_store` / `exhibition` / `brand_event`；不改 UI / crawler / 自動翻譯 | ✅ PR #83 merged（migration 041 已執行）|
| 60 | 後台中文欄位 + 快閃店 subtype UI | 候選詳情顯示中文展示欄位 / subtype / 日期區間；核准候選時帶入草稿；草稿活動編輯頁可手動補中文標題、中文摘要、日期區間與地點細節；新增活動支援 popup/exhibition/brand_event subtype | ✅ PR #85 merged（無 migration）|
| 61 | 前台中文顯示 + 日期區間 | 公開活動卡片 / 詳情頁優先顯示 `display_title_zh`，保留原文標題；日期支援 `start_date` / `end_date` / `date_label`；地點可顯示中文地點與地址；不改 crawler / AI / schema | ✅ PR #86 merged（無 migration）|
| 62 | 活動類型 icon 顯示 | 共用 `EventTypeBadge` 加 lucide icon mapping；前台卡片 / 詳情頁、後台活動列表 / 詳情、候選列表 / 詳情顯示 label-backed icon；不改 crawler / AI / schema | ✅ PR #87 merged（無 migration）|
| 63 | 前台摘要 fallback 文案 | 活動詳情頁只有在 `display_summary_zh` 有值時顯示「AI 繁中摘要」；否則將原始 description 標為「原始摘要 / 原文」，避免誤導 | ✅ PR #88 merged（無 migration）|
| 64 | 繁中顯示文案生成工作單 | `CHINESE_GENERATION_WORK_ORDER.md`：規劃 admin-only 單筆生成、manual/reviewed 保護、嚴格 JSON 驗證、crawler 不直接呼叫 AI；只做工作單，不改 DB / AI runtime / UI | ✅ PR #89 merged（無 migration）|
| 65 | 候選 + 草稿單筆繁中生成 | 後台候選詳情與草稿活動詳情加 admin-only「產生繁中顯示文案」；共用 Claude JSON helper；保護 manual/reviewed 與既有中文欄位；不做 batch / overwrite / reviewed / 發布提示 / crawler | ✅ PR #90 merged（無 migration）|
| 66 | 繁中欄位標記已審閱 | 後台候選詳情與草稿活動詳情加 admin-only「標記已審閱」；只允許 `translation_status = machine` 且已有中文欄位；只更新 `translation_status` / `translation_updated_at`，不改中文內容、不改 `translation_source`、不碰發布 / AI / crawler / schema | ✅ PR #91 merged（無 migration）|
| 67 | WAKEONE crawler 工作單 | `CRAWLER_WORK_ORDER_WAKEONE.md`：規劃 WAKEONE 公開 notice crawler，第一版覆蓋 ZEROBASEONE / Kep1er / izna；共享 label notice feed，需保守 artist matching 與 event filter；只做工作單，不改 DB / crawler / migration | ✅ PR #92 merged（無 migration）|
| 68 | SMTOWN crawler 工作單 | `CRAWLER_WORK_ORDER_SMTOWN.md`：規劃 SMTOWN 公開 notice crawler，第一版先聚焦 aespa / RIIZE / Red Velvet / EXO / NCT 等高訊號群組；共享 label notice feed，需保守 artist matching 與 event filter，特別注意 NCT unit / solo overlap；只做工作單，不改 DB / crawler / migration | ✅ PR #93 merged（無 migration）|
| 69 | UI-1 `/schedule` Cassette Archive v3 | 以前台 `/schedule` 為唯一範圍，做 Cassette Archive v3 視覺試點：暖紫黑背景、archive header、cassette track cards、StatusPill / KindPill / HeartButton / TrackCode、小型 calendar/timeline 樣式升級；不改資料邏輯、query、DB、crawler、auth、其他頁 | ✅ PR #95 merged（無 migration）|
| 70 | UI-2 `/schedule` 搜尋 + 月份展開 + 小扁框活動列 | 解決藝人 chip 過長：加入搜尋框，藝人 chip 改為少量快速篩選；timeline 只呈現未來活動，按月份 accordion 展開；活動預設為小扁框，點擊後展開成 Cassette Track Card；不改資料邏輯、query、DB、crawler、auth、其他頁 | 🔄 進行中（無 migration）|

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
| 038 | Seed 20 個 solo / 分隊 / 大團成員（Rain / IU / TAEYEON / G-DRAGON / BLACKPINK solo / BTS solo / NCT 分隊 / PLAVE / (G)I-DLE / STAYC）+ 修 aespa agency typo | ✅ 已執行 |
| 039 | GRANT SELECT ON idols TO service_role + 停用 BLACKPINK 2025 舊巡演頁 source | ✅ 已執行 |
| 040 | Seed BLACKPINK / BABYMONSTER / TREASURE 官方 YG Schedule crawler_sources（parser_type=`yg_artist_schedule`）| ✅ 已執行 |
| 041 | Add events / event_candidates Chinese display fields, translation metadata, date ranges, richer locations, and popup/exhibition/brand_event subtypes | ✅ 已執行 |

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
    │   ├── ygArtistSchedule.ts               # YG official schedule parser（JSON endpoint）
    │   ├── runYgArtistScheduleFetcher.ts     # yg_artist_schedule fetcher（12 個月，config.artistId）
    │   ├── kpopofficialConcerts.ts           # kpopofficial.com HTML parser（M1a-B）
    │   └── runKpopofficialConcertsFetcher.ts # kpopofficial 聚合 fetcher（M1a-B + C）
    └── ai/
        └── parseCandidate.ts                 # Claude Haiku wrapper

supabase/
├── migrations/001–040（見 Migration 索引）
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
| `/api/admin/crawlers/yg-artist-schedule/run` | POST | YG official schedule 手動觸發（admin guard；body: {sourceKey}）|
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
