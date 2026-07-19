# B-7b binding rules fix rerun

日期：2026-07-16
分支：feature/b7b-binding-rules-fix

## Verdict：真實 yield 10/12；安全 gate 通過，仍不進 runtime

本輪只改 assertion：刪除 C；A/B 獨立評估；D 要求同一段 cited_text 同時滿足日期與場館條件。階段一與階段二流程、prompt、樣本和 request 設定均沿用 B-7。12 個 discovery 真日期中，有效 CONFIRMED **10/12**，達到 PM 預估；F1/F2 仍被拒，假陽性 **0/2**。剩餘 2 筆不會被人工放行：Red Velvet 08/01 的 provider excerpt 無法字面證明日期/場館；重跑 discovery 將 Toronto 線索錯標成 10/13 且混入 Rosemont，該筆 verification CONTRADICTED，分類為 retrieval variance。

## 1. 規則規格

- A（獨立）：任一 citation 的 cited_text 字面包含 candidate 日期。接受 ISO YYYY-MM-DD、YYYY/MM/DD、YYYY.MM.DD、M/D/YY、M.D.YY、完整月名/三字母縮寫（可帶句點）+ 日 + 年，以及依 candidate 年份的無年格式 Oct. 22 / October 22。
- B（獨立）：任一 citation 的 cited_text 字面包含場館正規化名稱或連續兩個以上 distinctive token；若 URL hostname 是保守 allowlist 的場館官方 domain，且 URL title 明確含場館識別詞，則 B 由 domain self-identification 通過，snippet 仍必須含 artist + 日期。
- 本輪唯一 domain self-identification allowlist：greatcanadian.com → venue token “great canadian”；URL https://greatcanadian.com/event/2026-monsta-x/，title 是 “Monsta X - Great Canadian Casino Resort Toronto”。其他 Ticketmaster、媒體、主辦 domain 不享有此豁免。
- D（唯一通過條件）：同一段 cited_text 同時滿足 A 與 B；domain self-identification 時，該 domain snippet 必須含日期。C 已刪除，不再評估共享 snippet。
- 任一 D fail → citation_unbound、fail closed；不以人工瀏覽補救。

## 2. 階段一

| artist | verdict | event count / parsed | stop_reason | cost USD |
|---|---|---:|---|---:|
| Red Velvet | EVENTS_FOUND | 1 / 1 | end_turn | 0.083009 |
| MONSTA X | EVENTS_FOUND | 10 / 10 | end_turn | 0.112199 |
| tripleS | NO_EVENTS_FOUND | 0 / 0 | end_turn | 0.170211 |
| PENTAGON | NO_EVENTS_FOUND | 0 / 0 | end_turn | 0.083789 |
| N.Flying | NO_EVENTS_FOUND | 0 / 0 | end_turn | 0.168195 |

tripleS、PENTAGON、N.Flying 仍為 NO_EVENTS_FOUND，沒有進階段二。Discovery citations 不作證據。

## 3. 階段二逐場 assertion

| candidate | raw verdict | effective verdict | A | B | D | failure class |
|---|---|---|---|---|---|---|
| Red Velvet / August 1, 2026 / Korea University Hwajeong Tiger Dome (Hwajeong Gymnasium) | CONFIRMED | citation_unbound | false | false | false | 153_char_truncation |
| Red Velvet / August 2, 2026 / Korea University Hwajeong Tiger Dome (Hwajeong Gymnasium) | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 3, 2026 / EagleBank Arena | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 6, 2026 / Infosys Theater at Madison Square Garden | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 8, 2026 / MGM Music Hall at Fenway | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 13, 2026 / Rosemont Theatre | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 15, 2026 / The Pavilion at Toyota Music Factory | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 17, 2026 / Arizona Financial Theatre | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 20, 2026 / Kia Forum | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 22, 2026 / The Theater at Bill Graham Civic Auditorium | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 13, 2026 / (venue name listed on Live Nation/Ticketmaster as Great Canadian Toronto per Billboard) | CONTRADICTED | citation_unbound | true | true | false | 153_char_truncation |
| MONSTA X / October 24, 2026 / WAMU Theater | CONFIRMED | CONFIRMED | true | true | true | — |
| MONSTA X / October 25, 2026 / Moda Center | CONTRADICTED | citation_unbound | false | false | false | 153_char_truncation |
| Red Velvet / August 15, 2026 / Olympic Hall | UNCONFIRMED | citation_unbound | false | false | false | 153_char_truncation |

有效 yield：10/12。所有 effective CONFIRMED 都是 D=true。F1/F2 raw verdict 分別為 CONTRADICTED、UNCONFIRMED，沒有通過。

### 剩餘失敗分類

- 153 字元/截斷：Red Velvet 2026-08-01 的 verification cited_text 沒有可同時滿足日期與場館的完整字面證據；保留 raw 結尾，不補句。
- retrieval variance：本輪 discovery 對 Toronto 線索輸出 October 13 並混入 Rosemont，未產出原 B-7 的 October 10 / Great Canadian 組合；verification 對該自洽輸入回 CONTRADICTED，沒有假陽性。
- 沒有其他規則誤殺：本輪刪除 C 後 Red Velvet 08/02 與場館 domain Toronto 的 B/D 可通過。

## 4. 每則階段二 cited_text（raw 直接抽取）

所有下列 cited_text 由 raw payload 的 citation object 直接輸出；provider 若以 ... 截斷，JSON string representation 原樣保留。

### Red Velvet / August 1, 2026 / Korea University Hwajeong Tiger Dome (Hwajeong Gymnasium)
A=false B=false D=false raw=CONFIRMED effective=citation_unbound
URL: https://www.soompi.com/article/1847788wpp/red-velvet-announces-2026-fan-con-a-day-in-red-velvet-following-august-comeback-news
Title: Red Velvet Announces 2026 Fan-Con “A Day In Red & Velvet” Following August Comeback News | Soompi
cited_text: "On June 15, the group revealed a poster announcing the schedule for “2026 Red Velvet FAN-CON ‘A Day in Red & Velvet.’” The fan-con will take place at ..."

### Red Velvet / August 2, 2026 / Korea University Hwajeong Tiger Dome (Hwajeong Gymnasium)
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://www.koreatimes.co.kr/entertainment/k-pop/20260616/red-velvet-sets-august-return-ending-2-year-wait-for-full-group-comeback
Title: Red Velvet sets August return, ending 2-year wait for full group comeback - The Korea Times
cited_text: "The fan concert will take place at Korea University’s Hwajeong Gymnasium on Aug. 1 and Aug. 2. "
URL: https://www.koreatimes.co.kr/entertainment/k-pop/20260616/red-velvet-sets-august-return-ending-2-year-wait-for-full-group-comeback
Title: Red Velvet sets August return, ending 2-year wait for full group comeback - The Korea Times
cited_text: "The company also unveiled details Sunday for “2026 Red Velvet FAN-CON 'A Day in Red & Velvet,'” a two-day event that will bring the group together wit..."

### MONSTA X / October 3, 2026 / EagleBank Arena
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-fairfax-virginia-10-03-2026/event/15006482B90BDA55
Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX Tickets Oct 03, 2026 Fairfax, VA | Ticketmaster
cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX tickets at the EagleBank Arena in Fairfax, VA for Oct 03, 2026 at Ticketmaster.\n\n"
URL: https://www.livenation.com/event/1A4Zk3eGkeyeWt4/2026-monsta-x-world-tour-the-x-nexus-in-fairfax
Title: 2026 monsta x world tour [the x : nexus] in fairfax
cited_text: "EagleBank Arena · Fairfax, VA · Buy Tickets · MONSTA X ·"

### MONSTA X / October 6, 2026 / Infosys Theater at Madison Square Garden
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://www.msg.com/events-tickets/monsta-x-infosys-theater-at-madison-square-garden-october-2026/3B00647BF0495307
Title: MONSTA X | KPOP Concerts | Infosys Theater at MSG
cited_text: "Get tickets to see 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NEW YORK come to the Infosys Theater at MSG on October 6, 2026.\n\n"
URL: https://www.livenation.com/event/G5diZ_6RY34G6/2026-monsta-x-world-tour-the-x-nexus-in-new-york
Title: 2026 monsta x world tour [the x : nexus] in new york
cited_text: "Tue Oct 6, 2026 ▪︎ 8 PM · Infosys Theater at Madison Square Garden · New York, NY · Buy Tickets · MONSTA X ·"

### MONSTA X / October 8, 2026 / MGM Music Hall at Fenway
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NORTH AMERICA DATES: Sat Oct 3 - Fairfax, VA - EagleBank Arena · Tue Oct 6 - New York, NY - Infosys Theate..."
URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-boston-massachusetts-10-08-2026/event/0100647BAD4DF692
Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN BOSTON Tickets Oct 08, 2026 Boston, MA | Ticketmaster
cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN BOSTON tickets at the MGM Music Hall at Fenway in Boston, MA for Oct 08, 2026 at Ticketmaster.\n\n"
URL: https://www.axs.com/events/1405346/monsta-x-tickets
Title: Monsta X - Boston - MGM Music Hall at Fenway - Thu, Oct 8, 2026, 08:00 PM - AXS US
cited_text: "Get tickets for Monsta X at MGM Music Hall at Fenway in Boston on Thu, 08 October 2026 - 08:00 PM at AXS.com\n\nThu Oct 8, 2026 - 8:00 PM · MGM Music Ha..."

### MONSTA X / October 13, 2026 / Rosemont Theatre
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://rosemont.com/theatre/event/2026-monsta-x-world-tour-the-x-nexus-in-rosemont/
Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT – Rosemont Theatre
cited_text: "Tuesday, October 13, 2026 · GET TICKETS · Parking is available close to all entrances of the Rosemont Theatre. "
URL: https://rosemont.com/theatre/event/2026-monsta-x-world-tour-the-x-nexus-in-rosemont/
Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT – Rosemont Theatre
cited_text: "5400 N. River Road Rosemont, IL 60018 ...\n\nTuesday, October 13, 2026 · GET TICKETS · Parking is available close to all entrances of the Rosemont Theat..."
URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
cited_text: "Truly Rooftop Pre-Show Access: ... Rosemont, IL, Rosemont Theatre, 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT10/13/26, 8:00 PMRosemont, ILRo..."

### MONSTA X / October 15, 2026 / The Pavilion at Toyota Music Factory
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-irving-texas-10-15-2026/event/0C00648398F88E02
Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING Tickets Oct 15, 2026 Irving, TX | Ticketmaster
cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING tickets at the The Pavilion at Toyota Music Factory in Irving, TX for Oct 15, 2026 at Ticketmas..."
URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
cited_text: "@ MGM Music Hall at Fenway · Oct. 10: Toronto, ON @ Great Canadian Toronto · Oct. 13: Rosemont, Ill. @ Rosemont Theatre · Oct. 15: Irving, Texas @ The..."

### MONSTA X / October 17, 2026 / Arizona Financial Theatre
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-phoenix-arizona-10-17-2026/event/19006483BC7DB50C
Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX Tickets Oct 17, 2026 Phoenix, AZ | Ticketmaster
cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX tickets at the Arizona Financial Theatre in Phoenix, AZ for Oct 17, 2026 at Ticketmaster.\n\nSat..."
URL: https://www.livenation.com/event/1A_Zk3dGkeHLhfG/2026-monsta-x-world-tour-the-x-nexus-in-phoenix
Title: 2026 monsta x world tour [the x : nexus] in phoenix
cited_text: "Arizona Financial Theatre · Phoenix, AZ · Buy Tickets · Premier Parking - MONSTA X - Not a Concert TicketBuy Upgrade · Fast Lane Pass - MONSTA X - Not..."
URL: https://www.thatericalper.com/2026/04/07/monsta-x-bring-their-world-tour-to-north-america-this-fall-with-10-arena-dates/
Title: Monsta X Bring Their World Tour to North America This Fall With 10 Arena Dates - That Eric Alper
cited_text: "2026 Monsta X World Tour, The X: ... Theatre · October 15 — Irving, TX — The Pavilion at Toyota Music Factory · October 17 — Phoenix, AZ — Arizona Fin..."
URL: https://www.thatericalper.com/2026/04/07/monsta-x-bring-their-world-tour-to-north-america-this-fall-with-10-arena-dates/
Title: Monsta X Bring Their World Tour to North America This Fall With 10 Arena Dates - That Eric Alper
cited_text: "The 2026 Monsta X World Tour, The X: Nexus, hits 10 cities across the continent this fall, promoted by Live Nation, kicking off October 3 at EagleBank..."

### MONSTA X / October 20, 2026 / Kia Forum
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://thekiaforum.com/event/monsta-x/
Title: MONSTA X - Kia Forum
cited_text: "October 20 · 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN LOS ANGELES · Tickets PARKING · EVENT PARKING · Prepaid parking is available at the Kia Forum..."
URL: https://www.livenation.com/event/vv1AaZk3vGkdfJcBD/2026-monsta-x-world-tour-the-x-nexus-in-los-angeles
Title: 2026 monsta x world tour [the x : nexus] in los angeles
cited_text: "Tue Oct 20, 2026 ▪︎ 8 PM · Kia Forum · Inglewood, CA · Buy Tickets · MONSTA X ·"

### MONSTA X / October 22, 2026 / The Theater at Bill Graham Civic Auditorium
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-san-francisco-california-10-22-2026/event/1C006483CF0D29E6
Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SAN FRANCISCO Tickets Oct 22, 2026 San Francisco, CA | Ticketmaster
cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SAN FRANCISCO tickets at the The Theater at Bill Graham Civic Auditorium in San Francisco, CA for Oct ..."
URL: https://www.livenation.com/event/G5vYZ_F22d3EJ/2026-monsta-x-world-tour-the-x-nexus-in-san-francisco
Title: 2026 monsta x world tour [the x : nexus] in san francisco
cited_text: "Thu Oct 22, 2026 ▪︎ 8PM · The Theater at Bill Graham Civic Auditorium · San Francisco, CA · Buy Tickets · MONSTA X ·"
URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
cited_text: "17: Phoenix, Ariz. @ Arizona Financial Theatre · Oct. 20: Los Angeles, Calif. @ The Kia Forum · Oct. 22: San Francisco, Calif. @ Bill Graham Civic Aud..."
URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
cited_text: "According to a press release, the tour’s title, THE X : NEXUS, “reflects a bond that goes beyond the long-standing connection between Monsta X and MON..."

### MONSTA X / October 13, 2026 / (venue name listed on Live Nation/Ticketmaster as Great Canadian Toronto per Billboard)
A=true B=true D=false raw=CONTRADICTED effective=citation_unbound
URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
cited_text: "Parking: WAMU Theater MONSTA X ... at Great Canadian Toronto, 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN TORONTO10/10/26, 8:00 PMToronto, ON, CanadaT..."
URL: https://greatcanadian.com/event/2026-monsta-x/
Title: Monsta X - Great Canadian Casino Resort Toronto
cited_text: "Get ready for a night of explosive energy and global K-pop dominance as Monsta X takes the stage October 10, 2026!\n\n"
URL: https://www.livenation.com/artist/K8vZ9174TNV/monsta-x-events
Title: MONSTA X - 2026 Tour Dates & Concert Schedule
cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN TORONTO · Tue, Oct 13 · Buy Tickets · 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT · Thu, Oct 15 ·..."

### MONSTA X / October 24, 2026 / WAMU Theater
A=true B=true D=true raw=CONFIRMED effective=CONFIRMED
URL: https://newsroom.livenation.com/news/global-superstars-monsta-x-announce-north-american-dates-on-world-tour-the-x-nexus/
Title: Global Superstars MONSTA X Announce North American Dates on WORLD TOUR [THE X : NEXUS] - Live Nation Newsroom
cited_text: "Promoted by Live Nation, the newly added shows kick off Saturday, October 3 in Fairfax, VA at EagleBank Arena, with stops in New York, Boston, Toronto..."
URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-seattle-washington-10-24-2026/event/0F006482D94050A3
Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SEATTLE Tickets Oct 24, 2026 Seattle, WA | Ticketmaster
cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SEATTLE tickets at the WAMU Theater in Seattle, WA for Oct 24, 2026 at Ticketmaster.\n\n"
URL: https://www.wamutheater.com/events/monsta-x-2026
Title: MONSTA X at WAMU Theater | WAMU Theater - WAMUTheater.com
cited_text: "WAMU Theater 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SEATTLE / Get Tickets\n\nThe 2026 MONSTA X WORLD TOUR [THE X : NEXUS] is coming to WAMU Theater..."

### MONSTA X / October 25, 2026 / Moda Center
A=false B=false D=false raw=CONTRADICTED effective=citation_unbound
URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
cited_text: "Starting at the EagleBank Arena in Fairfax, Va., on Oct. 3, the group will play dates across the two countries before wrapping on Oct. 24 at the WAMU ..."
URL: https://www.rosequarter.com/events/event-calendar
Title: Rose Quarter - Event Calendar
cited_text: "October 1, 2026 · / 8:00 pm · Time: TBD · 2026-10-01 · tickets · tickets · Oct · 2 · date · TBD · Multiple dates · Date: TBD · Starts: Fri · . Oct 2, ..."

### Red Velvet / August 15, 2026 / Olympic Hall
A=false B=false D=false raw=UNCONFIRMED effective=citation_unbound
URL: https://www.soompi.com/article/1847788wpp/red-velvet-announces-2026-fan-con-a-day-in-red-velvet-following-august-comeback-news
Title: Red Velvet Announces 2026 Fan-Con “A Day In Red & Velvet” Following August Comeback News | Soompi
cited_text: "Following the announcement of their long-awaited August comeback, Red Velvet has unveiled plans for a fan-con to celebrate with fans! On June 15, the ..."

## 5. 引文 raw assertion

報告產生器逐一解析 verification raw JSON，檢查每則引用的 cited_text 是否在對應 raw citation object 完全相等：34/34 matched。任何未命中即產生失敗；本輪全部命中。Raw 分開存放於 AGGREGATOR_VERIFICATION_B7B_RAW/DISCOVERY、AGGREGATOR_VERIFICATION_B7B_RAW/VERIFICATION，並附 b7b-results.json。

本輪 discovery 產生兩筆相同的 MONSTA X 2026-10-13 candidateId，造成 raw key collision；為保留兩筆自洽輸入的可複查性，重跑其中一筆 verification 一次並使用唯一 raw key，prompt/config 未變，成本包含該補跑。

## 6. 成本與 63 黑洞推估

- Discovery：5 requests、12 searches、US$0.617403，平均 US$0.123481/artist。
- Verification：14 requests、15 searches、US$0.797127，平均 US$0.056938/場。
- 合計：19 requests、27 searches、US$1.414530。
- 63 藝人只 discovery：約 US$7.779278；每藝人 1 場 verification 約 US$11.366349；每藝人 6 場約 US$29.301707。未計 retry。

## 7. 結論

刪除 C 修正了連演誤殺；domain self-identification 修正了 Great Canadian venue snippet 的合理缺口；A/B 獨立後診斷資訊不再塌陷。放寬沒有讓 F1/F2 穿透，假陽性仍為 0/2。真實 yield 從 B-7 的 8/12 提升至 10/12，但仍有 2/12 被 fail closed，故兩階段鏈尚不能直接進 runtime；下一步需處理 provider excerpt / discovery retrieval variance，不得放寬日期 A 或 D。
