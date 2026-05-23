# Search Discovery Provider 工作單

> **版本**：v1 — 2026-05-23
> **範圍**：只做技術評估與策略規劃，不寫 code、不新增 API key、不改 crawler、不改 schema、不改 `event_candidates`、不碰前台 UI。
> **用途**：評估是否引入 Google Programmable Search / Google Search / SerpAPI / Brave Search 作為 discovery layer，補爬蟲直接抓不到的長尾來源。
> **上游**：快閃店來源盤點工作單（PR #139 merged）確認 Ktown4u / LINE FRIENDS SQUARE / The Hyundai / Musinsa / Soundwave / Music Plant 等 SPA 重度站點不適合直接爬，需要 discovery 補洞。
> **下游**：本工作單通過後，視決策開 discovery runtime 工作單（含 API key 申請流程）或確認「v1 先人工搜尋 + Claude 判斷」。

---

## 一、背景與問題

### 1.1 現有爬蟲的盲區

現有 crawler 全部是「已知 URL → 定期 fetch → AI 解析」模式：

| 現有爬蟲 | 模式 | 盲區 |
|---|---|---|
| SMTOWN / WAKEONE notice | 固定 notice feed URL → HTML parse | 只覆蓋該 notice feed 已列出的活動 |
| YG / JYP artist schedule | 固定 schedule endpoint → JSON parse | 只覆蓋各藝人的官方排程頁 |
| kpopofficial.com | 聚合站 HTML parse | 聚合站本身延遲、遺漏長尾活動 |

**盲區**：SPA 重度 / 品牌 / 場館 / 電商平台上的活動（快閃店 / 展覽 / 品牌活動），沒有公開 JSON feed 也沒有固定 notice URL。即使頁面存在，直接 curl 取回的是 JS bundle shell，內容為空。

### 1.2 Discovery 的核心概念

Discovery layer 的任務是：
> 「找到活動頁面的 URL」，而不是「抓取活動內容」。

流程分工：
```
Google / SerpAPI / Brave
  ↓ 搜尋 → 回傳相關頁面 URL list
Claude
  ↓ 判斷哪些 URL 可能是有效活動頁 → fetch 頁面 → 解析欄位
event_candidates
  ↓ 候選入庫 → 後台 admin 審核 → approve → publish
```

這比每個品牌站點各開一個爬蟲更有擴展性，且不需要處理各站的 SPA / login / anti-bot。

---

## 二、範圍邊界（本工作單不做）

| 禁止 | 原因 |
|---|---|
| 申請或設定任何 API key | runtime 工作單才做；本輪只評估 |
| 寫任何 discovery runtime / fetcher | 工作單先行 |
| 修改 `event_candidates` / `events` schema | 不需 migration |
| 改 crawler 現有邏輯 | 不動既有爬蟲 |
| 碰前台 UI | 無關 |
| 開 headless browser 抓 SPA 站點 | v1 明確排除（PR #139 §六第 7 條）|
| 直接 publish 任何搜尋結果 | 永遠走 `event_candidates` 候選 → admin 審核 → publish |

---

## 三、候選 Provider 評估

### 3.1 Google Programmable Search Engine（PSE / Custom Search API）

| 項目 | 評估 |
|---|---|
| **簡介** | Google 官方自訂搜尋 API；可限定搜尋範圍（site: / 特定域名）或全網搜尋 |
| **定向搜尋支援** | ✅ 支援 `site:ktown4u.com`、`site:linefriendssquare.com`、`site:thehyundai.com` 等 |
| **免費配額** | 100 queries/day（免費）；超過 $5 / 1,000 queries |
| **付費上限** | 最高 10,000 queries/day via Billing |
| **回傳格式** | JSON；包含 title、snippet、link、pagemap |
| **結果品質** | Google 索引品質高；snippet 可能已含活動日期 / 摘要 |
| **API key 要求** | 需 `GOOGLE_PSE_API_KEY` + `GOOGLE_PSE_CX`（Search Engine ID）；兩者都必須在 Vercel env 設定，**不得用 `NEXT_PUBLIC_` 前綴** |
| **rate limit 控管** | 每日 quota 固定；可設 Vercel Cron 頻率控制 |
| **ToS 合規** | Google 允許透過 API 使用搜尋結果；禁止 scraping HTML（但本方案走 API，合規）|
| **缺點** | CX 設定較複雜；免費 quota 100 query/day 對多藝人場景偏緊；snippet 品質不如完整頁面 |
| **v1 適用性** | ✅ 高 — 官方 API、JSON 回傳、有 site: 過濾、有免費層，適合 v1 pilot |

### 3.2 SerpAPI

| 項目 | 評估 |
|---|---|
| **簡介** | 第三方 Google 搜尋結果 API；不需要自己維護 CX；支援多引擎（Google / Bing / Baidu / Naver）|
| **定向搜尋支援** | ✅ 支援 `site:` 參數 |
| **免費配額** | 100 searches/month（免費）|
| **付費方案** | $50/month → 5,000 searches；$130/month → 15,000 searches |
| **回傳格式** | JSON；有 organic_results、knowledge_graph、related_searches 等豐富欄位 |
| **結果品質** | 接近真實 Google 搜尋結果；snippet + link + date 豐富 |
| **API key 要求** | 需 `SERPAPI_KEY`；server-only，**不得 `NEXT_PUBLIC_` 前綴** |
| **rate limit 控管** | 依方案月配額；無 daily cap（以月計）|
| **ToS 合規** | SerpAPI 本身是合法代理；合規取決於下游用途（Idol Rhythm 非商業爬蟲，用途合規）|
| **缺點** | 100/month 免費太少（pilot 勉強可用）；付費起跳 $50/month 成本不低；仍是第三方依賴 |
| **v1 適用性** | 🔶 中 — 功能好但成本偏高；適合 pilot 測試，長期需評估 ROI |

### 3.3 Brave Search API

| 項目 | 評估 |
|---|---|
| **簡介** | Brave 自有搜尋索引（非 Google proxy）；有獨立爬蟲，結果與 Google 有差異 |
| **定向搜尋支援** | ✅ 支援 `site:` 過濾（透過 query 字串）|
| **免費配額** | 2,000 queries/month（Data for Good 計畫，限特定用途）；一般免費層 1 query/sec，月配額需確認 |
| **付費方案** | $3 / 1,000 queries（Goggles / standard tier）|
| **回傳格式** | JSON；含 title、description、url、published date（部分）|
| **結果品質** | 自有索引覆蓋率不如 Google；K-pop / 韓國本地站點覆蓋可能偏弱 |
| **API key 要求** | 需 `BRAVE_SEARCH_API_KEY`；server-only |
| **rate limit 控管** | 依方案；1 query/sec 速率限制 |
| **ToS 合規** | ✅ 官方 API，合規 |
| **缺點** | 韓國本地站點（ktown4u / Soundwave / The Hyundai）索引深度未確認，可能遺漏；需實測 |
| **v1 適用性** | 🔶 中 — 成本較低但覆蓋率風險高；可作 Google PSE 的備用或補充 |

### 3.4 Naver Search API（補充評估）

| 項目 | 評估 |
|---|---|
| **簡介** | 韓國最大搜尋引擎；韓語 K-pop 活動覆蓋遠優於 Google |
| **定向搜尋支援** | 有限（不支援 site: 過濾，走 blog / news / cafes 類型搜尋）|
| **免費配額** | 25,000 queries/day（開發者帳號）|
| **回傳格式** | JSON；有 title / description / link / pubDate |
| **API key 要求** | 需 Naver Developer 帳號 + `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` |
| **ToS 合規** | ✅ 官方 API，合規 |
| **缺點** | 不支援 site: 定向搜尋；結果以韓文 blog / news 為主，非活動 landing page；需二次過濾 URL 品質 |
| **v1 適用性** | 🔶 補充用 — 適合補 Soundwave / Music Plant 等韓文平台的 news / blog 入口；不適合取代 Google PSE 作主力 |

---

## 四、分工架構設計

### 4.1 推薦分工（Google PSE 作主力）

```
┌─────────────────────────────────────┐
│  Vercel Cron（每日 / 每週）          │
│                                     │
│  for each (idol, query_template):   │
│    → Google PSE API                 │
│      query = "{idol} 팝업 OR 快閃店 OR  │
│               exhibition OR 展覽    │
│               site:ktown4u.com"     │
│    → 回傳 URL list (JSON)           │
│                                     │
│  for each URL:                      │
│    → 判斷是否已在 event_candidates  │
│      (source_hash 去重)             │
│    → Claude 分析 URL metadata /     │
│      snippet → 判斷是否活動頁       │
│    → 若是 → INSERT event_candidates │
│      (review_status = pending)      │
│                                     │
│  Admin 後台審核 → approve / reject  │
└─────────────────────────────────────┘
```

### 4.2 query 策略

定向 site: 搜尋（針對已知高價值站點）：
```
"{idol_name}" 팝업 site:ktown4u.com
"{idol_name}" 팝업스토어 OR 전시 site:linefriendssquare.com
"{idol_name}" 팝업 site:thehyundai.com
"{idol_name}" 팬사인회 OR 사인회 site:soundwavekorea.com
"{idol_name}" 사인회 site:musicplant.co.kr
```

全網廣域搜尋（補洞）：
```
"{idol_name}" 팝업스토어 2026
"{idol_name}" 전시 2026
"{idol_name}" popup store 2026
"{idol_name}" exhibition 2026
"{idol_name}" brand event collaboration 2026
```

> 每輪 query 數估算：91 個 active idol × 3 query template = 273 queries/run。
> 若每日跑一次，月配額需約 8,190 queries。Google PSE 免費層（100/day = 3,000/month）**不足**；需 Billing 或縮減 idol × template 組合。

### 4.3 Query 配額控管策略選項

| 選項 | 描述 | 配額需求 | 成本 |
|---|---|---|---|
| **A — 週跑 + 縮 idol 範圍** | 每週一次；只跑「有快閃 / 展覽活動紀錄的 idol」子集 | ~500–1,000 queries/week | Google PSE Billing：$5–10/月 |
| **B — 全 idol + 月跑** | 每月一次跑全部 91 個 idol | ~800 queries/月 | 免費層可能勉強應付（需實測）|
| **C — 人工觸發** | Admin 後台「Discovery 搜尋」按鈕，不自動跑 | 按需 | 最省；v1 pilot 建議先走此路 |
| **D — SerpAPI + 月方案** | 5,000 searches/month @ $50 | 充足 | 月 $50 起 |

**v1 建議**：先走 **選項 C（人工觸發）**，確認搜尋品質 + 候選命中率後，再決定是否轉自動 Cron。

---

## 五、v1 是否先人工搜尋 + Claude 判斷？

### 5.1 人工搜尋流程（無 API key 版本）

Admin 手動在 Google 搜尋：
```
BLACKPINK 팝업스토어 2026
TWICE 팬사인회 site:soundwavekorea.com
IVE 전시 2026
```

取得 URL 後，貼入後台「手動新增候選」表單 → Claude 解析欄位 → `event_candidates` 候選 → admin 審核。

**優點**：零 API 成本，立即可用，admin 對搜尋結果有完整控制。
**缺點**：不可規模化；每次需要人工操作；91 個 idol 無法全覆蓋。

### 5.2 結論

| 階段 | 建議 |
|---|---|
| **v1 pilot（現在）** | 人工搜尋 + Claude 判斷。建立 query template 清單，Admin 自行 Google → 貼 URL → 手動候選。評估命中率與 admin 工作量。 |
| **v1.5（配額確認後）** | 若人工候選命中率達標，開 Google PSE Billing 帳號，實作 runtime 工作單（API key + Vercel env + Cron trigger）。配額選項 C（人工觸發）先行。 |
| **v2（資料量穩定後）** | 轉自動 Cron，依配額選擇週跑或月跑模式。 |

---

## 六、與快閃店來源盤點的對應

以下來源在 PR #139 工作單中標為「discovery」策略，對應本工作單的 query 設計：

| 來源 | discovery query 範例 | 期望 sub-type |
|---|---|---|
| Ktown4u | `"{idol}" 팝업 site:ktown4u.com` | `popup_store` / `brand_event` |
| Soundwave | `"{idol}" 팬사인회 site:soundwavekorea.com` | `brand_event` |
| Music Plant | `"{idol}" 사인회 site:musicplant.co.kr` | `brand_event` |
| LINE FRIENDS SQUARE | `"{idol}" 팝업 site:linefriendssquare.com` | `popup_store` / `exhibition` |
| The Hyundai | `"{idol}" 팝업 site:thehyundai.com` | `popup_store` |
| Musinsa | `"{idol}" 팝업 site:musinsa.com` | `popup_store` / `brand_event` |
| HYBE Insight | `"{idol}" HYBE Insight 전시 OR 팝업 2026` | `exhibition` / `popup_store` |
| 全網廣域 | `"{idol}" 팝업스토어 OR popup store 2026` | 依結果判斷 |

---

## 七、資料政策（不得變更）

1. **搜尋結果不得直接 publish**：所有 discovery 候選必須進 `event_candidates`（`review_status = pending`），admin 審核後才能 approve → publish。
2. **trust_level 初始為 `pending`**：Discovery 來源初始 trust_level 為 pending，admin approve 時再設定 official / media。
3. **source_hash 去重**：同一 URL 的候選不重複進庫（既有 J4 source_hash 機制）。
4. **不接觸私有 API / login-required 頁面**：搜尋結果 URL 若指向需要登入的頁面，skip（不 fetch）。
5. **不違反 robots.txt**：fetch URL 內容前檢查 robots.txt。
6. **v1 不使用 headless browser**：搜尋回傳的 URL 若為 SPA（fetch 取回 JS shell），以 snippet + title 作為解析輸入，或 skip 並標為「需人工確認」；不啟動 Playwright。

---

## 八、開放問題（需 runtime 工作單解答）

| # | 問題 | 影響 |
|---|---|---|
| Q1 | Google PSE 免費層 100 queries/day 對 pilot 是否足夠？Cron 觸發頻率？ | 決定配額選項（A / B / C）|
| Q2 | 91 個 idol × 多少 query template = 單次運行 query 數上限？ | 決定是否需要 idol 子集策略 |
| Q3 | Google PSE snippet 是否足夠讓 Claude 判斷「這是活動頁 / 非活動頁」？還是需要 fetch 完整頁面？ | 決定 discovery → parse 流程設計 |
| Q4 | `event_candidates` 的 `source` 欄位如何記錄「google_discovery」來源？是否需要新 parser_type？ | 決定 schema 影響（若需新 parser_type → 需 migration）|
| Q5 | Brave Search 韓國本地站點覆蓋率是否足夠補充 Google PSE？ | 決定是否雙 provider 並用 |
| Q6 | Naver API 搜尋結果（blog / news）能否作為快閃店 URL 入口？還是品質太低？ | 決定 Naver 是否納入 |
| Q7 | Admin 人工觸發 discovery 的 UI 設計：獨立 `/admin/discovery` 頁、或在現有 `/admin/event-candidates` 加 tab？ | 後台 UI 影響（不屬本工作單但需提前考慮）|

---

## 九、決策樹（給 runtime 工作單）

```
開始：確認 v1 先走「人工搜尋 + Claude 判斷」
  ↓
人工 pilot 結果評估：
  ├─ 命中率 > 50%、admin 工作量可接受
  │    → 開 Google PSE runtime 工作單（API key + 選項 C 人工觸發）
  │
  ├─ 命中率 OK 但工作量過大（91 idol 無法手動覆蓋）
  │    → 開 Google PSE runtime 工作單（API key + 選項 A 週跑）
  │
  └─ 命中率低（搜尋結果不精準）
       → 重新評估 query template + 考慮 SerpAPI / Naver 補充
```

---

## 十、Acceptance Criteria（本工作單）

- [ ] 四個 provider（Google PSE / SerpAPI / Brave / Naver）皆有完整評估（適用性 / 配額 / 成本 / ToS）
- [ ] 分工架構（搜尋引擎找 URL → Claude 判斷 → event_candidates）清晰定義
- [ ] Query 策略草案：定向 site: + 全網廣域，覆蓋 PR #139 所有「discovery」來源
- [ ] 配額控管選項 A / B / C / D 列出，含成本估算
- [ ] v1 是否先人工搜尋的決策有明確結論（建議：是，先 pilot）
- [ ] 資料政策確認：搜尋結果不直接 publish，走候選 → 審核流程
- [ ] 開放問題清單可作為 runtime 工作單的前置 checklist
- [ ] 不寫 runtime code / 不新增 API key / 不改 schema

---

*只做工作單，不寫 runtime、不改 schema、不新增 migration、不接 API key。*
*下一步：GPT audit 通過後，依 §五 決策樹進行 v1 pilot（人工搜尋）或開 Google PSE runtime 工作單。*
