# B-6 場館／售票端 discovery probe

日期：2026-07-15
分支：`feature/b6-discovery-probe`
範圍：純研究；未寫入 DB，未修改 `src/`、schema、migration、RLS、admin UI、發布邏輯或前台。

## Verdict：否決進 runtime（目前 discovery contract 不夠安全）

這輪沒有發生「宣稱存在但 citation 實際不存在／日期場館錯」的已完成場次，假陽性 **0/8 個可完整解析場次**。三個預期無行程藝人都回 `NO_EVENTS_FOUND`，Red Velvet 的一場 fan-con 與 MONSTA X 前七場都有直接可核對的 citation。

但是 MONSTA X response 在列出第 7 場後以 `stop_reason=max_tokens` 截斷，第 8 場只開始輸出城市、沒有完整日期／場館／citation 欄位；模型同時聲稱有 10 場。這違反「每個宣稱場次都必須完整 machine-readable + citation binding」的核心 contract。若 runtime 把這種 response 當成功，會漏資料或落庫半筆 evidence。因此本路徑目前**不能**拿來補 63 個黑洞；需先加嚴 response completeness / pagination（或每次只回一場／更小 batch）再重測。

## 1. 統一設定

- Model：`claude-sonnet-4-6`
- Tool：`web_search_20260209`
- `allowed_callers: ["direct"]`
- `max_uses: 3`
- `blocked_domains: ["kpopofficial.com"]`
- 5 個藝人各一個獨立 request，沒有 bundle
- cutoff：**2026-07-15 之後**；只接受官方藝人／公司、主辦、場館、售票或可靠媒體；聚合站不可作證據；沒有逐場日期的巡演總公告不算
- prompt 要求 `EVENTS_FOUND | NO_EVENTS_FOUND`，每場完整日期、場館、城市與 structured citation；找不到必須明確回 `NO_EVENTS_FOUND`，不得猜測
- API key 僅由 `.env.local` server-side 載入，未進腳本、report、console 或 Git
- DB：本探測腳本完全不存取 Supabase，沒有 SELECT/INSERT/UPDATE/DELETE；研究樣本以藝人名稱指定，DB 全程零操作

## 2. 五筆結果與 usage

| 藝人 | 樣本類別（評估用，未放進 prompt） | verdict | classification | citations（非空 cited_text） | stop_reason | latency ms | input/output | searches | 成本 USD |
|---|---|---|---|---:|---|---:|---:|---:|---:|
| Red Velvet | 預期有行程 | EVENTS_FOUND | completed_with_results | 5 (5) | end_turn | 18,426 | 17,047 / 842 | 2 | 0.083771 |
| MONSTA X | 預期有行程 | EVENTS_FOUND | completed_with_results（**response 截斷**） | 8 (8) | max_tokens | 22,682 | 21,138 / 1,522 | 2 | 0.106244 |
| tripleS | 預期無行程 | NO_EVENTS_FOUND | completed_with_results | 4 (4) | end_turn | 15,336 | 39,628 / 594 | 3 | 0.157794 |
| PENTAGON | 預期無行程 | NO_EVENTS_FOUND | completed_with_results | 3 (3) | end_turn | 12,324 | 19,695 / 452 | 2 | 0.085865 |
| N.Flying | 預期無行程 | NO_EVENTS_FOUND | completed_with_results | 3 (3) | end_turn | 13,875 | 19,739 / 553 | 2 | 0.087512 |

合計：input **117,247**、output **3,963**、web searches **11**、latency **82,643 ms**、實算成本 **US$0.521186**（平均 US$0.104237／藝人）。成本公式：input `$3/1M` + output `$15/1M` + web search `$10/1,000`。

若 63 個黑洞完全按本輪平均成本估算：**63 × $0.104237 = US$6.566944**，約 139 次 web searches；這只是 provider usage 線性推估，不代表可接受的 runtime 成本，因為長事件清單可能觸發截斷或需要續跑。

## 3. EVENTS_FOUND：逐場人工核對

### Red Velvet（1 場，核對通過）

| artist | 完整日期 | 場館／城市 | citation URL | cited_text 原文（provider 回傳） | 核對 |
|---|---|---|---|---|---|
| Red Velvet | 2026-08-01 18:00 KST、2026-08-02 16:00 KST | Korea University Hwajeong Tiger Dome（Hwajeong Gymnasium）, Seoul, South Korea | `https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807` | “The fan concert will take place at the Tiger Dome gymnasium at Korea University in northern Seoul at 6 p.m. on Aug. 1 and at 4 p.m. on Aug. 2.” | ✅ 藝人、兩日日期、場館、城市均相符；可靠媒體。 |

交叉 structured citations 也包含 The Korea Times（Hwajeong Gymnasium，Aug. 1–2）與 Soompi（Hwajeong Tiger Dome，Aug. 1 18:00／Aug. 2 16:00），且回應指出 Melon Ticket 售票；5/5 citation 的 `cited_text` 非空。

### MONSTA X（7 場完整可核對；第 8 場起截斷，不納入）

下列七場的 URL/title/cited_text 均直接將 MONSTA X、日期與場館綁在同一段證據；Ticketmaster 是售票來源，MSG 是場館來源。人工逐場核對沒有發現日期或城市衝突。

| artist | 完整日期 | 場館／城市 | citation URL | cited_text 原文 |
|---|---|---|---|---|
| MONSTA X | 2026-10-03 20:00 | EagleBank Arena, Fairfax, VA, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX 10/3/26, 8:00 PM Fairfax, VA EagleBank Arena” |
| MONSTA X | 2026-10-06 | Infosys Theater at Madison Square Garden, New York, NY, USA | `https://www.msg.com/events-tickets/monsta-x-infosys-theater-at-madison-square-garden-october-2026/3B00647BF0495307` | “Get tickets to see 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NEW YORK come to the Infosys Theater at MSG on October 6, 2026.” |
| MONSTA X | 2026-10-08 20:00 | MGM Music Hall at Fenway, Boston, MA, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN BOSTON 10/8/26, 8:00 PM Boston, MA MGM Music Hall at Fenway” |
| MONSTA X | 2026-10-13 20:00 | Rosemont Theatre, Rosemont, IL, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT 10/13/26, 8:00 PM Rosemont, IL Rosemont Theatre” |
| MONSTA X | 2026-10-15 20:00 | The Pavilion at Toyota Music Factory, Irving, TX, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING 10/15/26, 8:00 PM Irving, TX The Pavilion at Toyota Music Factory” |
| MONSTA X | 2026-10-17 20:00 | Arizona Financial Theatre, Phoenix, AZ, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX 10/17/26, 8:00 PM Phoenix, AZ Arizona Financial Theatre” |
| MONSTA X | 2026-10-20 20:00 | Kia Forum, Inglewood (Los Angeles), CA, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN LOS ANGELES 10/20/26, 8:00 PM Inglewood, CA Kia Forum” |

MONSTA X 的 structured citation 也包含 Billboard 的 North America tour announcement；但 response 自稱 10 場、在第 8 場只輸出到 `San Francisco, CA,` 後 `stop_reason=max_tokens`。因此第 8–10 場沒有完整日期、場館、URL/cited_text，不能算完成 discovery，也不能落庫。

## 4. NO_EVENTS_FOUND：負向控制

| 藝人 | 結果 | 可核對的負向證據 | 人工結論 |
|---|---|---|---|
| tripleS | NO_EVENTS_FOUND | Ticketmaster：`We're sorry, but we couldn't find any upcoming concerts for tripleS.`；SeatGeek：`There are no upcoming events for TripleS.`；Soompi 只說 ASSEMBLE26 comeback，且 `no comeback dates have yet been announced`。 | ✅ 沒有把音樂回歸或巡演總稱誤當有日期 live event。 |
| PENTAGON | NO_EVENTS_FOUND | Ticketmaster：`We couldn't find any upcoming concerts for PENTAGON.`；Wikipedia 的 Hanteo appearance 是 2026-02-15，早於 cutoff，也不是未來場次。 | ✅ 聚合站 Festivaly.eu 未被當成證據；無 future dated qualifying source。 |
| N.Flying | NO_EVENTS_FOUND | Ticketmaster：`We couldn't find any upcoming concerts for N.Flying.`；Live Nation：`There are no upcoming shows.`；Songkick：`no concert dates for N.Flying scheduled in 2026`。模型另排除已過去的 Seoul/Taipei/Macau 場次。 | ✅ 沒有把已過去活動誤算成 7/15 後行程。 |

三個 negative control 均沒有模型硬掰場次；負向 precision 通過本樣本，但不能抵銷 MONSTA X 的截斷完整性問題。

## 5. Failure analysis 與 runtime gate

1. **假陽性：0/8 個可完整解析場次。** 每一場可落地的聲稱都有直接 citation，人工核對 artist + exact date + venue/city 均一致。
2. **重大完整性失敗：MONSTA X。** `EVENTS_FOUND` 不能代表整個清單完成；`stop_reason=max_tokens` 必須分類為 provider/parse failure，不能部分寫入。若採 discovery runtime，至少要有「所有宣稱事件都有完整欄位與 citation」的 completeness gate，否則 fail closed。
3. **NO_EVENTS_FOUND 不等於世界上沒有活動。** 本輪只能證明在 cutoff 與允許來源下沒有找到合格公開場次；這是 discovery 的保守語義，不可在 UI 顯示成確定「沒有活動」。
4. **聚合站污染風險仍存在。** PENTAGON response 搜到 Festivaly.eu，但沒有把它當證據；runtime 必須保留 source allowlist/blocklist，不得只看搜尋結果數量。

## 6. 是否能補 63 個黑洞？

**目前不能進 runtime。** 證據顯示 B-direct 能主動找到真實 venue/ticketing discovery（Red Velvet 1 場、MONSTA X 至少 7 場），也能對 tripleS/PENTAGON/N.Flying 保守回報無合格未來場次；但長清單的截斷證明 response contract 尚未足以安全落庫。下一張票若要重測，應先設計事件數上限／分頁或單場輸出、要求 `stop_reason=end_turn`、聲稱數量與完整事件陣列一致，任何不一致都 `provider_error` / fail closed，再用同一混合樣本重跑。

## 7. Raw payload 與安全

去除 `encrypted_content`、`encrypted_index` 後的 5 筆 raw JSON 與 summary 位於 [`AGGREGATOR_VERIFICATION_B6_RAW/`](./AGGREGATOR_VERIFICATION_B6_RAW/)。完整含密文 payload 只留在 `/tmp`，沒有提交。raw 檔未包含 API key 或任何 secret。
