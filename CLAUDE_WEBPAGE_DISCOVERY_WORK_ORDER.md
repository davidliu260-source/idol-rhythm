# P1-B Claude Webpage Discovery 工作單

> **類型**：規劃工作單（只做研究與決策，不寫 runtime、不改 DB、不新增 migration、不改前台 UI）
> **狀態**：待 GPT audit
> **優先**：P1-B（P1-A Google PSE Verdict Deferred 後的替代路線）

---

## 定位

**這不是 Search Discovery provider，不負責找 URL。**

它負責「管理員已經提供 URL 後」：
1. 抓取單一公開網頁的 HTML
2. 清理後送給 Claude Haiku 判斷是否有 K-pop / idol 活動資訊
3. 解析結果只進 `event_candidates`（`review_status = 'pending'`）
4. 人工審核後才可 approve / publish

與 Search Discovery 的分工：Search Discovery 負責「找 URL」；generic_webpage 負責「讀已知 URL」。

---

## 1. parser_type 命名與現有架構確認

### 1.1 parser_type 欄位型別

已確認（migration 019 明確說明）：

```sql
-- parser_type is kept as text (not an enum) on purpose: locking the parser
-- application code maps parser_type strings to fetcher implementations.
parser_type  text  NOT NULL,
```

**`parser_type` 是 plain text，無 enum 約束，無 DB 白名單。**
新增 `generic_webpage` 值不需要 migration（欄位層面）。

### 1.2 Admin Sources UI 白名單

已確認：Admin Sources 詳情頁（`/admin/sources/[id]/page.tsx`）將 `parser_type` 顯示為 **read-only text**，無 dropdown、無白名單驗證。新 parser_type 不需要改 UI 即可正確顯示。

### 1.3 RunSourceButton（dispatch 白名單）

已確認（`RunSourceButton.tsx`）：

```ts
function planForSource(parserType: string, sourceKey: string): RunPlan | null {
  switch (parserType) {
    case 'jyp_schedule': ...
    case 'blackpink_official_tour': ...
    case 'kpopofficial_concerts': ...
    case 'yg_artist_schedule': ...
    default: return null  // 未知 parser_type → 按鈕隱藏
  }
}
```

**runtime PR 必須在 switch 加 `case 'generic_webpage'`**，否則後台 Sources 頁不顯示執行按鈕。

### 1.4 runActiveCrawlerSources（cron fan-out dispatch）

已確認（`runActiveCrawlerSources.ts`）：

```ts
default:
  return { errors: [`未知 parser_type：${source.parser_type}（dispatch table 未註冊）`], ... }
```

**runtime PR 必須在 switch 加 `case 'generic_webpage'` 並設 cron guard**（同 `youtube_official_channel` 模式），確保 Vercel Cron 不觸發此 parser_type（v1 手動觸發only）。

### 1.5 新增 source 的方式

已確認：Admin Sources UI **沒有 new source 表單**，新 source 必須透過 SQL migration seed。

因此 runtime PR 應包含一份 migration（編號 049+），seed 第一批人工驗收用的 3–5 個 URL，全部 `is_active = false`，待驗收通過後才手動啟用。

### 1.6 命名決定

使用 **`generic_webpage`**（描述性、與現有命名風格一致、不限定 AI provider）。

---

## 2. v1 範圍

- admin 手動觸發單一 source：`POST /api/admin/crawlers/generic-webpage/run`（body: `{ sourceKey, mode: 'preview' | 'commit' }`）
- **不進 cron**：`runActiveCrawlerSources` 的 `generic_webpage` case 加 cron guard，`trigger === 'vercel-cron'` 時直接 skip
- **不接 sync-all fan-out**（同上，cron guard 保護）
- **一次只處理一個 source**（`maxPagesPerRun = 1`）
- **不直接 publish**：寫入 `event_candidates` 後 `review_status = 'pending'`，需人工 approve
- **不自動 approve**：解析結果不論信心多高，都不自動設 `review_status = 'approved'`

---

## 3. fetch 邊界

- 只抓公開無登入頁面（HTTP GET，無 cookie / token / session / authorization header）
- 不使用 Puppeteer / Playwright / headless browser（純 fetch）
- 遇到 Cloudflare / bot protection / paywall → 直接 fail gracefully，回報 `errors`，不繞過
- 遇到 `403` / `429` / `5xx` → 直接 fail，不重試
- 設定以下上限（runtime PR 必須實作）：
  - `timeout`：10 秒
  - `maxHtmlBytes`：500 KB（超過截斷，不 crash）
  - `maxTextLength`：8000 字元（送給 Claude 前截斷）
- 尊重 robots.txt 精神（不繞路、不高頻）；不做 rate limit bypass
- User-Agent：標準 fetch UA，不偽裝 browser

---

## 4. HTML 清理

清理步驟（runtime 用 cheerio 實作，同既有 crawler 慣例）：

1. 移除 `<script>` / `<style>` / `<nav>` / `<footer>` / `<header>` / `<aside>`
2. 抽取 `<title>` / `<meta name="description">` / `<main>` 或 `<body>` 主內容
3. 壓縮連續空白 / 換行
4. 截斷至 `maxTextLength`（8000 字元），超出時補 `[TRUNCATED]` 標記並記錄 warning
5. 清理結果須包含：`pageTitle`、`metaDescription`、`bodyText`、`wasTruncated`

---

## 5. Claude Haiku 解析

### 5.1 Prompt 設計原則

- System prompt 明確限制：只抽出**明確的 K-pop / idol 活動**
- 活動類型白名單：`concert` / `tour` / `fan_meeting` / `showcase` / `ticketing` / `livestream` / `streaming` / `media` / `brand` / `popup_store` / `exhibition` / `official`
- 不確定就回 `[]`（empty array），不硬猜、不推測
- 信心閾值（runtime 設定）：`confidence < 0.6` 的條目不寫入

### 5.2 嚴格 JSON Schema

Claude Haiku 必須回傳以下格式，runtime 做 JSON parse + schema 驗證（zod 或手動）：

```json
{
  "events": [
    {
      "rawTitle": "string（原始活動名稱，必填）",
      "eventType": "concert | tour | fan_meeting | ...",
      "idolHint": "string（頁面提到的藝人名稱，可空）",
      "dateHint": "string（原始日期文字，可空）",
      "locationHint": "string（原始地點文字，可空）",
      "confidence": 0.0~1.0,
      "rawSnippet": "string（支持此判斷的原文片段，必填）"
    }
  ],
  "pageRelevance": "high | medium | low | none",
  "parserNote": "string（選填，解析過程備註）"
}
```

- `rawTitle` 和 `rawSnippet` 必填，其餘可空
- `pageRelevance = 'none'` 時 `events` 必須為 `[]`
- JSON parse 失敗 → 整個 source run 標記 error，不寫入任何候選

### 5.3 每次解析筆數限制

- `maxEventsPerPage`（建議 v1 = 10）：Claude 回傳超過此數量的 events 時截斷，並在 fetcher log 記錄 warning
- 單次 run 只處理一個 source（`maxPagesPerRun = 1`）

---

## 6. Preview / Commit 設計

### 6.1 Preview Mode（建議 v1 預設）

- API route 接受 `mode: 'preview'`（預設）
- fetch + clean + Claude parse 全跑，但**不寫入 DB**
- 回傳 `{ mode: 'preview', parsedEvents: [...], pageRelevance, parserNote, wasTruncated, errors }`
- 管理員在後台看到解析結果後，再決定是否 commit

### 6.2 Commit Mode

- API route 接受 `mode: 'commit'`
- 需 admin 明確在 request body 指定 `mode: 'commit'`（不可預設）
- 寫入 `event_candidates` 前再次確認：
  - `confidence >= 0.6`
  - `rawTitle` 非空
  - `source_hash` 不重複（已存在則 skip）
- 超出 `maxCandidatesPerRun`（建議 v1 = 5）時截斷，回傳 warning

---

## 7. event_candidates 寫入規格

| 欄位 | 值 | 備註 |
|---|---|---|
| `review_status` | `'pending'` | 現有合法值，不新增 enum |
| `source_type` | `'other'` | 現有合法值，不新增 `web_discovery` 等 enum |
| `source_hash` | `SHA-256(source_url + rawTitle)` | 支援同一頁多活動（URL 相同但 rawTitle 不同）|
| `raw_data` | jsonb | 存 `{ provider: 'generic_webpage', sourceUrl, rawTitle, rawSnippet, confidence, pageTitle, metaDescription, wasTruncated }` |
| `detected_date` | 當天日期 | |
| `trust_level` | 不設定（沿用現有預設）| 不新增 trust_level enum 值 |

寫入失敗必須逐筆回報 `errors`，不吞掉、不靜默略過。
部分成功（5 筆中 3 筆成功、2 筆 error）也要回報所有結果。

---

## 8. 成本控制

| 限制 | 建議 v1 值 | 說明 |
|---|---|---|
| `maxPagesPerRun` | 1 | 一次只處理一個 source |
| `maxHtmlBytes` | 500 KB | fetch 超過截斷 |
| `maxTextLength` | 8000 字元 | 送給 Claude 前截斷 |
| `maxEventsPerPage` | 10 | Claude 回傳超過時截斷 |
| `maxCandidatesPerRun` | 5 | commit mode 寫入上限 |
| Claude tokens | ~2000 input + 500 output / 次 | Haiku 費率極低；v1 手動觸發可接受 |

**不設 cron**：admin 手動使用，成本完全可控。

---

## 9. 與既有架構分工

| | 固定格式 crawler | generic_webpage（本工作單）| YouTube Official Channel |
|---|---|---|---|
| **適用場景** | 格式固定、更新頻繁的官方頁面（JYP / SMTOWN / YG / WAKEONE）| 長尾、不規則、低頻的公開頁面 | 官方 YouTube 頻道影片上傳事件 |
| **Parser** | 針對特定網站的 HTML/JSON parser | Claude Haiku 通用解析 | YouTube Data API v3 |
| **維護成本** | 網站改版即壞，需修 parser | 相對耐改版（Claude 讀自然語言）| YouTube API schema 穩定 |
| **準確率** | 高（規則明確）| 中（依賴 Claude 判斷）| 高（結構化 API 回傳）|
| **優先順序** | 固定格式網站仍優先寫專用 parser | 只用於無法寫固定 parser 的長尾來源 | 按需啟用（per-idol）|
| **Search Discovery** | — | 不負責找 URL；URL 由管理員手動提供 | — |

---

## 10. 人工驗收計畫（runtime PR 後執行）

準備以下 5 類 URL 做 preview mode 測試：

| 類型 | 範例 URL | 預期結果 |
|---|---|---|
| 官方公告頁 | IU 官網 / 藝人公告頁 | 有活動 → events 非空 |
| 票務頁 | Interpark / YES24 特定演唱會頁 | 有活動 → events 非空，含日期地點 |
| 品牌 / 快閃頁 | ktown4u 特定活動頁 | 有活動 → events 非空，eventType = popup_store |
| 媒體文章 | 娛樂新聞報導（有具體活動資訊）| 可能有活動，信心較低 |
| 不相關頁面 | 任意非 K-pop 網頁 | `pageRelevance = 'none'`，`events = []` |

驗收標準：
- 前三類命中率 ≥ 70%（有活動的頁面能正確抽出）
- 不相關頁回傳 empty（不產生假 candidate）
- `event_candidates` 沒有低信心污染（`confidence < 0.6` 的不寫入）

---

## 11. Runtime PR 需實作的檔案

（本工作單不寫 runtime；以下為後續 PR 範圍）

| 檔案 | 說明 |
|---|---|
| `src/lib/crawlers/genericWebpage.ts` | HTML fetch + cheerio 清理 + Claude Haiku 解析 |
| `src/lib/crawlers/runGenericWebpageFetcher.ts` | 全流程 fetcher（source 查詢 / fetch / clean / parse / dedupe / write）|
| `src/app/api/admin/crawlers/generic-webpage/run/route.ts` | admin-only POST route（preview / commit mode）|
| `src/app/admin/sources/[id]/RunSourceButton.tsx` | 新增 `case 'generic_webpage'` |
| `src/lib/crawlers/runActiveCrawlerSources.ts` | 新增 `case 'generic_webpage'` + cron guard |
| `supabase/migrations/049_seed_generic_webpage_sources.sql` | seed 3–5 個驗收用 URL（全部 `is_active = false`）|

---

## 12. 不在本工作單範圍

- 不寫 runtime（不寫 fetcher / API route / parser）
- 不新增 migration（column 層面不需要；seed migration 在 runtime PR）
- 不改 schema / RLS / auth / service_role
- 不新增 cron
- 不改前台 UI
- 不提交 API key / secret
- 不做 Search Discovery（找 URL 的工作不在這裡）
- 不做 YouTube generic 解析（YouTube 仍走 P2-A official channel crawler）

---

## 13. Acceptance Criteria（工作單階段）

- [ ] 確認 `parser_type` 是 plain text，新增 `generic_webpage` 不需要 schema migration
- [ ] 確認 Admin Sources UI 無白名單，新 parser_type 顯示正確
- [ ] 確認 `RunSourceButton` 需加 `case 'generic_webpage'`（runtime PR 範圍）
- [ ] 確認 `runActiveCrawlerSources` 需加 case + cron guard（runtime PR 範圍）
- [ ] 確認新 source URL 需透過 migration seed（無 admin UI new source 表單）
- [ ] 定義 `parser_type = 'generic_webpage'`（命名確定）
- [ ] 說明 fetch 邊界（無 login / 無 cookie / timeout / maxHtmlBytes）
- [ ] 說明 HTML 清理步驟（cheerio / 移除 nav footer script / 截斷）
- [ ] 定義 Claude Haiku 嚴格 JSON schema
- [ ] 說明 preview / commit 兩模式設計
- [ ] 確認 `event_candidates` 寫入：`review_status = 'pending'`，`source_type = 'other'`，不新增 enum
- [ ] 確認 `source_hash = SHA-256(source_url + rawTitle)`（支援同一頁多活動）
- [ ] 列出成本控制參數（maxPagesPerRun / maxTextLength / maxEventsPerPage / maxCandidatesPerRun）
- [ ] 列出與既有架構分工（固定格式 crawler 優先，generic_webpage 只用長尾）
- [ ] 列出人工驗收計畫（5 類 URL，preview mode 先跑）
