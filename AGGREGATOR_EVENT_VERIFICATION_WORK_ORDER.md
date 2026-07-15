# 聚合源事件自動求證工作單（AGGREGATOR_EVENT_VERIFICATION）

> 類型：**高風險任務工作單**（涉 AI / 搜尋 / 發布邏輯）。
> 角色：PM 起草規劃；實作一律開票交 Codex（PR 標 `high-risk` label → Claude review → Owner merge）。
> 依據：`DATA_GAP_AUDIT_WORK_ORDER.md` + `DATA_BACKFILL_PLAN.md`（D1 選項 B）。
> 前身：`SEARCH_DISCOVERY_WORK_ORDER.md`(P1) / `GOOGLE_PSE_PROBE_REPORT.md`(P1-A, Deferred) /
>       `CLAUDE_WEBPAGE_DISCOVERY_WORK_ORDER.md`(P1-B → generic_webpage runtime 已 ship)。

---

## 0. 一句話定義

給「聚合源候選 / 草稿」一個**自動交叉求證**的管道：系統去搜尋官方 / 售票 / 主辦 / 場館 / 可靠媒體是否也報導同一場活動，**命中就把佐證來源掛上去（trust_level 升 media/official）**、供 admin 一鍵確認發布；**沒命中就維持草稿**。核心是把「人工逐筆補來源」變成「機器先找、人工把關」。

---

## 1. 問題陳述（今日實證）

- kpopofficial（community 聚合源）是**最高產來源**，覆蓋 BTS / ENHYPEN / (G)I-DLE 等頂流巡演。
- 但依 `inferTrustLevelFromSource`，community → `trust_level='pending'` → **不可發布**（`CLAUDE.md` 前台只顯示 official/media 的守門，正確設計）。
- 現況數據（2026-07-14）：
  - 156 場已發布中，**27 場**聚合源是**人工手動升級**（補官方 source）才發出去 → 已達人力極限。
  - 目前 **99 筆草稿中 94 筆是 community**，全部卡住無法發布。
  - 後台「自動判斷+發布」對這 94 筆 **0/84 生效**（閘門正確擋下）。
- **人工逐筆求證不可規模化**（Owner 2026-07-14 明確否決）；cron 每日還會生更多聚合草稿，缺口只會擴大。

→ 需要一個**自動求證層**，把聚合源的高產出接回可發布狀態，同時不破壞 trust 守門。

---

## 2. 範圍與非範圍

### 範圍（v1）
- 對「**已存在的聚合源草稿 / 候選**」做求證（不改 crawler 抓取階段）。
- **admin 手動觸發**：後台選取聚合草稿 →「自動求證」→ 系統逐筆搜尋佐證 → 回報結果。
- 命中佐證 → **提議**新增 event_sources（真實 official/media/ticketing type）+ 對應 trust_level → **admin 一鍵確認後**才實際掛上並可發布。
- 未命中 → 維持草稿，標記「已求證未命中 + 時間」，避免重複空跑。

### 非範圍（v1 明確不做）
- ❌ 不做全自動發布（求證命中也**必須 admin 確認**，保留人工把關 = 守門精神）。
- ❌ 不改 `inferTrustLevelFromSource` 對 community 的判定（community 本身仍是 pending；靠「掛上真實佐證 source」改變結果，不是放寬規則）。
- ❌ 不接 cron / 不自動批次跑全站（v1 只手動觸發、有 batch 上限）。
- ❌ 不改前台 UI / 不改資料可見性規則 / 不降 trust_level 門檻。
- ❌ 不重寫 crawler 抓取；重用既有 generic_webpage 基礎設施。

---

## 3. 求證流程設計（v1 草案，待 GPT 定調）

```
聚合草稿 (artist + date + title + venue?)
   │
   ├─ 1. 組查詢：{artist} {venue/city} {date} concert/tour official
   │
   ├─ 2. 搜尋 provider（見 §4）→ 取候選 URL 清單
   │
   ├─ 3. 對每個候選 URL：重用 generic_webpage fetchPublicHtml + Claude 判讀
   │        「這頁是否為官方/售票/主辦/場館/媒體，且指向同一場活動
   │         （藝人相符 + 日期相符 ± 場館相符）？」
   │
   ├─ 4a. 命中 → 產出「提議佐證」：{url, 判定 type(official/media/ticketing),
   │         信心分數, 比對依據} → 寫入 pending 提議（不直接掛 source）
   │
   └─ 4b. 未命中 → 標記 verified_at + verified_result='no_match'，維持草稿
   │
   ▼
後台顯示提議 → admin 檢視（原聚合標題 vs 找到的官方頁）→ 一鍵「採用並發布」
   → 實際 INSERT event_sources(真實 type) → inferTrustLevel 升 media/official → publish
```

---

## 4. 工作單必須回答的關鍵問題

| # | 問題 | 備註 |
|---|---|---|
| Q1 | **搜尋 provider 用哪個？** → **Owner 定調：Gemini（Google Search grounding）為首選**，B-0 探測驗證命中品質後定案 | Gemini grounding = 搜尋+判讀一次呼叫、Google 索引覆蓋最佳（尤其韓文官方/售票）、Flash 成本低、回傳 citations（正好是要掛的佐證 URL）。備選 Claude web search（已在 Anthropic 生態）。P1-A 已否決免費 Google PSE |
| Q2 | **「命中佐證」的判定標準？** 藝人相符 + 日期相符為必要？場館相符加分？ | 定義太寬 → 假佐證發錯活動；太嚴 → 命中率低 |
| Q3 | **信心門檻多少才提議？** 低於門檻是否直接 no_match？ | 沿用 generic_webpage confidence gate 概念（0.65?）|
| Q4 | **找到的來源如何分類 type / trust_level？** 官方站→official，售票/媒體→media？ | 需對應 `source_type` enum + trust 規則 |
| Q5 | **要不要人工確認關卡？**（PM 強烈建議：要）| v1 保留 admin 一鍵確認，命中不自動發 |
| Q6 | **成本 / rate limit 控管？** 每筆求證幾次搜尋 + 幾次 fetch+Claude？batch 上限？ | 需 maxVerifyPerRun / maxSearchPerEvent 保護 |
| Q7 | **假陽性風險如何降低？** 錯配活動 = 發布錯誤資料上前台 | 這是最大風險，需 §6 專節 |
| Q8 | **求證結果如何持久化？** 新欄位 or 重用 latest_* / raw_data？ | 可能需 migration（verified_at / verified_result / proposed_source jsonb）|
| Q9 | **與既有 27 筆人工升級如何並存？** 不回頭動它們 | 只處理未求證的草稿 |
| Q10 | **觸發入口？** 後台哪一頁、單筆 vs 批量、與現有「自動判斷+發布」按鈕關係 | 建議獨立「自動求證」動作，不混入現有發布按鈕 |

---

## 5. 重用既有基礎設施（降低實作成本）

- `src/lib/crawlers/genericWebpage.ts`：`fetchPublicHtml` + `cleanHtmlToText` + `parseWebpageWithClaude` + `assertUrlIsPublic`(SSRF guard) → 求證的「fetch + 判讀」直接沿用。
- `sourceReview.ts`：`inferTrustLevelFromSource` 不動；求證只負責產出真實 source，讓既有邏輯自然升 trust。
- `event_candidates` / `events` + `event_sources`：掛佐證用既有 event_sources INSERT 路徑。

---

## 6. 假陽性風險（最高風險，需專節把關）

- **風險**：搜尋把「同藝人不同場」或「同名不同藝人」的官方頁錯配 → 掛上錯佐證 → admin 若沒細看就發 → 前台出現錯誤日期 / 地點。
- **緩解**：
  1. **必要條件**：藝人相符 **且** 日期相符（±1 天容錯）才可提議；場館/城市相符為信心加分。
  2. **人工確認關卡不可省**：後台並排顯示「原聚合資料 vs 找到的官方頁摘要」，admin 目視確認才發。
  3. **提議不等於掛上**：命中只寫入 proposed 狀態，admin 拒絕則丟棄、不污染 event_sources。
  4. **信心門檻 + 記錄比對依據**（哪些欄位相符）供 admin 判斷。

---

## 7. 建議 PR 拆分（PM 逐張開票交 Codex，high-risk 標 label）

1. **B-0 Gemini grounding 探測報告**（純研究）：用 Gemini（Google Search grounding）對 3–5 個真實聚合草稿（如 ENHYPEN / BTS World Tour）做求證，實測：(a) 命中率（找到官方/售票佐證的比例）、(b) 假陽性率（錯配活動）、(c) citations URL 品質、(d) 每筆成本與延遲、(e) grounding metadata 解析難度。備選同場測 Claude web search 對照。→ 定 provider。比照 P1-A/P1-B「先探測再實作」紀律，**不先寫 runtime**。
2. **B-1 parser / evidence-contract spike**（純研究，**不碰 DB**）：依 B-0c 報告 §8，先解決 citation binding —— 測 `allowed_callers:["direct"]` / `web_search_20250305` 能否恢復結構化 citations，並設計 evidence contract（哪些欄位可稽核落庫）+ `max_uses` 成本收斂。**取不到可靠 citation binding 就不進 runtime**，即使 accuracy 5/5。
   > ⚠️ 原規劃此處為 migration，已於 2026-07-15 依 B-0c 結論改為 spike——格式問題未解前不得建 schema。
3. **B-1b migration**（B-1 spike 通過後才做）：新增求證狀態欄位（verified_at / verified_result / proposed_source jsonb 等）。
3. **B-2 求證 runtime（手動、單筆）**：一個草稿 → 搜尋 → fetch+Claude → 產出提議；不自動發。
4. **B-3 後台 UI**：提議檢視 + 一鍵「採用並發布」+ 未命中標記。
5. **B-4 批量 + 上限保護**：batch 求證 + maxVerifyPerRun。
6. （後續）B-5 cron 自動求證新草稿 — v1 不做，待 v1 驗證命中率後再議。

---

## 8. 邊界與硬規則

- 本檔為**規劃**；每個 B-x 由 PM 另開票交 Codex，涉 AI / 搜尋 / migration / 發布邏輯者 PR 標 `high-risk` label，Claude review → Owner merge。
- **不得**放寬 `inferTrustLevelFromSource` 或降 trust_level 門檻來「假裝」聚合源可信 —— 必須靠**真實找到的佐證來源**改變 trust。
- **命中不自動發布**，admin 確認關卡 v1 不可省。
- 假陽性 = 前台錯誤資料，視為**正確性事故**，§6 緩解為驗收必要條件。
- provider 若需 API key / billing，先在 B-0 探測報告評估，不在本檔決定。
- **Gemini 整合的 secret 邊界**：`GEMINI_API_KEY` 依 `CLAUDE.md` secrets 規則 —— 不進版控、不加 `NEXT_PUBLIC_`、不設 Preview 環境、只在 server-side（求證 runtime）使用；比照既有 `ANTHROPIC_API_KEY` 管理。
- **provider 判定不可全信**：Gemini grounding 找到的 URL 仍須經 §6 假陽性把關（藝人+日期相符）+ admin 確認，grounding 命中 ≠ 自動採信。

---

## 9. 成功長相

- admin 選一批聚合草稿 → 按「自動求證」→ 系統回報：X 筆找到官方/售票佐證（附連結）、Y 筆未命中。
- admin 逐筆目視「原聚合 vs 官方頁」→ 確認無誤 → 一鍵採用 → 事件掛真實 source、trust 升 media/official、發布上前台。
- 未命中的維持草稿、標記已求證，下次不重複空跑。
- 涵蓋數與已發布場數可持續成長，**不再依賴人工逐筆補來源**。
