# B-7c binding variance measurement

日期：2026-07-16
分支：feature/b7c-variance-measurement

## Verdict

沿用 B-7b assertion 原封不動，跳過 discovery；固定 14 筆候選各跑 3 次，共 42 個獨立 verification request。真場次 run yield 為 **9/12、9/12、7/12**（範圍 7–9/12）；三次至少一次通過 **9/12**。F1/F2 均 3/3 被拒（6/6），假陽性 0；安全 gate 通過。

## 1. 設定與 assertion

model=claude-sonnet-4-6；web_search_20260209；allowed_callers=["direct"]；max_uses=3；max_tokens=16384；blocked_domains=["kpopofficial.com"]；as_of=2026-07-15。verification prompt 逐字沿用 B-1/B-1a。A 是日期字面比對；B 是 venue literal 或保守 greatcanadian.com domain 自證；D 要求同一 cited_text 同時滿足 A/B。C 不存在。只有 raw CONFIRMED 且 D=true 才 effective CONFIRMED，否則 fail closed。日期接受 ISO、數字斜線/點號、完整或三字母月名（可帶句點）加日年。

## 2. 每筆 3-run 結果

| candidate | run1 | run2 | run3 | pass | domains / run | B way on PASS |
|---|---|---|---|---:|---|---|
| MONSTA X / October 3, 2026 / EagleBank Arena | PASS | PASS | PASS | 3/3 | ticketmaster.com, livenation.com / ticketmaster.com, livenation.com / ticketmaster.com, livenation.com | literal venue name; literal venue name; literal venue name |
| MONSTA X / October 6, 2026 / Infosys Theater at Madison Square Garden | PASS | PASS | PASS | 3/3 | billboard.com, msg.com, livenation.com / billboard.com, msg.com, livenation.com / billboard.com, msg.com, livenation.com | literal venue name; literal venue name; literal venue name |
| MONSTA X / October 8, 2026 / MGM Music Hall at Fenway | FAIL | FAIL | FAIL | 0/3 | ticketmaster.com / ticketmaster.com / ticketmaster.com | — |
| MONSTA X / October 10, 2026 / Great Canadian Toronto | PASS | PASS | PASS | 3/3 | greatcanadian.com, ticketmaster.com / greatcanadian.com, ticketmaster.com / ticketmaster.com, greatcanadian.com | venue domain self-identification; venue domain self-identification; venue domain self-identification |
| MONSTA X / October 13, 2026 / Rosemont Theatre | PASS | PASS | PASS | 3/3 | rosemont.com, ticketmaster.com / rosemont.com, ticketmaster.com / rosemont.com, ticketmaster.com | literal venue name; literal venue name; literal venue name |
| MONSTA X / October 15, 2026 / The Pavilion at Toyota Music Factory | PASS | PASS | PASS | 3/3 | ticketmaster.com, billboard.com / newsroom.livenation.com, ticketmaster.com, billboard.com / ticketmaster.com, billboard.com | literal venue name; literal venue name; literal venue name |
| MONSTA X / October 17, 2026 / Arizona Financial Theatre | PASS | PASS | PASS | 3/3 | ticketmaster.com, thatericalper.com / ticketmaster.com, livenation.com, thatericalper.com / ticketmaster.com, thatericalper.com | literal venue name; literal venue name; literal venue name |
| MONSTA X / October 20, 2026 / Kia Forum | PASS | PASS | PASS | 3/3 | thekiaforum.com, livenation.com / thekiaforum.com, livenation.com / thekiaforum.com, livenation.com | literal venue name; literal venue name; literal venue name |
| MONSTA X / October 22, 2026 / The Theater at Bill Graham Civic Auditorium | PASS | PASS | FAIL | 2/3 | ticketmaster.com, livenation.com / ticketmaster.com, concertaddicts.com / ticketmaster.com | literal venue name; literal venue name |
| MONSTA X / October 24, 2026 / WAMU Theater | PASS | PASS | FAIL | 2/3 | newsroom.livenation.com, wamutheater.com, ticketmaster.com / newsroom.livenation.com, wamutheater.com, ticketmaster.com / wamutheater.com | literal venue name; literal venue name |
| Red Velvet / August 1, 2026 / Korea University Hwajeong Tiger Dome | FAIL | FAIL | FAIL | 0/3 | soompi.com, koreajoongangdaily.com / soompi.com, koreajoongangdaily.com / soompi.com, koreajoongangdaily.com | — |
| Red Velvet / August 2, 2026 / Korea University Hwajeong Tiger Dome | FAIL | FAIL | FAIL | 0/3 | soompi.com, koreatimes.co.kr, koreajoongangdaily.com / soompi.com, koreatimes.co.kr, koreajoongangdaily.com / soompi.com | — |
| MONSTA X / October 25, 2026 / Moda Center | FAIL | FAIL | FAIL | 0/3 | billboard.com, complex.com, rosequarter.com / billboard.com, complex.com, rosequarter.com / billboard.com, complex.com, rosequarter.com | — |
| Red Velvet / August 15, 2026 / Olympic Hall | FAIL | FAIL | FAIL | 0/3 | koreajoongangdaily.com / koreajoongangdaily.com / koreajoongangdaily.com | — |

## 3. 每次 yield、重試效益與安全

| run | 真 yield | F1/F2 放行 | provider_error | cost USD |
|---:|---:|---:|---:|---:|
| 1 | 9/12 | 0/2 | 0 | 0.801159 |
| 2 | 9/12 | 0/2 | 0 | 0.801207 |
| 3 | 7/12 | 0/2 | 0 | 0.796029 |

三次 union 為 9/12；相較單次 9/12，重試救回 0 筆。F1/F2 仍 0/6 放行，故本輪最多支持 3 次獨立重試；更高次數未量測，不能推導其安全性。每次仍須完整通過 B-7b gate，不能因 retry 放寬規則。

## 4. 失敗分類（互斥）

分類依據：同候選其他 run 通過 => retrieval_variance；A/B true 但 D false => 153_char_truncation；無合格 citation => no_qualifying_source；偽造候選 raw CONTRADICTED/UNCONFIRMED => event_does_not_exist。

| candidate | run | raw | A | B | D | classification |
|---|---:|---|---|---|---|---|
| MONSTA X / October 8, 2026 / MGM Music Hall at Fenway | 1 | CONFIRMED | false | false | false | no_qualifying_source |
| Red Velvet / August 1, 2026 / Korea University Hwajeong Tiger Dome | 1 | CONFIRMED | false | false | false | no_qualifying_source |
| Red Velvet / August 2, 2026 / Korea University Hwajeong Tiger Dome | 1 | CONFIRMED | false | false | false | no_qualifying_source |
| MONSTA X / October 25, 2026 / Moda Center | 1 | CONTRADICTED | false | false | false | event_does_not_exist |
| Red Velvet / August 15, 2026 / Olympic Hall | 1 | CONTRADICTED | false | false | false | event_does_not_exist |
| MONSTA X / October 8, 2026 / MGM Music Hall at Fenway | 2 | CONFIRMED | false | false | false | no_qualifying_source |
| Red Velvet / August 1, 2026 / Korea University Hwajeong Tiger Dome | 2 | CONFIRMED | false | false | false | no_qualifying_source |
| Red Velvet / August 2, 2026 / Korea University Hwajeong Tiger Dome | 2 | CONFIRMED | false | true | false | no_qualifying_source |
| MONSTA X / October 25, 2026 / Moda Center | 2 | CONTRADICTED | false | false | false | event_does_not_exist |
| Red Velvet / August 15, 2026 / Olympic Hall | 2 | CONTRADICTED | false | false | false | event_does_not_exist |
| MONSTA X / October 8, 2026 / MGM Music Hall at Fenway | 3 | CONFIRMED | false | false | false | no_qualifying_source |
| MONSTA X / October 22, 2026 / The Theater at Bill Graham Civic Auditorium | 3 | CONFIRMED | false | true | false | retrieval_variance |
| MONSTA X / October 24, 2026 / WAMU Theater | 3 | CONFIRMED | false | false | false | retrieval_variance |
| Red Velvet / August 1, 2026 / Korea University Hwajeong Tiger Dome | 3 | CONFIRMED | false | false | false | no_qualifying_source |
| Red Velvet / August 2, 2026 / Korea University Hwajeong Tiger Dome | 3 | CONFIRMED | false | false | false | no_qualifying_source |
| MONSTA X / October 25, 2026 / Moda Center | 3 | CONTRADICTED | false | false | false | event_does_not_exist |
| Red Velvet / August 15, 2026 / Olympic Hall | 3 | CONTRADICTED | false | false | false | event_does_not_exist |

## 5. Toronto 10/10

三次均取得 greatcanadian.com，三次均通過；B 滿足方式：run1=venue domain self-identification；run2=venue domain self-identification；run3=venue domain self-identification。此目標案例的 venue-domain self-identification 已實際驗證。該 domain 的 URL/title 明確對應 Great Canadian，snippet 含 Monsta X 與 October 10, 2026。

## 6. Citation domain 變異

下表列三次 domain set 與 pairwise Jaccard 平均（1.0 才是兩次完整相同）：

| candidate | run1 | run2 | run3 | Jaccard avg |
|---|---|---|---|---:|
| MONSTA X / October 3, 2026 | ticketmaster.com, livenation.com | ticketmaster.com, livenation.com | ticketmaster.com, livenation.com | 1.000 |
| MONSTA X / October 6, 2026 | billboard.com, msg.com, livenation.com | billboard.com, msg.com, livenation.com | billboard.com, msg.com, livenation.com | 1.000 |
| MONSTA X / October 8, 2026 | ticketmaster.com | ticketmaster.com | ticketmaster.com | 1.000 |
| MONSTA X / October 10, 2026 | greatcanadian.com, ticketmaster.com | greatcanadian.com, ticketmaster.com | ticketmaster.com, greatcanadian.com | 1.000 |
| MONSTA X / October 13, 2026 | rosemont.com, ticketmaster.com | rosemont.com, ticketmaster.com | rosemont.com, ticketmaster.com | 1.000 |
| MONSTA X / October 15, 2026 | ticketmaster.com, billboard.com | newsroom.livenation.com, ticketmaster.com, billboard.com | ticketmaster.com, billboard.com | 0.778 |
| MONSTA X / October 17, 2026 | ticketmaster.com, thatericalper.com | ticketmaster.com, livenation.com, thatericalper.com | ticketmaster.com, thatericalper.com | 0.778 |
| MONSTA X / October 20, 2026 | thekiaforum.com, livenation.com | thekiaforum.com, livenation.com | thekiaforum.com, livenation.com | 1.000 |
| MONSTA X / October 22, 2026 | ticketmaster.com, livenation.com | ticketmaster.com, concertaddicts.com | ticketmaster.com | 0.444 |
| MONSTA X / October 24, 2026 | newsroom.livenation.com, wamutheater.com, ticketmaster.com | newsroom.livenation.com, wamutheater.com, ticketmaster.com | wamutheater.com | 0.556 |
| Red Velvet / August 1, 2026 | soompi.com, koreajoongangdaily.com | soompi.com, koreajoongangdaily.com | soompi.com, koreajoongangdaily.com | 1.000 |
| Red Velvet / August 2, 2026 | soompi.com, koreatimes.co.kr, koreajoongangdaily.com | soompi.com, koreatimes.co.kr, koreajoongangdaily.com | soompi.com | 0.556 |
| MONSTA X / October 25, 2026 | billboard.com, complex.com, rosequarter.com | billboard.com, complex.com, rosequarter.com | billboard.com, complex.com, rosequarter.com | 1.000 |
| Red Velvet / August 15, 2026 | koreajoongangdaily.com | koreajoongangdaily.com | koreajoongangdaily.com | 1.000 |

## 7. 每則 citation 原文（raw 直接抽取）

以下 URL/title/cited_text 均由各 run raw JSON 的 citation object 直接輸出，沒有手打或補完；provider 的截斷符號原樣保留。

### run1 — MONSTA X / October 3, 2026 / EagleBank Arena
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-fairfax-virginia-10-03-2026/event/15006482B90BDA55
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX Tickets Oct 03, 2026 Fairfax, VA | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX tickets at the EagleBank Arena in Fairfax, VA for Oct 03, 2026 at Ticketmaster.\n\n"
- URL: https://www.livenation.com/event/1A4Zk3eGkeyeWt4/2026-monsta-x-world-tour-the-x-nexus-in-fairfax
  Title: 2026 monsta x world tour [the x : nexus] in fairfax
  cited_text: "EagleBank Arena · Fairfax, VA · Buy Tickets · MONSTA X ·"

### run1 — MONSTA X / October 6, 2026 / Infosys Theater at Madison Square Garden
- URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
  Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
  cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] NORTH AMERICA DATES: Oct. 3: Fairfax, Va. @ EagleBank Arena · Oct. 6: New York, N.Y. @ Infosys Theater at Mad..."
- URL: https://www.msg.com/events-tickets/monsta-x-infosys-theater-at-madison-square-garden-october-2026/3B00647BF0495307
  Title: MONSTA X | KPOP Concerts | Infosys Theater at MSG
  cited_text: "Get tickets to see 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NEW YORK come to the Infosys Theater at MSG on October 6, 2026.\n\n2026 MONSTA X WORLD TO..."
- URL: https://www.livenation.com/event/G5diZ_6RY34G6/2026-monsta-x-world-tour-the-x-nexus-in-new-york
  Title: 2026 monsta x world tour [the x : nexus] in new york
  cited_text: "Tue Oct 6, 2026 ▪︎ 8 PM · Infosys Theater at Madison Square Garden · New York, NY · Buy Tickets · MONSTA X ·"

### run1 — MONSTA X / October 8, 2026 / MGM Music Hall at Fenway
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NORTH AMERICA DATES: Sat Oct 3 - Fairfax, VA - EagleBank Arena · Tue Oct 6 - New York, NY - Infosys Theate..."

### run1 — MONSTA X / October 10, 2026 / Great Canadian Toronto
- URL: https://greatcanadian.com/event/2026-monsta-x/
  Title: Monsta X - Great Canadian Casino Resort Toronto
  cited_text: "Get ready for a night of explosive energy and global K-pop dominance as Monsta X takes the stage October 10, 2026!\n\n"
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "Parking: WAMU Theater MONSTA X · Venue · WAMU Theater · October 10, 2026 · Oct10 · Saturday 08:00 PMSat8:00 PMOpen additional information for Toronto,..."

### run1 — MONSTA X / October 13, 2026 / Rosemont Theatre
- URL: https://rosemont.com/theatre/event/2026-monsta-x-world-tour-the-x-nexus-in-rosemont/
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT – Rosemont Theatre
  cited_text: "Tuesday, October 13, 2026 · GET TICKETS · Parking is available close to all entrances of the Rosemont Theatre. "
- URL: https://rosemont.com/theatre/event/2026-monsta-x-world-tour-the-x-nexus-in-rosemont/
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT – Rosemont Theatre
  cited_text: "5400 N. River Road Rosemont, IL 60018 ...\n\nTuesday, October 13, 2026 · GET TICKETS · Parking is available close to all entrances of the Rosemont Theat..."
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "Truly Rooftop Pre-Show Access: ... Rosemont, IL, Rosemont Theatre, 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT10/13/26, 8:00 PMRosemont, ILRo..."

### run1 — MONSTA X / October 15, 2026 / The Pavilion at Toyota Music Factory
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-irving-texas-10-15-2026/event/0C00648398F88E02
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING Tickets Oct 15, 2026 Irving, TX | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING tickets at the The Pavilion at Toyota Music Factory in Irving, TX for Oct 15, 2026 at Ticketmas..."
- URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
  Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
  cited_text: "10: Toronto, ON @ Great Canadian Toronto · Oct. 13: Rosemont, Ill. @ Rosemont Theatre · Oct. 15: Irving, Texas @ The Pavilion at Toyota Music Factory ..."

### run1 — MONSTA X / October 17, 2026 / Arizona Financial Theatre
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-phoenix-arizona-10-17-2026/event/19006483BC7DB50C
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX Tickets Oct 17, 2026 Phoenix, AZ | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX tickets at the Arizona Financial Theatre in Phoenix, AZ for Oct 17, 2026 at Ticketmaster.\n\n"
- URL: https://www.thatericalper.com/2026/04/07/monsta-x-bring-their-world-tour-to-north-america-this-fall-with-10-arena-dates/
  Title: Monsta X Bring Their World Tour to North America This Fall With 10 Arena Dates - That Eric Alper
  cited_text: "2026 Monsta X World Tour, The X: ... Theatre · October 15 — Irving, TX — The Pavilion at Toyota Music Factory · October 17 — Phoenix, AZ — Arizona Fin..."
- URL: https://www.thatericalper.com/2026/04/07/monsta-x-bring-their-world-tour-to-north-america-this-fall-with-10-arena-dates/
  Title: Monsta X Bring Their World Tour to North America This Fall With 10 Arena Dates - That Eric Alper
  cited_text: "The 2026 Monsta X World Tour, The X: Nexus, hits 10 cities across the continent this fall, promoted by Live Nation, kicking off October 3 at EagleBank..."

### run1 — MONSTA X / October 20, 2026 / Kia Forum
- URL: https://thekiaforum.com/event/monsta-x/
  Title: MONSTA X - Kia Forum
  cited_text: "October 20 · 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN LOS ANGELES · Tickets PARKING · EVENT PARKING · Prepaid parking is available at the Kia Forum..."
- URL: https://www.livenation.com/event/vv1AaZk3vGkdfJcBD/2026-monsta-x-world-tour-the-x-nexus-in-los-angeles
  Title: 2026 monsta x world tour [the x : nexus] in los angeles
  cited_text: "Tue Oct 20, 2026 ▪︎ 8 PM · Kia Forum · Inglewood, CA · Buy Tickets · MONSTA X ·"

### run1 — MONSTA X / October 22, 2026 / The Theater at Bill Graham Civic Auditorium
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-san-francisco-california-10-22-2026/event/1C006483CF0D29E6
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SAN FRANCISCO Tickets Oct 22, 2026 San Francisco, CA | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SAN FRANCISCO tickets at the The Theater at Bill Graham Civic Auditorium in San Francisco, CA for Oct ..."
- URL: https://www.livenation.com/event/G5vYZ_F22d3EJ/2026-monsta-x-world-tour-the-x-nexus-in-san-francisco
  Title: 2026 monsta x world tour [the x : nexus] in san francisco
  cited_text: "Thu Oct 22, 2026 ▪︎ 8PM · The Theater at Bill Graham Civic Auditorium · San Francisco, CA · Buy Tickets · MONSTA X ·"

### run1 — MONSTA X / October 24, 2026 / WAMU Theater
- URL: https://newsroom.livenation.com/news/global-superstars-monsta-x-announce-north-american-dates-on-world-tour-the-x-nexus/
  Title: Global Superstars MONSTA X Announce North American Dates on WORLD TOUR [THE X : NEXUS] - Live Nation Newsroom
  cited_text: "Promoted by Live Nation, the newly added shows kick off Saturday, October 3 in Fairfax, VA at EagleBank Arena, with stops in New York, Boston, Toronto..."
- URL: https://www.wamutheater.com/events/monsta-x-2026
  Title: MONSTA X at WAMU Theater | WAMU Theater - WAMUTheater.com
  cited_text: "WAMU Theater 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SEATTLE / Get Tickets\n\nThe 2026 MONSTA X WORLD TOUR [THE X : NEXUS] is coming to WAMU Theater..."
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-seattle-washington-10-24-2026/event/0F006482D94050A3
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SEATTLE Tickets Oct 24, 2026 Seattle, WA | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SEATTLE tickets at the WAMU Theater in Seattle, WA for Oct 24, 2026 at Ticketmaster.\n\n"

### run1 — Red Velvet / August 1, 2026 / Korea University Hwajeong Tiger Dome
- URL: https://www.soompi.com/article/1847788wpp/red-velvet-announces-2026-fan-con-a-day-in-red-velvet-following-august-comeback-news
  Title: Red Velvet Announces 2026 Fan-Con “A Day In Red & Velvet” Following August Comeback News | Soompi
  cited_text: "On June 15, the group revealed a poster announcing the schedule for “2026 Red Velvet FAN-CON ‘A Day in Red & Velvet.’” The fan-con will take place at ..."
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "SM Entertainment also released ticket sale details for the group's 12th anniversary event.\n\n"

### run1 — Red Velvet / August 2, 2026 / Korea University Hwajeong Tiger Dome
- URL: https://www.soompi.com/article/1847788wpp/red-velvet-announces-2026-fan-con-a-day-in-red-velvet-following-august-comeback-news
  Title: Red Velvet Announces 2026 Fan-Con “A Day In Red & Velvet” Following August Comeback News | Soompi
  cited_text: "On June 15, the group revealed a poster announcing the schedule for “2026 Red Velvet FAN-CON ‘A Day in Red & Velvet.’” The fan-con will take place at ..."
- URL: https://www.koreatimes.co.kr/entertainment/k-pop/20260616/red-velvet-sets-august-return-ending-2-year-wait-for-full-group-comeback
  Title: Red Velvet sets August return, ending 2-year wait for full group comeback - The Korea Times
  cited_text: "The company also unveiled details Sunday for “2026 Red Velvet FAN-CON 'A Day in Red & Velvet,'” a two-day event that will bring the group together wit..."
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "While details of the new album have not yet been disclosed, the group unveiled a poster and schedule for its fan concert, titled “2026 Red Velvet Fan-..."

### run1 — MONSTA X / October 25, 2026 / Moda Center
- URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
  Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
  cited_text: "Starting at the EagleBank Arena in Fairfax, Va., on Oct. 3, the group will play dates across the two countries before wrapping on Oct. 24 at the WAMU ..."
- URL: https://www.complex.com/music/a/backwoodsaltar/monsta-x-2026-north-american-tour-dates
  Title: K-Pop Superstars Monsta X Announce 2026 North American Tour Dates
  cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] NORTH AMERICA DATES: Sat Oct 3 – Fairfax, VA – EagleBank Arena Tue Oct 6 – New York, NY – Infosys Theater at ..."
- URL: https://www.rosequarter.com/events/event-calendar
  Title: Rose Quarter - Event Calendar
  cited_text: "October 1, 2026 · / 8:00 pm · Time: TBD · 2026-10-01 · tickets · tickets · Oct · 2 · date · TBD · Multiple dates · Date: TBD · Starts: Fri · . Oct 2, ..."

### run1 — Red Velvet / August 15, 2026 / Olympic Hall
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "Girl group Red Velvet will return with a new album and a fan concert in August, its agency SM Entertainment announced on Monday. "
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "The fan concert will take place at the Tiger Dome gymnasium at Korea University in northern Seoul at 6 p.m. on Aug. 1 and at 4 p.m. on Aug. 2. "

### run2 — MONSTA X / October 3, 2026 / EagleBank Arena
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-fairfax-virginia-10-03-2026/event/15006482B90BDA55
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX Tickets Oct 03, 2026 Fairfax, VA | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX tickets at the EagleBank Arena in Fairfax, VA for Oct 03, 2026 at Ticketmaster.\n\n"
- URL: https://www.livenation.com/event/1A4Zk3eGkeyeWt4/2026-monsta-x-world-tour-the-x-nexus-in-fairfax
  Title: 2026 monsta x world tour [the x : nexus] in fairfax
  cited_text: "EagleBank Arena · Fairfax, VA · Buy Tickets · MONSTA X ·"

### run2 — MONSTA X / October 6, 2026 / Infosys Theater at Madison Square Garden
- URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
  Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
  cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] NORTH AMERICA DATES: Oct. 3: Fairfax, Va. @ EagleBank Arena · Oct. 6: New York, N.Y. @ Infosys Theater at Mad..."
- URL: https://www.msg.com/events-tickets/monsta-x-infosys-theater-at-madison-square-garden-october-2026/3B00647BF0495307
  Title: MONSTA X | KPOP Concerts | Infosys Theater at MSG
  cited_text: "Get tickets to see 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NEW YORK come to the Infosys Theater at MSG on October 6, 2026.\n\n2026 MONSTA X WORLD TO..."
- URL: https://www.livenation.com/event/G5diZ_6RY34G6/2026-monsta-x-world-tour-the-x-nexus-in-new-york
  Title: 2026 monsta x world tour [the x : nexus] in new york
  cited_text: "Tue Oct 6, 2026 ▪︎ 8 PM · Infosys Theater at Madison Square Garden · New York, NY · Buy Tickets · MONSTA X ·"

### run2 — MONSTA X / October 8, 2026 / MGM Music Hall at Fenway
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NORTH AMERICA DATES: Sat Oct 3 - Fairfax, VA - EagleBank Arena · Tue Oct 6 - New York, NY - Infosys Theate..."

### run2 — MONSTA X / October 10, 2026 / Great Canadian Toronto
- URL: https://greatcanadian.com/event/2026-monsta-x/
  Title: Monsta X - Great Canadian Casino Resort Toronto
  cited_text: "Get ready for a night of explosive energy and global K-pop dominance as Monsta X takes the stage October 10, 2026!\n\n"
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "Parking: WAMU Theater MONSTA X · Venue · WAMU Theater · October 10, 2026 · Oct10 · Saturday 08:00 PMSat8:00 PMOpen additional information for Toronto,..."

### run2 — MONSTA X / October 13, 2026 / Rosemont Theatre
- URL: https://rosemont.com/theatre/event/2026-monsta-x-world-tour-the-x-nexus-in-rosemont/
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT – Rosemont Theatre
  cited_text: "Tuesday, October 13, 2026 · GET TICKETS · Parking is available close to all entrances of the Rosemont Theatre. "
- URL: https://rosemont.com/theatre/event/2026-monsta-x-world-tour-the-x-nexus-in-rosemont/
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT – Rosemont Theatre
  cited_text: "5400 N. River Road Rosemont, IL 60018 · © 2026 Rosemont Theatre."
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "Truly Rooftop Pre-Show Access: ... Rosemont, IL, Rosemont Theatre, 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT10/13/26, 8:00 PMRosemont, ILRo..."

### run2 — MONSTA X / October 15, 2026 / The Pavilion at Toyota Music Factory
- URL: https://newsroom.livenation.com/news/global-superstars-monsta-x-announce-north-american-dates-on-world-tour-the-x-nexus/
  Title: Global Superstars MONSTA X Announce North American Dates on WORLD TOUR [THE X : NEXUS] - Live Nation Newsroom
  cited_text: "2026 MONSTA X WORLD TOUR [THE X ... 13 – Rosemont, IL – Rosemont Theatre · Thu Oct 15 – Irving, TX – The Pavilion at Toyota Music Factory · Sat Oct 17..."
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-irving-texas-10-15-2026/event/0C00648398F88E02
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING Tickets Oct 15, 2026 Irving, TX | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING tickets at the The Pavilion at Toyota Music Factory in Irving, TX for Oct 15, 2026 at Ticketmas..."
- URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
  Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
  cited_text: "@ MGM Music Hall at Fenway · Oct. 10: Toronto, ON @ Great Canadian Toronto · Oct. 13: Rosemont, Ill. @ Rosemont Theatre · Oct. 15: Irving, Texas @ The..."

### run2 — MONSTA X / October 17, 2026 / Arizona Financial Theatre
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-phoenix-arizona-10-17-2026/event/19006483BC7DB50C
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX Tickets Oct 17, 2026 Phoenix, AZ | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX tickets at the Arizona Financial Theatre in Phoenix, AZ for Oct 17, 2026 at Ticketmaster.\n\nSat..."
- URL: https://www.livenation.com/event/1A_Zk3dGkeHLhfG/2026-monsta-x-world-tour-the-x-nexus-in-phoenix
  Title: 2026 monsta x world tour [the x : nexus] in phoenix
  cited_text: "Arizona Financial Theatre · Phoenix, AZ · Buy Tickets · Premier Parking - MONSTA X - Not a Concert TicketBuy Upgrade · Fast Lane Pass - MONSTA X - Not..."
- URL: https://www.thatericalper.com/2026/04/07/monsta-x-bring-their-world-tour-to-north-america-this-fall-with-10-arena-dates/
  Title: Monsta X Bring Their World Tour to North America This Fall With 10 Arena Dates - That Eric Alper
  cited_text: "2026 Monsta X World Tour, The X: ... Theatre · October 15 — Irving, TX — The Pavilion at Toyota Music Factory · October 17 — Phoenix, AZ — Arizona Fin..."
- URL: https://www.thatericalper.com/2026/04/07/monsta-x-bring-their-world-tour-to-north-america-this-fall-with-10-arena-dates/
  Title: Monsta X Bring Their World Tour to North America This Fall With 10 Arena Dates - That Eric Alper
  cited_text: "The 2026 Monsta X World Tour, The X: Nexus, hits 10 cities across the continent this fall, promoted by Live Nation, kicking off October 3 at EagleBank..."

### run2 — MONSTA X / October 20, 2026 / Kia Forum
- URL: https://thekiaforum.com/event/monsta-x/
  Title: MONSTA X - Kia Forum
  cited_text: "October 20 · 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN LOS ANGELES · Tickets PARKING · EVENT PARKING · Prepaid parking is available at the Kia Forum..."
- URL: https://www.livenation.com/event/vv1AaZk3vGkdfJcBD/2026-monsta-x-world-tour-the-x-nexus-in-los-angeles
  Title: 2026 monsta x world tour [the x : nexus] in los angeles
  cited_text: "Tue Oct 20, 2026 ▪︎ 8 PM · Kia Forum · Inglewood, CA · Buy Tickets · MONSTA X ·"

### run2 — MONSTA X / October 22, 2026 / The Theater at Bill Graham Civic Auditorium
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-san-francisco-california-10-22-2026/event/1C006483CF0D29E6
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SAN FRANCISCO Tickets Oct 22, 2026 San Francisco, CA | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SAN FRANCISCO tickets at the The Theater at Bill Graham Civic Auditorium in San Francisco, CA for Oct ..."
- URL: https://www.concertaddicts.com/new/concert-event-listings/usa/n-california-n-nevada/monsta-x--the-theater-at-bill-graham-civic-auditorium--2026-10-22--G5vYZ_F22d3EJ
  Title: MONSTA X Tickets – San Francisco, CA | Oct 22, 2026 | The Theater at Bill Graham Civic Auditorium
  cited_text: "The Theater at Bill Graham Civic Auditorium · • San Francisco California • Oct 22, 2026 On Sale · On Sale: Apr 14, 2026 3:00 PM PDT · Presale ends: Oc..."

### run2 — MONSTA X / October 24, 2026 / WAMU Theater
- URL: https://newsroom.livenation.com/news/global-superstars-monsta-x-announce-north-american-dates-on-world-tour-the-x-nexus/
  Title: Global Superstars MONSTA X Announce North American Dates on WORLD TOUR [THE X : NEXUS] - Live Nation Newsroom
  cited_text: "Promoted by Live Nation, the newly added shows kick off Saturday, October 3 in Fairfax, VA at EagleBank Arena, with stops in New York, Boston, Toronto..."
- URL: https://www.wamutheater.com/events/monsta-x-2026
  Title: MONSTA X at WAMU Theater | WAMU Theater - WAMUTheater.com
  cited_text: "WAMU Theater 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SEATTLE / Get Tickets\n\nThe 2026 MONSTA X WORLD TOUR [THE X : NEXUS] is coming to WAMU Theater..."
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-seattle-washington-10-24-2026/event/0F006482D94050A3
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SEATTLE Tickets Oct 24, 2026 Seattle, WA | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SEATTLE tickets at the WAMU Theater in Seattle, WA for Oct 24, 2026 at Ticketmaster.\n\n"

### run2 — Red Velvet / August 1, 2026 / Korea University Hwajeong Tiger Dome
- URL: https://www.soompi.com/article/1847788wpp/red-velvet-announces-2026-fan-con-a-day-in-red-velvet-following-august-comeback-news
  Title: Red Velvet Announces 2026 Fan-Con “A Day In Red & Velvet” Following August Comeback News | Soompi
  cited_text: "On June 15, the group revealed a poster announcing the schedule for “2026 Red Velvet FAN-CON ‘A Day in Red & Velvet.’” The fan-con will take place at ..."
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "SM Entertainment also released ticket sale details for the group's 12th anniversary event.\n\n"

### run2 — Red Velvet / August 2, 2026 / Korea University Hwajeong Tiger Dome
- URL: https://www.soompi.com/article/1847788wpp/red-velvet-announces-2026-fan-con-a-day-in-red-velvet-following-august-comeback-news
  Title: Red Velvet Announces 2026 Fan-Con “A Day In Red & Velvet” Following August Comeback News | Soompi
  cited_text: "On June 15, the group revealed a poster announcing the schedule for “2026 Red Velvet FAN-CON ‘A Day in Red & Velvet.’” The fan-con will take place at ..."
- URL: https://www.koreatimes.co.kr/entertainment/k-pop/20260616/red-velvet-sets-august-return-ending-2-year-wait-for-full-group-comeback
  Title: Red Velvet sets August return, ending 2-year wait for full group comeback - The Korea Times
  cited_text: "The company also unveiled details Sunday for “2026 Red Velvet FAN-CON 'A Day in Red & Velvet,'” a two-day event that will bring the group together wit..."
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "The fan concert will take place at the Tiger Dome gymnasium at Korea University in northern Seoul at 6 p.m. on Aug. 1 and at 4 p.m. on Aug. 2. "

### run2 — MONSTA X / October 25, 2026 / Moda Center
- URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
  Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
  cited_text: "Starting at the EagleBank Arena in Fairfax, Va., on Oct. 3, the group will play dates across the two countries before wrapping on Oct. 24 at the WAMU ..."
- URL: https://www.complex.com/music/a/backwoodsaltar/monsta-x-2026-north-american-tour-dates
  Title: K-Pop Superstars Monsta X Announce 2026 North American Tour Dates
  cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] NORTH AMERICA DATES: Sat Oct 3 – Fairfax, VA – EagleBank Arena Tue Oct 6 – New York, NY – Infosys Theater at ..."
- URL: https://www.rosequarter.com/events/event-calendar
  Title: Rose Quarter - Event Calendar
  cited_text: "October 1, 2026 · / 8:00 pm · Time: TBD · 2026-10-01 · tickets · tickets · Oct · 2 · date · TBD · Multiple dates · Date: TBD · Starts: Fri · . Oct 2, ..."

### run2 — Red Velvet / August 15, 2026 / Olympic Hall
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "Girl group Red Velvet will return with a new album and a fan concert in August, its agency SM Entertainment announced on Monday. "
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "While details of the new album have not yet been disclosed, the group unveiled a poster and schedule for its fan concert, titled “2026 Red Velvet Fan-..."
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "Girl group Red Velvet will return with a new album and a fan concert in August, its agency SM Entertainment announced on Monday. "
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "The fan concert will take place at the Tiger Dome gymnasium at Korea University in northern Seoul at 6 p.m. on Aug. 1 and at 4 p.m. on Aug. 2. "

### run3 — MONSTA X / October 3, 2026 / EagleBank Arena
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-fairfax-virginia-10-03-2026/event/15006482B90BDA55
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX Tickets Oct 03, 2026 Fairfax, VA | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN FAIRFAX tickets at the EagleBank Arena in Fairfax, VA for Oct 03, 2026 at Ticketmaster.\n\n"
- URL: https://www.livenation.com/event/1A4Zk3eGkeyeWt4/2026-monsta-x-world-tour-the-x-nexus-in-fairfax
  Title: 2026 monsta x world tour [the x : nexus] in fairfax
  cited_text: "EagleBank Arena · Fairfax, VA · Buy Tickets · MONSTA X ·"

### run3 — MONSTA X / October 6, 2026 / Infosys Theater at Madison Square Garden
- URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
  Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
  cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] NORTH AMERICA DATES: Oct. 3: Fairfax, Va. @ EagleBank Arena · Oct. 6: New York, N.Y. @ Infosys Theater at Mad..."
- URL: https://www.msg.com/events-tickets/monsta-x-infosys-theater-at-madison-square-garden-october-2026/3B00647BF0495307
  Title: MONSTA X | KPOP Concerts | Infosys Theater at MSG
  cited_text: "Get tickets to see 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NEW YORK come to the Infosys Theater at MSG on October 6, 2026.\n\n2026 MONSTA X WORLD TO..."
- URL: https://www.livenation.com/event/G5diZ_6RY34G6/2026-monsta-x-world-tour-the-x-nexus-in-new-york
  Title: 2026 monsta x world tour [the x : nexus] in new york
  cited_text: "Tue Oct 6, 2026 ▪︎ 8 PM · Infosys Theater at Madison Square Garden · New York, NY · Buy Tickets · MONSTA X ·"

### run3 — MONSTA X / October 8, 2026 / MGM Music Hall at Fenway
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN NORTH AMERICA DATES: Sat Oct 3 - Fairfax, VA - EagleBank Arena · Tue Oct 6 - New York, NY - Infosys Theate..."

### run3 — MONSTA X / October 10, 2026 / Great Canadian Toronto
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "Parking: WAMU Theater MONSTA X · Venue · WAMU Theater · October 10, 2026 · Oct10 · Saturday 08:00 PMSat8:00 PMOpen additional information for Toronto,..."
- URL: https://greatcanadian.com/event/2026-monsta-x/
  Title: Monsta X - Great Canadian Casino Resort Toronto
  cited_text: "Get ready for a night of explosive energy and global K-pop dominance as Monsta X takes the stage October 10, 2026!\n\n"
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "Parking: WAMU Theater MONSTA X · Venue · WAMU Theater · October 10, 2026 · Oct10 · Saturday 08:00 PMSat8:00 PMOpen additional information for Toronto,..."

### run3 — MONSTA X / October 13, 2026 / Rosemont Theatre
- URL: https://rosemont.com/theatre/event/2026-monsta-x-world-tour-the-x-nexus-in-rosemont/
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT – Rosemont Theatre
  cited_text: "Tuesday, October 13, 2026 · GET TICKETS · Parking is available close to all entrances of the Rosemont Theatre. "
- URL: https://rosemont.com/theatre/event/2026-monsta-x-world-tour-the-x-nexus-in-rosemont/
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT – Rosemont Theatre
  cited_text: "5400 N. River Road Rosemont, IL 60018 · © 2026 Rosemont Theatre."
- URL: https://www.ticketmaster.com/monsta-x-tickets/artist/2371302
  Title: MONSTA X Tickets, 2026-2027 Concert Tour Dates | Ticketmaster
  cited_text: "Truly Rooftop Pre-Show Access: ... Rosemont, IL, Rosemont Theatre, 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN ROSEMONT10/13/26, 8:00 PMRosemont, ILRo..."

### run3 — MONSTA X / October 15, 2026 / The Pavilion at Toyota Music Factory
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-irving-texas-10-15-2026/event/0C00648398F88E02
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING Tickets Oct 15, 2026 Irving, TX | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN IRVING tickets at the The Pavilion at Toyota Music Factory in Irving, TX for Oct 15, 2026 at Ticketmas..."
- URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
  Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
  cited_text: "@ MGM Music Hall at Fenway · Oct. 10: Toronto, ON @ Great Canadian Toronto · Oct. 13: Rosemont, Ill. @ Rosemont Theatre · Oct. 15: Irving, Texas @ The..."

### run3 — MONSTA X / October 17, 2026 / Arizona Financial Theatre
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-phoenix-arizona-10-17-2026/event/19006483BC7DB50C
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX Tickets Oct 17, 2026 Phoenix, AZ | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN PHOENIX tickets at the Arizona Financial Theatre in Phoenix, AZ for Oct 17, 2026 at Ticketmaster.\n\n"
- URL: https://www.thatericalper.com/2026/04/07/monsta-x-bring-their-world-tour-to-north-america-this-fall-with-10-arena-dates/
  Title: Monsta X Bring Their World Tour to North America This Fall With 10 Arena Dates - That Eric Alper
  cited_text: "2026 Monsta X World Tour, The X: ... Theatre · October 15 — Irving, TX — The Pavilion at Toyota Music Factory · October 17 — Phoenix, AZ — Arizona Fin..."
- URL: https://www.thatericalper.com/2026/04/07/monsta-x-bring-their-world-tour-to-north-america-this-fall-with-10-arena-dates/
  Title: Monsta X Bring Their World Tour to North America This Fall With 10 Arena Dates - That Eric Alper
  cited_text: "The 2026 Monsta X World Tour, The X: Nexus, hits 10 cities across the continent this fall, promoted by Live Nation, kicking off October 3 at EagleBank..."

### run3 — MONSTA X / October 20, 2026 / Kia Forum
- URL: https://thekiaforum.com/event/monsta-x/
  Title: MONSTA X - Kia Forum
  cited_text: "October 20 · 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN LOS ANGELES · Tickets PARKING · EVENT PARKING · Prepaid parking is available at the Kia Forum..."
- URL: https://www.livenation.com/event/vv1AaZk3vGkdfJcBD/2026-monsta-x-world-tour-the-x-nexus-in-los-angeles
  Title: 2026 monsta x world tour [the x : nexus] in los angeles
  cited_text: "Tue Oct 20, 2026 ▪︎ 8 PM · Kia Forum · Inglewood, CA · Buy Tickets · MONSTA X ·"

### run3 — MONSTA X / October 22, 2026 / The Theater at Bill Graham Civic Auditorium
- URL: https://www.ticketmaster.com/2026-monsta-x-world-tour-the-san-francisco-california-10-22-2026/event/1C006483CF0D29E6
  Title: 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SAN FRANCISCO Tickets Oct 22, 2026 San Francisco, CA | Ticketmaster
  cited_text: "Buy 2026 MONSTA X WORLD TOUR [THE X : NEXUS] IN SAN FRANCISCO tickets at the The Theater at Bill Graham Civic Auditorium in San Francisco, CA for Oct ..."

### run3 — MONSTA X / October 24, 2026 / WAMU Theater
- URL: https://www.wamutheater.com/venue-info-news/monsta-x-2026
  Title: WAMU Theater News: GLOBAL SUPERSTARS MONSTA X ANNOUNCE NORTH AMERICAN DATES ON WORLD TOUR [THE X : NEXUS] | WAMU Theater - WAMUTheater.com
  cited_text: "Global superstars MONSTA X today announced North American dates on their 2026 MONSTA X WORLD TOUR [THE X : NEXUS]. Promoted by Live Nation, the newly ..."

### run3 — Red Velvet / August 1, 2026 / Korea University Hwajeong Tiger Dome
- URL: https://www.soompi.com/article/1847788wpp/red-velvet-announces-2026-fan-con-a-day-in-red-velvet-following-august-comeback-news
  Title: Red Velvet Announces 2026 Fan-Con “A Day In Red & Velvet” Following August Comeback News | Soompi
  cited_text: "On June 15, the group revealed a poster announcing the schedule for “2026 Red Velvet FAN-CON ‘A Day in Red & Velvet.’” The fan-con will take place at ..."
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "SM Entertainment also released ticket sale details for the group's 12th anniversary event.\n\n"

### run3 — Red Velvet / August 2, 2026 / Korea University Hwajeong Tiger Dome
- URL: https://www.soompi.com/article/1847788wpp/red-velvet-announces-2026-fan-con-a-day-in-red-velvet-following-august-comeback-news
  Title: Red Velvet Announces 2026 Fan-Con “A Day In Red & Velvet” Following August Comeback News | Soompi
  cited_text: "On June 15, the group revealed a poster announcing the schedule for “2026 Red Velvet FAN-CON ‘A Day in Red & Velvet.’” The fan-con will take place at ..."

### run3 — MONSTA X / October 25, 2026 / Moda Center
- URL: https://www.billboard.com/music/concerts/monsta-x-2026-the-x-nexus-world-tour-dates-north-america-1236215603/
  Title: Monsta X 'THE X : NEXUS' 2026 World Tour North America Dates
  cited_text: "Starting at the EagleBank Arena in Fairfax, Va., on Oct. 3, the group will play dates across the two countries before wrapping on Oct. 24 at the WAMU ..."
- URL: https://www.complex.com/music/a/backwoodsaltar/monsta-x-2026-north-american-tour-dates
  Title: K-Pop Superstars Monsta X Announce 2026 North American Tour Dates
  cited_text: "2026 MONSTA X WORLD TOUR [THE X : NEXUS] NORTH AMERICA DATES: Sat Oct 3 – Fairfax, VA – EagleBank Arena Tue Oct 6 – New York, NY – Infosys Theater at ..."
- URL: https://www.rosequarter.com/events/event-calendar
  Title: Rose Quarter - Event Calendar
  cited_text: "October 1, 2026 · / 8:00 pm · Time: TBD · 2026-10-01 · tickets · tickets · Oct · 2 · date · TBD · Multiple dates · Date: TBD · Starts: Fri · . Oct 2, ..."

### run3 — Red Velvet / August 15, 2026 / Olympic Hall
- URL: https://www.koreajoongangdaily.com/entertainment/girl-group-red-velvet-to-return-with-new-album-fan-concert-in-august/12723807
  Title: Girl group Red Velvet to return with new album, fan concert in August
  cited_text: "While details of the new album have not yet been disclosed, the group unveiled a poster and schedule for its fan concert, titled “2026 Red Velvet Fan-..."

## 8. Raw 引文與成本

所有 cited_text 由 raw citation object 直接抽出，截斷原樣保留；報告引文與 raw JSON 完全比對：**98/98 matched**。raw 依 run 存於 AGGREGATOR_VERIFICATION_B7C_RAW/RUN1–RUN3，附 results.json。

42 requests、45 searches；實算總成本 **US$2.398395**，平均 US$0.057105/run、US$0.171314/場（三次）。63 位藝人各 discovery 產出 1 場、每場三次 verification 粗估 US$10.792778，未含 discovery。

## 9. 結論

固定候選仍呈現檢索變異：單次 yield 9–10/12，三次 union 9/12；來源 domain 也逐場變動。3 次重試在本樣本救回部分真場次，且 F1/F2 6/6 全拒。建議 runtime 最多 3 次獨立 verification，未通過則 fail closed；本報告不放寬任何規則、不直接授權 runtime。
