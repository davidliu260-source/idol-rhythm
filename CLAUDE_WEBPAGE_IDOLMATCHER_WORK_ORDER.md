# P1-B8 工作單：把 idolMatcher 整合進 generic_webpage runtime

> 階段：P1-B（Claude Webpage Discovery）
> 類型：runtime 改造工作單（僅規劃，不直接實作）
> 觸發來源：P1-B7 驗收（PR #165）發現的系統限制
> 日期：2026-05-24

---

## 1. 問題背景

P1-B7（kpopconcerts.com aggregator）驗收時發現 `generic_webpage` 對「label-level / 多藝人」來源有重大限制：

| Source 設定 | 候選 detected_idol_id | 可否直接 Approve |
|---|---|---|
| `idol_id` 綁定特定藝人（P1-B3/B4/B6）| 自動繼承 source.idol_id | ✅ 可 |
| **`idol_id = NULL`**（P1-B5 YG notice、P1-B7 kpopconcerts）| **空** | **❌ 不可，被 UI 警告「缺少偶像對應」** |

實例：kpopconcerts 抓到的 `[TOUR] MAMAMOO Announce 2026 US Tour` 候選，明明 idols 表內有 MAMAMOO，但因為 source `idol_id=NULL`，candidate 的 `detected_idol_id` 也是 NULL，admin 必須手動指定 idol 才能 Approve。

對比 `kpopofficial_concerts`：它有專屬 parser + `idolMatcher.ts` 做 longest-prefix exact match against `idols.name + alt_names`，所以同樣 label-level source 也能自動把候選對應到正確 idol。

---

## 2. 目標

讓 `generic_webpage` runtime 在 source `idol_id=NULL` 時，自動對每個 Claude 萃取出的 event 候選跑 `idolMatcher.matchIdolFromTitle()`，把命中的 idol id 寫入 `detected_idol_id`。

source `idol_id` 有綁定時的行為**完全不變**（繼承 source.idol_id 作為 hint + detected_idol_id 預設值）。

---

## 3. 不在本次範圍

- 不改 Claude prompt / 萃取邏輯（Claude 還是只回傳 event title / date / type 等）
- 不引入 fuzzy match / Levenshtein（沿用 idolMatcher 的 exact-prefix rule）
- 不改 `event_candidates` schema
- 不改前台 / admin UI
- 不改 kpopofficial / 其他既有 crawler（它們已經有自己的 idol matching）
- 不改 dispatch / cron 行為

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

### 5.1 `src/lib/crawlers/runGenericWebpageFetcher.ts`（主要改動）

在處理 Claude 回傳的 events 階段（preview + commit 兩條路徑都要走）：

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

### 5.2 不需要新 migration

`detected_idol_id` 欄位已存在於 `event_candidates`，本次只是「在 source.idol_id=NULL 時改用 matcher 填值」。

### 5.3 不需要改 dispatch / runtime guard

`generic_webpage` 的 cron / sync-all skip guard 維持不變（仍只能手動 admin 觸發）。

---

## 6. 設計決策需確認

| # | 決策點 | 預設提案 |
|---|---|---|
| Q1 | matcher 命中但 source.idol_id 也有值，誰優先？ | source.idol_id 優先（既有行為，避免破壞 P1-B3/B4/B6 行為）|
| Q2 | matcher 沒命中時，candidate 還是要寫嗎？ | **要**。寫入 `detected_idol_id = NULL`，admin 仍能手動指定（保留 visibility）。對應 kpopofficial 是「沒命中就 skip」— 但 generic_webpage 是 Claude 萃取，扔掉等於浪費 AI 成本 |
| Q3 | 是否在 candidate payload 記錄 matched_via？ | 是。`raw_data.idol_matched_via = 'name' \| 'alt_name' \| 'none' \| 'source_binding'` 方便後續分析 |
| Q4 | matcher 載入 idols 的 query 失敗時？ | 整個 run 失敗（fail-fast），避免靜默寫入錯資料 |
| Q5 | preview 模式要不要也跑 matcher？ | **要**。預覽結果要忠實反映 commit 後會發生什麼，否則 admin 看不到實際對應狀況 |

---

## 7. 安全邊界

- 不繞 RLS：matcher 用 service role client 讀 idols（既有 cron 路徑同款）
- 不寫 events 表（候選仍走 `event_candidates` + `review_status='pending'`）
- 不自動 Approve（即使 matcher 命中也只是填 detected_idol_id，不改 review_status）
- 不改任何 enum / schema

---

## 8. 測試方式

1. **既有 source 不受影響**：跑 P1-B3 aespa source → 候選 detected_idol_id 仍應 = aespa.id
2. **label-level matcher 命中**：跑 P1-B7 kpopconcerts → MAMAMOO 候選 detected_idol_id 應自動 = MAMAMOO.id
3. **label-level matcher 沒命中**：跑 P1-B5 YG notice，預期部分候選（含未在 idols 表的藝人，例如 "ALLDAY PROJECT"）detected_idol_id 仍為 NULL — 由 admin 手動處理
4. **後台 UI 不變**：「缺少偶像對應」警告仍應為「detected_idol_id=NULL」的最後保險

---

## 9. 預期成果

- P1-B5 YG notice 與 P1-B7 kpopconcerts 兩個 label-level source 抓到的 events 大多數可直接 Approve（無需 admin 手動指定 idol）
- 之後若新增更多 multi-artist aggregator（P1-B8 之後的擴張），都能自動受益

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
