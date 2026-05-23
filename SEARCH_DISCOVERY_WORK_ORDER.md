# P1 Search Discovery Provider 工作單

> **類型**：規劃工作單（只做研究與決策，不寫 runtime、不改 DB、不新增 migration、不改前台 UI）
> **狀態**：待 GPT audit
> **優先**：P1（繼 P2-A1 YouTube crawler 完成後）

---

## 1. 目標

引入 **Search Discovery Layer**，補充現有官方 crawler 與 YouTube crawler 無法覆蓋的網頁來源，提升 K-pop 活動候選資料的廣度與新鮮度。

本工作單目標：
- 確定 v1 使用哪個搜尋提供者（或組合）
- 設計查詢策略（`site:` 定向搜尋、關鍵字策略、per-idol query 設計）
- 確定候選收錄流程（進 `event_candidates`，走後台審核，不自動 publish）
- 估算成本 / 配額 / rate limit
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
| `youtube_official_channel`（P2-A1）| BTS（已驗收）+ 18 個 is_active=false | 限官方頻道有上傳活動，非即時 |

**無法覆蓋的缺口**：

- **HYBE 系**（BTS / SEVENTEEN / TXT / ENHYPEN / LE SSERAFIM / ILLIT 等）：Weverse 探測結果 Verdict C（全 SPA，無登入無法抓），YouTube 按需啟用，主要靠 kpopofficial 演唱會聚合
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
| **覆蓋類型** | 藝人官方頻道上傳：MV / teaser / behind / live / premiere / concert film trailer | 網頁搜尋發現：活動公告 / 票務頁 / 品牌合作 / 快閃店 / 媒體報導 / Netflix 新聞稿 |
| **觸發條件** | 藝人有近期 comeback / MV premiere / livestream → 按需啟用對應 source | 任何 crawler 沒覆蓋到的網頁來源 → site: 定向搜尋或關鍵字查詢 |
| **擴張計畫** | P2-A2 cron 暫緩；P2-B YouTube Discovery 未來可做，不是現在 | P1 v1 先做工作單 → GPT audit → runtime PR |
| **互補關係** | Search Discovery **不取代** YouTube；YouTube 負責官方頻道影片事件；Search Discovery 負責 YouTube / 官方 crawler 無法覆蓋的**網頁文字來源** | |

---

## 4. 技術選項評估

### 4.1 選項比較

| 提供者 | 免費額度 | 付費 | site: 支援 | 回傳格式 | 備註 |
|---|---|---|---|---|---|
| **Google Programmable Search Engine (PSE)** | 100 queries/day | $5 / 1000 queries | ✅ 支援 | JSON | 需建立 CSE 引擎（可設搜全網 or 特定站點）；API key 需要 |
| **Google Custom Search JSON API** | 同上（PSE 的 API 形式）| 同上 | ✅ | JSON | 實質上同 PSE，建議採用這個 |
| **SerpAPI** | 100 searches/month（免費）| $50/month（5000）| ✅（透過 `q=site:xxx`）| JSON（結構化）| 代理 Google 結果，不需自己管 quota 邏輯 |
| **Brave Search API** | 2000 queries/month（免費）| $3 / 1000 queries | ⚠️ 部分支援 | JSON | 獨立索引，非 Google；適合通用探索，site: 效果弱於 Google |
| **Claude web_search（Anthropic built-in）**| — | 按 token 計費 | ❌ 不支援 site: | 自然語言結果 | 適合單次 ad-hoc 查詢；不適合批量定向搜尋；無程式化 JSON 回傳 |

### 4.2 建議：v1 採用 Google Custom Search JSON API（PSE）

理由：
- 免費額度（100/day）足夠 v1 手動觸發驗證
- 支援 `site:` 定向搜尋（ktown4u / linefriendssquare / visitseoul 等）
- JSON 結構化回傳（title / link / snippet），直接進 `event_candidates`
- 可升級：超過免費額度後付費（$5/1000），成本可控

### 4.3 v1 策略：先手動觸發，不設 cron

- v1 不設定 cron job；只開 `POST /api/admin/crawlers/search-discovery/run` admin-only 手動觸發路由
- 每次觸發時帶入查詢參數（`q`、`siteRestrict`、`idol`）
- 後台管理員手動確認結果進候選池
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

**鐵則：所有搜尋結果都必須進 `event_candidates`，不得直接 publish。**

```
Google Custom Search API
    ↓
結果 JSON（title / link / snippet / date）
    ↓
Claude Haiku 解析（複用 parseCandidate 流程）
    → 判斷是否為 K-pop 活動
    → 抽取 idol / date / location / event_type
    → 生成 source_hash（URL-based）
    ↓
寫入 event_candidates（trust_level = 'pending'）
    ↓
後台管理員審核 → approve → 發布
```

注意：
- `trust_level` 一律 `pending`，不得自動升級
- `source_type = 'web_search'`（需確認是否要新增此 enum 值，或沿用 `other`）
- 重複偵測：`source_hash = SHA-256(search_result_url)`，已存在則 skip
- Claude 解析失敗或信心低的候選：保留原始 snippet 進候選，reviewer 手動補欄位

---

## 7. Schema / 欄位評估

### 7.1 `crawler_sources.source_type` 是否需要新增 `web_search`？

目前 enum 值（推測）：`official_website` / `ticketing` / `social_media` / `other`

選項：
- **方案 A**：沿用 `other`，在 `crawler_sources.config` 的 jsonb 存 `{ "provider": "google_pse", "query": "..." }`
- **方案 B**：新增 `web_search` enum 值（需 migration）

v1 建議方案 A（不改 schema），降低上線門檻。

### 7.2 `event_candidates.source_type` 同上評估

同方案 A，沿用 `other` 並在 `raw_data` jsonb 記錄 provider。

### 7.3 是否需要 migration？

**v1 不需要 migration**，前提是沿用方案 A（`other` + config jsonb）。

---

## 8. 成本與配額估算

| 場景 | 每日 query 數 | 月費 |
|---|---|---|
| v1 手動觸發（每次 5–10 queries）| < 100 | $0（免費額度內）|
| v2 每日自動（10 idols × 2 queries）| 20/day → 600/month | $0（免費額度內）|
| v3 擴張（50 idols × 3 queries）| 150/day → 4500/month | 約 $17.5/month |

結論：v1 / v2 完全免費；v3 擴張時成本仍低。

---

## 9. API Key 管理

- 新增 env var：`GOOGLE_PSE_API_KEY`（Google Cloud API key）
- 新增 env var：`GOOGLE_PSE_CX`（Programmable Search Engine ID）
- 本地：`.env.local`
- Vercel：Production 環境設定（Preview 不需要）
- 絕不加 `NEXT_PUBLIC_` 前綴，不進版控

---

## 10. 風險與邊界

| 風險 | 緩解方式 |
|---|---|
| 搜尋結果包含假新聞 / 粉絲非官方資訊 | 所有結果走 `trust_level = pending` + 人工審核 |
| Google PSE 索引延遲（最多 2 週）| 不適合用於即時性極高的活動；補充用途，非即時 crawler |
| 配額超限 | v1 手動觸發，管理員自行控制頻率；不設自動 cron |
| AI 解析錯誤（日期 / idol 辨識）| 解析失敗保留原始 snippet，管理員手動補 |
| `site:` 定向搜尋命中率低 | 先以通用查詢測試，確認有效後再 restrict |
| ToS（Google 服務條款）| Google Custom Search JSON API 為官方 API，符合 ToS |

---

## 11. 不在本工作單範圍

- ❌ 實作 runtime（不寫 API route / parser / fetcher）
- ❌ 新增 API key（在 Vercel 設定 env var 在 runtime PR 後再設）
- ❌ schema migration（v1 沿用 `other` + jsonb）
- ❌ 前台 UI 變更
- ❌ Brave Search / SerpAPI 實際接入
- ❌ YouTube P2-B Search Strategy（與本工作單分離，未來另開）
- ❌ Netflix / Disney+ crawler（本工作單只規劃 Google PSE，streaming 媒體查詢作為查詢策略之一，不是獨立 parser）

---

## 12. Acceptance Criteria（工作單階段）

- [ ] 明確選定 v1 搜尋提供者（Google Custom Search JSON API）
- [ ] 列出 v1 site: 定向站點清單（至少 5 個）
- [ ] 說明 per-idol query 生成策略（不捆綁，獨立查詢）
- [ ] 確認候選收錄流程（全部進 `event_candidates` + 人工審核）
- [ ] 確認不需要 migration（schema 沿用現有欄位）
- [ ] 估算成本（v1 免費額度內）
- [ ] 列出新增 env var（GOOGLE_PSE_API_KEY / GOOGLE_PSE_CX）
- [ ] 說明 v1 只做手動觸發，不設 cron
- [ ] 包含與 YouTube P2-A / P2-B 的分工說明（§3）

---

## 13. 後續 PR 規劃

本工作單通過 GPT audit 後，依序開：

1. **runtime PR**：實作 `POST /api/admin/crawlers/search-discovery/run`、Google PSE fetcher、Claude Haiku 解析、寫入 `event_candidates`
2. **後台 UI PR**（可選）：Admin Sources 頁加入「手動搜尋觸發」表單，帶入 idol / query / site 參數
3. 確認有效後評估是否加入 cron fan-out（不急）
