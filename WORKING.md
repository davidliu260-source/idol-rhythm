# Idol Rhythm — WORKING.md

> 工作排程、進度索引、migration 狀態、API / 目錄 / 設計索引。
> 執行規則與安全邊界請看 `CLAUDE.md`；本檔只放「目前做到哪裡、下一步做什麼」。

---

## 專案狀態快照

| 項目 | 值 |
|---|---|
| 目前階段 | S1 / C1 / I1a / I1b-A / J7d-A / 忘記密碼 / M1a / admin 刪除草稿 / M1b 第一批 + 第二批 + M1b-3（75 個 active idol）/ trust_level 單一真相 / Supabase SSR middleware / 後台 4 頁 filter tabs + 搜尋 pilot / 後台 idols「缺資料」tab / I1b-B AI 搜圖（Wikimedia + 可重搜）/ I1b-C avatar 來源紀錄 + 多色 placeholder / 前台 polish 6 改動 / #45 description + color 補齊 / Source Inventory A / YG crawler 工作單 / YG artist schedule crawler / 中文顯示 + 快閃店資料模型 / 後台中文欄位 / 前台中文顯示 / 活動類型 icon / 摘要 fallback / 中文生成工作單 / 候選 + 草稿單筆繁中生成 / 繁中欄位標記已審閱 / WAKEONE crawler 工作單 / SMTOWN crawler 工作單 / UI-1 `/schedule` Cassette Archive v3 / UI-2 `/schedule` 搜尋 + 月份展開 + 小扁框活動列 / UI-3 `/events/[id]` Cassette Detail v1 / UI-4 `/favorites` Archive Shelf / UI-5 首頁 `/` Today Archive v1 follow-up / UI-6 `/me` Personal Console v1 / UI-7 `/idols` Archive Roster v1 / UI-8 `/idols/[slug]` Archive Detail v1 / UI-9 auth pages visual pass / N1 通知系統工作單 v1 / N2 通知資料模型工作單（PR #112 merged）/ N3 notifications 資料模型 migration 042（PR #113 merged，已執行）/ N5 `/notifications` 通知列表頁（PR #116）/ N6 event_reminder 派送（PR #117/#118 工作單 + #119 實作 merged）/ N7 followed_idol_new_event 派送（PR #121 工作單 + #122 實作 merged）。通知系統 v1 全線完工。J7d-B resolve 按鈕（PR #124）。M1b-4 主流漏網藝人 seed 16 人（PR #125，migration 043 已執行 2026-05-22，91 個 active idol）。WAKEONE notice crawler 實作（PR #126 merged，migration 044 已執行）。SMTOWN notice crawler 實作（PR opened，migration 045 待執行）。帳號設定 v1 工作單（PR #129 merged）+ 帳號設定 v1 實作（PR #130 merged，無 migration）。Weverse 技術探測工作單（PR #131 merged）+ Weverse Phase A 實地探測（PR opened）→ **Verdict C：不可無登入抓**，weverse.io 全 SPA shell（5478 bytes 對所有 URL），無 inline JSON，無 server-rendered content；abandoned for v1，不開 runtime 工作單。後台用戶統計工作單（PR #133 merged）+ 後台用戶統計實作 `/admin/analytics`（PR #135 merged）。快閃店搜尋與呈現工作單（PR #136 merged，採方案 X 拆 chip + 補搜尋別名）+ 快閃店搜尋與呈現實作（本 PR：`ScheduleClient.tsx` 三 chip 拆分 + `SUBTYPE_SEARCH_KEYWORDS` 別名 + `getEmptyStateMessage` 白標空狀態，無 migration）。P2-A1 YouTube Official Channel crawler runtime 已完成（PR #143–#147 全部 merged）。migration 048 已執行。BTS source 驗收成功。剩餘 18 個 YouTube sources 已補 channel metadata，全部保持 is_active=false，採按需啟用策略。P2-A2 cron 暫緩。P1 Search Discovery Provider 工作單（PR #149 merged）。P1-A Google PSE Probe Verdict Deferred（PR #151 merged）。**P1-B Claude Webpage Discovery 工作單開出（本 PR），等 GPT audit。下一步：audit 通過後開 runtime PR（generic_webpage fetcher + preview/commit mode + migration 049 seed）。** |
| 輔助參考 | `ADMIN_ROADMAP.md`（後台分階段開發路線）、`AI_PIPELINE_PLAN.md`（爬蟲架構設計文件）、`SOURCE_INVENTORY_A.md`（官方來源盤點研究附件；不是流程索引，流程仍以本檔為準）、`MAINSTREAM_ARTIST_SEED_WORK_ORDER.md`（主流漏網藝人 seed 工作單；只做規劃）、`CHINESE_GENERATION_WORK_ORDER.md`（繁中顯示文案生成工作單；只做規劃）、`NOTIFICATION_SYSTEM_WORK_ORDER.md`（通知系統短版工作單；只做規劃）、`NOTIFICATION_DATA_MODEL_WORK_ORDER.md`（通知資料模型工作單 + migration 草案 SQL；只做規劃）、`CRAWLER_WORK_ORDER_STARSHIP.md`（Starship Entertainment Phase A probe：Verdict Google Discovery；IVE / MONSTA X / CRAVITY / KiiiKiii 目前走 Google Discovery 路徑等待決策）、`STREAMING_VIDEO_SOURCE_WORK_ORDER.md`（P2 Streaming / Video Source Inventory 工作單，PR #144 merged）、`YOUTUBE_CHANNEL_CRAWLER_WORK_ORDER.md`（P2-A YouTube Official Channel Crawler 工作單，PR #145 merged）、`SEARCH_DISCOVERY_WORK_ORDER.md`（P1 Search Discovery Provider 工作單，PR #149 merged）、`GOOGLE_PSE_PROBE_REPORT.md`（P1-A Google PSE 探測報告，Verdict Deferred）、`CLAUDE_WEBPAGE_DISCOVERY_WORK_ORDER.md`（P1-B Claude Webpage Discovery 工作單，待 GPT audit）|
| P2-A1 驗收狀態 | YouTube Official Channel crawler runtime（PR #146 merged）。`YOUTUBE_API_KEY` 已設定（Vercel + .env.local）。migration 048 已執行。**BTS 單一 source 手動驗收完成**：bts-youtube-official（channelId=`UCLkAepWjdylmXSltofFvsYQ`，官方 handle=`@BTS`，source_url 使用穩定 channel URL）。驗收結果：fetched=1、classifiedC=1、inserted=0、errors=[]、quotaExceeded=false — 屬於預期行為（BTS 頻道近期上傳為 C 級內容，classifier 正確排除）。publishedAfterHours 已改回 25。**剩餘 18 個 YouTube sources**：channelId / uploadsPlaylistId / source_url 已批量填入（2026-05-23）；除 BTS 外全部保持 `is_active = false`，採按需啟用策略。**P2-A2（cron 排程）暫緩，不開。** cron guard 已在 PR #146 實作，vercel-cron 不會觸發 youtube_official_channel。**下一步**：Beta Data Readiness Audit，或按需啟用下一個近期有 comeback / MV / premiere 的 source（不要批量啟用）|

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
| 70 | UI-2 `/schedule` 搜尋 + 月份展開 + 小扁框活動列 | 解決藝人 chip 過長：加入搜尋框，藝人 chip 改為活動分類篩選；timeline 只呈現未來活動，按月份 accordion 展開；活動預設為小扁框，點擊後替換成 Cassette Track Card；大卡右上補收合按鈕、hero 移除「已歸檔」數字，並預留 YouTube / Netflix 平台分類；不改資料邏輯、query、DB、crawler、auth、其他頁 | ✅ PR #96 + #97 + #98 merged（無 migration）|
| 71 | UI-3 `/events/[id]` Cassette Detail v1 | 以活動詳情頁為唯一範圍，接上 cassette cover 式主視覺、TRK code、日期地點資訊條、本地化摘要 / 原文層級、資訊來源與票務 / 官方 / 分享 CTA；分享連結支援 Web Share API 與 copy link fallback；地點在結構化欄位缺漏時可從原始摘要 `Location:` fallback 補上；不改 query、DB、crawler、auth、其他頁 | ✅ PR #99 merged（無 migration）|
| 72 | UI-4 `/favorites` Archive Shelf | 以 `/favorites` 為唯一範圍，將收藏頁升級成 archive shelf：暖紫黑 cassette 語言、收藏統計 header、搜尋保留、登入提示 / 空狀態升級、即將到來與已歸檔分區、收藏卡片層級重做；後續月份分組與 archived accordion 已在首頁 follow-up 線接回；不改 query、DB、crawler、auth、其他頁 | ✅ PR #100 merged（follow-up 已併入後續首頁線，無 migration）|
| 73 | UI-5 首頁 `/` Today Archive v1 | 以首頁 `/` 為主範圍，將入口頁升級成 Today Archive / control deck：暖紫黑 cassette 語言、今日 spotlight、快速入口、個人化區塊與首頁 timeline 視覺統一；後續用 PR #102～#104 補首頁卡片同 `/schedule` 的小卡展開、詳情頁返回上一瀏覽進度、`/favorites` 月份分組版本接回、首頁鈴鐺與追蹤內容修正；不改資料邏輯、query、DB、crawler、auth | ✅ PR #101 + #102 + #103 + #104 merged |
| 74 | UI-6 `/me` Personal Console v1 | 以 `/me` 為唯一主範圍，將個人頁升級成 personal console：帳號總覽、追蹤 / 收藏 / 提醒 stats、提醒與通知落點、追蹤偶像與近期追蹤行程、收藏與提醒清單、未登入狀態重做；不改 auth 流程、query、DB、crawler、其他頁資料邏輯 | ✅ PR #105 merged |
| 75 | UI-7 `/idols` Archive Roster v1 | 以 `/idols` 為唯一主範圍，將偶像列表升級成 archive roster：暖紫黑 roster header、搜尋與公司篩選重做、追蹤名單與繼續探索分區、卡片視覺接上 archive 語言；不改追蹤邏輯、query、DB、crawler、其他頁資料邏輯 | ✅ PR #106 merged |
| 76 | UI-8 `/idols/[slug]` Archive Detail v1 | 以 `/idols/[slug]` 為唯一主範圍，將偶像詳情頁升級成 archive detail：dossier hero、追蹤按鈕視覺對齊、檔案資訊 stats、描述分區、即將到來與已歸檔行程層級重做；後續用 PR #108 補 `/idols` roster card 名稱可見性；不改追蹤邏輯、query、DB、crawler、其他頁資料邏輯 | ✅ PR #107 + #108 merged |
| 77 | UI-9 auth pages visual pass | 以 `/login`、`/forgot-password`、`/reset-password` 為唯一主範圍，將 auth 入口升級成 archive/control deck 語言：暖紫黑 shell、登入/恢復密碼 panel、tabs 與表單視覺重做、已登入與成功狀態整理；不改 auth 流程、query、DB、crawler、其他頁資料邏輯 | ✅ PR #109 merged |
| 78 | N1 通知系統工作單 v1 | `NOTIFICATION_SYSTEM_WORK_ORDER.md`：短版定義 reminder vs notification 邊界、首頁鈴鐺與 `/me` 分工、v1 只支援活動提醒通知與追蹤偶像新活動通知、收藏不自動轉通知、建議未來拆 PR 為資料模型 / 通知頁 / 派送機制；只做工作單，不改 DB / UI / push runtime | ✅ PR #111 merged（無 migration）|
| 79 | N2 通知資料模型工作單 | `NOTIFICATION_DATA_MODEL_WORK_ORDER.md`：把 v1 通知系統的 schema 釘到 SQL 等級 — `notifications` table 欄位、`type` text+check、`dedupe_key = type:event_id`、`read_at` 未讀模型、unread count partial index、RLS（client 讀自己 + 只能改 read_at）/ service_role 寫入、與 `reminders` 表完全獨立；附草案 SQL 但**不放進 `supabase/migrations/`**，等 review 通過後 N3 才寫成正式 migration（編號 042+）。本輪不寫 runtime / 不改 UI / 不執行 migration | ✅ PR #112 merged（GPT review 通過）|
| 80 | N3 notifications 資料模型 migration | migration 042：照 N2 工作單草案 SQL 寫成正式 migration — 建立 `notifications` table（user_id / type / event_id（NULLABLE）/ idol_id / title / body / payload / dedupe_key / read_at / delivered_at NOT NULL DEFAULT NOW() / created_at）+ CHECK on type（`event_reminder` / `followed_idol_new_event`）+ 3 個 index（user_dedupe UNIQUE / user_created_at / user_unread partial）+ RLS + GRANT（authenticated SELECT 自己的 + UPDATE(read_at) 自己的；service_role 完整；anon 無權限）。裁定要點：dedupe 用 `${type}:${event_id}` 單次通知模型、保留 delivered_at、不加 archived_at、通知只從 published events 派送（runtime 端）、followed_idol_new_event v1 不回追舊活動（runtime 端比對 user_follows.created_at vs events.published_at）。本輪只做 DB migration，不寫 runtime / 不接 push / 不做 UI | ✅ PR #113 merged（migration 042 已執行）|
| 81 | N4 query helper + 首頁鈴鐺 unread count + `/me` 通知入口 | `src/lib/supabase/notifications.ts`：getUnreadNotificationCount / listNotifications / markAllRead / markAsRead 四個 browser-client helpers；`HomeNotificationBell`：登入時改讀 notifications.unread count，未登入 fallback reminders 數，連結改指向 `/me#notifications`；`MeClient`：加 useEffect 讀 unread count，「提醒與通知」區塊改顯示未讀通知數（登入時）/ 提醒數（未登入時）+ 通知列表入口 placeholder（N5 建 /notifications 後啟用）；不改 schema / migration / reminders 行為；patch 補 non-logged-in section 的 `id="notifications"` anchor | ✅ PR #114 merged |
| 82 | N5 `/notifications` 通知列表頁 | 新增 `src/app/notifications/page.tsx` + `NotificationsClient.tsx`：登入 → archive style header（通知數 / 未讀數 / 全部已讀按鈕）+ 通知 feed（未讀粉紅高亮 / 已讀灰色 / 點擊標已讀 / 有 event_id 的通知可跳詳情頁）+ 空狀態；未登入 → 登入提示；`HomeNotificationBell`：登入時連結改 `/notifications`；`MeClient`：placeholder 改為真實「查看完整通知列表」連結；不改 schema / migration / reminders / query helper | ✅ PR #116 merged |
| 83 | N6 event_reminder 派送工作單 v2 | `NOTIFICATION_DISPATCH_WORK_ORDER.md`：設計 event_reminder cron 派送機制 — 路由 `GET /api/cron/dispatch-reminders`、排程 `30 1 * * *`（Vercel Hobby plan 限制 daily）、`dedupe_key = event_reminder:{event_id}:{reminder_type}`（week/day 不互擋）、is_sent 更新規則（insert 成功 + dedup 略過都標 true，真正錯誤不標）、date-level only（hour_before 留 N6b）；v1 PR #117 + v2 修正 PR #118 merged | ✅ PR #117 + #118 merged |
| 84 | N6 event_reminder 派送 Cron 實作 | `src/app/api/cron/dispatch-reminders/route.ts` + `vercel.json`：CRON_SECRET auth → service_role query → day_before/week_before 日期視窗過濾 → upsert notifications（ignoreDuplicates）→ is_sent 標記；upsert 或 is_sent 更新失敗皆回 500；排程 `30 1 * * *`（09:30 Taipei）| ✅ PR #119 merged |
| 85 | N7 followed_idol_new_event 派送工作單 v2 | `N7_NEW_EVENT_DISPATCH_WORK_ORDER.md`：設計 followed_idol_new_event cron 派送 — 路由 `GET /api/cron/dispatch-new-event-notifications`、排程 `0 2 * * *`（10:00 Taipei，與 N6 錯開 30 分鐘）、掃近 25 小時新發布活動、JOIN user_follows、不回追規則（`published_at >= user_follows.created_at`）、`dedupe_key = followed_idol_new_event:{event_id}`；v2 修正 dedupe_key 一致性 / hidden Unicode / 前置條件文字 | ✅ PR #121 merged |
| 86 | N7 followed_idol_new_event 派送 Cron 實作 | `src/app/api/cron/dispatch-new-event-notifications/route.ts` + `vercel.json`：CRON_SECRET auth → 雙查詢設計（先查 events 25h 視窗、再用 idol_id IN 查 user_follows + created_at）→ JS Map 配對 + 不回追守則 → upsert notifications（ignoreDuplicates）；v2 patch 修正 user_follows→events 中間隔 idols 表的 2-hop FK bug + 補回漏選的 `created_at`；排程 `0 2 * * *` | ✅ PR #122 merged |
| 87 | M1b-4 主流漏網藝人 seed | migration 043：seed 16 位主流藝人（P0: Lee Young Ji / QWER / BIBI / Jay Park / Chungha / Sunmi / Baekhyun；P1: Jannabi / Epik High / Dynamicduo / Crush / Heize / Dean / Paul Kim；P2: Jo Yuri / DAESUNG）；跳過 agency 未確認者（Lee Mujin / 10CM / Kwon Eunbi / T.O.P / YENA）；ON CONFLICT (slug) DO NOTHING；不改 schema / GRANT / crawler / UI | ✅ PR #125 merged（migration 043 已執行 2026-05-22；目前 91 個 active idol）|
| 88 | WAKEONE notice crawler 實作 | `wakeoneNotice.ts` HTML parser + `runWakeoneNoticeFetcher.ts` 全流程 fetcher（crawler_sources 查詢 / 偶像 slug 載入 / WordPress 分頁 / event filter / idol 匹配 / J7d-A recheck flow / service_role 寫入）+ `POST /api/admin/crawlers/wakeone-notice/run` admin-only 手動觸發路由；`runActiveCrawlerSources.ts` 加 `wakeone_notice` case；migration 044 seed 三個 WAKEONE 來源（ZEROBASEONE / Kep1er / izna）；不改 schema / RLS / 前台 UI / 通知 / auth | ✅ PR #126 merged（migration 044 已執行）|
| 89 | SMTOWN notice crawler 實作 | `smtownNotice.ts` HTML parser（`div.noticeTop` 列表 + `span.number/day` + `div.noticeBox` body / `YYYY/MM/DD` 日期 / pinned-`Notice` 用 title-slug 當 noticeId）+ `runSmtownNoticeFetcher.ts` 全流程 fetcher（`?page=N` 三頁、event filter、idol 匹配、**NCT-root unit guard** 攔截 NCT 127 / NCT DREAM / NCT WISH / WayV、J7d-A recheck flow、service_role 寫入）+ `POST /api/admin/crawlers/smtown-notice/run` admin-only 手動觸發路由；`runActiveCrawlerSources.ts` 加 `smtown_notice` case；migration 045 seed 五個 SMTOWN 來源（aespa / RIIZE / Red Velvet / EXO / NCT）；source_url 用 `#smtown-{noticeId}-{idolSlug}` fragment 解決共享 feed 唯一性；不改 schema / RLS / 前台 UI / 通知 / auth | ✅ PR #128 merged，migration 045 已執行（2026-05-23 確認）|
| 90 | 帳號設定 v1 工作單 | `ACCOUNT_SETTINGS_WORK_ORDER.md`：規劃使用者改 email（`supabase.auth.updateUser({ email })` + Supabase 雙重確認）+ 刪除帳號（`POST /api/account/delete` + `auth.admin.deleteUser(user.id)` + service_role 邊界 + 二次確認 modal + 強制 sign out）。盤點 user_follows / saved_events / reminders / notifications / admin_users 全部 ON DELETE CASCADE 完整 → Method A 適用，**v1 無需 migration 046**。涵蓋安全 checklist、UI flow（建議 `/account/settings` 新頁）、OAuth 改 email 風險標註、實作 PR 前置條件。只工作單，不寫 code / 不改 schema / 不新增 migration / 不改 UI | ✅ PR #129 merged |
| 91 | 帳號設定 v1 實作 | 新 `src/app/account/settings/page.tsx`（SSR auth gate，未登入導 `/login?returnUrl=/account/settings`）+ `AccountSettingsClient.tsx`（目前帳號顯示 + Change Email 表單呼叫 `supabase.auth.updateUser({ email })` 走 Supabase 雙重確認 + Danger Zone 顯示刪除範圍 + 二次確認 modal 要求輸入目前 email 才啟用）+ 新 `POST /api/account/delete` server route（`getCurrentUser()` 401 gate、body 一律忽略、`getSupabaseServiceClient().auth.admin.deleteUser(user.id)`、service-role error 只 server-log 不外洩）+ `/me` 把「隱私與帳號」改為連到 `/account/settings` 的 Link（不重設計 /me）。動工前重跑 cascade 盤點確認 Method A 仍適用 → 無 migration / 無 GRANT / 無 RLS / 無新依賴 | ✅ PR #130 merged（手動測試跳過，OAuth 改 email 行為待生產觀察）|
| 92 | Weverse 技術探測工作單 | `CRAWLER_WORK_ORDER_WEVERSE.md`：純研究文件 — 規劃 Weverse 公開無登入頁面探測（藝人 community / notice / media / 活動頁），明確排除 cookie / login / token / 私有 API / 反爬繞路；列 11 條探測問題（HTML server-rendered？__NEXT_DATA__？需登入？分頁？permalink？rate limit？robots.txt？ToS？）；對比 WAKEONE / SMTOWN pattern（per-community URL → 不需共享 feed fragment）；列第一波 HYBE 系候選（BTS / SEVENTEEN / TXT / ENHYPEN / LE SSERAFIM / ILLIT / BOYNEXTDOOR / TWS / KATSEYE / &TEAM / CORTIS）+ 非 HYBE 候選（fromis_9 / ZEROBASEONE / ATEEZ / (G)I-DLE / IVE），**NewJeans / NJZ 明確標 status uncertain**；風險（HYBE/Naver edge 反爬、ToS、會員制 gating、GDPR、區域差異）；Phase A 探測步驟（curl + incognito DevTools，每 community 限 5 page、2s spacing，只觀察不壓測）；三種 verdict（A 可全抓 → 開 runtime 工作單 / B 部分 → 縮範圍 / C 不可 → 放棄）。不寫 runtime / 不新增 parser_type / 不 seed crawler_sources / 不改 schema / 不開 API route / 不碰 UI / 不碰通知 | ✅ PR #131 merged |
| 93 | Weverse Phase A 實地探測 | `WEVERSE_PROBE_REPORT.md`：依工作單 §10 跑 curl 探測，全程 incognito-equivalent（無 cookie / 桌面 Chrome UA）。**Verdict C — 不可無登入抓**。關鍵證據：(1) weverse.io 所有 URL（`/bts`、`/bts/notice`、`/bts/media`、`/bts/notice/{任意 id 包含 invalid}`、甚至 `/sitemap.xml`）全部回 200 + 5478 bytes 完全相同的 React SPA shell；(2) HTML 只有 `<div id="root"></div>` + spinner + Vite asset preloads，零 inline JSON、零 `__NEXT_DATA__`、零內容標籤、零藝人關鍵字；(3) robots.txt 名義上 permissive 但其 cited sitemap 是假的（也是 SPA shell）；(4) ko-KR vs en-US 同 shell；(5) 5×2s 連抓無 429（但只是 CloudFront cache，不代表 API 友善）；(6) SPA preconnect 全指向 `accountapi.weverse.io` / `global.apis.naver.com` 等 account-gated endpoints。觸發工作單 §10.3 hand-off 4 硬規則「需 auth header 自動 verdict C」。**不開 runtime 工作單**、不新增 parser_type / migration / API route，HYBE 系藝人覆蓋缺口維持以 `kpopofficial-concerts` + 人工輸入處理；探測 artifacts 留 `/tmp/wv_*.html` 不入庫 | 🔒 PR opened，等 GPT audit |
| 97 | 快閃店搜尋與呈現實作 | `src/app/schedule/ScheduleClient.tsx`：依 `POPUP_STORE_SEARCH_WORK_ORDER.md` 方案 X 實作。(1) `ScheduleCategory` type：`'brand'` 拆成 `'popup_store' | 'exhibition' | 'brand_event'` 三類；(2) `SCHEDULE_CATEGORIES` chips 從 8 個變 10 個（拆「品牌快閃」為 快閃店 / 展覽 / 品牌活動）；(3) 新增 `SUBTYPE_SEARCH_KEYWORDS` 別名 map（popup_store: '快閃店 快閃 pop-up popup pop up'、exhibition: '展覽 展 exhibition exhibit'、brand_event: '品牌活動 品牌 brand event brand_event'）；(4) `matchesScheduleCategory` 對三個新 case 直接比對 `event.subType`，brand_event 額外保留 `event.type === 'brand'` fallback；`other` case 更新排除三個新類；(5) `getSearchHaystack` 加入 `subTypeLabel`（如「快閃店」，取 `EVENT_SUBTYPE_LABELS`）+ `subTypeKeywords`（別名字串）；(6) 新增 `getEmptyStateMessage(category, searchQuery)` helper，依 active chip 回白標空狀態文案；(7) `TimelineView` 空狀態改用 helper。不改 schema / 不新增 migration / 不碰 EventTypeBadge / 不碰詳情頁渲染（既有 pill 已正確） | ✅ 本 PR |
| 96 | 快閃店搜尋與呈現工作單 | `POPUP_STORE_SEARCH_WORK_ORDER.md`：規劃 `/schedule` 三個子類（popup_store / exhibition / brand_event）的篩選與搜尋。確認無需 migration（migration 041 已加 `event_sub_type` enum 與 `EventTypeBadge` 已渲染三類 icon/label）。盤點兩個 Gap：(A) `getSearchHaystack` 沒包含 subtype label 與關鍵字別名，搜「快閃店」/「pop-up」找不到；(B) 篩選器「品牌快閃」chip 將三類綁一起，無法只看快閃店。提出方案 X（拆 chip + 補搜尋別名，推薦）與方案 Y（只補搜尋，chip 不動）；列 12 條 acceptance criteria、SQL 確認查詢、空狀態文案、別名 map 設計。只工作單，不寫 runtime / 不改 schema | ✅ PR #136 merged（GPT audit 通過方案 X）|
| 95 | 後台用戶統計儀表板實作 | 新 `src/lib/supabase/analyticsStats.ts`（server-only，`getAnalyticsStats()` 回傳 18 欄聚合：auth.users 總數 / 7d / 30d、user_follows / saved_events / reminders / notifications 總數與未讀、admin_users 數、published / draft events、event_candidates 按 review_status / source_type 分組、crawler_sources active / 按 parser_type 分組。service_role block 用 try/catch（key 缺失 → `serviceRoleAvailable = false` + 相關欄位回 null，不 crash），公開表 block 用 `Promise.allSettled` per-query 容錯。GROUP BY 在 JS 端 groupBy 避免 DB function）+ 新 `src/app/admin/analytics/page.tsx`（`force-dynamic`，`getCurrentAdmin()` 未驗證 redirect `/admin/login`，7 個 section：Users / Interactions / Notifications / Content / Candidates / Crawler Sources / Admins，service_role 缺失時顯示 amber banner + `—` 值，純 Server Component）+ `src/app/admin/page.tsx` quick nav 加 `/admin/analytics` 入口 + `src/lib/supabase/serviceClient.ts` 註解新增 `analyticsStats.ts` 為允許 caller。無 migration / 無 GRANT / 無 RLS 變更 / 無 client fetch | ✅ PR #135 merged |
| 94 | 後台用戶統計工作單 | `ADMIN_ANALYTICS_WORK_ORDER.md`：規劃 `/admin/analytics` 聚合統計儀表板 — v1 指標（auth.users 總數 / 新增 7d / 30d、user_follows / saved_events / reminders 聚合與 distinct user_id 數、notifications 總數 / 未讀、published / draft events 數、event_candidates 按 review_status / source_type 分組、crawler_sources active 數 / 按 parser_type 分組、admin_users 數）；v2 指標（cohort / DAU/MAU / per-user drill-down / CSV export / funnel）明確延遲；隱私邊界（純 aggregate count，不回傳任何 email 或 row-level data）；auth.users 存取策略（需 service_role + `eyJ...` JWT，key 缺失時 fallback 顯示 `—`，不 crash）；**GPT audit 修正**：user_follows / saved_events / reminders / notifications 因 user-scoped RLS 全站 aggregate 也可能需要 service_role，runtime PR 前必須 audit RLS，service_role 缺失時這些表也顯示 `—`（events / event_candidates / crawler_sources / admin_users 無 user-scoped RLS 不受影響）；資料來源盤點（9 張表各有 service_role 需求標旗修正）；技術路徑 A（Server Component + service_role props，推薦）vs B（API route + client fetch，備選）；UI wire-level sketch（7 個 section）；風險（service_role 設錯 / user-scoped RLS 攔截 / Vercel cache / 無 activity log）；acceptance criteria 20 項全核取。只工作單，不寫 dashboard runtime / 不新增 API route / 不改 schema / 不新增 migration / 不執行 SQL / 不碰 auth 實作 / 不碰 service_role 實作 / 不改前台 UI / 不改 crawler / 不改 notifications | ✅ PR #133 merged（GPT audit patch 已補）|

| 98 | SMTOWN additional crawler sources（migration 046）| `supabase/migrations/046_seed_smtown_notice_additional_sources.sql`：為 8 個尚未接入 smtown_notice 的 SM 藝人新增 `crawler_sources` seed rows（NCT 127 / NCT DREAM / NCT WISH / SHINee / Super Junior / TAEYEON / TVXQ / Hearts2Hearts）。前置確認：8 個 slug 全部 is_active=true ✅；8 個 source_key 無衝突 ✅；NCT unit matching 安全分析：fetcher 以各 idol 的 `alt_names` 建立 matchIndex，unit-specific notices 乾淨隔離（nct-127 只匹配含「NCT 127」的 title；nct root 有 NCT_UNIT_NAMES_LOWER guard 攔截 unit 名稱）；source_url fragment `#smtown-{noticeId}-{idolSlug}` 確保 source_hash 跨 source 無衝突。不改 parser / 不改 runtime / 不改 schema。| ✅ migration 046 已執行（2026-05-23 二次確認，8 筆全部正確）|
| 99 | Jo Yuri WAKEONE notice seed + Starship Phase A probe | Phase A 探測：(1) jo-yuri slug 確認 is_active=true；(2) wake-one.com/notice/ 200 OK server-rendered WordPress ✅；(3) runWakeoneNoticeFetcher 以 per-idol matchIndex 匹配 → 僅標題點名 Jo Yuri 的公告進候選池；(4) `#wakeone-{idolSlug}` fragment 確保 source_hash 唯一。migration 047 seed 1 筆（jo-yuri-wakeone-notice）。Starship Phase A probe：starshipent.com 被 Cloudflare 封（301→shopstarship.com + bot protection），starshipentertainment.com 是加拿大舞蹈公司（非目標），IVE/MONSTA X/CRAVITY/KiiiKiii 主要走 Weverse（Verdict C），建議全走 Google Discovery。工作單：`CRAWLER_WORK_ORDER_STARSHIP.md` | ✅ PR #142 merged，migration 047 已執行（2026-05-23 二次確認）|
| 100 | P1 Search Discovery Provider 工作單 | `SEARCH_DISCOVERY_WORK_ORDER.md`：規劃引入 Google Custom Search JSON API 作為 Search Discovery layer，補 HYBE / Starship / THEBLACKLABEL / 個人歌手 / 快閃店 / 串流等 crawler 無法覆蓋缺口。v1 暫定首選 Google PSE（runtime PR 前須 3–5 組人工查詢驗證命中品質後正式定案）。候選收錄：全部進 `event_candidates`（review_status='pending'），source_type 沿用 'other'，不新增 enum / migration。成本：每日 100 queries 免費額度，runtime 必須設 maxQueriesPerRun 保護。Claude Haiku 解析邊界：manual preview 優先、maxParsePerRun 上限、失敗不自動補完整欄位。v1 只做手動觸發，不設 cron。含與 YouTube P2-A/P2-B 分工說明。 | ✅ PR #149 merged |
| 101 | P1-A Google PSE Manual Probe | `GOOGLE_PSE_PROBE_REPORT.md`：人工探測 Google PSE 作為 v1 Search Discovery provider。Verdict Deferred：(1) 免費版無法搜尋全網，只能 trusted-site；(2) Custom Search JSON API 呼叫回 403（需 Cloud API Library 啟用 + billing）；(3) 門檻超出 v1 輕量預期。下一步改評估替代方案 → P1-B Claude Webpage Discovery。 | ✅ PR #151 merged |
| 102 | P1-B Claude Webpage Discovery 工作單 | `CLAUDE_WEBPAGE_DISCOVERY_WORK_ORDER.md`：規劃 `generic_webpage` parser — 管理員提供 URL 後，fetch 公開頁 HTML、cheerio 清理、送 Claude Haiku 解析 K-pop 活動、preview/commit 兩模式、全部進 `event_candidates`（review_status='pending'）人工審核。確認 parser_type 為 plain text（無需 schema migration）；RunSourceButton / runActiveCrawlerSources 需各加一個 case + cron guard（runtime PR 範圍）；新 source 透過 migration 049 seed。成本控制：maxPagesPerRun=1 / maxTextLength=8000 / maxEventsPerPage=10 / maxCandidatesPerRun=5。不進 cron，v1 純手動觸發。 | 🔲 待 GPT audit |

---

## 後續工作排程（規劃中，尚未開工作單）

按建議優先順序排列。每一項都是「先開工作單，不直接寫 runtime」的方向。實際開工前需使用者下令，並依 `CLAUDE.md` 高風險任務流程（涉 API key / 爬蟲 / schema 的須先工作單 PR、等 GPT audit）執行。

| # | 方向 | 目的 / 範圍 | 工作單要回答 | 優先 | 依賴 |
|---|---|---|---|---|---|
| P1 | Search Discovery Provider 工作單 | 評估是否引入 **Google Programmable Search / Google Search / SerpAPI / Brave Search** 作為 discovery layer，補爬蟲沒覆蓋到的長尾來源（如 ktown4u / linefriendssquare / visitseoul 等定向 `site:` 查詢）。**只工作單**：不寫 code、不新增 API key、不改 crawler、不改 schema、不改 `event_candidates`、不碰前台 UI | (1) Google 搜尋是否比 Claude web search 更適合作 discovery？(2) 「Google 找 URL + Claude 判斷與抽欄位」是否為 v1 最佳分工？(3) 是否支援 `site:ktown4u.com` / `site:linefriendssquare.com` / `site:visitseoul.net` 定向搜尋？(4) 成本、配額、rate limit、查詢策略如何控管？(5) 搜尋結果如何進 `event_candidates`？(6) **搜尋結果不得直接 publish，必須走後台審核**（既有政策）(7) v1 是否先「人工搜尋 + Claude 判斷」、不急著接 API？ | 中高 | 建議在「快閃店來源盤點」完成後做（盤點先確定哪些來源需要 discovery 補洞） |
| P2 | Streaming / Video Source Inventory 工作單 | 盤點 YouTube / Netflix / Disney+ / 其他串流平台，建立藝人影片來源策略。**只工作單**：不寫 code、不新增 crawler runtime、不接 YouTube API key、不抓 Netflix / Disney+ 私有 API、不做 login / cookie / app API、不改 schema | (1) YouTube 是否用官方 YouTube Data API 做 public search？(2) YouTube 可收哪些類型：MV / teaser / behind / live performance / premiere / livestream / concert film trailer / official channel upload？(3) Netflix / Disney+ 沒合適公開 API 時，是否只透過官方新聞稿 / 媒體文章 / Google discovery / 人工候選？(4) 哪些內容該進 `event type = streaming` / `media`？(5) 是否需要新增 `platform` 欄位或沿用既有 `event metadata`？(6) 如何記錄 availability region / platform link / release date？(7) 如何避免收錄盜版影片、非官方 reupload、fan upload？(8) **所有候選都必須進 `event_candidates`，不直接 publish** | 中高 | 建議在 P1 之後（YouTube 公開搜尋與 Google discovery 策略相關） |
| P2 工作單（PR pending GPT audit）| `STREAMING_VIDEO_SOURCE_WORK_ORDER.md`（PR 本輪開）| 已覆蓋全部 8 個問題：YouTube Data API v3（免費 10k units/day）、channelId seed 用 crawler_sources.config jsonb、Netflix/Disney+ 走 Google Discovery + manual candidate、EventType 映射（streaming/official/media 不需新 enum）、schema v1 沿用 metadata jsonb（不需 migration）、region 用 metadata.region、anti-piracy filter（只信已 seed channelId、排除 fan-cam/unofficial/cover 特徵）、建議執行順序 P2-A YouTube crawler → P2-B Google Discovery 接串流 → P2-C sub_type migration（按需）。**等 GPT audit 通過後再開 runtime 工作單** | | |

> 註：兩項皆「工作單先行」。任一項實際開工時，先依 `CLAUDE.md` § 高風險任務 開一個 `*_WORK_ORDER.md` 規劃 PR，等 GPT audit 通過再開 runtime 實作 PR。

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
| 042 | Create notifications table（user-scoped RLS + service_role INSERT + type CHECK + (user_id, dedupe_key) UNIQUE index + user_created_at / user_unread partial index）— N3 v1 資料模型 | ✅ 已執行 |
| 043 | Seed 16 主流漏網藝人（M1b-4）：Lee Young Ji / QWER / BIBI / Jay Park / Chungha / Sunmi / Baekhyun（P0）+ Jannabi / Epik High / Dynamicduo / Crush / Heize / Dean / Paul Kim（P1）+ Jo Yuri / DAESUNG（P2）；ON CONFLICT DO NOTHING；不改 schema / GRANT / crawler | ✅ 已執行（2026-05-22）|
| 044 | Seed WAKEONE notice crawler_sources：zerobaseone-wakeone-notice / kep1er-wakeone-notice / izna-wakeone-notice；全指向 `https://wake-one.com/notice/`，`parser_type = 'wakeone_notice'`，`source_type = 'official_website'`；ON CONFLICT (source_key) DO UPDATE；不改 schema / GRANT / RLS | ✅ 已執行 |
| 045 | Seed SMTOWN notice crawler_sources：aespa-smtown-notice / riize-smtown-notice / red-velvet-smtown-notice / exo-smtown-notice / nct-smtown-notice；全指向 `https://www.smtown.com/notice`，`parser_type = 'smtown_notice'`，`source_type = 'official_website'`；ON CONFLICT (source_key) DO UPDATE；不改 schema / GRANT / RLS | ✅ 已執行（2026-05-23 確認，5 筆全部正確）|
| 046 | Seed 額外 SMTOWN notice crawler_sources：nct-127 / nct-dream / nct-wish / shinee / super-junior / taeyeon / tvxq / hearts2hearts；8 筆；同 045 pattern；NCT unit matching 安全確認（unit-specific alt_names + NCT_UNIT_NAMES_LOWER guard）；ON CONFLICT (source_key) DO UPDATE；不改 parser / schema / RLS | ✅ 已執行（2026-05-23 二次確認，8 筆全部正確）|
| 047 | Seed Jo Yuri WAKEONE notice crawler_source：jo-yuri-wakeone-notice；1 筆；source_url = `https://wake-one.com/notice/`；parser_type = `wakeone_notice`；Phase A probe 確認 Jo Yuri 已加入 WAKEONE（wake-one.com/artists/joyuri/ 確認）+ notice board server-rendered WordPress + fetcher per-idol 匹配安全；ON CONFLICT (source_key) DO UPDATE；不改 parser / schema / RLS | ✅ 已執行（2026-05-23 二次確認；source_key / parser_type / is_active / slug / name 全部正確）|
| 048 | Seed 19 個 P0 YouTube 官方頻道 crawler_sources（parser_type=`youtube_official_channel`，source_type=`official_website`）；全部 `is_active = false`，`config` 含 channelId / uploadsPlaylistId placeholder / maxVideosPerRun=10 / publishedAfterHours=25；ON CONFLICT (source_key) DO UPDATE 不覆蓋 config / is_active；不改 schema / GRANT / RLS | ✅ 已執行（2026-05-23；BTS source 已填入真實 channelId/uploadsPlaylistId 並成功執行，last_status=success）|

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
