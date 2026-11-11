# P1-B8 工作單：generic_webpage runtime 兩處改進
## (1) 整合 idolMatcher 自動對應藝人
## (2) 放寬 MAX_CANDIDATES_PER_COMMIT 並改為可配置

> 階段：P1-B（Claude Webpage Discovery）
> 類型：runtime 改造工作單（僅規劃，不直接實作）
> 觸發來源：P1-B7 驗收（PR #165）發現的兩個系統限制
> 日期：2026-05-24

---

## 1. 問題背景

P1-B7（kpopconcerts.com aggregator）驗收時發現 `generic_webpage` 對「label-level / 多藝人」來源有**兩個**重大限制：

### 限制 A：detected_idol_id 為空，無法直接 Approve

| Source 設定 | 候選 detected_idol_id | 可否直接 Approve |
|---|---|---|
| `idol_id` 綁定特定藝人（P1-B3/B4/B6）| 自動繼承 source.idol_id | ✅ 可 |
| **`idol_id = NULL`**（P1-B5 YG notice、P1-B7 kpopconcerts）| **空** | **❌ 不可，被 UI 警告「缺少偶像對應」** |

實例：kpopconcerts 抓到的 `[TOUR] MAMAMOO Announce 2026 US Tour` 候選，明明 idols 表內有 MAMAMOO，但因為 source `idol_id=NULL`，candidate 的 `detected_idol_id` 也是 NULL，admin 必須手動指定 idol 才能 Approve。

對比 `kpopofficial_concerts`：它有專屬 parser + `idolMatcher.ts` 做 longest-prefix exact match against `idols.name + alt_names`，所以同樣 label-level source 也能自動把候選對應到正確 idol。

### 限制 B：MAX_CANDIDATES_PER_COMMIT = 3 對 aggregator 太緊

`runGenericWebpageFetcher.ts:60` 寫死：

```ts
export const MAX_CANDIDATES_PER_COMMIT = 3
```

行為：Preview 給超過 3 筆 → Commit **整批拒絕**（不寫前 3 個，回傳錯誤 `too many candidates after filtering (7 > 3): refuse to commit`）。

P1-B7 驗收實況：
- **YG notice**：Preview 7 events → Commit `inserted=0`，全部被拒
- **N.Flying JP**：Preview 7 events → 同樣全部被拒
- kpopconcerts：Preview 1 event ≤ 3 → 寫入成功（但只有 1 筆）
- P1-B3 smtown：Preview 3 events 剛好 ≤ 3 → 寫入成功

對 idol-bound source（單一藝人，公告本來就少）cap=3 合理；但對 **label-level aggregator**（多藝人，公告會很多）cap=3 顯然太緊。kpopofficial_concerts 沒有這個限制（一次能寫幾十場 events）。

---

## 2. 目標

### 目標 A：idolMatcher 整合
讓 `generic_webpage` runtime 在 source `idol_id=NULL` 時，自動對每個 Claude 萃取出的 event 候選跑 `idolMatcher.matchIdolFromTitle()`，把命中的 idol id 寫入 `detected_idol_id`。

source `idol_id` 有綁定時的行為**完全不變**（繼承 source.idol_id 作為 hint + detected_idol_id 預設值）。

### 目標 B：MAX_CANDIDATES_PER_COMMIT 改可配置 + 提高預設

- 預設值：**3 → 10**（涵蓋 YG / N.Flying 等 7 events 的常見規模）
- 改成 per-source 可配置：`source.config.maxCandidatesPerCommit` 若有設則優先用該值，否則用預設
- 上限硬性 cap：**不超過 50**（保護 Claude 萃取 noise 時不會塞爆候選池）
- 超過 cap 的行為**完全不變**：仍是「整批拒絕」而非「截斷前 N 筆」，避免 dedupe basis 不穩定

---

## 3. 不在本次範圍

- 不改 Claude prompt / 萃取邏輯（Claude 還是只回傳 event title / date / type 等）
- 不引入 fuzzy match / Levenshtein（沿用 idolMatcher 的 exact-prefix rule）
- 不改 `event_candidates` schema
- 不改 `crawler_sources` schema（cap 用既有 jsonb `config` 欄位）
- 不改前台 / admin UI
- 不改 kpopofficial / 其他既有 crawler（它們已經有自己的 idol matching）
- 不改 dispatch / cron 行為
- 不改 COMMIT_CONFIDENCE_THRESHOLD（0.65 不動）

---

## 4. 既有資源（可直接重用）

`src/lib/crawlers/idolMatcher.ts`（M1a-B，目前只被 `kpopofficial_concerts` 使用）

```ts
export interface IdolForMatching { id: string; name: string; alt_names: string[] }
export interface IdolMatchIndex { /* opaque */ }
export interface IdolMatchResult { idol: IdolForMatching; viaPrimaryName: boolean }

export function normalizeName(s: string): string
export function buildIdolMatchIndex(idols: IdolForMatching[]): IdolMatchIndex
export function matchIdolFromTitle(title: string, index: IdolMatchIndex): IdolMatchResult | null
```

Hard rules（已實作）：
- exact match after normalization（lowercase / dash 處理 / 標點剝除）
- longest prefix wins（"Stray Kids" 不會被 "Stray" 短匹配蓋掉）
- 沒命中就回傳 null（不亂猜）

---

## 5. 提案改動範圍

### 5.1 `src/lib/crawlers/runGenericWebpageFetcher.ts`（兩處主要改動）

**改動 A — idolMatcher 整合**：在處理 Claude 回傳的 events 階段（preview + commit 兩條路徑都要走）：

```ts
// 偽碼示意
const sourceHasBoundIdol = source.idol_id !== null

// 只在 source 未綁定 idol 時，準備 matcher index
let matcherIndex: IdolMatchIndex | null = null
if (!sourceHasBoundIdol) {
  const { data: idols } = await supabase
    .from('idols')
    .select('id, name, alt_names')
    .eq('is_active', true)
  matcherIndex = buildIdolMatchIndex(idols ?? [])
}

for (const event of claudeEvents) {
  let detectedIdolId: string | null
  if (sourceHasBoundIdol) {
    detectedIdolId = source.idol_id  // 既有行為
  } else if (matcherIndex) {
    const match = matchIdolFromTitle(event.title, matcherIndex)
    detectedIdolId = match?.idol.id ?? null  // 新行為：沒命中就保持 NULL
  } else {
    detectedIdolId = null
  }
  // ... 寫 candidate payload
}
```

**改動 B — MAX_CANDIDATES_PER_COMMIT 改可配置 + 提高預設**：

```ts
// 改動前
export const MAX_CANDIDATES_PER_COMMIT = 3

// 改動後
export const DEFAULT_MAX_CANDIDATES_PER_COMMIT = 10
export const MAX_CANDIDATES_PER_COMMIT_HARD_CAP = 50

function resolveMaxCandidates(source: CrawlerSourceRow): number {
  const raw = source.config?.maxCandidatesPerCommit
  if (typeof raw === 'number' && raw > 0) {
    return Math.min(raw, MAX_CANDIDATES_PER_COMMIT_HARD_CAP)
  }
  return DEFAULT_MAX_CANDIDATES_PER_COMMIT
}
```

guard 邏輯（既有的 line ~738）改為呼叫 `resolveMaxCandidates(source)`，超過仍是「整批拒絕」(behavioral 不變)。

### 5.2 不需要新 migration

- `detected_idol_id` 欄位已存在於 `event_candidates`
- `maxCandidatesPerCommit` 用既有 jsonb `crawler_sources.config` 欄位，admin 可在後台 UI / 直接 SQL UPDATE 設定，不需要 schema 變更

### 5.3 不需要改 dispatch / runtime guard

`generic_webpage` 的 cron / sync-all skip guard 維持不變（仍只能手動 admin 觸發）。

---

## 6. 設計決策需確認

### 改動 A（idolMatcher 整合）

| # | 決策點 | 預設提案 |
|---|---|---|
| Q1 | matcher 命中但 source.idol_id 也有值，誰優先？ | source.idol_id 優先（既有行為，避免破壞 P1-B3/B4/B6 行為）|
| Q2 | matcher 沒命中時，candidate 還是要寫嗎？ | **要**。寫入 `detected_idol_id = NULL`，admin 仍能手動指定（保留 visibility）。對應 kpopofficial 是「沒命中就 skip」— 但 generic_webpage 是 Claude 萃取，扔掉等於浪費 AI 成本 |
| Q3 | 是否在 candidate payload 記錄 matched_via？ | 是。`raw_data.idol_matched_via = 'name' \| 'alt_name' \| 'none' \| 'source_binding'` 方便後續分析 |
| Q4 | matcher 載入 idols 的 query 失敗時？ | 整個 run 失敗（fail-fast），避免靜默寫入錯資料 |
| Q5 | preview 模式要不要也跑 matcher？ | **要**。預覽結果要忠實反映 commit 後會發生什麼，否則 admin 看不到實際對應狀況 |

### 改動 B（MAX_CANDIDATES_PER_COMMIT 改可配置）

| # | 決策點 | 預設提案 |
|---|---|---|
| Q6 | 預設值要設多少？ | **10**。涵蓋 YG (7) / N.Flying (7) / 預期未來 aggregator 5–10 events 的常見規模 |
| Q7 | hard cap 要設多少？ | **50**。Claude 一次萃取超過 50 個 events 幾乎只可能是 noise，硬擋避免後台被淹 |
| Q8 | 超過 cap 的行為？ | **整批拒絕**（不變）。理由：截斷前 N 筆會破壞 dedupe basis 穩定性，且 admin 看不到 Preview 跟 Commit 結果不一致 |
| Q9 | 既有 P1-B3/B4/B6 source 要不要回去把 cap 改低？ | **不需要**。沒設就走預設 10，比 3 更寬容；既有 source 自然受益 |
| Q10 | 後台 UI 要不要為這個值加編輯介面？ | **不在本次範圍**。先用 SQL UPDATE 或重 seed migration 設定；admin UI 編 jsonb config 之後可單獨工作單做 |

---

## 7. 安全邊界

- 不繞 RLS：matcher 用 service role client 讀 idols（既有 cron 路徑同款）
- 不寫 events 表（候選仍走 `event_candidates` + `review_status='pending'`）
- 不自動 Approve（即使 matcher 命中也只是填 detected_idol_id，不改 review_status）
- 不改任何 enum / schema

---

## 8. 測試方式

### 改動 A 驗收
1. **既有 source 不受影響**：跑 P1-B3 aespa source → 候選 detected_idol_id 仍應 = aespa.id
2. **label-level matcher 命中**：跑 P1-B7 kpopconcerts → MAMAMOO 候選 detected_idol_id 應自動 = MAMAMOO.id
3. **label-level matcher 沒命中**：跑 P1-B5 YG notice，預期部分候選（含未在 idols 表的藝人，例如 "ALLDAY PROJECT"）detected_idol_id 仍為 NULL — 由 admin 手動處理
4. **後台 UI 不變**：「缺少偶像對應」警告仍應為「detected_idol_id=NULL」的最後保險

### 改動 B 驗收
1. **預設 cap 提高有效**：跑 P1-B5 YG notice (Preview 7 events) → Commit 不再被拒，`inserted=7`（或扣掉 dedup / lowConf 後的數字）
2. **per-source override 有效**：UPDATE 某筆 source 的 config 加 `{"maxCandidatesPerCommit": 5}` → Commit 上限變 5，超過仍整批拒絕
3. **hard cap 有效**：把 source config 設 `{"maxCandidatesPerCommit": 999}` → 實際生效值應 = 50
4. **既有 P1-B7 kpopconcerts (1 event)** → 行為完全不變，仍 `inserted=1`

---

## 9. 預期成果

- **改動 A**：P1-B5 YG notice 與 P1-B7 kpopconcerts 兩個 label-level source 抓到的 events 大多數可直接 Approve（無需 admin 手動指定 idol）
- **改動 B**：P1-B5 YG notice + P1-B6 N.Flying JP（兩個都被 cap=3 卡住）終於能 commit；未來新加的 aggregator 也不會被 cap=3 卡死
- 之後若新增更多 multi-artist aggregator，都能自動受益

---

## 10. 後續 PR 拆分建議

| PR | 內容 |
|---|---|
| 工作單 PR（本檔） | 規劃；不改 code |
| 實作 PR | 只改 `runGenericWebpageFetcher.ts`；不改 prompt 不改 schema；含單元測試 |
| 驗收 | 重跑 kpopconcerts Preview，觀察 MAMAMOO 是否自動帶 idol |

---

## 11. 開放問題

- Q5 是否要做「matched_idol_name」回填到 Claude prompt 當 hint？（暫不做，避免循環依賴 + 增加 token）
- 多藝人標題（"Stray Kids and JENNIE To Be First-Ever Headliners"）— idolMatcher 是 longest-prefix 規則，會挑到第一個能對上的 idol（這場是 Stray Kids 還是 JENNIE 視標題寫法）。如果要產生兩筆 candidate（一筆給 Stray Kids、一筆給 JENNIE），那是另一輪工作單（M2 跨來源多藝人去重）的範圍，本輪不做。
