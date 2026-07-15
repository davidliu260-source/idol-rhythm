# B-6b discovery rerun：max_tokens + completeness gate

日期：2026-07-15
分支：`feature/b6b-discovery-rerun`

## Verdict：通過本輪 probe，但仍只建議進入下一輪 contract/runtime 設計

B-6 的唯一阻斷原因是 MONSTA X 以小 output 上限截斷。本輪明確設定 `max_tokens=16384` 後，5/5 都是 `stop_reason=end_turn`；MONSTA X 完整回傳 10/10 場，`EVENT_COUNT=10` 與完整解析事件數一致。三個預期無行程藝人仍回 `NO_EVENTS_FOUND`。逐場核對沒有發現假陽性（**0/11 場**）。

因此 B-6 的截斷是 config artifact，不是 provider 的 1.5K 能力上限；但 completeness gate 仍是必要安全邊界，不能因這次上限放大就移除。任何 `stop_reason != end_turn`、EVENT_COUNT 不相等、欄位缺失或 citation/cited_text 缺失，都應整筆 `provider_error/incomplete`、不部分採計。

## 1. 可複查 request 設定

五個 request 各自獨立，沒有 DB 存取、沒有 bundle、沒有 INSERT/UPDATE/DELETE。除了新增 `EVENT_COUNT: <n>` 一行外，prompt 沿用 B-6 原文。每個 raw JSON 同時保存 request 與 response；request 內含 model、tool、allowed_callers、max_uses、max_tokens、blocked_domains、完整 prompt、as_of。

```json
{
  "model": "claude-sonnet-4-6",
  "tool": "web_search_20260209",
  "allowed_callers": ["direct"],
  "max_uses": 3,
  "max_tokens": 16384,
  "blocked_domains": ["kpopofficial.com"],
  "as_of": "2026-07-15"
}
```

Prompt 唯一新增行：`EVENT_COUNT: <n>`，位於 `VERDICT` 後；其他文字未改。API key 只從 `.env.local` server-side 載入，未寫入 raw/report/console/Git。

## 2. 五筆結果、completeness、usage 與成本

| 藝人 | verdict | stop_reason | EVENT_COUNT / parsed / complete | gate | citations（非空 cited_text） | latency ms | input / output | searches | 成本 USD |
|---|---|---|---:|---|---:|---:|---:|---:|---:|
| Red Velvet | EVENTS_FOUND | end_turn | 1 / 1 / 1 | PASS | 4 / 4 | 14,636 | 17,063 / 745 | 2 | 0.082364 |
| MONSTA X | EVENTS_FOUND | end_turn | 10 / 10 / 10 | PASS | 11 / 11 | 28,733 | 19,708 / 2,007 | 2 | 0.109229 |
| tripleS | NO_EVENTS_FOUND | end_turn | 0 / 0 / 0 | PASS | 4 / 4 | 15,479 | 38,669 / 542 | 3 | 0.154137 |
| PENTAGON | NO_EVENTS_FOUND | end_turn | 0 / 0 / 0 | PASS | 3 / 3 | 11,022 | 19,590 / 390 | 2 | 0.084620 |
| N.Flying | NO_EVENTS_FOUND | end_turn | 0 / 0 / 0 | PASS | 3 / 3 | 21,502 | 43,945 / 860 | 3 | 0.174735 |

合計：input **138,975**、output **4,544**、web searches **12**、latency **91,372 ms**、實算成本 **US$0.605085**（平均 US$0.121017／藝人）。成本公式：input `$3/1M` + output `$15/1M` + web search `$10/1,000`。63 個黑洞按本輪平均線性估算：**US$7.624071**、約 **151.2 searches**；這是成本估算，不代表可直接批量上線。

## 3. Red Velvet：1/1 場人工核對

| artist | 完整日期 | 場館／city | citation URL / title | cited_text 原文 | 核對 |
|---|---|---|---|---|---|
| Red Velvet | 2026-08-01 18:00 KST、2026-08-02 16:00 KST | Korea University Hwajeong Tiger Dome（Hwajeong Gymnasium）, Seoul, South Korea | `https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807` — *Girl group Red Velvet to return with new album, fan concert in August* | “The fan concert will take place at the Tiger Dome gymnasium at Korea University in northern Seoul at 6 p.m. on Aug. 1 and at 4 p.m. on Aug. 2.” | ✅ artist、完整兩日、場館、city 均一致；可靠媒體。 |

Supporting structured citations 另含 Soompi 的 Hwajeong Tiger Dome 同日同時間與 Melon Ticket 售票文字；沒有僅靠巡演總公告。

## 4. MONSTA X：10/10 場人工核對

每列均有完整 artist、日期、venue、city、citation URL/title/cited_text；逐列以 Ticketmaster、MSG venue 或 Billboard reliable media 交叉核對。沒有日期或場館衝突。

| # | 完整日期 | 場館／city | citation URL | cited_text 原文 |
|---:|---|---|---|---|
| 1 | 2026-10-03 20:00 | EagleBank Arena, Fairfax, VA, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` — *MONSTA X Tickets, 2026-2027 Concert Tour Dates* | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX 10/3/26, 8:00 PM Fairfax, VA EagleBank Arena” |
| 2 | 2026-10-06 | Infosys Theater at Madison Square Garden, New York, NY, USA | `https://www.msg.com/events-tickets/monsta-x-infosys-theater-at-madison-square-garden-october-2026/3B00647BF0495307` — *MONSTA X | KPOP Concerts | Infosys Theater at MSG* | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NEW YORK will come to the Infosys Theater at MSG on October 6.” |
| 3 | 2026-10-08 20:00 | MGM Music Hall at Fenway, Boston, MA, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN BOSTON 10/8/26, 8:00 PM Boston, MA MGM Music Hall at Fenway” |
| 4 | 2026-10-10 | Great Canadian Toronto, Toronto, ON, Canada | `https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/` — *Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates* | “Oct. 6: New York, N.Y. @ Infosys Theater at Madison Square Garden · Oct. 8: Boston, Mass. @ MGM Music Hall at Fenway · Oct. 10: Toronto, ON @ Great Canadian Toronto” |
| 5 | 2026-10-13 20:00 | Rosemont Theatre, Rosemont, IL, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT 10/13/26, 8:00 PM Rosemont, IL Rosemont Theatre” |
| 6 | 2026-10-15 20:00 | The Pavilion at Toyota Music Factory, Irving, TX, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING 10/15/26, 8:00 PM Irving, TX The Pavilion at Toyota Music Factory” |
| 7 | 2026-10-17 20:00 | Arizona Financial Theatre, Phoenix, AZ, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX 10/17/26, 8:00 PM Phoenix, AZ Arizona Financial Theatre” |
| 8 | 2026-10-20 20:00 | Kia Forum, Inglewood (Los Angeles), CA, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN LOS ANGELES 10/20/26, 8:00 PM Inglewood, CA Kia Forum” |
| 9 | 2026-10-22 20:00 | The Theater at Bill Graham Civic Auditorium, San Francisco, CA, USA | `https://www.ticketmaster.com/monsta-x-tickets/artist/2371302` | “2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SAN FRANCISCO 10/22/26, 8:00 PM San Francisco, CA The Theater at Bill Graham Civic Auditorium” |
| 10 | 2026-10-24 | WAMU Theater, Seattle, WA, USA | `https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/` | “Starting at the EagleBank Arena in Fairfax, Va., on Oct. 3, the group will play dates across the two countries before wrapping on Oct. 24 at the WAMU Theater in Seattle, Wash.” |

MONSTA X 這次不再截斷；第 8–10 場已逐場核對。Toronto 與 Seattle 的 cited_text 由 Billboard tour-date list 提供完整日期與場館，頁面 title 明確是 MONSTA X；其餘場次由 Ticketmaster/MSG 直接綁定。

## 5. 三個負向控制

| 藝人 | verdict / EVENT_COUNT | 人工核對 |
|---|---|---|
| tripleS | NO_EVENTS_FOUND / 0 | Ticketmaster cited_text：`We're sorry, but we couldn't find any upcoming concerts for tripleS.`；SeatGeek/Vivid Seats 也無 upcoming dated event。搜尋到的 ASSEMBLE26 是 comeback，沒有日期，不能當 live event。 |
| PENTAGON | NO_EVENTS_FOUND / 0 | Ticketmaster：`We couldn't find any upcoming concerts for PENTAGON.`；Festivaly.eu 是聚合站，未作 evidence；沒有 official/promoter/venue/ticketing/reliable-media 的 7/15 後 dated event。 |
| N.Flying | NO_EVENTS_FOUND / 0 | Ticketmaster：`We couldn't find any upcoming concerts for N.Flying.`；Live Nation：`There are no upcoming shows.`；Songkick：`no concert dates for N.Flying scheduled in 2026.` 已過去的 Seoul/Taipei/Macau/Japan 活動均排除。 |

三個 negative control 沒有硬掰場次；NO_EVENTS_FOUND 的語義是「允許來源與 cutoff 下無合格公開場次」，不是證明世界上永遠沒有活動。

## 6. Completeness gate 結論與下一步

- 5/5 `stop_reason=end_turn`。
- 5/5 `EVENT_COUNT == complete parsed events`。
- 11/11 EVENTS_FOUND 場次都有日期、venue、city、citation URL/title、非空 cited_text；structured citation 25/25 非空 cited_text。
- 假陽性：**0/11**。
- B-6 的 `max_tokens` 截斷是 config artifact；`16384` 足以完成本批 10 場 MONSTA X 清單，不是 provider 固有 1.5K 上限。
- Gate 不可移除：若未來清單再長，任何不完整 response 都必須整筆 fail closed，不得部分採計。

**建議：** 本 probe 通過 discovery correctness/completeness，可進下一輪 runtime contract 設計；仍不直接接入 app。下一階段必須保留 request/response raw、`stop_reason`、EVENT_COUNT、逐場 citation 與 fail-closed provider_error 分類。

## 7. Raw JSON

[`AGGREGATOR_VERIFICATION_B6B_RAW/`](./AGGREGATOR_VERIFICATION_B6B_RAW/) 包含 5 筆 raw JSON 與 `b6b-results.json`。每筆 raw 同時保存 request + response，已移除 `encrypted_content`、`encrypted_index`；未包含 API key 或其他 secret。完整含密文 payload 僅留在 `/tmp`。
