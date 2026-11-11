# P1 Search Discovery Provider 工作單

> **類型**：規劃工作單（只做研究與決策，不寫 runtime、不改 DB、不新增 migration、不改前台 UI）
> **狀態**：待 GPT audit
> **優先**：P1（繼 P2-A1 YouTube crawler 完成後）

---

## 1. 目標

引入 **Search Discovery Layer**，補充現有官方 crawler 與 YouTube crawler 無法覆蓋的網頁來源，提升 K-pop 活動候選資料的廣度與新鮮度。

本工作單目標：
- 評估 v1 搜尋提供者選項，暫定首選並說明正式定案前提條件
- 設計查詢策略（`site:` 定向搜尋、關鍵字策略、per-idol query 設計）
- 確定候選收錄流程（進 `event_candidates`，走後台審核，不自動 publish）
- 估算成本 / 配額 / rate limit，說明每日免費額度上限與保護機制
- 說明 Claude Haiku 解析邊界（manual preview 優先、解析失敗不自動補完）
- 決定 v1 是否先「人工搜尋 + Claude 判斷」，不急著接 API

---

## 2. 為什麼需要 Search Discovery

目前已建立的爬蟲覆蓋：

| 來源 | 覆蓋藝人 | 限制 |
|---|---|---|
| `jyp_schedule` | JYP 系（TWICE/Stray Kids/ITZY/NMIXX/DAY6/XH/2PM/J.Y.Park）| JYP 獨有 JSON endpoint |
| `yg_artist_schedule` | BLACKPINK group / BABYMONSTER / TREASURE | YG 獨有 JSON endpoint |
| `kpopofficial_concerts` | 聚合多藝人演唱會 | 限演唱會類型，長尾來源補足有限 |
| `wakeone_notice` | ZEROBASEONE / Kep1er / izna / Jo Yuri | 僅 WAKEONE 公司 |
| `smtown_notice` | SM 系（aespa / RIIZE / Red Velvet / EXO / NCT 系 / SHINee / TVXQ 等）| 僅 SMTOWN |
| `youtube_official_channel`（P2-A1）| BTS（已驗收）+ 18 個 is_active=false | 限官方頻道有上傳活動，按需啟用 |

**無法覆蓋的缺口**：

- **HYBE 系**（BTS / SEVENTEEN / TXT / ENHYPEN / LE SSERAFIM / ILLIT 等）：Weverse 探測 Verdict C（全 SPA，無登入無法抓），YouTube 按需啟用，主要靠 kpopofficial 演唱會聚合
- **Starship 系**（IVE / MONSTA X / CRAVITY / KiiiKiii）：starshipent.com 被 Cloudflare 封，主要走 Weverse（Verdict C）
- **THEBLACKLABEL**（TAEYANG / ROSE solo 等）：無獨立 crawler
- **個人歌手**（IU / G-DRAGON / TAEYEON / Rain / Baekhyun / Sunmi / Chungha 等）：各自官網差異大，難以統一 parser
- **快閃店 / 展覽 / 品牌活動**：ktown4u / LINE FRIENDS / Visit Seoul / 品牌官網等，分散且無規律 feed
- **串流 / 影片 premiere**：Netflix / Disney+ 無公開 RSS / JSON，通常靠新聞稿或媒體文章
- **長尾演唱會 / fan meeting**：票務平台（Ticketmaster / Interpark / YES24 等）有活動資料但非 RSS

---

## 3. 與 YouTube P2-A / P2-B 的分工

| | YouTube Official Channel（P2-A）| Search Discovery（P1）|
|---|---|---|
| **已完成** | P2-A1 runtime 完成，BTS 驗收成功，18 個 sources is_active=false | 本工作單（runtime 待後續 PR）|
| **覆蓋類型** | 藝人官方頻道上傳：MV / teaser / behind / live / premiere / concert film trailer | 網頁搜尋發現：活動公告 / 票務頁 / 品牌合作 / 快閃店 / 媒體報導 / 串流新聞稿 |
| **觸發條件** | 藝人有近期 comeback / MV premiere / livestream → 按需啟用對應 source | 任何 crawler 沒覆蓋到的網頁來源 → site: 定向搜尋或關鍵字查詢 |
| **擴張計畫** | P2-A2 cron 暫緩；P2-B YouTube Discovery 未來可做，不是現在 | P1 v1 先做工作單 → GPT audit → runtime PR |
| **互補關係** | Search Discovery **不取代** YouTube；YouTube 負責官方頻道影片事件；Search Discovery 負責 YouTube / 官方 crawler 無法覆蓋的**網頁文字來源** | |

---

## 4. 技術選項評估

### 4.1 選項比較

| 提供者 | 免費額度 | 付費 | site: 支援 | 回傳格式 | 備註 |
|---|---|---|---|---|---|
| **Google Programmable Search Engine (PSE)** | 100 queries/day | $5 / 1000 queries | 支援 | JSON | 需建立 CSE 引擎（可設搜全網 or 特定站點）；API key 需要 |
| **Google Custom Search JSON API** | 同上（PSE 的 API 形式）| 同上 | 支援 | JSON | 實質上同 PSE，推薦採用此形式 |
| **SerpAPI** | 100 searches/month | $50/month（5000）| 支援（`q=site:xxx`）| JSON（結構化）| 代理 Google 結果；月額度遠低於 PSE 日額度 |
| **Brave Search API** | 2000 queries/month | $3 / 1000 queries | 部分支援 | JSON | 獨立索引，非 Google；site: 效果弱於 Google |
| **Claude web_search（Anthropic built-in）**| — | 按 token 計費 | 不支援 site: | 自然語言結果 | 適合單次 ad-hoc；不適合批量定向搜尋；無程式化 JSON 回傳 |

### 4.2 v1 暫定首選：Google Custom Search JSON API（PSE）

Google Custom Search JSON API 為 v1 **暫定首選**，但 runtime PR 開工前，須先以 3–5 組人工查詢（不接 API，直接在 Google 搜尋介面測試）驗證以下命中品質，確認後才正式定案：

- 目標站點（ktown4u / visitseoul / ticketmaster）的 site: 查詢命中率是否達到預期
- 搜尋結果 title / snippet 是否包含足夠的活動日期 / 地點資訊供 Claude Haiku 解析
- 結果是否以粉絲站 / 非官方內容為主（若命中率低於 50% 視為不合格，需重新評估提供者）

暫定選用理由：
- 免費額度每日 100 queries，v1 手動觸發量可控
- 支援 `site:` 定向搜尋
- JSON 結構化回傳（title / link / snippet）直接可程式化處理
- 超過免費額度時付費成本可控（$5 / 1000 queries）

### 4.3 v1 策略：先手動觸發，不設 cron

- v1 不設定 cron job
- 只開 `POST /api/admin/crawlers/search-discovery/run` admin-only 手動觸發路由
- 每次觸發時帶入查詢參數（`q`、`siteRestrict`、`idol`）
- 後台管理員手動確認結果後再選擇寫入候選池
- 確認 v1 有效後，再評估是否加入 cron fan-out

---

## 5. 查詢策略設計

### 5.1 查詢類型

| 類型 | 範例查詢 | 目標缺口 |
|---|---|---|
| **per-idol + 活動關鍵字** | `"SEVENTEEN" concert 2026 site:ticketmaster.com` | 票務平台 |
| **per-idol + 快閃店** | `"IU" pop-up store 2025 2026` | 快閃店 / 展覽 |
| **site: 定向搜尋** | `site:ktown4u.com BLACKPINK 2026` | ktown4u 品牌活動 |
| **media / streaming** | `"aespa" Netflix OR "Disney+" 2026 release` | 串流節目 / 紀錄片 |
| **HYBE 補洞** | `"TXT" tour 2026 OR concert OR showcase` | Weverse Verdict C 缺口 |
| **brand collaboration** | `"LE SSERAFIM" brand event collaboration 2026` | 品牌活動 |

### 5.2 per-idol query 生成

- 優先使用 `idols.name`（英文）+ `idols.alt_names`（如有韓文拼音）
- 加入年份過濾（`2025 OR 2026`）
- 加入事件類型關鍵字（`concert OR tour OR showcase OR fan meeting OR pop-up OR premiere`）
- 不使用捆綁查詢（禁止 `A B C concert`），每個 idol 獨立查詢

### 5.3 site: 候選清單（v1 優先）

| 站點 | 類型 | 目標藝人 |
|---|---|---|
| `site:ktown4u.com` | 品牌活動 / 快閃店 | 全藝人 |
| `site:linefriendssquare.com` | 快閃店 / 展覽 | LINE FRIENDS 合作 |
| `site:visitseoul.net` | 觀光活動 / 演唱會 | 首爾大型活動 |
| `site:interpark.com` | 票務 | 韓國本地演唱會 / fan meeting |
| `site:melon.com` | 音樂節 / 試聽 | 全藝人 |
| `site:yes24.com` | 票務 | 韓國本地 |
| `site:ticketmaster.com` | 票務（北美）| HYBE / SM / YG 全球巡演 |

---

## 6. 候選收錄流程

**鐵則：搜尋來源一律視為低信任，所有結果都必須進 `event_candidates` 等待人工審核，不得直接 approve 或 publish。**

```
Google Custom Search API
    |
    v
結果 JSON（title / link / snippet）
    |
    v
[可選] Admin manual discovery preview
    管理員先瀏覽結果清單，確認值得解析後再觸發寫入
    |
    v
Claude Haiku 解析（每次限制筆數，見 §6.1）
    -> 判斷是否為 K-pop 活動
    -> 嘗試抽取 idol / date / location / event_type
    -> 生成 source_hash（SHA-256 of search_result_url）
    |
    v
寫入 event_candidates
    review_status = 'pending'
    source_type = 'other'
    raw_data jsonb 存原始 title / link / snippet / provider metadata
    |
    v
後台管理員審核 -> approve -> 發布
```

### 6.1 Claude Haiku 解析邊界

- **v1 優先做 admin manual discovery preview**：管理員先看搜尋結果清單，選擇要解析的項目，再批量或單筆觸發 Claude Haiku 解析，不自動全量解析
- **每次解析筆數上限**：runtime PR 必須設定 `maxParsePerRun`（建議 v1 為 20 筆），超過則截斷並告知管理員
- **解析失敗或低信心的候選**：
  - 不得自動補完整欄位（idol / date / location 等）
  - 保留原始 `title` / `link` / `snippet` 寫入 `event_candidates.raw_data`
  - `review_status = 'pending'`，由管理員手動補充欄位後再 approve
- **解析成功的候選**：抽取欄位填入，但 `review_status` 仍維持 `pending`，管理員仍需確認後才可 approve

---

## 7. Schema / 欄位評估

### 7.1 `source_type` 裁定

v1 一律沿用 `source_type = 'other'`，不新增 `web_search` enum 值，不做 migration。

provider 識別資訊、查詢參數、搜尋結果 metadata 放在：
- `crawler_sources.config` jsonb（來源層級）：`{ "provider": "google_pse", "cx": "...", "defaultQuery": "..." }`
- `event_candidates.raw_data` jsonb（候選層級）：`{ "provider": "google_pse", "searchQuery": "...", "siteRestrict": "...", "resultTitle": "...", "resultLink": "...", "resultSnippet": "..." }`

### 7.2 `event_candidates.review_status`

搜尋來源候選寫入時：
- `review_status = 'pending'`（現有合法值，不新增 enum）
- 不設定任何信任度自動升級邏輯

### 7.3 是否需要 migration？

**v1 不需要 migration**，沿用現有 `source_type = 'other'` + config / raw_data jsonb 欄位。

---

## 8. 成本與配額估算

Google Custom Search JSON API 免費額度為 **每日 100 queries**，超過後才產生付費（$5 / 1000 queries）。

| 場景 | 每次 query 數 | 每日上限 | 是否超出免費額度 |
|---|---|---|---|
| v1 手動觸發（每次 5–10 queries）| 5–10 | < 100 | 不超出 |
| v2 每日自動（10 idols x 2 queries）| 20 / run | 20 | 不超出 |
| v3 擴張（50 idols x 3 queries）| 150 / run | 超出 50 queries | 超出 50 queries -> $0.25/day，約 $7.5/month |

**runtime 必須設定保護機制**：
- `maxQueriesPerRun`（建議 v1 為 20），防止單次觸發耗盡每日額度
- 超出限制時中止並回報已消耗 query 數，不繼續執行
- 建議在 runtime PR 記錄每次消耗量（log 或 crawler_sources.last_run_meta）

---

## 9. API Key 管理

- 新增 env var：`GOOGLE_PSE_API_KEY`（Google Cloud API key）
- 新增 env var：`GOOGLE_PSE_CX`（Programmable Search Engine ID）
- 本地：`.env.local`
- Vercel：Production 環境設定（Preview 不需要）
- 絕不加 `NEXT_PUBLIC_` 前綴，不進版控
- **env var 實際設定在 runtime PR 通過後再設；本工作單不設定任何 key**

---

## 10. 風險與邊界

| 風險 | 緩解方式 |
|---|---|
| 搜尋結果包含假新聞 / 粉絲非官方資訊 | 所有結果 review_status = pending，強制人工審核 |
| Google PSE 命中品質不足 | runtime PR 前先做 3–5 組人工查詢驗證；未達標則重新評估提供者 |
| Google PSE 索引延遲（最多 2 週）| 補充用途，非即時 crawler；不適合用於即時性極高的活動 |
| 每日配額超限 | maxQueriesPerRun 保護 + v1 手動觸發控制頻率 |
| Claude Haiku 解析錯誤（日期 / idol 辨識）| 解析失敗保留原始 snippet，不自動補欄位，管理員手動補 |
| `site:` 定向搜尋命中率低 | 人工查詢驗證階段先測試，確認有效後再接 API |
| ToS（Google 服務條款）| Google Custom Search JSON API 為官方 API，符合 ToS |

---

## 11. 不在本工作單範圍

- 不寫 runtime（不寫 API route / parser / fetcher）
- 不新增 env var 實際設定（等 runtime PR 後再設）
- 不做 schema migration（v1 沿用 other + jsonb）
- 不改前台 UI
- 不接 Brave Search / SerpAPI（本工作單評估但不實作）
- 不開 YouTube P2-B Search Strategy（與本工作單分離，未來另開）
- 不做 Netflix / Disney+ 獨立 parser（串流媒體查詢作為查詢策略之一，不是獨立 parser）

---

## 12. Acceptance Criteria（工作單階段）

- [ ] 說明 v1 搜尋提供者為暫定首選，並列出正式定案前的人工驗證前提條件
- [ ] 列出 v1 site: 定向站點清單（至少 5 個）
- [ ] 說明 per-idol query 生成策略（不捆綁，獨立查詢）
- [ ] 確認候選收錄流程（全部進 `event_candidates`，review_status = pending，人工審核）
- [ ] 確認 source_type 一律沿用 `other`，不新增 enum，不做 migration
- [ ] 說明 Claude Haiku 解析邊界（manual preview 優先、maxParsePerRun、失敗不自動補完）
- [ ] 說明成本以每日 100 queries 免費額度為基準，runtime 必須設 maxQueriesPerRun 保護
- [ ] 列出新增 env var（GOOGLE_PSE_API_KEY / GOOGLE_PSE_CX）並說明設定時機
- [ ] 說明 v1 只做手動觸發，不設 cron
- [ ] 包含與 YouTube P2-A / P2-B 的分工說明（§3）

---

## 13. 後續 PR 規劃

本工作單通過 GPT audit 後，依序開：

1. **人工查詢驗證**（不開 PR）：以 3–5 組查詢在 Google 介面人工測試命中品質，確認達標後正式定案 Google PSE
2. **runtime PR**：實作 `POST /api/admin/crawlers/search-discovery/run`、Google PSE fetcher、admin manual preview、Claude Haiku 解析（含 maxParsePerRun 保護）、寫入 `event_candidates`
3. **後台 UI PR**（可選）：Admin Sources 頁加入「手動搜尋觸發」表單，帶入 idol / query / site 參數
4. 確認有效後評估是否加入 cron fan-out（不急）
