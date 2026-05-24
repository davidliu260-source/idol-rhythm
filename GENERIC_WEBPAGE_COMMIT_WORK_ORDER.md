# P1-B2 Generic Webpage Commit Runtime — 工作單

> **狀態**：🔒 待 GPT 工作單審核
> **前置**：P1-B1 wiring probe 驗收完成（2026-05-24）
> **目標**：在 P1-B1 preview-only 基礎上，新增 `mode='commit'` 寫入路徑，
> 讓管理員確認 preview 結果正確後，可將事件候選寫入 `event_candidates`。

---

## 1. 背景與範疇

P1-B1 已完成：
- `GET /api/admin/crawlers/generic-webpage/run` (`mode='preview'`)：fetch → clean → Claude → 回傳 JSON，**不寫 DB**
- `mode !== 'preview'` 一律回 400

P1-B2 新增：
- `mode='commit'`：在 preview 流程之後，把 Claude 建議的 events 寫入 `event_candidates`
- `mode='preview'` 行為完全不變

**不做**：
- 不改 cron / sync-all 守門（generic_webpage dispatch skip 維持不變）
- 不自動發布（全部進 `review_status = 'pending'`，admin 手動審核）
- 不改 schema / migration（所需欄位全部已存在）
- 不改 SSRF guard / fetch 邊界 / Claude prompt
- 不改前台任何頁面

---

## 2. 需要修改的檔案

| 檔案 | 類型 | 說明 |
|---|---|---|
| `src/lib/crawlers/runGenericWebpageFetcher.ts` | 修改 | 新增 commit 路徑 + CommitResult type |
| `src/app/api/admin/crawlers/generic-webpage/run/route.ts` | 修改 | 接受 `mode='commit'`，不再一律 400 |
| `src/app/admin/sources/[id]/RunSourceButton.tsx` | 修改 | 新增獨立「寫入候選」按鈕 |

**不新增 migration**（`source_hash`、`raw_data` 欄位已在 migration 017 加入）。

---

## 3. event_candidates 欄位對應

| event_candidates 欄位 | 來源 | 說明 |
|---|---|---|
| `raw_title` | `PreviewEvent.rawTitle` | 必填，Claude 輸出 |
| `raw_content` | `PreviewEvent.rawSnippet` | 選填 |
| `detected_idol_id` | `crawler_sources.idol_id` | 該 source 綁定的偶像，可為 null |
| `detected_event_type` | `mapToEventType(PreviewEvent.eventType)` | 見 §4 |
| `detected_date` | `parseDateHint(PreviewEvent.dateHint)` | 見 §5，解析失敗 → null |
| `source_url` | `crawler_sources.source_url` | 爬取的頁面 URL |
| `source_name` | `crawler_sources.name` | crawler source 名稱 |
| `source_type` | `crawler_sources.source_type` | 沿用 source row 的 source_type |
| `ai_confidence` | `PreviewEvent.confidence` | 0.00–1.00 |
| `review_status` | `'pending'` | 固定，永不自動發布 |
| `source_hash` | `computeSourceHash(...)` | 見 §6 |
| `raw_data` | `buildRawData(...)` | 見 §7 |

---

## 4. PreviewEventType → event_type 對應（保守規則）

`genericWebpage.ts` 的 `PREVIEW_EVENT_TYPES` 比 DB enum `event_type` 更細。
commit 路徑必須將 Claude 輸出的寬型別映射到 schema enum，**且採保守策略：
無法可靠 mapping 的 event 一律 skip（不硬塞 official / media）**。

| PreviewEventType | event_type (DB enum) | 備註 |
|---|---|---|
| `'concert'` | `'concert'` | 直接對應 |
| `'tour'` | `'concert'` | 直接對應（巡演視為演唱會） |
| `'fan_meeting'` | `'concert'` | 直接對應（粉絲見面會視為演唱會） |
| `'showcase'` | `'concert'` | 直接對應 |
| `'ticketing'` | `'ticketing'` | 直接對應 |
| `'livestream'` | `'livestream'` | 直接對應 |
| `'streaming'` | `'streaming'` | 直接對應 |
| `'media'` | `'media'` | 直接對應 |
| `'brand'` | `'brand'` | 直接對應 |
| `'popup_store'` | `'brand'` | **⚠️ 暫定 mapping**：raw_data 必須保留 `preview_event_type='popup_store'` 供 admin 審核時判斷 |
| `'exhibition'` | `'brand'` | **⚠️ 暫定 mapping**：raw_data 必須保留 `preview_event_type='exhibition'` 供 admin 審核時判斷 |
| `'official'` | `'official'` | 直接對應 |
| `null` 或不在白名單內 | — | **skip，計入 `skippedUnsupportedType`**，不寫入 |

**核心規則：**

- 不得對 mapping 不明確的型別「硬塞」`official` 或 `media`（這兩個是兜底常見的誤選項）
- `preview_event_type` 永遠保留在 `raw_data.preview_event_type` 欄位
- 暫定 mapping（`popup_store`、`exhibition`）必須在 `raw_data.event_type_mapping` 欄位標示為 `"tentative"`，直接對應者標 `"direct"`

此對應表以常數（`EVENT_TYPE_MAP`）定義在 `runGenericWebpageFetcher.ts`，
不內嵌在 genericWebpage.ts（保持 parser 純粹，不依賴 DB schema）。

---

## 5. dateHint → detected_date 解析規則

`PreviewEvent.dateHint` 是 Claude 回傳的自由文字（如 `"2026-08-15"` / `"August 2026"` / `"2026年8月"`）。

解析策略：
1. 嘗試 `new Date(dateHint)` — 如果結果是合法日期（非 NaN）且年份在 2020–2030 之間，使用
2. 嘗試從字串抽取 `YYYY-MM-DD` 或 `YYYY/MM/DD` 格式（regex）
3. 嘗試從字串抽取 `YYYY-MM`（無日期，設為該月 1 日）
4. 全部失敗 → `detected_date = null`（不阻擋寫入）

解析失敗**不阻擋寫入**，但必須：

- `detected_date` 留 null
- `raw_data.originalDateHint` 必須保留 Claude 回傳的原始字串（即使是 null / empty 也要寫入欄位）
- `raw_data.parsedDate` 為 null
- commit response 的 `warnings` 陣列加入：`"event '<rawTitle>': detected_date is null, manual date fill required"`
- 後台 `/admin/event-candidates` 審核頁透過現有 `detected_date` 欄位顯示「—」即可看出需要補日期（不需新增 UI；本工作單不改前/後台 UI 除了 RunSourceButton）

**Admin 在審核時必須能看出此候選需要人工補日期**，靠 `detected_date IS NULL` + `raw_data.originalDateHint` 兩個訊號。

---

## 6. source_hash 計算

優先使用 **url + title + date + type**（日期和類型都有值時更精確）：

```
primary: SHA-256( sourceUrl + "|" + rawTitle + "|" + dateHint + "|" + eventType )
```

fallback（`dateHint` 為空 / null 時）：

```
fallback: SHA-256( sourceUrl + "|" + rawTitle + "|" + rawSnippet.slice(0, 100) )
```

`dedupe_basis` 記錄在 `raw_data` 供除錯（`"url+title+date+type"` 或 `"url+title+snippet"`）。

衝突處理：
- 若 `source_hash` 已存在 `event_candidates`（partial unique index 命中）→ **skip**（不更新現有行）
- 回傳 `skipped` 計數

---

## 7. raw_data 結構

```jsonc
{
  "provider": "generic_webpage",
  "parserVersion": "p1-b2",
  "crawlerSourceId": "<uuid>",
  "crawlerSourceKey": "<source_key>",
  "pageRelevance": "high" | "medium" | "low" | "none",
  "dedupe_basis": "url+title+date+type" | "url+title+snippet",
  "preview_event_type": "concert" | "tour" | "fan_meeting" | "showcase" | "ticketing" | "livestream" | "streaming" | "media" | "brand" | "popup_store" | "exhibition" | "official",
  "event_type_mapping": "direct" | "tentative",
  "idolHint": "<Claude 回傳的自由文字 idol 提示，供除錯>",
  "locationHint": "<Claude 回傳的地點提示>",
  "originalDateHint": "<Claude 回傳的原始日期文字，可為空字串或 null，但欄位必須存在>",
  "parsedDate": "2026-08-15" | null,
  "confidence": 0.78
}
```

`preview_event_type` 與 `event_type_mapping` 兩欄位允許 admin 在審核時：
1. 看到 `popup_store` 被暫定 mapping 到 `brand`，必要時手動改 event_type
2. 看到 `event_type_mapping='tentative'` 的列優先檢視

---

## 8. Commit route 防線（強制要求）

`POST /api/admin/crawlers/generic-webpage/run` 在 `mode='commit'` 時必須**全部滿足**以下守門條件，
任一失敗 → 400 / 401 / 403，**不得進入 fetch / Claude / DB 寫入路徑**：

| 守門 | 行為 | 失敗回應 |
|---|---|---|
| Admin auth | `getCurrentAdmin()` 必須回傳 admin user（沿用 P1-B1 同一邏輯） | 401 `{ ok: false, error: 'admin only' }` |
| `confirmCommit` flag | request body 必須包含 `confirmCommit: true`（顯式 boolean true，不接受 truthy） | 400 `{ ok: false, error: 'confirmCommit must be true for mode=commit' }` |
| 單一 sourceKey | request body 必須包含**剛好一個** `sourceKey: string`（非空字串）| 400 `{ ok: false, error: 'sourceKey required (single string only)' }` |
| 禁止批量 | **不接受 sourceKeys（陣列）/ sourceIds / 任何複數欄位**；若 request body 出現 `sourceKeys` 欄位 → 400 | 400 `{ ok: false, error: 'batch commit not supported in v1' }` |
| mode 白名單 | `mode` 必須在 `['preview', 'commit']` 之內 | 400 `{ ok: false, error: 'mode must be preview or commit' }` |

`mode='preview'` 不需要 `confirmCommit`（向後相容 P1-B1）。

**Request body 範例（commit）：**
```json
{ "sourceKey": "generic-test-wikipedia-blackpink", "mode": "commit", "confirmCommit": true }
```

**Request body 範例（preview，P1-B1 同樣支援）：**
```json
{ "sourceKey": "generic-test-wikipedia-blackpink", "mode": "preview" }
```

---

## 9. pageRelevance 守門

commit 路徑必須：

```
if pageRelevance === 'none':
    return {
      ok: true,
      ...,
      inserted: 0,
      skippedPageRelevanceNone: events.length,
      ...
    }
    // 不進 INSERT 迴圈
```

`'low'` 不阻擋寫入（admin 可在後台 review 後 reject）。

---

## 10. Low confidence gate

每個 PreviewEvent 進 INSERT 前必須通過 confidence 門檻：

```
const CONFIDENCE_THRESHOLD = 0.65

if (event.confidence == null || event.confidence < CONFIDENCE_THRESHOLD) {
  skippedLowConfidence++
  continue  // 不寫入
}
```

規則：
- **`confidence` 為 null / undefined / NaN → skip**（不假設、不補預設值）
- **`confidence < 0.65` → skip**
- skip 計數寫入 response 的 `skippedLowConfidence`
- 門檻常數命名 `COMMIT_CONFIDENCE_THRESHOLD`，定義在 `runGenericWebpageFetcher.ts` top-level
- 不寫入 = 不去算 source_hash、不去算 detected_date、不進 INSERT

---

## 11. maxCandidatesPerCommit

單一 commit 呼叫最多寫入候選數量：

```
const MAX_CANDIDATES_PER_COMMIT = 3
```

規則：
- 通過 §10（confidence）+ §4（type mapping 成功）的候選列表，**若長度 > 3，全部不寫入**
- response：`inserted=0`、`warnings` 加入：`"too many candidates after filtering (N > 3): refuse to commit; please split source or tighten Claude prompt"`
- ok 仍為 true（這是業務層限制，不是錯誤）
- 不做「寫前 3 個丟掉其餘」之類的部分寫入（會誤導 admin 以為某些被去重）

理由：generic_webpage v1 是 admin 親自選 URL 的「手動高訊噪比來源」。
一頁吐出 4+ 個高 confidence + 型別清楚的候選 → 多半是聚合公告頁，需要 admin 重新評估該 URL 是否拆細或改抓子頁，而不是讓系統一次塞一堆。

---

## 12. API route 變更（`route.ts`）

目前：`mode !== 'preview'` → 400

P1-B2 後：依 §8 守門順序檢查，全通過後：
- `mode='preview'` → 呼叫 `runGenericWebpageFetcher(supabase, { sourceKey, mode: 'preview' })`
- `mode='commit'` → 呼叫 `runGenericWebpageFetcher(supabase, { sourceKey, mode: 'commit' })`

---

## 13. Response shape（preview 與 commit 嚴格分開）

### 13.1 Preview response（P1-B1，不變）

```jsonc
{
  "ok": true,
  "mode": "preview",
  "source": "<source_key>",
  "sourceKey": "<source_key>",
  "pageRelevance": "high" | "medium" | "low" | "none",
  "pageTitle": "...",
  "events": [ ... ],            // Claude 建議的完整 PreviewEvent 陣列
  "model": "claude-haiku-...",
  "errors": []
}
```

無 `inserted` / `skipped*` / `deduped` 等 commit 專屬欄位。

### 13.2 Commit response（P1-B2，新增）

```jsonc
{
  "ok": true,
  "mode": "commit",
  "source": "<source_key>",
  "sourceKey": "<source_key>",
  "pageRelevance": "high" | "medium" | "low" | "none",
  "pageTitle": "...",
  "summary": {
    "candidatesFromClaude": 5,           // Claude 原始輸出筆數
    "inserted": 2,                       // 實際寫入 event_candidates
    "deduped": 1,                        // source_hash 衝突
    "skippedLowConfidence": 1,           // confidence 缺失 / < 0.65
    "skippedUnsupportedType": 1,         // eventType 無法 mapping 到 DB enum
    "skippedPageRelevanceNone": 0        // pageRelevance='none' 時 = candidatesFromClaude，其他情況 = 0
  },
  "warnings": [
    "event 'XYZ Tour': detected_date is null, manual date fill required",
    "too many candidates after filtering (4 > 3): refuse to commit; please split source or tighten Claude prompt"
  ],
  "errors": []
}
```

**關鍵：** preview 不會回 `summary` / `warnings` / `inserted`；commit 不會回 `events`（避免前端混淆兩種 response）。
前端依 `mode` 欄位分流顯示。

---

## 14. RunSourceButton UI 變更

新增獨立的**「寫入候選」**按鈕，與現有「Preview」按鈕並排：

- **Preview 按鈕**（現有）：不變，`mode='preview'`，**不送 `confirmCommit`**
- **Commit 按鈕**（新增）：`mode='commit'`，amber 色調（表示有副作用），文字：`寫入候選：{sourceName}`
  - 按下時 fetch body：`{ sourceKey, mode: 'commit', confirmCommit: true }`
  - 顯示前必須二段式：先彈確認對話框（`window.confirm`）「將寫入 event_candidates，繼續？」，使用者點取消 → 不送 request
- Commit 結果顯示（依 `summary` 計數）：
  - 主行：`插入 N 筆（去重 N，低 confidence 略過 N，型別不支援略過 N，pageRelevance=none 略過 N）`
  - 若有 `warnings`：每筆列出
  - 若 `inserted > 0`：附 `已寫入 event_candidates（review_status=pending），請至 /admin/event-candidates 審核。`

**兩個按鈕各自獨立 loading state**，互不干擾。

---

## 15. CommitResult type（`runGenericWebpageFetcher.ts`）

```typescript
export interface CommitSummary {
  candidatesFromClaude: number
  inserted: number
  deduped: number
  skippedLowConfidence: number
  skippedUnsupportedType: number
  skippedPageRelevanceNone: number
}

export interface CommitResult {
  ok: boolean
  mode: 'commit'
  source: string
  sourceKey: string | null
  pageRelevance: PageRelevance | null
  pageTitle: string
  summary: CommitSummary
  warnings: string[]
  errors: string[]
  status: number
}
```

`mode` 欄位的字面量型別讓 TS 在前端 narrowing 時可以區分 `PreviewResult | CommitResult`。

---

## 16. crawler_sources.last_run_status 寫入規則

commit 路徑結束時（不論 inserted=0 或 N）**必須**更新 `crawler_sources` 的 run-status 欄位，
且 status 字串必須包含摘要，不可只寫 `'success'`。

格式建議：

| 情境 | last_run_status |
|---|---|
| 全成功 + 有插入 | `"commit ok: inserted=N, deduped=N, lowConf=N, badType=N"` |
| pageRelevance=none | `"commit skipped (pageRelevance=none): candidates=N"` |
| 超過 maxCandidatesPerCommit | `"commit refused (too many candidates: N>3)"` |
| INSERT 部分錯誤 | `"commit partial: inserted=N, errors=N"` |
| fetch / Claude 失敗 | `"commit failed: <error_summary>"` |

`last_run_at` 永遠寫當前時間。沿用 P1-B1 既有 `updateRunStatus` helper，**不新建** DB function。

---

## 17. 不需要 migration 的確認

| 欄位 | 已存在？ | migration |
|---|---|---|
| `event_candidates.source_hash` | ✅ migration 017 | 無需新增 |
| `event_candidates.raw_data` | ✅ migration 017 | 無需新增 |
| `event_candidates.detected_idol_id` | ✅ migration 001 | 無需新增 |
| `event_candidates.ai_confidence` | ✅ migration 001 | 無需新增 |
| partial unique index on `source_hash` | ✅ migration 017 | 無需新增 |

P1-B2 **絕不**新增 migration / 不改 schema / 不改 RLS / 不改 GRANT / 不改 auth / 不動 service_role。

---

## 18. 安全邊界（不得跨越）

| 邊界 | 說明 |
|---|---|
| 不自動發布 | review_status 永遠寫 `'pending'`，admin 手動 approve；**任何 commit 路徑不得寫 events 表，不得自動轉 approved** |
| 不寫 events 表 | 只寫 event_candidates；approve / publish 流程沿用既有 J7b/J7e，不在本工作單範疇 |
| 不接 cron | `runActiveCrawlerSources` 對 `generic_webpage` 的 unconditional skip 維持不變；vercel-cron 永遠不會碰到 commit 路徑 |
| 不接 sync-all | 同上，admin 「sync-all」fan-out 也不會碰到 commit 路徑；commit 只能透過 `/api/admin/crawlers/generic-webpage/run` + `confirmCommit=true` 顯式觸發 |
| 不批量 source | request body 只能帶單一 `sourceKey: string`（見 §8） |
| 不呼叫 Claude 兩次 | preview + commit 同一 orchestrator call 內完成，commit 不是 preview 之後第二次呼叫 |
| 不 bypass SSRF guard | fetch 路徑與 P1-B1 共用 `fetchPublicHtml`，SSRF 守門不能改弱 |
| 不開放非 admin | route 必須保留 `getCurrentAdmin()` 檢查 |
| 不新增 migration | 全部欄位已存在，禁止新建 SQL |
| 不改 schema / RLS / GRANT / auth / service_role | 同上，禁止任何 DB 結構變更 |
| 不提交 key / secret | `ANTHROPIC_API_KEY` 沿用既有 env，不在本工作單範疇新增 |

---

## 19. 成功條件（人工驗收）

1. Preview 按鈕行為與 P1-B1 完全相同（response shape 不變）
2. Commit 按鈕（**有確認對話框**）執行後：
   - `event_candidates` 出現新行，`review_status = 'pending'`
   - `source_hash` 非 null
   - `raw_data.provider = 'generic_webpage'`
   - `raw_data.dedupe_basis` 有值
   - `raw_data.preview_event_type` 有值
   - `raw_data.event_type_mapping ∈ {'direct', 'tentative'}`
   - 若 `detected_date IS NULL` → `raw_data.originalDateHint` 必須保留原文字
3. 再按 Commit 同一 source → `inserted=0, deduped=N`（去重保護）
4. `pageRelevance='none'` 時按 Commit → `inserted=0, skippedPageRelevanceNone=N`，DB 零寫入
5. `confidence < 0.65` 或缺失 → 計入 `skippedLowConfidence`，不寫入
6. eventType 不在白名單 → 計入 `skippedUnsupportedType`，不寫入
7. 通過篩選後候選 > 3 → `inserted=0`，warning 提示
8. `crawler_sources.last_run_status` 寫入摘要字串（不只 `'success'`）
9. request body 缺 `confirmCommit` 或非 true → 400，零寫入
10. request body 帶 `sourceKeys` 陣列 → 400，零寫入
11. 非 admin 呼叫 → 401，零寫入
12. `npm run build` 通過

---

## 20. 不在本工作單範圍的項目

| 項目 | 原因 |
|---|---|
| content_hash 計算（J7d-A 機制）| 可在 P1-B2 後補（不阻擋基本寫入） |
| 日期格式標準化（NLP）| 超出 v1 範疇，detected_date=null 可接受 |
| 批量 commit 多個 source | §8 明確禁止 |
| Cron 排程 | P1-B2 後另立工作單評估 |
| `/admin/event-candidates` 審核頁 UI 改動 | 沿用既有 UI；本工作單只動 RunSourceButton |
| 自動 reject 低 confidence 候選 | 本工作單只 skip，不寫入「拒絕」記錄 |
