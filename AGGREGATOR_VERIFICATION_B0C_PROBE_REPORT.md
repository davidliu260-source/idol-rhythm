# B-0c Claude Web Search Probe Report

> **日期**：2026-07-15
>
> **狀態**：COMPLETED
>
> **範圍**：research-only；`event_candidates` 唯讀；未修改 `src/`、schema、migration、發布邏輯或資料
>
> **Verdict**：**需調整 — 可進 B-1 parser / design spike，但不可把本次 response shape 原樣接成 production runtime**

---

## TL;DR

- 步驟 0 通過：`claude-sonnet-4-6` 搭配 `web_search_20260209` 成功回 HTTP 200，實際執行 1 次搜尋，無 `web_search_tool_result_error`；org 已啟用 web search。
- 對 B-0 同一批 5 筆 production 聚合候選逐筆獨立求證，5/5 都完成，沒有 provider error、空結果或 `pause_turn`。
- Claude 判為 `CONFIRMED` 5/5；人工逐 URL 核對後，正確命中 **5/5 = 100%**，假陽性 **0/5 = 0%**。
- 5 筆共 14 次 `usage.server_tool_use.web_search_requests`、225,634 input tokens、7,258 output tokens；依實際 usage 與官方牌價實算共 **US$0.925772**，平均 **US$0.185154 / candidate**。
- URL/title 品質足以找到可用的 official / venue / promoter / ticketing source；但 5/5 response 的 text blocks 都沒有 `citations`，因此 `cited_text` 全缺。`web_search_tool_result` 又混有聚合站，不能整包直接寫進 `event_sources`。
- 結論：provider 的 recall / precision 在本樣本達門檻，可以進 B-1 做 deterministic parser 與 evidence selection spike；但須先解決 citation binding、降低重複 search / token 成本，並 fail closed 處理工具錯誤。

---

## 1. 方法與安全邊界

### 1.1 步驟 0：能力探測

最小 request 使用：

```json
{
  "model": "claude-sonnet-4-6",
  "tools": [{
    "type": "web_search_20260209",
    "name": "web_search",
    "max_uses": 1,
    "blocked_domains": ["kpopofficial.com"]
  }]
}
```

結果：HTTP 200、`stop_reason=end_turn`、`web_search_requests=1`、無工具錯誤。沒有出現「web search not enabled」的 400，因此繼續正式 5 筆探測。

### 1.2 Probe 設定

- SDK：`@anthropic-ai/sdk` 0.96.0；此版本已有 `web_search_20260209` 型別，**未降級**到 `web_search_20250305`。
- Model：`claude-sonnet-4-6`。
- 一個 candidate 一個獨立 Messages API request；沒有 bundle 多場活動。
- 每筆 `max_uses=5`，`blocked_domains=["kpopofficial.com"]`。
- `ANTHROPIC_API_KEY` 只由 `.env.local` server-side 載入，未寫入腳本、report、console 或 Git。
- Probe 腳本與完整原始 JSON 只放 `/tmp`，未提交 repo。
- 每筆先用 service role 對指定 candidate ID 做單筆 SELECT；未發出 INSERT / UPDATE / DELETE。

### 1.3 嚴格判定標準

沿用 B-0，不放寬：

1. 排除 kpopofficial.com 與其他聚合站作為證據。
2. 至少一個官方藝人/公司、主辦、場館、售票或可靠媒體來源。
3. 藝人相符，且日期精確相符；只允許時區造成的 ±1 日。
4. 場館或城市不得衝突。
5. 只有巡演總公告、沒有該站日期者，不算命中。

### 1.4 Error 與 no-match 分流

- `web_search_tool_result.content` 是單一 error object：記為 `provider_error`，不算 no-match。
- `content` 是空 list：才記為 `no_match_empty_results`。
- 有結果 list 且無 error：記為 `completed_with_results`。
- 若 `stop_reason=pause_turn`，腳本會把該 assistant content 原封不動加入下一 request 繼續；本次 5 筆均未觸發。

---

## 2. 同批五筆候選

| # | Candidate ID | 藝人 | 日期 | 場館 / 城市 |
|---|---|---|---|---|
| 1 | `55e640d7-4a8a-42f1-95a1-fedbed2401f4` | BTS | 2026-08-05～06 | Gillette Stadium / Foxborough |
| 2 | `31db5d26-cfe8-408c-b0a9-245a0db0ec6c` | BTS | 2026-09-01、02、05、06 | SoFi Stadium / Inglewood–Los Angeles |
| 3 | `4ad757a6-f8d2-4c7c-a89d-10a4fd0595b2` | ENHYPEN | 2026-10-16～18 | Galaxy Arena / Macau |
| 4 | `19fb2d71-a224-4a45-bf02-d0ea9d5dc663` | ENHYPEN | 2026-12-01～02 | Tokyo Dome / Tokyo |
| 5 | `4ed0e0ff-2bde-47e2-9aba-37eda05c089d` | i-dle / (G)I-DLE | 2026-06-27～28 | Kai Tak Stadium / Hong Kong |

五筆 SELECT 回傳的 `source_type` 均為 `community`。資料庫只讀。

---

## 3. Provider 結果與人工核對

| # | Claude Verdict | 人工 Verdict | 主要非聚合證據 | 藝人 | 日期 | 場館/城市 | 錯配 |
|---|---|---|---|---|---|---|---|
| 1 | CONFIRMED | CONFIRMED | [Gillette Stadium 官方活動頁](https://www.gillettestadium.com/events/bts-world-tour/) | ✅ | ✅ 8/5–6 | ✅ Gillette Stadium / Foxborough | 無 |
| 2 | CONFIRMED | CONFIRMED | [SoFi Stadium 官方活動頁](https://www.sofistadium.com/events/detail/bts-september-2-2026) | ✅ | ✅ 9/1、2、5、6 | ✅ SoFi Stadium / Inglewood | 無 |
| 3 | CONFIRMED | CONFIRMED | [Galaxy Macau 官方場館頁](https://www.galaxymacau.com/offers/entertainment/enhypen-world-tour-blood-saga-macau/) | ✅ | ✅ 10/16–18 | ✅ Galaxy Arena / Macau | 無 |
| 4 | CONFIRMED | CONFIRMED | [ENHYPEN Weverse 官方公告](https://weverse.io/enhypen/notice/35099)；[Tokyo Dome 官方 schedule](https://www.tokyo-dome.co.jp/en/dome/event/) | ✅ | ✅ 12/1–2 | ✅ Tokyo Dome / Tokyo | 無 |
| 5 | CONFIRMED | CONFIRMED | [Kai Tak Sports Park 官方活動頁](https://www.kaitaksportspark.com.hk/events-tickets/2026-i-dle-world-tour-syncopation-in-hong-kong) | ✅ | ✅ 6/27–28 | ✅ Kai Tak Stadium / Hong Kong | 無 |

人工核對重點：

- Foxborough：場館頁同時列 BTS、2026-08-05/06 與 Gillette Stadium，非同藝人別站。
- Los Angeles：SoFi 官方頁明列 2026-09-01、02、05、06；場館地址是 Inglewood，與候選的 Los Angeles metro 描述不衝突。
- Macau：Galaxy 官方頁逐日列出 10/16、17、18，並列 Galaxy Arena 與主辦 iMe。
- Tokyo：Weverse 與 Tokyo Dome 各自明列 12/1、12/2；不是只有日本巡演總公告。
- Hong Kong：Kai Tak 官方頁明列 i-dle、6/27–28、Kai Tak Stadium。

### 指標

- 命中率：**5/5 = 100%**。
- 假陽性率：**0/5 = 0%**。
- False-positive gate：**通過**；沒有模型宣稱命中但人工判為別場或錯配的案例。
- Provider errors：**0/5**。
- 真 no-match（空 result list）：**0/5**。

---

## 4. 每筆 raw response（audit-relevant blocks）

完整 API payload 含大量重複搜尋結果與不可讀的 `encrypted_content`，只保存在 `/tmp/b0c-claude-*.json`，不進版控。以下逐筆保留可稽核的原始 response 欄位：stop reason、search query、模型輸出的 verdict/source URLs、主要 `web_search_tool_result` title/URL、usage。未改寫模型 Verdict。

### 4.1 BTS — Foxborough

```text
stop_reason: end_turn
search queries (5):
  BTS World Tour ARIRANG 2026 Foxborough Gillette Stadium
  BTS World Tour ARIRANG 2026 Foxborough Gillette Stadium
  BTS ARIRANG tour 2026 August Gillette Stadium official HYBE BigHit
  site:gillettestadium.com BTS ARIRANG 2026
  ibighit.com BTS ARIRANG tour Foxborough August 2026
VERDICT: CONFIRMED
ARTIST_MATCH: true
DATE_MATCH: true
VENUE_OR_CITY_MATCH: true
MATCHED_DATES: August 5–6, 2026
SOURCE_QUALITY: venue, ticketing, reliable_media
SOURCE_URLS:
  https://www.gillettestadium.com/events/bts-world-tour/
  https://www.livenation.com/event/vv177Z_eGkSeKli7/bts-world-tour-arirang-in-foxborough
  https://www.ticketmaster.com/bts-world-tour-arirang-in-foxborough-foxborough-massachusetts-08-05-2026/event/0100642CBD7AB56B
primary web_search_tool_result title: BTS WORLD TOUR: ‘ARIRANG’ - Gillette Stadium
latency_ms: 57901
usage: input_tokens=59147, output_tokens=1738, web_search_requests=5
```

人工：官方場館頁直接吻合全部 deterministic fields；`CONFIRMED` 正確。

### 4.2 BTS — Los Angeles

```text
stop_reason: end_turn
search queries (3):
  BTS World Tour ARIRANG 2026 SoFi Stadium Los Angeles
  BTS World Tour ARIRANG 2026 SoFi Stadium Los Angeles
  BTS ARIRANG world tour 2026 official HYBE BIGHIT announcement
VERDICT: CONFIRMED
ARTIST_MATCH: true
DATE_MATCH: true
VENUE_OR_CITY_MATCH: true
MATCHED_DATES: September 1, 2, 5, and 6, 2026
SOURCE_QUALITY: venue, promoter, ticketing
SOURCE_URLS:
  https://www.sofistadium.com/events/detail/bts-september-2-2026
  https://www.livenation.com/event/vvG1IZ_eJSfUoL/bts-world-tour-arirang-in-los-angeles
  https://www.ticketmaster.com/bts-world-tour-arirang-in-los-inglewood-california-09-02-2026/event/0A006429B1B363A4
primary web_search_tool_result title: BTS | SoFi Stadium
latency_ms: 77515
usage: input_tokens=94042, output_tokens=2113, web_search_requests=3
```

人工：SoFi 官方頁的 event details 一次列出四日；Inglewood / Los Angeles 是同一場站描述，沒有城市衝突。

### 4.3 ENHYPEN — Macau

```text
stop_reason: end_turn
search queries (2):
  ENHYPEN World Tour BLOOD SAGA 2026 Macau Galaxy Arena
  ENHYPEN World Tour BLOOD SAGA 2026 Macau Galaxy Arena
VERDICT: CONFIRMED
ARTIST_MATCH: true
DATE_MATCH: true
VENUE_OR_CITY_MATCH: true
MATCHED_DATES: October 16, 17, and 18, 2026
SOURCE_QUALITY: venue | ticketing | promoter
SOURCE_URLS:
  https://www.galaxymacau.com/offers/entertainment/enhypen-world-tour-blood-saga-macau/
  https://www.fantopia.io/shows/en-us/enhypen-world-tour-blood-saga-in-macau.html
  https://ime.co/blog/tour/enhypen-world-tour-blood-saga-in-macau/
primary web_search_tool_result title: ENHYPEN WORLD TOUR 'BLOOD SAGA' IN MACAU | Galaxy Macau
latency_ms: 33030
usage: input_tokens=27306, output_tokens=1098, web_search_requests=2
```

人工：Galaxy 官方頁已包含加場後完整三日，不需依賴聚合站；`CONFIRMED` 正確。

### 4.4 ENHYPEN — Tokyo

```text
stop_reason: end_turn
search queries (2):
  ENHYPEN World Tour BLOOD SAGA 2026 Tokyo Dome
  ENHYPEN BLOOD SAGA Tokyo Dome December 1 2 2026 official
VERDICT: CONFIRMED
ARTIST_MATCH: true
DATE_MATCH: true
VENUE_OR_CITY_MATCH: true
MATCHED_DATES: December 1–2, 2026
SOURCE_QUALITY: official_artist_company, venue, reliable_media
SOURCE_URLS:
  https://x.com/ENHYPEN_JP/status/2047208852886626553
  https://www.tokyo-dome.co.jp/en/dome/event/
  https://weverse.io/enhypen/notice/35099
primary web_search_tool_result title: [notice] enhypen world tour 'blood saga'
latency_ms: 32177
usage: input_tokens=19497, output_tokens=1183, web_search_requests=2
```

人工：官方 Weverse 與場館 schedule 都逐日列出 Tokyo Dome 12/1–2；`CONFIRMED` 正確。

### 4.5 i-dle — Hong Kong

```text
stop_reason: end_turn
search queries (2):
  (G)I-DLE World Tour Syncopation 2026 Hong Kong Kai Tak Stadium
  (G)I-DLE World Tour Syncopation 2026 Hong Kong Kai Tak Stadium
VERDICT: CONFIRMED
ARTIST_MATCH: true
DATE_MATCH: true
VENUE_OR_CITY_MATCH: true
MATCHED_DATES: June 27–28, 2026
SOURCE_QUALITY: venue, reliable_media
SOURCE_URLS:
  https://www.kaitaksportspark.com.hk/events-tickets/2026-i-dle-world-tour-syncopation-in-hong-kong
  https://www.koreaboo.com/news/ticketing-information-2026-dle-world-tour-syncopation-in-hong-kong/
primary web_search_tool_result title: 2026 i-dle WORLD TOUR [Syncopation] IN HONG KONG - Kai Tak Sports Park
latency_ms: 31888
usage: input_tokens=25642, output_tokens=1126, web_search_requests=2
```

人工：Kai Tak 官方頁直接吻合藝人、兩日與場館；不需要可靠媒體作唯一證據。

---

## 5. Latency、usage 與實算成本

官方牌價基準：Claude Sonnet 4.6 standard input **US$3 / MTok**、output **US$15 / MTok**；web search **US$10 / 1,000 searches**。本次沒有 prompt cache token，所有單筆 input 都低於 200K。

公式：

```text
cost = input_tokens × 3 / 1,000,000
     + output_tokens × 15 / 1,000,000
     + web_search_requests × 10 / 1,000
```

| Candidate | Latency | Input | Output | Searches | Search cost | Token cost | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| BTS Foxborough | 57.901s | 59,147 | 1,738 | 5 | $0.050000 | $0.203511 | **$0.253511** |
| BTS Los Angeles | 77.515s | 94,042 | 2,113 | 3 | $0.030000 | $0.313821 | **$0.343821** |
| ENHYPEN Macau | 33.030s | 27,306 | 1,098 | 2 | $0.020000 | $0.098388 | **$0.118388** |
| ENHYPEN Tokyo | 32.177s | 19,497 | 1,183 | 2 | $0.020000 | $0.076236 | **$0.096236** |
| i-dle Hong Kong | 31.888s | 25,642 | 1,126 | 2 | $0.020000 | $0.093816 | **$0.113816** |
| **合計 / 平均** | **232.511s / 46.502s** | **225,634** | **7,258** | **14 / 2.8** | **$0.140000** | **$0.785772** | **$0.925772 / $0.185154** |

這是正式 5 筆 evaluation requests 的 observed cost，不含步驟 0 的單筆 capability smoke。沒有以預估 token 代替 usage。

成本觀察：

- 費用主體是 search result 進入 input context 的 token，不是 $0.01/search 本身。
- Foxborough、Los Angeles 出現完全相同 query 重複執行；目前 `max_uses=5` 允許模型過度搜尋。
- B-1 應測 `max_uses=2–3`、更短 output schema，並比較 direct caller / basic search 是否可在維持 0 false positive 下顯著降 token。

---

## 6. Citation URL 品質與解析難度

### 6.1 可以直接使用的部分

- `web_search_tool_result` 成功內容是 list；每個 result 有穩定的 `url`、`title`、`page_age` 與 opaque `encrypted_content`。
- 5/5 至少找到一個官方場館或官方藝人 URL，URL 本身可成為 `event_sources.source_url` 候選。
- `usage.server_tool_use.web_search_requests` 可直接計量搜尋次數。
- `server_tool_use.input.query` 可留作 search audit trail。

### 6.2 不能直接使用的部分

- 5/5 的 text blocks 都未回 `citations` array，觀測到的 structured citation count 是 **0**；因此 `web_search_result_location.cited_text` 全部缺失。
- 每次搜尋回 9–10 個 result，內含 Wikipedia、fan site、旅遊/票券聚合站、社群貼文；即使 kpopofficial.com 已 block，也不能把 result list 整包寫入 `event_sources`。
- 模型最後用純文字 `SOURCE_URLS` 選出證據，但沒有 machine-readable citation binding 將每個結論綁到 result index / cited text。只用 regex 解析模型文字會脆弱。
- `web_search_20260209` 的 dynamic filtering 會額外出現 `code_execution_tool_result` 與帶 `caller` 的 nested tool blocks；parser 必須容忍同一 query 重複與多組 tool-use/result。

### 6.3 錯誤與續跑 shape

- Error：HTTP 200 下 `web_search_tool_result.content` 可能是單一 `{type:"web_search_tool_result_error", error_code:...}`，不可當空 list。
- No-match：只有 `content: []` 才能視為該次搜尋無結果；若同 request 還有其他非空 result，仍要分析完整 turn。
- `pause_turn`：必須送回 assistant message 的完整 content blocks，包括 `encrypted_content`；不可重建或刪減。

### 6.4 解析難度評等

**中高**。錯誤分流與 usage 很清楚，但「模型採信哪一個 URL、其 cited_text 是什麼」在本次 0/5 payload 中沒有結構化 citation。B-1 至少需要：

1. deterministic domain/source classification；
2. 從 model-selected URL 回查對應 `web_search_tool_result` title；
3. artist/date/venue deterministic re-check；
4. 沒有可綁定 citation 時 fail closed 或再做 targeted fetch；
5. 測試 `allowed_callers:["direct"]` 或 `web_search_20250305` 是否恢復 citation shape，並量測 accuracy/cost 差異。

---

## 7. 與 B-0 並列對照

| 指標 | B-0 Gemini Google Search grounding | B-0c Claude web search |
|---|---:|---:|
| 同批 candidate | 5 | 5 |
| 完成 provider 求證 | **0/5** | **5/5** |
| Provider 狀態 | 2.5 → 404；3.x → grounding quota 0 / 429 | Step 0 與 5 筆皆成功 |
| 命中率 | N/A | **5/5 = 100%** |
| 假陽性率 | N/A | **0/5 = 0%** |
| 人工 ground truth | 5/5 有佐證 | 同一 ground truth；Claude 找到 5/5 |
| Citation URL 品質 | N/A | 5/5 有 official / venue URL；但 cited_text 0/5 |
| 平均 latency | N/A（只有 error round-trip） | **46.502s** |
| Searches | N/A | **14 total / 2.8 per candidate** |
| Token usage | N/A | **225,634 input / 7,258 output** |
| 正式 5 筆成本 | $0 completed-provider cost | **$0.925772** |
| Parsing | 未能實測 | error/result shape 清楚；citation binding 不足 |
| Verdict | BLOCKED / rerun required | **需調整；可進 B-1 spike** |

Claude web search 解除了 B-0 的 provider entitlement blocker，也在同一批資料達到 0 false positive；代價是目前 observed latency / token cost 偏高，且 citation metadata 不足以直接落庫。

---

## 8. 最終 Verdict

### Verdict：**需調整**

理由：

- ✅ 5/5 正確找到同場活動的非聚合證據。
- ✅ 假陽性 0/5，通過 Owner 指定的最關鍵 gate。
- ✅ 官方場館 / 官方藝人來源覆蓋 5/5。
- ✅ error、empty result、pause-turn 的 runtime 分流可明確設計。
- ❌ structured citations / `cited_text` 0/5，不能直接把模型選證據可靠地正規化。
- ❌ 平均 46.5s、US$0.185/event；兩筆有重複 query，成本與 latency 尚未收斂。
- ❌ raw search results 混有聚合站，blocked domain 不能取代 source allowlist / classifier。

### 建議

可進 B-1，但限定為 parser / evidence-contract / cost-control spike，不直接接 admin 或發布 runtime。B-1 先完成下列門檻：

1. 結構化綁定 model-selected URL、title、source class 與可稽核 evidence text；綁不到就 fail closed。
2. deterministic 比對 artist、完整日期集合、venue/city；不能只信模型 `CONFIRMED`。
3. `max_uses=2–3` 與短 schema 的 cost/latency regression；維持 false positive 0。
4. 以 direct caller / basic search 做小型 response-shape 對照，確認 citations 是否可穩定取得。
5. provider error 與 true no-match 永遠分開保存與呈現。

若 B-1 無法取得可靠 citation binding，則不建議進 production runtime，即使本批 accuracy 是 5/5。

---

## 9. Repo / 資料影響

- 新增本 report 一個 Markdown 文件。
- 未提交 probe script；臨時腳本與完整原始 API response 只在 `/tmp`。
- 未修改 `.env.local`，未輸出或提交 `ANTHROPIC_API_KEY`。
- 未修改 `.claude/`、`.obsidian/` 或個人筆記。
- 未修改 `src/`、app、migration、schema、RLS、crawler、候選資料、events 或發布邏輯。
