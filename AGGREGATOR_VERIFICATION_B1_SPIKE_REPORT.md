# B-1 Citation Binding Spike Report

> **日期**：2026-07-15
>
> **範圍**：research-only；`event_candidates` 唯讀；未修改 DB、`src/`、schema、migration、發布邏輯或資料
>
> **Verdict**：**可進 B-1b migration，但只採用 B-direct evidence contract；A dynamic 不可作 runtime binding，C basic 可作 fallback**

---

## TL;DR

- 對 B-0c 同一批 5 筆 candidate，各跑三組、共 **15 個獨立 request**：
  - A：`web_search_20260209`，預設 `allowed_callers`（dynamic filtering）
  - B：`web_search_20260209` + `allowed_callers: ["direct"]`
  - C：`web_search_20250305`（basic）
- A：**0/5 structured citations、0/5 cited_text**；但命中 5/5、假陽性 0/5。
- B：**5/5 有 citations、5/5 cited_text 非空**；命中 5/5、假陽性 0/5。
- C：**5/5 有 citations、5/5 cited_text 非空**；命中 5/5、假陽性 0/5。
- 假設結論：**成立**。在本批與相同 SDK/model 下，dynamic filtering 的 code-execution caller 是 citation binding 斷裂的主要可重現因素；把 20260209 限制為 direct 可恢復 binding。
- B-direct 是推薦 runtime contract：總成本 **US$0.245621**（平均 **US$0.049124/event**）、平均 latency **9.508s**、每筆 1 search。
- C-basic 同樣可行：**US$0.248879**、平均 **9.034s**；但失去 dynamic filtering，列為 fallback / response-shape 對照。
- 15 筆 event-level 都是 5/5 命中、0/5 假陽性；citation-level 仍需 deterministic checks：B-direct Foxborough 有一個 Ticketmaster artist landing page 的 cited snippet 指向 East Rutherford，C-basic Hong Kong 的模型 `SOURCE_URLS` path 少了 `-tickets`，但 structured citation URL 正確。

---

## 1. 探測設定與安全邊界

### 1.1 三組設定

| 組別 | Tool | allowed_callers | max_uses | dynamic filtering |
|---|---|---|---:|---|
| A_dynamic | `web_search_20260209` | SDK/API default | 3 | 是 |
| B_direct | `web_search_20260209` | `["direct"]` | 3 | 否（direct invocation） |
| C_basic | `web_search_20250305` | default | 3 | 否（basic tool） |

三組統一 `model=claude-sonnet-4-6`、`blocked_domains=["kpopofficial.com"]`、一筆 candidate 一個 request。SDK 是 `@anthropic-ai/sdk` 0.96.0。

### 1.2 資料與 secret 邊界

- 同 B-0/B-0c 的 5 個 candidate ID：BTS×2、ENHYPEN×2、i-dle×1。
- `event_candidates` 僅 SELECT；未 INSERT / UPDATE / DELETE，未查詢或修改 events/event_sources。
- `ANTHROPIC_API_KEY` 只由 `.env.local` server-side 載入；未寫入腳本、report、console 或 Git。
- probe script 與完整 raw JSON 僅存 `/tmp/b1-*.json`，沒有提交。
- 未修改 `.claude/`、`.obsidian/`、個人筆記、`src/`、schema、migration、app 或發布流程。

### 1.3 判定標準與錯誤分流

沿用 B-0/B-0c，沒有放寬：排除聚合站；官方藝人/公司、主辦、場館、售票或可靠媒體至少一個；藝人與完整日期相符（只容許時區 ±1 日）；venue/city 不衝突；只有巡演總公告而無該站日期不算命中。

- `web_search_tool_result.content` 單一 error object → `provider_error`。
- `content=[]` → `no_match_empty_results`。
- 非空 result list → `completed_with_results`。
- `pause_turn` 會把完整 assistant content 原封不動送回續跑；15 筆均未觸發。

---

## 2. 三組完整對照結果

成本公式：`input × $3/MTok + output × $15/MTok + searches × $10/1000`。牌價依 [Anthropic Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing) 與 [web search pricing](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)。

### 2.1 Group aggregate

| 組別 | citations（5 筆） | cited_text 非空 | 命中率 | 假陽性率 | provider error / no-match | searches | input / output tokens | 平均 latency | 總成本 / 平均 |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|
| A_dynamic | **0/5** | **0/5** | 5/5 = 100% | 0/5 = 0% | 0 / 0 | 10 | 115,698 / 4,143 | 28.731s | **$0.509239 / $0.101848** |
| B_direct | **5/5** | **5/5** | 5/5 = 100% | 0/5 = 0% | 0 / 0 | 5 | 57,012 / 1,639 | 9.508s | **$0.245621 / $0.049124** |
| C_basic | **5/5** | **5/5** | 5/5 = 100% | 0/5 = 0% | 0 / 0 | 5 | 57,988 / 1,661 | 9.034s | **$0.248879 / $0.049776** |

### 2.2 每筆 raw audit summary：A_dynamic

完整原始 response 在 `/tmp/b1-A_dynamic-*.json`；下表保留每個 request 的 raw-derived fields。

| Candidate | classification / stop | model verdict | citations / cited_text | latency | searches | input / output | cost |
|---|---|---|---:|---:|---:|---:|---:|
| BTS Foxborough | completed / end_turn | CONFIRMED | 0 / 0 | 28.376s | 2 | 23,977 / 855 | $0.104756 |
| BTS Los Angeles | completed / end_turn | CONFIRMED | 0 / 0 | 36.428s | 2 | 24,533 / 904 | $0.107159 |
| ENHYPEN Macau | completed / end_turn | CONFIRMED | 0 / 0 | 29.520s | 2 | 26,442 / 953 | $0.113621 |
| ENHYPEN Tokyo | completed / end_turn | CONFIRMED | 0 / 0 | 27.291s | 2 | 23,265 / 741 | $0.100910 |
| i-dle Hong Kong | completed / end_turn | CONFIRMED | 0 / 0 | 22.042s | 2 | 17,481 / 690 | $0.082793 |

A 的模型仍以純文字 `SOURCE_URLS` 作答；這些 URL 經人工核對可找到同場官方證據，但沒有 machine-readable `web_search_result_location`，所以 A 不可直接落庫。

### 2.3 每筆 raw audit summary：B_direct

| Candidate | classification / stop | model verdict | citations / cited_text | latency | searches | input / output | cost | citation audit |
|---|---|---|---:|---:|---:|---:|---:|---|
| BTS Foxborough | completed / end_turn | CONFIRMED | 2 / 2 | 13.004s | 1 | 14,384 / 379 | $0.058837 | Gillette official valid；Ticketmaster artist landing page 的 cited snippet 顯示 East Rutherford，需 deterministic re-check，不能單獨採信 |
| BTS Los Angeles | completed / end_turn | CONFIRMED | 3 / 3 | 10.247s | 1 | 11,211 / 370 | $0.049183 | SoFi official + Live Nation 同場同日；第三個 BIGHIT tour URL 只作背景，非單獨日期證據 |
| ENHYPEN Macau | completed / end_turn | CONFIRMED | 3 / 3 | 9.249s | 1 | 11,255 / 360 | $0.049165 | 三個 citation 都是 Galaxy 官方頁的不同 cited spans，逐日與場館相符 |
| ENHYPEN Tokyo | completed / end_turn | CONFIRMED | 1 / 1 | 7.326s | 1 | 8,315 / 275 | $0.039070 | ENHYPEN Japan 官方 X，日期與 Tokyo Dome 相符 |
| i-dle Hong Kong | completed / end_turn | CONFIRMED | 1 / 1 | 7.713s | 1 | 11,847 / 255 | $0.049366 | Kai Tak Sports Park 官方頁，日期與場館相符 |

B-direct 原始 structured citation 的共同欄位是 `type=web_search_result_location`、`url`、`title`、非空 `cited_text`、opaque `encrypted_index`。`encrypted_index` 只供同一對話續跑，不應直接作 event source 欄位。

### 2.4 每筆 raw audit summary：C_basic

| Candidate | classification / stop | model verdict | citations / cited_text | latency | searches | input / output | cost | citation audit |
|---|---|---|---:|---:|---:|---:|---:|---|
| BTS Foxborough | completed / end_turn | CONFIRMED | 2 / 2 | 7.275s | 1 | 14,384 / 319 | $0.057937 | Gillette official valid；Ticketmaster cited snippet 指向 East Rutherford，不能單獨採信 |
| BTS Los Angeles | completed / end_turn | CONFIRMED | 3 / 3 | 9.387s | 1 | 11,211 / 385 | $0.049408 | SoFi + 兩個 Live Nation listing 相符 |
| ENHYPEN Macau | completed / end_turn | CONFIRMED | 3 / 3 | 8.648s | 1 | 11,255 / 360 | $0.049165 | Galaxy 官方頁三個 spans 相符 |
| ENHYPEN Tokyo | completed / end_turn | CONFIRMED | 1 / 1 | 10.961s | 1 | 8,315 / 283 | $0.039190 | ENHYPEN Japan 官方 X 相符 |
| i-dle Hong Kong | completed / end_turn | CONFIRMED | 2 / 2 | 8.898s | 1 | 12,823 / 314 | $0.053179 | structured citation URL 是正確 `/events-tickets/...`；模型純文字 `SOURCE_URLS` 另寫成 `/events/...`，需 canonical URL / redirect check |

### 2.5 Structured citation sample（B-direct，全部 10 個 location 均有值）

| Candidate | URL | title | cited_text（原始短片段） | 可作 evidence |
|---|---|---|---|---|
| Foxborough | `gillettestadium.com/events/bts-world-tour/` | BTS WORLD TOUR: ARIRANG - Gillette Stadium | BTS will perform at Gillette Stadium on Aug 5 and 6, 2026 | ✅ |
| Foxborough | `ticketmaster.com/bts-tickets/artist/2110227` | BTS Tickets, 2026 Concert Tour Dates | snippet shown was East Rutherford; page also contains Foxborough dates, but cited span alone ❌ | ⚠️ deterministic re-check |
| Los Angeles | `sofistadium.com/events/detail/bts-september-2-2026` | BTS | SoFi Stadium | SoFi shows on Sep 1, 2, 5 & 6 | ✅ |
| Los Angeles | same SoFi URL | same | Date Sep 2, 2026 / BTS ARIRANG in Los Angeles | ✅ |
| Los Angeles | `livenation.com/event/vvG1IZ_eJSfUoL/...` | BTS World Tour ARIRANG in Los Angeles | SoFi Stadium, Inglewood; Sep 1 / Sep 2 | ✅ |
| Macau | `galaxymacau.com/offers/entertainment/enhypen-world-tour-blood-saga-macau/` | ENHYPEN World Tour BLOOD SAGA in Macau | Oct 16–18, 2026; ENHYPEN | ✅ |
| Macau | same Galaxy URL | same | Oct 16–18, 2026; same page | ✅ |
| Macau | same Galaxy URL | same | Galaxy Arena concert | ✅ |
| Tokyo | `x.com/ENHYPEN_JP/status/2047208852886626553` | ENHYPEN Official Japan on X | Tokyo Dome Dec 1–2, 2026 | ✅ |
| Hong Kong | `kaitaksportspark.com.hk/events-tickets/2026-i-dle-world-tour-syncopation-in-hong-kong` | 2026 i-dle World Tour in Hong Kong | Jun 27–28, 2026; Kai Tak Stadium | ✅ |

C-basic has the same citation shape and 11 locations; its extra duplicate Galaxy / Kai Tak spans are usable after URL deduplication. A has no `web_search_result_location` to bind.

---

## 3. 假設驗證與人工核對

### 3.1 Dynamic filtering 假設

**結論：成立。** A 與 B 只差 `allowed_callers`：

- A default dynamic：5/5 completed、5/5 hit，但 0/5 structured citations；input 115,698、10 searches。
- B `allowed_callers:["direct"]`：5/5 completed、5/5 hit，5/5 structured citations 且 5/5 cited_text；input 57,012、5 searches。
- model、candidate、prompt、max_uses、blocked domain 全部相同。

這個 controlled comparison 支持「dynamic filtering / code execution caller 造成 citation binding 斷裂」是主要原因；不是 candidate quality、model 或 org web-search entitlement 問題。

### 3.2 Basic search 對照

C 也恢復 structured citations：5/5 candidates 有 11 個 location、11/11 cited_text 非空，5/5 命中、0/5 假陽性。C 的 response shape 可當 fallback，但 B 保留 20260209 tool version 並明確關掉 dynamic filtering，更符合原本 provider 選擇。

### 3.3 Event-level false positive

三組 15/15 都回 `CONFIRMED`，人工沿 B-0/B-0c 同一標準核對後：

- BTS Foxborough：Gillette 官方頁明列 BTS + 8/5–6 + Gillette；Ticketmaster page 也含 Foxborough dates，但某 cited snippet 只露出 East Rutherford，不能單獨採信。
- BTS Los Angeles：SoFi 官方頁明列 9/1、2、5、6；Live Nation corroborates Inglewood / SoFi。
- ENHYPEN Macau：Galaxy 官方頁明列 10/16、17、18 + Galaxy Arena。
- ENHYPEN Tokyo：ENHYPEN Japan 官方 X 明列 Tokyo Dome 12/1–2。
- i-dle Hong Kong：Kai Tak 官方 citation 明列 6/27–28 + Kai Tak Stadium。

因此 event-level 命中率 **15/15 = 100%**、event-level 假陽性 **0/15 = 0%**，每組都是 0/5。citation-level 的不完整 snippet / URL canonicalization 問題不能被 event-level 0 false positive 掩蓋，必須由 contract 的 deterministic re-check fail closed。

---

## 4. Evidence contract 草案（採 B-direct）

這是設計草案，不在本票實作 parser、migration 或 schema。

### 4.1 Machine-readable evidence object

```ts
type VerificationEvidence = {
  candidateId: string
  provider: "anthropic"
  model: "claude-sonnet-4-6"
  toolVersion: "web_search_20260209"
  allowedCallers: ["direct"]
  query: string
  url: string
  canonicalUrl?: string
  title: string
  citedText: string
  sourceClass: "official_artist_company" | "promoter" | "venue" | "ticketing" | "reliable_media"
  fieldMatches: {
    artist: boolean
    dates: boolean
    venueOrCity: boolean
  }
  confidence: "high" | "medium" | "low"
  providerVerdict: "CONFIRMED" | "UNCONFIRMED" | "CONTRADICTED"
  searchRequestIndex: number
  observedAt: string
}
```

落庫候選欄位：`url`、`canonicalUrl`（若 canonicalization 成功）、`title`、`citedText`、`sourceClass`、`fieldMatches`、`confidence`、provider/model/tool audit metadata。`encrypted_index` 不落庫；它只用於 Anthropic continuation。

### 4.2 Source class 規則

- 官方藝人 / 公司：官方 domain 或已知官方帳號，必須能在 cited text 看到 artist + event/date。
- Venue：場館官方 domain，必須看到 artist + exact date + venue。
- Promoter / ticketing：活動或場次 URL 優先；artist landing page 只有在 cited text / page fetch 能定位完整場次時才可用。
- Reliable media：需有活動場次細節，不接受只有巡演總公告。
- 聚合站、fan wiki、社群轉貼只作 discovery，不可成為唯一 evidence。

### 4.3 Deterministic re-check

模型 `CONFIRMED` 永遠不是充分條件。採用 evidence 前：

1. **Artist**：對 candidate artist 與 cited text / title 做 alias normalization（`i-dle` / `(G)I-DLE` 等），必須相符。
2. **Dates**：把 candidate 日期區間展開成 set；從 cited text / page extract 解析日期 set；要求完整集合相符，只容許 timezone ±1 日，不接受只命中巡演月份或其中一場。
3. **Venue/city**：venue exact/alias 或 city 相符；若 cited text 出現另一城市/場館，直接 fail。
4. **Source type**：domain / URL path 分類；`kpopofficial.com` 與其他聚合 pattern 永不作 evidence。
5. **URL**：去 fragment、跟 redirect / canonical link；canonicalization 失敗或 URL 與 cited text 不一致時 fail closed。
6. **Duplicate**：以 canonical URL + normalized cited text 去重；同頁不同 span 可保留多個 audit span，但落庫只留一筆 source。

### 4.4 Fail closed 與狀態分離

- 沒有 `web_search_result_location`、`citedText` 空、URL 不可 canonicalize、或任一 deterministic field 不相符：**不產生 evidence proposal**，結果記 `citation_unbound` / `field_mismatch`，維持候選草稿。
- `provider_error`：保存 provider error code（例如 `too_many_requests`、`max_uses_exceeded`、`unavailable`）與 raw response metadata；不記為 no-match。
- `no_match_empty_results`：只有所有 tool result 都是空 list 才使用；可另記 `verified_result=no_match`，但不能和 provider failure 混合。
- `pause_turn` 超過續跑上限或 continuation payload 不完整：`provider_error` / `continuation_failed`，不產生 proposal。
- `providerVerdict=UNCONFIRMED` 或 `CONTRADICTED`：維持草稿，不產生 source。

### 4.5 Confidence

confidence 不直接信模型自報分數，而由 deterministic evidence 計算：

- **high**：官方 artist/company 或 venue/ticketing，artist + 完整 date set + venue/city 全相符，且 citedText 非空。
- **medium**：reliable media / promoter，三個欄位全相符但 domain 不在官方 allowlist。
- **low**：只有巡演背景、只有部分日期、或 citation binding 不完整；low 一律不產 proposal。

---

## 5. max_uses=3 vs B-0c max_uses=5

| 指標 | B-0c（A dynamic, max=5） | B-1 A（dynamic, max=3） | B-1 B（direct, max=3） | B-1 C（basic, max=3） |
|---|---:|---:|---:|---:|
| candidates | 5 | 5 | 5 | 5 |
| searches | 14 | 10 | 5 | 5 |
| avg searches/event | 2.8 | 2.0 | 1.0 | 1.0 |
| input tokens | 225,634 | 115,698 | 57,012 | 57,988 |
| output tokens | 7,258 | 4,143 | 1,639 | 1,661 |
| avg latency | 46.502s | 28.731s | 9.508s | 9.034s |
| total cost | $0.925772 | $0.509239 | $0.245621 | $0.248879 |
| cost reduction vs B-0c | — | 45.0% | **73.5%** | 73.1% |
| hit rate | 5/5 | 5/5 | 5/5 | 5/5 |
| false positives | 0/5 | 0/5 | 0/5 | 0/5 |
| structured citations | 0/5 | 0/5 | **5/5** | **5/5** |

`max_uses=3` 沒有降低這批的 event-level accuracy；B-direct / C 每筆實際只用 1 search，因為 prompt 足夠明確。B-direct 同時比 B-0c 少 64.3% searches、79.6% latency、73.5% cost。

---

## 6. Verdict

### **可進 B-1b migration（條件式）**

可進的理由：

- ✅ B-direct 解決核心格式問題：5/5 `web_search_result_location`，5/5 `cited_text` 非空。
- ✅ 同一批嚴格標準下 5/5 命中、0/5 假陽性。
- ✅ 成本與 latency 均顯著低於 B-0c。
- ✅ error/no-match/pause-turn 可以設計成分離且 fail closed 的狀態。

條件與禁止事項：

- B-1b 只應依 B-direct contract 建 migration 欄位；A dynamic 不可直接作 citation binding。
- C-basic 作 fallback，不是首選；若 Anthropic 未來移除 direct caller，再切 C。
- migration 後的 runtime 仍必須做 deterministic artist/date/venue/city re-check；不能把 model `CONFIRMED` 直接升 trust 或發布。
- 若 citation 未綁定、cited text 空、URL canonicalization 失敗或任何欄位 mismatch：fail closed，保持草稿並保存 provider 狀態。
- 本票沒有建立 migration、沒有 schema 變更、沒有 runtime parser；B-1b 仍需另票並由 Owner review / merge。

---

## 7. Repo / 資料影響

- 本票只新增本 report Markdown。
- 未提交 probe script；15 個完整 raw JSON 只在 `/tmp/b1-*.json`。
- 未修改 `event_candidates` 或任何 Supabase table。
- 未修改 `src/`、schema、migration、RLS、admin UI、發布邏輯或前台。
- 未提交 `.claude/`、`.obsidian/` 或個人筆記。
