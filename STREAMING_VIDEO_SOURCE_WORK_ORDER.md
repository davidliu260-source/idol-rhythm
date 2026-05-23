# Streaming / Video Source Inventory 工作單（P2）

> **版本**：v1 — 2026-05-23  
> **範圍**：只做技術評估與策略規劃，不寫 code、不新增 API key、不改 crawler、不改 schema、不改 `event_candidates`、不碰前台 UI。  
> **上游**：Search Discovery Provider 工作單（`SEARCH_DISCOVERY_PROVIDER_WORK_ORDER.md`，PR #140）已確立 Google Discovery 為長尾補洞機制；Starship Phase A probe（`CRAWLER_WORK_ORDER_STARSHIP.md`，PR #143）確認 IVE / MONSTA X / CRAVITY / KiiiKiii 暫走 Google Discovery。  
> **下游**：本工作單 GPT audit 通過後，依 §八決策輸出選擇方案，再開對應 runtime 工作單。

---

## 一、背景與問題

K-pop 影音內容是偶像活動的核心，但目前 idol-rhythm 完全沒有串流 / 影片來源覆蓋：

| 現有覆蓋 | 空缺 |
|---|---|
| 演唱會 / 見面會（kpopofficial / JYP / YG schedule）| MV release、comeback showcase 影音 |
| 官方公告 / 快閃店（SMTOWN / WAKEONE notice）| Netflix / Disney+ 音樂紀錄片 / 演唱會影片 |
| 品牌活動 / 展覽 | YouTube Official Channel 新上架影片通知 |

使用者最常問的兩類影音活動：
1. **MV / comeback showcase 發布** — 何時上 YouTube？什麼時候有新專輯？
2. **串流平台首播** — Netflix / Disney+ 的演唱會影片、紀錄片何時上線？

這兩類已有對應 EventType：`official`（MV release）、`streaming`（Netflix / Disney+ 上線）、`media`（電視節目、綜藝）。問題是來源還沒接。

---

## 二、範圍邊界（本工作單不做）

| 禁止 | 原因 |
|---|---|
| 申請或設定任何 API key（YouTube Data API / Netflix / Disney+）| runtime 工作單才做 |
| 寫任何 fetcher / parser / crawler runtime | 工作單先行 |
| 修改 events / event_candidates schema 或新增 migration | v1 先用既有欄位 |
| 改現有爬蟲邏輯 | 不動既有 parser |
| 碰前台 UI | 無關 |
| 開 headless browser 抓 SPA | v1 明確排除 |
| 直接 publish 任何影片 / 串流候選 | 永遠走 `event_candidates` → admin 審核 → publish |
| 抓 Instagram / X / TikTok 影片 | v1 排除（需登入 / 私有 API）|
| 抓 Weverse 影片 | Verdict C，排除 |
| 抓非官方 fan upload / 二次剪輯 / 字幕版 | 品質邊界，不抓 |

---

## 三、YouTube 策略分析

### 3-A. YouTube Data API v3 概覽

| 項目 | 評估 |
|---|---|
| 公開 API？ | ✅ 是。YouTube Data API v3 有公開配額，不需 OAuth |
| 免費配額 | 10,000 units/day（每次 search 消耗 100 units → 每日可做 100 次 search）|
| 月成本（免費內）| $0 USD（Google Cloud 10,000 units free tier）|
| 月成本（超配額）| $0.60 / 千 units，超過部分計費 |
| 可搜尋欄位 | channelId（指定官方頻道）、keyword、type=video、publishedAfter |
| 可取得欄位 | 影片 title / description / publishedAt / thumbnail / channelId / videoId |
| 官方頻道辨識 | 需提前 seed 每個藝人的官方 YouTube Channel ID |
| 需登入？ | ❌ 不需要（API key 即可，無 OAuth）|

### 3-B. 應收哪些影片類型

**應收（`event_candidates` → 審核後 publish）：**

| 類型 | EventType | EventSubType | 說明 |
|---|---|---|---|
| MV 首播 | `official` | `release` | 官方頻道 MV 首發（含 performance MV / lyric video） |
| Comeback Showcase 直播存檔 | `official` | `release` | 直播後的 showcase 存檔影片（非直播本身）|
| Concert Film / Concert 影片 | `streaming` | —（視平台）| YouTube 官方頻道全場演唱會影片 |
| Teaser / Short Clip | `official` | `announcement` | 官方釋出的 teaser、preview、highlight clip |
| Official Behind / Making Film | `media` | `interview` | 官方釋出的幕後花絮（非用戶上傳）|

**不收（邊界排除）：**

| 類型 | 排除理由 |
|---|---|
| Fan-cam / 粉絲錄影 | 非官方，無法驗證來源 |
| 二次剪輯 / 合輯 / 字幕版 | 非原始官方上傳 |
| 官方剪輯的廣告 / 商業宣傳 | 不是藝人活動 |
| 個別成員個人頻道（非團體官方）| 需另外評估，v1 先不收 |
| 反應視頻 / 討論視頻 | 完全排除 |

### 3-C. 官方頻道辨識與 Channel ID Seed 策略

**核心問題**：YouTube search keyword 結果混雜官方 / 非官方頻道，不能用 keyword 盲目抓。

**v1 策略**：

1. 維護一份 `youtube_channel_id` per idol（可寫入 idols table 新欄位，或用 crawler_sources config jsonb 記錄）
2. Fetcher 只對已知官方 Channel ID 抓最新影片（`channels.list` + `search.list?channelId=xxx&type=video&order=date&publishedAfter=24h ago`）
3. 未收錄 Channel ID 的藝人不抓，不做 keyword 盲搜

**Channel ID 的 seed 方式（v1）**：

- admin 後台手動填寫（現有 EditIdolForm 可加欄位）
- 或 `crawler_sources.config jsonb` 新增 `{ "channelId": "UCxxxxx" }` 欄位，沿用現有架構

**推薦**：用 `crawler_sources.config jsonb`，不需 migration（config 本身已是 jsonb）：

```json
{
  "channelId": "UCXXXXXXxxx",
  "publishedAfterHours": 25
}
```

### 3-D. YouTube API 反濫用守則

- 每個藝人每次 search 消耗 100 units → 91 個 active idol 全跑一輪 = 9,100 units（在免費配額內）
- Cron 最多每日一次（Vercel Hobby plan 限制 daily，與 N6/N7 cron 錯開排程）
- 抓 `publishedAfter = 25小時前`（與 N7 視窗一致，避免漏洞）
- 永遠只信 channelId 過濾，不做 keyword 盲搜

---

## 四、Netflix / Disney+ 策略分析

### 4-A. 公開 API 現況

| 平台 | 公開 API？ | 說明 |
|---|---|---|
| Netflix | ❌ 無公開 API | 官方無提供內容搜尋 API；JustWatch 有非官方 API 但 ToS 不允許商業用途 |
| Disney+ | ❌ 無公開 API | 同上，無公開 API |
| TVING / Wavve / Viu | ❌ 無公開 API | 韓國 / 東南亞 串流，無公開 API |
| Apple TV+ | ❌ 無公開 API | 同上 |

**結論**：所有主要串流平台均無適合公開 API。

### 4-B. 替代來源策略

| 來源類型 | 可行性 | 說明 |
|---|---|---|
| 官方新聞稿 / press release | ✅ 高 | Netflix / Disney+ 韓國發布的官方 press release（通常有 release date）|
| 韓國媒體報導（naver / osen）| ✅ 高 | 串流發行消息幾乎全部有韓國媒體報導 |
| Google Discovery | ✅ 高 | `site:netflix.com "BTS"` / `"BLACKPINK" Netflix documentary 2026` 等 query 可找到發布頁 |
| 官方 YouTube teaser | ✅ 高 | Netflix / Disney+ 的官方 YouTube 頻道通常在 release 前發 teaser → YouTube crawler 可以先抓 teaser |
| 人工 manual candidate | ✅ 穩 | admin 看到消息後直接後台匯入候選 |
| JustWatch API | ❌ 不用 | ToS 禁止非 JustWatch 平台用途的 API 呼叫 |
| Netflix / Disney+ app API | ❌ 不用 | 私有 API，需 auth，v1 排除 |
| Headless browser 抓平台頁 | ❌ 不用 | v1 明確排除 |

**v1 推薦路徑**：

1. **Google Discovery（主路徑）**：等 Search Discovery Provider runtime 上線後，加入 `"BTS" Netflix 2026`、`"BLACKPINK" Disney+ 2026` 等 query template，找到 press release / 平台頁 URL，交 Claude Haiku 解析
2. **YouTube teaser 捎帶（副路徑）**：Netflix / Disney+ 旗下演唱會影片通常在 YouTube 上有 official teaser，YouTube crawler 抓到 teaser → `event_candidates`，admin 審核後可補 streaming 詳情
3. **manual candidate（保底）**：admin 手動補入，維持人工把關

### 4-C. 其他串流平台

| 平台 | K-pop 相關性 | v1 策略 |
|---|---|---|
| V LIVE（已合併入 Weverse Video）| 低（舊存檔）| 不收（Weverse Verdict C）|
| JTBC / tvN / MBC / SBS | 中（綜藝節目）| 屬 `media` 類，走 Google Discovery / 人工 |
| YouTube Music / YouTube Premium | 低（Concert film 已在 YouTube）| 沿用 YouTube crawler 覆蓋 |

---

## 五、EventType 映射表

本工作單確認以下映射，**不需要新增 event_type enum 值**（`streaming` / `media` / `official` 已涵蓋）：

| 內容類型 | event_type | event_sub_type | 來源路徑 |
|---|---|---|---|
| MV 首播 | `official` | `release` | YouTube official channel |
| 專輯預告 / teaser | `official` | `announcement` | YouTube official channel |
| Comeback showcase 存檔 | `official` | `release` | YouTube official channel |
| Netflix 演唱會 / 紀錄片首播 | `streaming` | —（尚無適合 subtype）| Google Discovery + manual |
| Disney+ 演唱會 / 紀錄片首播 | `streaming` | —（尚無適合 subtype）| Google Discovery + manual |
| YouTube 全場演唱會影片 | `streaming` | —（尚無適合 subtype）| YouTube official channel |
| 電視綜藝首播 / 特別節目 | `media` | `variety` | Google Discovery + manual |
| 電視採訪 / 音樂節目 | `media` | `musicshow` / `interview` | Google Discovery + manual |
| Making film / behind content | `media` | `interview` | YouTube official channel |

> **注意**：`streaming` 目前無 event_sub_type，v1 維持空值。若未來要細分 Netflix / Disney+ / YouTube Premium，可再開 migration 新增 `concert_film` / `documentary` 等 sub_type。

---

## 六、Schema 分析 — 是否需要新增欄位？

### 6-A. 現有欄位是否足夠？

| 需求 | 現有欄位 | 夠用？ |
|---|---|---|
| 平台名稱（Netflix / Disney+ / YouTube）| `metadata jsonb`（events / event_candidates）| ✅ v1 夠用 |
| 影片 URL / 平台連結 | `source_url`（event_sources）| ✅ 夠用 |
| 發布日期 | `date`（events）| ✅ 夠用 |
| 日期區間（如串流上線到下架）| `start_date` / `end_date`（migration 041 已加）| ✅ 夠用 |
| 地區限制（region availability）| `metadata jsonb` | ✅ v1 夠用（jsonb 記錄）|
| 影片 YouTube Channel ID（fetcher 用）| `crawler_sources.config jsonb` | ✅ 夠用（現有 config 欄位）|
| 是否官方頻道驗證 | `crawler_sources` is_official（現無）| ⚠️ v1 可靠 admin 種 source 確保，不需新欄位 |

**v1 結論：不需要新增 migration 或 schema 變更。** 所有必要資訊可透過：
- `events.metadata jsonb`：記錄 `{ "platform": "Netflix", "region": "global", "youtube_video_id": "xxxxx" }`
- `crawler_sources.config jsonb`：記錄 `{ "channelId": "UCxxxxx", "publishedAfterHours": 25 }`

### 6-B. v2 可能需要的欄位（延後）

- `events.platform` text（專用平台欄位，利於 filter / index）
- `events.region_availability` text[]（地區陣列，利於地區篩選）
- `event_sub_type` 新增 `concert_film` / `documentary`

---

## 七、資料品質與反盜版規則

所有影音候選進 `event_candidates` 前，fetcher 或 admin 必須確認：

1. **來源是官方 Channel / 官方頁面**：
   - YouTube：只信已 seed 的 channelId，不信 keyword 搜尋結果
   - Netflix / Disney+：只信有官方 URL（netflix.com / disneyplus.com）的連結，或官方 press release
2. **排除以下特徵的影片**（fetcher 層 filter）：
   - Channel title 包含「Fan Cam」/ 「Unofficial」/ 「Reaction」/ 「Cover」/ 「Fanmade」
   - 影片 description 含「All rights to」/ 「I do not own」/ 「No Copyright Infringement Intended」
   - 影片 viewCount < N（anti-spam，具體值 runtime 工作單再定）
3. **trust_level 設定**：
   - 官方 YouTube 頻道 → `trust_level = 'official'`
   - Google Discovery / 媒體報導 → `trust_level = 'media'`
   - 任何未確認來源 → `trust_level = 'pending'`，不得 publish

---

## 八、決策輸出（GPT audit 需回答）

以下問題是本工作單的審查要點，由 GPT 裁定後再開 runtime 工作單：

| # | 問題 | 影響 |
|---|---|---|
| Q1 | YouTube Data API v3 是否為 v1 YouTube 來源主路徑？（推薦「是」）| 決定是否申請 API key |
| Q2 | YouTube channel seed 策略：用 `crawler_sources.config jsonb` 還是 idols table 新欄位？| 決定 runtime 設計 |
| Q3 | Netflix / Disney+ v1 只走 Google Discovery + manual candidate，不做直接爬取，是否同意？| 決定 runtime 複雜度 |
| Q4 | MV release 應歸 `event_type = 'official'` + `sub_type = 'release'`，還是要新增 streaming sub-type 如 `mv_release`？| 決定是否需要 migration |
| Q5 | `streaming` event_type 的 event_sub_type v1 先維持 NULL，v2 再新增 `concert_film` / `documentary`，是否同意？| 決定 migration 時間點 |
| Q6 | region availability v1 只用 `metadata.region` jsonb，v2 再考慮 text[] 欄位，是否同意？| 決定 migration 時間點 |
| Q7 | YouTube crawler cron 排程頻率：每日一次（與 N6/N7 錯開）是否符合需求？還是需要每 12 小時？| 決定 cron 配置 |
| Q8 | 是否先做 YouTube crawler 工作單，再做 Google Discovery runtime 接 Netflix / Disney+？（建議按此順序）| 決定 PR 拆分順序 |

---

## 九、建議執行順序（工作單通過後）

```
P2-A：YouTube Official Channel Crawler 工作單
      → 設計 YouTube Data API v3 fetcher、channelId seed 策略、cron 配置
      → GPT audit 後再開 runtime PR

P2-B：Google Discovery 接 Netflix / Disney+ 工作單
      → 依 Search Discovery Provider 決策完成後配套
      → 設計 query template / 候選過濾策略

P2-C（按需）：streaming sub_type migration 工作單
      → 僅在 Q4/Q5 裁定需要新 sub_type 時才開
```

---

## 十、不做的事（邊界確認）

- ❌ 不寫任何 fetcher / parser（工作單先行）
- ❌ 不申請 YouTube Data API key（runtime 工作單才做）
- ❌ 不新增 migration（v1 沿用現有欄位）
- ❌ 不新增 parser_type（runtime 工作單才決定）
- ❌ 不新增 crawler_sources seed（runtime 工作單才 seed）
- ❌ 不碰前台 UI / 篩選器
- ❌ 不碰通知系統
- ❌ 不抓 Weverse（Verdict C）
- ❌ 不抓 Instagram / X / TikTok
- ❌ 不用 headless browser
- ❌ 不直接 publish 任何候選
