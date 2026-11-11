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

## 4. PreviewEventType → event_type 對應

`genericWebpage.ts` 的 `PREVIEW_EVENT_TYPES` 比 DB enum `event_type` 更細。
commit 路徑必須將 Claude 輸出的寬型別映射到 schema enum：

| PreviewEventType | event_type (DB enum) |
|---|---|
| `'concert'` | `'concert'` |
| `'tour'` | `'concert'` |
| `'fan_meeting'` | `'concert'` |
| `'showcase'` | `'concert'` |
| `'ticketing'` | `'ticketing'` |
| `'livestream'` | `'livestream'` |
| `'streaming'` | `'streaming'` |
| `'media'` | `'media'` |
| `'brand'` | `'brand'` |
| `'popup_store'` | `'brand'` |
| `'exhibition'` | `'brand'` |
| `'official'` | `'official'` |
| `null` | `null`（欄位留空）|

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

解析失敗**不阻擋寫入**，`detected_date` 留 null，admin 人工填補。

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
  "idolHint": "<Claude 回傳的自由文字 idol 提示，供除錯>",
  "locationHint": "<Claude 回傳的地點提示>",
  "originalDateHint": "<Claude 回傳的原始日期文字>",
  "parsedDate": "2026-08-15" | null
}
```

---

## 8. pageRelevance 守門

commit 路徑必須：

```
if pageRelevance === 'none':
    return { ok: true, inserted: 0, skipped: events.length, deduped: 0, errors: [] }
    // 不進 INSERT 迴圈
```

`'low'` 不阻擋寫入（admin 可在後台 review 後 reject）。

---

## 9. API route 變更（`route.ts`）

目前：`mode !== 'preview'` → 400

P1-B2 後：

```typescript
if (mode !== 'preview' && mode !== 'commit') {
  return NextResponse.json({ ok: false, error: 'mode must be preview or commit' }, { status: 400 })
}
```

`mode='commit'` → 呼叫 `runGenericWebpageFetcher(supabase, { sourceKey, mode: 'commit' })`

回傳格式（commit mode）：

```jsonc
{
  "ok": true,
  "source": "<source_key>",
  "pageRelevance": "high",
  "pageTitle": "...",
  "inserted": 2,
  "skipped": 0,
  "deduped": 1,
  "errors": []
}
```

---

## 10. RunSourceButton UI 變更

新增獨立的**「寫入候選」**按鈕，與現有「Preview」按鈕並排：

- **Preview 按鈕**（現有）：不變，`mode='preview'`
- **Commit 按鈕**（新增）：`mode='commit'`，amber 色調（表示有副作用），文字：`寫入候選：{sourceName}`
- Commit 按鈕結果顯示：`插入 N 筆，略過 N 筆（去重 N 筆），錯誤 N 筆`
- 加一行提示：`已寫入 event_candidates（review_status=pending），請至後台審核。`

**兩個按鈕各自獨立 loading state**，互不干擾。

---

## 11. CommitResult type（`runGenericWebpageFetcher.ts`）

```typescript
export interface CommitResult {
  ok: boolean
  source: string
  sourceKey: string | null
  pageRelevance: PageRelevance | null
  pageTitle: string
  inserted: number
  skipped: number   // pageRelevance=none 或 source_hash 衝突
  deduped: number   // source_hash 衝突計數（deduped ⊆ skipped）
  errors: string[]
  status: number
}
```

---

## 12. 不需要 migration 的確認

| 欄位 | 已存在？ | migration |
|---|---|---|
| `event_candidates.source_hash` | ✅ migration 017 | 無需新增 |
| `event_candidates.raw_data` | ✅ migration 017 | 無需新增 |
| `event_candidates.detected_idol_id` | ✅ migration 001 | 無需新增 |
| `event_candidates.ai_confidence` | ✅ migration 001 | 無需新增 |
| partial unique index on `source_hash` | ✅ migration 017 | 無需新增 |

---

## 13. 安全邊界（不得跨越）

| 邊界 | 說明 |
|---|---|
| 不自動發布 | review_status 永遠寫 `'pending'`，admin 手動 approve |
| 不寫 events 表 | 只寫 event_candidates，approve 流程另有 |
| 不觸發 cron | generic_webpage dispatch skip 維持 P1-B1 設計 |
| 不呼叫 Claude 兩次 | preview + commit 同一 request 內完成（preview 結果不另存；commit 在同一 orchestrator call 內） |
| 不 bypass SSRF guard | fetch 路徑不變，SSRF 守門在 preview 同一 path 上 |
| 不開放非 admin | route 必須保留 getCurrentAdmin() 檢查 |

---

## 14. 成功條件（人工驗收）

1. Preview 按鈕行為與 P1-B1 完全相同
2. Commit 按鈕執行後：
   - `event_candidates` 出現新行，`review_status = 'pending'`
   - `source_hash` 非 null
   - `raw_data.provider = 'generic_webpage'`
   - `raw_data.dedupe_basis` 有值
   - 再次按 Commit 同一 source → `inserted=0, deduped=N`（去重保護）
3. `pageRelevance=none` 時按 Commit → `inserted=0, skipped=N`，DB 零寫入
4. `npm run build` 通過

---

## 15. 不在本工作單範圍的項目

| 項目 | 原因 |
|---|---|
| P1-B2 content_hash 計算 | J7d-A 機制，可在 P1-B2 後補（不阻擋基本寫入） |
| 日期格式標準化（NLP）| 超出 v1 範疇，detected_date=null 可接受 |
| 批量 commit 多個 source | 單一 source 觸發已足夠 v1 |
| Cron 排程 | P1-B2 後另立工作單評估 |
