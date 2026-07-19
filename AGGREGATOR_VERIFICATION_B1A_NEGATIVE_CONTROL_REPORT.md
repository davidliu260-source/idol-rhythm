# B-1a Negative Control：聚合源 citation binding contract

日期：2026-07-15
分支：`feature/aggregator-verification-b1a-negative-control`
範圍：純研究；沒有寫入任何 Supabase table，沒有修改 `src/`、schema、migration、RLS、admin UI 或發布流程。

## Verdict

**PASS（contract 會拒絕壞資料）**：3/3 真候選得到 `CONFIRMED`，5/5 偽造候選都被拒絕（3 筆 `CONTRADICTED`、2 筆 `UNCONFIRMED`），沒有偽陽性穿過模型與 deterministic re-check 兩層防線。命中率（真候選）3/3 = 100%；偽造候選穿透率 0/5，假陽性率 0/5 = 0%。

需要保留的 runtime 原則：不能只信模型的 `VERDICT`；必須要求結構化 citation，並 deterministic 檢查 artist、完整 date set、venue/city 與 canonical URL。此次 5 筆壞資料全由模型先拒絕，因此 deterministic layer 的 rejection evidence 也逐筆列出，證明它能獨立擋下每一筆。

## 1. 實驗設定與邊界

三個真 candidate ID 只做一次 `event_candidates SELECT`：

- `31db5d26-cfe8-408c-b0a9-245a0db0ec6c` — BTS / SoFi Stadium / 2026-09-01、02、05、06
- `4ad757a6-f8d2-4c7c-a89d-10a4fd0595b2` — ENHYPEN / Galaxy Arena Macau / 2026-10-16～18
- `4ed0e0ff-2bde-47e2-9aba-37eda05c089d` — i-dle / Kai Tak Stadium HK / 2026-06-27～28

偽造候選由真 row 在腳本記憶體 clone 後改欄位；沒有偽造 ID，也沒有 INSERT/UPDATE/DELETE。每筆一個獨立 request，共 8 筆。設定與 B-1 spike B 組完全一致：`claude-sonnet-4-6`、`web_search_20260209`、`allowed_callers:["direct"]`、`max_uses:3`、`blocked_domains:["kpopofficial.com"]`，prompt 逐字沿用 B 組。

成本採 Anthropic 牌價實算：input `$3 / 1M` + output `$15 / 1M` + web search `$10 / 1,000 searches`。API error / 空結果分流也沿用 B-0c；本輪 8/8 為 `completed_with_results`，沒有 provider error、空結果或 `pause_turn`。

## 2. 8 筆量測結果

| case | 預期 | model verdict | classification | citations（非空 cited_text） | latency ms | input / output tokens | searches | 成本 USD |
|---|---|---|---|---:|---:|---:|---:|---:|
| T1 BTS SoFi | CONFIRMED | CONFIRMED | completed_with_results | 3 (3) | 9,581 | 11,082 / 381 | 1 | 0.048961 |
| N1 BTS Gillette 日期偏移 | REJECT | CONTRADICTED | completed_with_results | 3 (3) | 9,042 | 12,299 / 345 | 1 | 0.052072 |
| T2 ENHYPEN Macau | CONFIRMED | CONFIRMED | completed_with_results | 2 (2) | 8,686 | 11,814 / 376 | 1 | 0.051082 |
| N2 ENHYPEN Osaka 場館置換 | REJECT | CONTRADICTED | completed_with_results | 1 (1) | 11,911 | 25,918 / 390 | 2 | 0.103604 |
| T3 i-dle Kai Tak | CONFIRMED | CONFIRMED | completed_with_results | 2 (2) | 10,253 | 11,981 / 349 | 1 | 0.051178 |
| N3 aespa 藝人置換 | REJECT | CONTRADICTED | completed_with_results | 1 (1) | 14,783 | 32,169 / 466 | 2 | 0.123497 |
| N4 TWICE 憑空捏造 | REJECT | UNCONFIRMED | completed_with_results | 2 (2) | 13,158 | 14,065 / 460 | 1 | 0.059095 |
| N5 Macau 多宣稱一天 | REJECT | UNCONFIRMED | completed_with_results | 3 (3) | 8,317 | 11,830 / 389 | 1 | 0.051325 |

合計：input **131,158**、output **3,156**、web searches **10**、latency **85,731 ms**、成本 **US$0.540814**（平均 US$0.067602 / candidate）。8/8 都有 structured `web_search_result_location`，且 cited_text 全部非空（17/17）。

## 3. 偽造候選 deterministic re-check

判定規則：artist 必須相符；citation 的完整日期集合必須與候選集合相符（不是只命中其中一天）；venue/city 不得衝突；URL 必須是被允許的官方藝人/公司、主辦、場館、售票或可靠媒體 canonical URL。`kpopofficial.com` 及其他聚合站不作證據。

| fake | 模型結果 | deterministic 擋下的規則 | citation 的具體依據 |
|---|---|---|---|
| N1 BTS / Gillette / 8-12～13 | CONTRADICTED | 日期集合不符（rule 2） | Ticketmaster cited_text：`August 5, 2026`；Boston.com：`Aug. 5 and Aug. 6`。候選 8/12～13 與可靠來源的完整集合不相等。 |
| N2 ENHYPEN / Kyocera Osaka / 12-1～2 | CONTRADICTED | venue/city 衝突，且日期場館綁定不符（rules 3、2） | Only Hits cited_text：`It begins at the Tokyo Dome on December 1 and 2, 2026`；候選聲稱 Kyocera Dome Osaka。 |
| N3 aespa / Kai Tak / 6-27～28 | CONTRADICTED | artist 不符（rule 1） | Kai Tak 官方 cited_text：`2026 i-dle WORLD TOUR ... at Kai Tak Stadium on June 27 and 28, 2026`；來源明確是 i-dle，不是 aespa。 |
| N4 TWICE / Singapore National Stadium / 11-14～15 | UNCONFIRMED | 沒有合格來源支持；來源反而同時否定 artist/date/venue（rules 1–3） | Pollstar cited_text 列的是 Singapore 2025；Wikipedia cited_text 說巡演於 July 2026 結束。模型另指出 confirmed stop 是 Singapore Indoor Stadium 2025-10-11/12。 |
| N5 ENHYPEN / Galaxy Macau / 10-16～19 | UNCONFIRMED | 完整日期集合不符（rule 2） | iMe cited_text：`2026. 10. 16 ... 10.17 ... 10.18`；X cited_text 亦為 `Oct 16, 17, & 18`，沒有 10/19。 |

因此即使把模型 verdict 丟掉，單靠 citation binding + deterministic re-check，五筆也都應落為 rejected / fail closed；N4 沒有任何可支持 11/14～15 的合格 citation，必須拒絕而非猜測。

## 4. 每個 citation 原文

Raw payload（已移除 `encrypted_content` 與 `encrypted_index`）位於 [`AGGREGATOR_VERIFICATION_B1A_RAW/`](./AGGREGATOR_VERIFICATION_B1A_RAW/)。以下是每筆 response 的所有 structured citation（URL、title、cited_text 原文）：

### T1 BTS SoFi

- `https://www.sofistadium.com/events/detail/bts-september-2-2026` — **BTS | SoFi Stadium** — “Tickets for the shows at SoFi Stadium on September 1, 2, 5 &amp; 6 are on sale now!!”
- `https://www.sofistadium.com/events/detail/bts-september-2-2026` — **BTS | SoFi Stadium** — “Date Sep. 2, 2026 ... Are you ready for BTS WORLD TOUR ‘ARIRANG’ IN LOS ANGELES?”
- `https://consequence.net/2026/04/bts-sofi-los-angeles-tickets/` — **BTS at SoFi Stadium: How to Get Their Sold-Out Los Angeles Shows** — “BTS will ... four massive concerts at SoFi Stadium in Inglewood: September 1st, 2nd, 5th, an...”

### N1 BTS Gillette 日期偏移

- `https://www.ticketmaster.com/gillette-stadium-tickets-foxborough/venue/8759` — **Gillette Stadium - Foxborough, MA | Tickets, 2026-2027 Event Schedule** — “August 5, 2026 ... BTS WORLD TOUR 'ARIRANG' IN FOXBOROUGH, 8/5/26...”
- `https://www.boston.com/things-to-do/events/bts-gillette-stadium/` — **BTS is coming to Gillette Stadium for a pair of concerts** — “According to a press release from Live Nation, the shows will mark the first time a K-pop act has ever performed in the Boston area.”
- `https://www.boston.com/things-to-do/events/bts-gillette-stadium/` — 同上 — “The 79-show tour will visit 34 regions, including a pair of shows at Gillette Stadium on Wednesday, Aug. 5 and Thursday, Aug. 6 at 8 p.m.”

### T2 ENHYPEN Macau

- `https://www.galaxymacau.com/offers/entertainment/enhypen-world-tour-blood-saga-macau/` — **ENHYPEN WORLD TOUR 'BLOOD SAGA' IN MACAU** — “The globally acclaimed, record-breaking K-pop boy group ENHYPEN is set to return to Galaxy Macau this October with their brand-new world tour BLOOD SAGA...”
- `https://ime.co/blog/tour/enhypen-world-tour-blood-saga-in-macau/` — **ENHYPEN WORLD TOUR 'BLOOD SAGA' IN MACAU - iMe** — “We are excited to announce that ENHYPEN WORLD TOUR ‘BLOOD SAGA’ is coming to MACAU! Date：[ADDED] 2026. 10. 16 FRI &amp; 2026.10.17 SAT &amp; 2026.10.1...”

### N2 ENHYPEN Osaka 場館置換

- `https://onlyhit.us/en/news/enhypen-announces-2026-2027-blood-saga-world-tour-including-first-japanese-four` — **ENHYPEN Announces 2026-2027 'BLOOD SAGA' World Tour, Including First Japanese Four-Dome Tour** — “It begins at the Tokyo Dome on December 1 and 2, 2026. The tour then moves to Vantelin Dome Nagoya...”

### T3 i-dle Kai Tak

- `https://www.kaitaksportspark.com.hk/events-tickets/2026-i-dle-world-tour-syncopation-in-hong-kong` — **2026 i-dle WORLD TOUR [Syncopation] IN HONG KONG - Kai Tak Sports Park** — “K-pop popular girl group i-dle will hold their concert 2026 i-dle WORLD TOUR [Syncopation] IN HONG KONG at Kai Tak Stadium on June 27 and 28, 2026.”
- `https://berriz.in/en/i-dle/notice/1436` — **2026 i-dle WORLD TOUR [Syncopation] IN HONG KONG ... OFFICIAL FANCLUB** — “[Concert Information] - Title : 2026 i-dle WORLD TOUR [Syncopation] IN HONG KONG - Date & Time : June 27th(Sat) - 28th(Sun), 2026 6PM (HKT) - Venue : ...”

### N3 aespa 藝人置換

- `https://www.kaitaksportspark.com.hk/events-tickets/2026-i-dle-world-tour-syncopation-in-hong-kong` — **2026 i-dle WORLD TOUR [Syncopation] IN HONG KONG** — “Ticketing Details 2026 i-dle WORLD TOUR [Syncopation] IN Hong Kong Date: 27 June – 28 June 2026 ... Venue: Kai Tak Stadi...”

### N4 TWICE 憑空捏造

- `https://news.pollstar.com/2025/09/30/twice-announces-this-is-for-2026-world-tour/` — **TWICE Announces ‘This Is For’ 2026 World Tour** — “TWICE ‘THIS IS FOR’ WORLD TOUR DATES: 2025 DATES ... Sat Oct 11 – Singapore – Singapore ...”
- `https://en.wikipedia.org/wiki/List_of_Twice_concert_tours` — **List of Twice concert tours** — “Their sixth concert tour, the This Is For World Tour, began in Incheon in July 2025 and concluded in July 2026.”

### N5 ENHYPEN Macau 多宣稱一天

- `https://www.galaxymacau.com/offers/entertainment/enhypen-world-tour-blood-saga-macau/` — **ENHYPEN WORLD TOUR 'BLOOD SAGA' IN MACAU** — “The globally acclaimed, record-breaking K-pop boy group ENHYPEN is set to return to Galaxy Macau this October with their brand-new world tour BLOOD SAGA...”
- `https://ime.co/blog/tour/enhypen-world-tour-blood-saga-in-macau/` — **ENHYPEN WORLD TOUR 'BLOOD SAGA' IN MACAU - iMe** — “Date：[ADDED] 2026. 10. 16 FRI &amp; 2026.10.17 SAT &amp; 2026.10.18 SUN ... Stay tuned for tickets and more details!!!”
- `https://x.com/moonandenhypen/status/2056973797463621852` — **Moon on X: ...** — “After opening an additional show, ENHYPEN WORLD TOUR 'BLOOD SAGA' IN MACAU is all sold out. ... ENHYPEN will perform on Oct 16, 17, &amp; 18.”

## 5. Contract 與下一步

- **會拒絕壞資料嗎？會。** 五筆 negative control 全部被拒絕，且每筆都有可指出的規則與 cited_text；沒有一筆穿過兩層防線。
- **citation 品質：** 17/17 有非空 cited_text；URL/title/cited_text 可供 machine-readable evidence contract 使用，但同一 URL 可能重複，落庫前仍需 canonicalize/dedupe 與 source-class allowlist。
- **模型層 vs deterministic 層：** N1～N3 是模型 `CONTRADICTED`，N4～N5 是 `UNCONFIRMED`；這不是放寬 gate。deterministic layer 對五筆分別以日期、venue/city、artist、無 qualifying source、完整日期集合擋下。若未來只有散文而無 citation，應 fail closed。
- **成本：** 本輪 max_uses=3 實際 10 searches / US$0.540814；不能直接與 B-0c 的 5 筆 max_uses=5 做單純總額比較（樣本數不同），但本輪 N2/N3 顯示 max_uses=3 仍可能觸發 2 次搜尋與高 input token，runtime 必須設上限並記錄 provider usage。
- **Verdict：** 可進 B-1b migration 設計，但僅限把 evidence contract 與 deterministic re-check 落成；不得把模型 `CONFIRMED` 單獨視為可落庫證據。

## 6. 可複查檔案與安全檢查

- [`AGGREGATOR_VERIFICATION_B1A_RAW/`](./AGGREGATOR_VERIFICATION_B1A_RAW/)：8 筆 raw JSON + summary，已去除 `encrypted_content` / `encrypted_index`。
- 完整含加密欄位的 provider payload 只留在 `/tmp`，沒有提交。
- `ANTHROPIC_API_KEY` 只從 `.env.local` server-side 載入；沒有寫入腳本、報告、raw JSON、console 或 Git。
