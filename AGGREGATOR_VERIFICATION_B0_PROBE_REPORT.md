# B-0 Gemini Grounding Probe Report

> **日期**：2026-07-14  
> **狀態**：BLOCKED — Gemini API key 有效，但目前 project 無可用的 Google Search grounding entitlement  
> **範圍**：research-only；`event_candidates` 唯讀；未修改 `src/`、schema、migration、發布邏輯或資料  
> **Verdict**：**暫不進 B-1 / B-2；先完成 Gemini billing / quota 前置，再原樣重跑 B-0**

---

## TL;DR

- 從 production `event_candidates` 唯讀抽取 5 筆 `source_type='community'` 真實候選：BTS 2 筆、ENHYPEN 2 筆、i-dle 1 筆。
- 實際呼叫 Gemini Google Search grounding，但沒有任何一筆成功進入 grounded generation：
  - Gemini 2.5 Flash / Flash-Lite：HTTP 404，對 new users 已不可用。
  - Gemini 3.5 Flash / 3.1 Flash-Lite：HTTP 429，目前 project 的 Search grounding quota 為 0（需可用 billing / entitlement）。
- 因 0 筆 completed grounded response，**Gemini 命中率、假陽性率、citation URL 品質與 grounding metadata 解析難度均不可量測**；不可用人工搜尋結果冒充 provider 指標。
- 人工逐筆核對找到 5/5 高品質非聚合來源，且都符合「藝人 + 精確日期 + 場館/城市」：資料本身與 Google 索引覆蓋不是瓶頸。
- 結論是 **provider 前置 blocked，不是 candidate quality fail**。開啟可用 quota 後，應以同一批 5 筆與同一判定標準重跑，再決定是否進 B-1 / B-2。

---

## 1. 探測方法與安全邊界

### 1.1 資料抽樣

- 使用 server-side `SUPABASE_SERVICE_ROLE_KEY` 對 `event_candidates` 做唯讀 SELECT。
- 篩選 `source_type='community'`，優先取工作單指定的 ENHYPEN / BTS World Tour / (G)I-DLE。
- 未對 Supabase 發出 INSERT / UPDATE / DELETE；未變更候選狀態或活動資料。

### 1.2 Gemini 呼叫

- `GEMINI_API_KEY` 只由 `.env.local` server-side 載入。
- Key 放在 `x-goog-api-key` request header，未放入 URL、程式碼、report 或 console output。
- 使用 Google Search built-in tool：`tools: [{ google_search: {} }]`。
- 一筆 event 一個 request；不 bundled query，避免不同藝人/場次互相污染。
- 嚴格命中標準：
  1. 排除 kpopofficial.com 與其他聚合站作為佐證。
  2. 至少一個官方藝人/公司、主辦、場館、售票或可靠媒體來源。
  3. 藝人相符且日期精確相符（僅允許時區造成的 ±1 日）。
  4. 場館或城市不得衝突。
  5. 只有巡演總公告、沒有該站日期者，不算命中。

### 1.3 官方文件基準

- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)：現行模型使用 `google_search`；grounded response 應包含搜尋 query、citation 與來源資訊。
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)：Gemini 3 與 2.5 的 grounding entitlement / billing 單位不同。
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)：模型 availability 會持續演進，runtime 不應假設舊模型永久可用。

---

## 2. 五筆真實候選

| # | Candidate ID | 藝人 | 聚合候選 | 日期 | 場館 |
|---|---|---|---|---|---|
| 1 | `55e640d7-4a8a-42f1-95a1-fedbed2401f4` | BTS | ARIRANG 2026 — Foxborough | 2026-08-05～06 | Gillette Stadium |
| 2 | `31db5d26-cfe8-408c-b0a9-245a0db0ec6c` | BTS | ARIRANG 2026 — Los Angeles | 2026-09-01、02、05、06 | SoFi Stadium |
| 3 | `4ad757a6-f8d2-4c7c-a89d-10a4fd0595b2` | ENHYPEN | BLOOD SAGA 2026 — Macau | 2026-10-16～18 | Galaxy Arena |
| 4 | `19fb2d71-a224-4a45-bf02-d0ea9d5dc663` | ENHYPEN | BLOOD SAGA 2026 — Tokyo | 2026-12-01～02 | Tokyo Dome |
| 5 | `4ed0e0ff-2bde-47e2-9aba-37eda05c089d` | i-dle / (G)I-DLE | Syncopation 2026 — Hong Kong | 2026-06-27～28 | Kai Tak Stadium |

---

## 3. Gemini 實際呼叫結果

| 模型 | HTTP | 約略 round-trip | 結果 | B-0 影響 |
|---|---:|---:|---|---|
| `gemini-2.5-flash` | 404 | 6.4s | `no longer available to new users` | 工作單原先假設的 2.5 Flash 不可作新 project runtime 預設 |
| `gemini-2.5-flash-lite` | 404 | 8.7s | `no longer available to new users` | 不能以舊模型免費 grounding 額度繞過新模型 billing |
| `gemini-3.5-flash` | 429 | 3.5s | `exceeded your current quota` | 現行官方範例模型需要 project 有可用 Search grounding entitlement |
| `gemini-3.1-flash-lite` | 429 | 3.4s | `exceeded your current quota` | 較低成本的現行 stable model 同樣被 quota 擋下 |

觀察：

- API key 已通過 Google API endpoint 辨識；若 key 無效，預期會是 authentication / API key error，而非 model-specific 404 與 quota-specific 429。
- 四次呼叫都沒有 `candidates`、`groundingMetadata` 或 `usageMetadata`，因此沒有可分析的 citation 或 token 數。
- 本次 observed provider cost 估為 **$0**（沒有 completed generation / grounded response）；實際帳務仍以 Google billing console 為準。
- 這個結果揭露兩個 production 前置：**模型 availability probe** 與 **grounding quota/billing health check**，B-2 runtime 需要 fail closed，不能在 404/429 時產生「未命中」結論。

---

## 4. 人工 ground truth 核對

人工核對只用來建立真值基準，**不算 Gemini 命中**。

| # | 人工 Verdict | 非聚合佐證 | 來源品質 | 藝人 | 日期 | 場館/城市 |
|---|---|---|---|---|---|---|
| 1 | CONFIRMED | [Gillette Stadium 官方活動頁](https://www.gillettestadium.com/events/bts-world-tour/)；[Ticketmaster BTS tour help](https://help.ticketmaster.com/hc/en-us/articles/42758817906961-BTS-WORLD-TOUR) | 場館 + 售票 | ✅ | ✅ 8/5–6 | ✅ Gillette Stadium |
| 2 | CONFIRMED | [Ticketmaster Los Angeles 9/5 場](https://www.ticketmaster.com/bts-world-tour-inglewood-california-09-05-2026/event/0A006429B2CB6418)；[Ticketmaster BTS tour help](https://help.ticketmaster.com/hc/en-us/articles/42758817906961-BTS-WORLD-TOUR) | 售票 | ✅ | ✅ 9/1、2、5、6 | ✅ SoFi Stadium |
| 3 | CONFIRMED | [ENHYPEN Weverse 官方加場公告](https://weverse.io/enhypen/notice/35944)；[Galaxy Macau 場館活動頁](https://www.galaxymacau.com/th/offers/entertainment/enhypen-world-tour-blood-saga-macau/) | 官方 + 場館 | ✅ | ✅ 10/16–18 | ✅ Galaxy Arena / Macau |
| 4 | CONFIRMED | [ENHYPEN Weverse 官方日本場公告](https://weverse.io/enhypen/notice/35099)；[ENHYPEN Japan 官方 schedule](https://enhypen-jp.weverse.io/schedule/911292cae943) | 官方 | ✅ | ✅ 12/1–2 | ✅ Tokyo Dome |
| 5 | CONFIRMED | [Kai Tak Sports Park 官方活動頁](https://www.kaitaksportspark.com.hk/events-tickets/2026-i-dle-world-tour-syncopation-in-hong-kong) | 場館 / 售票入口 | ✅ | ✅ 6/27–28 | ✅ Kai Tak Stadium |

人工基準結果：

- 可由高品質非聚合 URL 求證：**5/5 = 100%**。
- 人工錯配：**0/5 = 0%**。
- URL 品質：官方藝人/平台 2 筆、場館 3 筆、售票 2 筆（同一事件可重疊）；**5/5 至少有一個 official / venue / ticketing source**。
- 這證明「搜尋不到佐證」不是這批 sample 的固有問題；Gemini quota 解鎖後有合理機會取得高命中率，但仍需實測才能定量。

---

## 5. B-0 指標

| 指標 | Gemini 實測 | 人工 ground truth | 解讀 |
|---|---:|---:|---|
| 完成求證數 | **0/5** | 5/5 | Gemini 被 entitlement 擋在 generation 前 |
| 命中率 | **N/A** | 100% | 不可把人工結果當 provider 命中率 |
| 假陽性率 | **N/A** | 0% | Gemini 無輸出，無從判斷錯配 |
| Citation URL 品質 | **N/A** | 5/5 高品質 | 索引存在高品質目標 URL |
| 成功 request latency | **N/A** | N/A | 只有 3.4–8.7s 的 error round-trip |
| Token / request | **N/A** | N/A | 失敗回應無 `usageMetadata` |
| Grounding queries / request | **N/A** | N/A | 失敗回應無 `webSearchQueries` |
| 解析難度 | **未能實測** | N/A | 官方 response schema 清楚，但 redirect URL、citation support mapping 與模型版本差異仍須成功 sample 驗證 |

### 成本基準（供重跑估算）

依 2026-07-14 官方價格頁：

- Gemini 3.5 Flash standard：input **$1.50 / 1M tokens**、output（含 thinking）**$9 / 1M tokens**。
- Search grounding：付費層每月前 5,000 prompts 免費（Gemini 3 共用），之後 **$14 / 1,000 search queries**；單一 prompt 若觸發多個 search query，會按 query 數計。
- B-0 重跑只有 5 prompts；若 project entitlement 正常且仍在免費 grounding 額度內，主要只剩 token 成本，預期遠低於 $0.01，但必須用成功回應的 `usageMetadata` 實算。

---

## 6. Parsing / Runtime 難點

本次無成功 payload，不能宣稱已驗證 parser；從官方 schema與錯誤實測可先確認：

1. **模型名稱不可硬編碼後永不檢查**：2.5 stable 文件仍可見，但 new users 已收到 404。
2. **429 不等於 no_match**：quota/billing error 必須是 provider failure；若誤標 `verified_result='no_match'`，會污染求證狀態。
3. **Citation 需做來源分類**：即使有 URL，也要排除 aggregator，並辨識 official / venue / ticketing / media。
4. **Gemini 3 計價按 search query**：需記錄每次 request 的實際 query 數，不能只按事件筆數估成本。
5. **建議先保存 provider 原始證據再正規化**：至少保留 model、response ID、web search queries、citation URL/title、usage、latency、provider error code；但 schema 設計留到 B-1。

---

## 7. 最終 Verdict

### Verdict：**BLOCKED / RERUN REQUIRED**

目前不能接受或否決 Gemini 作為 provider，因為成功樣本數是 0。可確認的是：

- ✅ 5 筆 production 聚合候選全部有高品質可驗證來源。
- ✅ Google Search 索引覆蓋官方/場館/售票頁，問題值得繼續探測。
- ❌ 2.5 系列對新 project 不可用。
- ❌ 3.x 系列在目前 project 上沒有可用 Search grounding quota。
- ❌ 命中率、假陽性率、provider URL 品質、成功 latency、usage 與 parser 難度尚未達 B-0 驗收。

### 進 B-1 前的必要條件

1. Owner 在 Google AI Studio / billing console 確認 project 已啟用 Gemini 3 Search grounding 的可用 paid entitlement / quota。
2. 重新執行本報告同一批 5 筆、同一 prompt、同一判定標準。
3. 報告補齊：Gemini 命中率、假陽性率、citations URL 品質、每筆 latency、`usageMetadata`、search query 數與實算成本。
4. 建議門檻：假陽性 **0/5**；若任一錯配，先收緊 prompt / deterministic field checks，不進 B-1。

在上述條件完成前：**不開 migration、不寫 runtime、不接 admin UI、不改發布流程。**

---

## 8. Repo / 資料影響

- 新增本 report 一個 Markdown 文件。
- 未新增 probe script 到 repo；臨時腳本與原始回應只放 `/tmp`。
- 未修改 `.env.local`，未輸出或提交 `GEMINI_API_KEY`。
- 未修改 `.claude/`、`.obsidian/` 或個人筆記。
- 未修改 `src/`、migration、schema、RLS、crawler、候選資料或發布邏輯。
