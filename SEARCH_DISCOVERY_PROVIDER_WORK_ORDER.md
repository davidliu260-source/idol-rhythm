# Search Discovery Provider 工作單

> **版本**：v2 — 2026-05-23（修正成本估算、補三方案決策輸出）
> **範圍**：只做技術評估與策略規劃，不寫 code、不新增 API key、不改 crawler、不改 schema、不改 `event_candidates`、不碰前台 UI。
> **上游**：快閃店來源盤點工作單（PR #139 merged）確認多個 SPA 重度站點不適合直接爬，需要 discovery 補洞。
> **下游**：本工作單 GPT audit 通過後，依 §七決策輸出選擇方案，再開對應 runtime 工作單。

---

## 一、背景與問題

現有爬蟲全部是「已知 URL → 定期 fetch → AI 解析」模式：

| 現有爬蟲 | 模式 | 盲區 |
|---|---|---|
| SMTOWN / WAKEONE notice | 固定 notice feed URL → HTML parse | 只覆蓋該 notice feed 已列出的活動 |
| YG / JYP artist schedule | 固定 schedule endpoint → JSON parse | 只覆蓋各藝人官方排程頁 |
| kpopofficial.com | 聚合站 HTML parse | 聚合站延遲、遺漏長尾活動 |

**盲區**：快閃店 / 展覽 / 品牌活動沒有公開 JSON feed，直接 curl 取回的是 JS bundle shell，內容為空。

**Discovery 的核心問題**：我們不知道「哪裡有活動頁面」，所以需要一個「找 URL 的工具」，再讓 Claude Haiku 去讀內容、抽欄位。

---

## 二、範圍邊界（本工作單不做）

| 禁止 | 原因 |
|---|---|
| 申請或設定任何 API key | runtime 工作單才做 |
| 寫任何 discovery runtime / fetcher | 工作單先行 |
| 修改 `event_candidates` / `events` schema | 不需 migration |
| 改 crawler 現有邏輯 | 不動既有爬蟲 |
| 碰前台 UI | 無關 |
| 開 headless browser 抓 SPA 站點 | v1 明確排除 |
| 直接 publish 任何搜尋結果 | 永遠走 `event_candidates` → admin 審核 → publish |
| 接 Instagram / X / TikTok | v1 排除（需登入 / 私有 API）|

---

## 三、候選方案比較

### 3.1 方案 A：手動 Google 搜尋 + Claude 判斷

**流程**：
Admin 自行上 Google 搜尋 → 找到活動 URL → 貼入後台手動新增候選表單 → Claude 解析 → `event_candidates` → 審核。

| 項目 | 評估 |
|---|---|
| API key 需求 | 無 |
| 成本 | $0（只有 Claude Haiku 解析費用，每筆 < 0.02 台幣）|
| 可擴展性 | 低（91 個 idol 無法全覆蓋，admin 工作量大）|
| 結果品質 | Admin 自行過濾，品質高但主觀 |
| 速度 | 慢，依 admin 操作頻率 |
| 適合時機 | 沒有預算、或需要驗證 query 模板效果的 pilot 階段 |

### 3.2 方案 B：Google PSE 作 discovery，Claude Haiku 做 parsing

**流程**：
Vercel Cron → Google PSE API（自動搜尋 per-idol query）→ 回傳 URL list → source_hash 去重 → Claude Haiku 解析過濾後 URL → `event_candidates` → admin 審核。

| 項目 | 評估 |
|---|---|
| API key 需求 | `GOOGLE_PSE_API_KEY` + `GOOGLE_PSE_CX`（不得 NEXT_PUBLIC_ 前綴）|
| 免費配額 | **100 queries/day**（非 100/run；每日上限）|
| 超額費用 | $5 / 1,000 queries |
| 查詢設計 | 支援 `site:ktown4u.com`、`site:linefriendssquare.com` 等定向搜尋 |
| 回傳格式 | JSON（title / snippet / link）；snippet 可作初步過濾 |
| 韓國本地覆蓋 | ✅ Google 索引韓國站點品質高 |
| 可擴展性 | 高（自動 Cron，不需 admin 手動操作）|
| ToS 合規 | ✅ 官方 API，合規 |
| 缺點 | snippet 有時不夠判斷是否為活動頁；需要 fetch 完整頁面才能高品質解析 |

### 3.3 方案 C：只做固定官方來源 crawler（不接搜尋 API）

**流程**：
為每個高價值站點各開一個 parser（ktown4u 各類目頁 / Soundwave listing / Music Plant listing 等），定期 fetch → Claude 解析 → `event_candidates`。

| 項目 | 評估 |
|---|---|
| API key 需求 | 無 |
| 成本 | 只有 Claude Haiku 解析費用 |
| 可擴展性 | 低（每個新站點都要各開 parser；SPA 站點無法直接爬）|
| 結果品質 | 高（直接讀源頭）|
| 維護成本 | 高（站點改版即 break）|
| 適合時機 | 站點有穩定 HTML / RSS / JSON endpoint，如 SMTOWN / WAKEONE 已採用此模式 |
| 限制 | Ktown4u / LINE FRIENDS / The Hyundai 等為 SPA，此方案無效 |

### 3.4 補充評估：SerpAPI

| 項目 | 評估 |
|---|---|
| 免費配額 | 100 searches/month |
| 付費方案 | $50/month → 5,000 searches |
| 優點 | 結果豐富（organic_results + date + pagemap）|
| 缺點 | 免費層過少；$50/month 起跳對 v1 ROI 不明確 |
| 建議 | 暫列備選，確認 Google PSE 不足時再評估 |

### 3.5 補充評估：Brave Search API

| 項目 | 評估 |
|---|---|
| 免費配額 | 2,000 queries/month（特定計畫）|
| 付費 | $3 / 1,000 queries |
| 韓國本地覆蓋 | 不確定；自有索引，可能遺漏韓國小型站點 |
| 建議 | 可作 Google PSE 的補充，但需實測韓國覆蓋率再決定 |

---

## 四、成本重新估算（修正版）

> **重要**：Google PSE 不消耗 Claude token；Claude Haiku 只在解析 URL 頁面內容時消耗 token。兩者費用獨立計算。

### 4.1 Query 數量估算

| 設定 | 數量 |
|---|---|
| Active idol 數 | 91 個 |
| Query template 數（per idol）| 3 個（定向 site: × 2 + 全網廣域 × 1）|
| 每次 run 總 query 數 | 91 × 3 = **273 queries/run** |

### 4.2 Google PSE 費用（依執行頻率）

| 頻率 | 每次 run | 免費 100/day 可抵 | 計費 queries | Google PSE 費用/run | 月費估算 |
|---|---|---|---|---|---|
| **每日自動** | 273 queries | 100 | 173 queries | ~$0.87 | **~$26/月** |
| **每週一次** | 273 queries | 700 free/週（不累積，每日上限 100）→ 實際只有 100/day | 173 queries | ~$0.87 | **~$3.5/月** |
| **人工觸發** | 273 queries（按需）| 100（當日）| 173 queries | ~$0.87/次 | **按需計費** |

> **注意**：Google PSE 免費額度是 **每日 100 queries**，不是每次 run 100，也不會跨日累積。一次 run 273 queries 時，當日免費額度（100）用完後，剩餘 173 queries 以 $5/1,000 計費 = **約 $0.87/run**。

### 4.3 Claude Haiku 解析費用

| 設定 | 數量 |
|---|---|
| Google PSE 每次回傳 URL 總數 | ~273 × 10 = 2,730 個（最多）|
| 經 snippet 初步過濾（字串比對，不消耗 token）| 保留 ~5–10% = 約 30–50 個值得解析的 URL |
| 每筆解析 token 數（input ~1,500 + output ~500 tokens）| ~2,000 tokens/筆 |
| Haiku 定價 | $0.25/M input + $1.25/M output ≈ $0.001/筆 |
| 每次 run 解析費用 | 50 筆 × $0.001 = **$0.05/run**（約 1.5 台幣）|
| 月費（每週一次）| ~$0.20/月 |

### 4.4 每週執行總成本摘要

| 項目 | 每次 run | 每月（4 次）|
|---|---|---|
| Google PSE | ~$0.87 | **~$3.5** |
| Claude Haiku 解析 | ~$0.05 | **~$0.20** |
| **合計** | **~$0.92/run** | **~$3.7/月（約 115 台幣）**|

> 每日自動執行則約 $26/月（約 800 台幣）；建議 v1 先以「每週一次或人工觸發」啟動。

---

## 五、查詢策略

### 5.1 定向 site: 搜尋（針對已知高價值站點）

```
"{idol_name}" 팝업 site:ktown4u.com
"{idol_name}" 팝업스토어 site:linefriendssquare.com
"{idol_name}" 팝업 OR 전시 site:thehyundai.com
"{idol_name}" 팬사인회 OR 사인회 site:soundwavekorea.com
"{idol_name}" 사인회 site:musicplant.co.kr
"{idol_name}" 팝업 site:musinsa.com
"{idol_name}" 팝업 site:nol.world
"{idol_name}" 관광 OR 전시 site:visitseoul.net
```

### 5.2 全網廣域搜尋（補洞）

```
"{idol_name}" 팝업스토어 2026
"{idol_name}" 전시 2026
"{idol_name}" popup store 2026
"{idol_name}" exhibition 2026
"{idol_name}" brand collaboration 2026
```

### 5.3 Query 上限設計

| 限制 | 建議值 | 原因 |
|---|---|---|
| 每次 run 總上限 | 300 queries | 控管成本；單次不超過 $1.5 |
| 每站點上限 | 10 queries | 避免單站消耗過多 quota |
| 每藝人上限 | 5 queries/run | 長尾 idol 降低頻率 |
| 每次 run 解析上限 | 50 URL | Claude Haiku 費用控管 |

### 5.4 去重機制

- 使用現有 `source_hash`（J4 機制）：對 URL 做 hash，避免同 URL 重複進庫
- Google PSE 回傳的 URL 在 fetch 前先查 `event_candidates.source_hash`；已存在則 skip
- 已 approve / reject 的候選不重新進庫

---

## 六、風險清單

| 風險 | 說明 | 緩解方式 |
|---|---|---|
| **Google PSE 產品限制** | Google 有時對新帳號限制 PSE 建立數量；或調整 API 政策 | 申請前確認帳號狀態；保留 SerpAPI / Brave 作備援 |
| **搜尋結果不精準** | Query 可能回傳媒體文章 / aggregator / fan content 而非官方活動頁 | snippet 初步過濾 + Claude 判斷「是否為官方活動頁」；admin 二次審核 |
| **snippet 品質不足** | 部分站點 snippet 截斷，日期 / 地點資訊缺失 | 需 fetch 完整頁面再解析；增加 token 消耗 |
| **SPA 站點 fetch 空白** | Ktown4u 等 SPA 頁面 curl 取回 JS shell | v1 以 snippet + title 解析，或標為「需人工確認」；不啟動 headless browser |
| **偽活動 / 過期活動** | 搜尋可能回傳過去活動或不相關頁面 | Claude 解析時判斷日期；admin 審核時過濾 |
| **quota 超支** | 每週自動跑，月費失控 | 設 hard cap（run 上限 300 queries）；Vercel Cron 頻率控管；billing alert |
| **登入限制** | 搜尋結果 URL 可能指向需登入頁面 | fetch 前先 HEAD request 確認；200 且 content-type text/html 才解析；login redirect 則 skip |
| **robots.txt 合規** | 部分站點禁止 crawler | fetch URL 前檢查 robots.txt；不抓禁止項目 |
| **Instagram / X / TikTok** | 社群平台需登入 / 私有 API | v1 明確排除；搜尋結果含此類 URL 時 skip |

---

## 七、決策輸出（三方案）

### 方案 A：暫時人工 Google 搜尋 + Claude 判斷

**適合情境**：預算為零、或需要先驗證哪些 query 有效再決定是否接 API。

**流程**：Admin 自行 Google → 貼 URL 到後台手動候選表單 → Claude 解析 → `event_candidates` → 審核。

**優點**：零 API 成本，立即可用，admin 對結果有完整控制。

**缺點**：無法規模化，91 個 idol 人工操作量過大，長期不可持續。

**推薦優先級**：🔶 短期 pilot 可用，不作長期方案。

---

### 方案 B：Google PSE 作 discovery，Claude Haiku 做 parsing（推薦）

**適合情境**：v1 正式 discovery 方案，需要自動化、可規模化。

**流程**：Vercel Cron（每週）→ Google PSE API（per-idol query）→ URL list → source_hash 去重 → snippet 初步過濾 → Claude Haiku 解析 → `event_candidates` → admin 審核。

**成本**：每週一次約 $0.92/run，月費約 $3.7（約 115 台幣）。

**優點**：
- 自動化，不需 admin 手動搜尋
- site: 定向搜尋精準覆蓋已知高價值站點
- 成本可控（每週一次）
- 與現有 `event_candidates` + `source_hash` 無縫整合
- admin 只需審核候選，不需找來源

**缺點**：
- 需申請 Google PSE API key + 設定 Vercel env
- SPA 站點 snippet 可能不完整
- 需 runtime 工作單才能實作

**推薦優先級**：✅ 推薦為 v1 正式方案，在 runtime 工作單 GPT audit 通過後實作。

---

### 方案 C：只做固定官方來源 crawler（不接搜尋 API）

**適合情境**：已知站點有穩定 HTML / RSS / JSON endpoint（如 SMTOWN / WAKEONE 已採用）。

**流程**：為每個新站點各開一個 parser → 定期 fetch → Claude 解析 → `event_candidates`。

**優點**：無 API key 需求，結果品質高（直接讀源頭）。

**缺點**：
- Ktown4u / LINE FRIENDS / The Hyundai 等 SPA 站點此方案無效
- 每個新站點都需要各開 parser，維護成本高
- 站點改版即 break

**推薦優先級**：🔶 適合補充（有穩定 endpoint 的站點），不適合作快閃店 discovery 主力。

---

### 推薦結論

**v1 採方案 B（Google PSE + Claude Haiku）**，理由：
1. 快閃店 / 展覽 / 品牌活動來源以 SPA 為主，方案 C 無效
2. 方案 A 的人工工作量對 91 個 idol 不可持續
3. 方案 B 月費約 115 台幣，成本明確可控
4. 與現有 `event_candidates` / `source_hash` / admin 審核流程完全兼容
5. runtime 工作單可分拆：先 Google PSE key 設定，再 Cron 接入，逐步驗證

---

## 八、開放問題（留給 runtime 工作單）

| # | 問題 | 影響 |
|---|---|---|
| Q1 | Google PSE CX（Search Engine ID）設定：全網搜尋？還是限定特定站點？ | 影響 query 覆蓋範圍 |
| Q2 | snippet 是否足夠讓 Claude 判斷「這是活動頁 / 非活動頁」？還是需要 fetch 完整頁面？ | 影響 token 成本估算 |
| Q3 | `event_candidates` 的 `source` 欄位如何記錄「google_discovery」來源？是否需要新 parser_type？ | 若需 → migration |
| Q4 | Cron 頻率：每週一次 vs 人工觸發 admin 按鈕，哪個更適合 v1？ | 影響成本與 admin UX |
| Q5 | Brave Search 韓國本地站點覆蓋率是否足夠補充 Google PSE？ | 決定是否雙 provider |
| Q6 | SPA 站點 snippet 不足時，Claude 判斷結果如何處理？skip / 標記需人工確認？ | 影響 admin 工作量 |

---

## 九、Acceptance Criteria（本工作單）

- [ ] 五個 provider / 方案皆有完整評估（Google PSE / SerpAPI / Brave / 手動 / 固定爬蟲）
- [ ] 成本估算正確：Google PSE 免費層 100 queries/day，超出以 $5/1,000 計費；每週一次約 $3.7/月
- [ ] Claude Haiku 解析費用獨立估算（不與 Google PSE 混淆）
- [ ] 三方案決策輸出清晰，有推薦結論與理由
- [ ] Query 策略草案：定向 site: + 全網廣域，覆蓋 PR #139 所有「discovery」來源
- [ ] Query 上限設計（run 上限 / 每站上限 / 每藝人上限）
- [ ] 風險清單涵蓋：PSE 限制 / 搜尋不精準 / SPA 空白 / quota 超支 / 登入限制 / v1 排除 Instagram / X / TikTok
- [ ] 資料政策確認：搜尋結果不直接 publish，走候選 → 審核流程
- [ ] 不寫 runtime code / 不新增 API key / 不改 schema

---

*只做工作單，不寫 runtime、不改 schema、不新增 migration、不接 API key。*
*下一步：GPT audit 通過後，依 §七推薦結論開 Google PSE runtime 工作單。*
