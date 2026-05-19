# Source Inventory A - K-pop Official Sources

> Scope: research only. No crawler, no DB write, no migration.
>
> Date: 2026-05-19
>
> Purpose: decide the next safe order for M1b-3 artist seed and crawler work
> orders. "Source unknown" below means the official public source was not
> confirmed in this pass. It does not mean the artist is inactive.

---

## Executive Summary

- Existing active idols checked from Supabase: 55
- M1b-3 seed candidates covered: 16
- Big-group solo / subunit candidates covered: 18
- Source entries reviewed: 34
- Best P0 crawler candidates:
  1. JYP artist schedule pages, extending existing `jyp_schedule`
  2. YG artist schedule pages, extending existing BLACKPINK parser pattern
  3. WAKEONE notice
  4. SMTOWN notice/newsroom plus SM artist profile
  5. Weverse Notice / Calendar, pending technical probe
- Do not crawl automatically:
  - copyrighted profile images from official sites
  - login-only fan club pages
  - paid/member-only Weverse media
  - SNS-only timelines unless an explicit API strategy is approved

## Source Family Catalog

| source family | URL | type | login required | feasibility | priority | notes |
|---|---|---|---|---|---|---|
| JYP artist schedule | https://twice.jype.com/Mobile/Schedule | official site | no | high | P0 | Existing parser already handles JYP schedule JSON/config. Extend per artist. |
| JYP artist schedule | https://straykids.jype.com/Mobile/Schedule | official site | no | high | P0 | Existing source. |
| JYP artist schedule | https://itzy.jype.com/Mobile/Schedule | official site | no | high | P0 | Existing source. |
| JYP artist schedule | https://nmixx.jype.com/Mobile/Schedule | official site | no | high | P0 | Existing source. |
| JYP artist schedule | https://day6.jype.com/Mobile/Schedule | official site | no | high | P0 | Existing source. |
| JYP artist schedule | https://xdinaryheroes.jype.com/Mobile/Schedule | official site | no | high | P0 | Existing source. |
| JYP artist schedule | https://jyp.jype.com/Mobile/Schedule | official site | no | high | P0 | Existing J.Y. Park source. |
| YG BLACKPINK schedule | https://www.ygfamily.com/ko/artists/blackpink/schedule | official site | no | high | P0 | Existing BLACKPINK parser family. |
| YG artist site | https://ygfamily.com/en | official site / label news | no | medium | P1 | News and artist pages; individual schedule paths need probe. |
| SMTOWN notice | https://www.smtown.com/notice | label notice | no | medium | P0 | Multi-artist notices; needs robust keyword/idol matching. |
| SM artist profile | https://www.smentertainment.com/en/artist/ | official site | no | medium | P1 | Good for seed/profiles, not a schedule feed. |
| SMTOWN Japan profile | https://smtown-official.jp/pickup/ | Japan official | no | medium | P1 | Good for SM group/unit coverage and Japan-oriented profile info. |
| Weverse Calendar help | https://help.weverse.io/weverse/article?faq-id=000001798&language=en | platform docs | unknown | medium | P0 | Confirms Calendar feature. Need technical probe for public web access. |
| Weverse notices | https://weverse.io/ | Weverse | unknown | medium | P0 | Strong for HYBE, PLAVE, STAYC, BIBI and more; per-community routes vary. |
| BTS Japan official | https://bts-official.jp/ | Japan official | no | medium | P1 | Has schedule/news for BTS Japan. |
| WAKEONE notice | https://wake-one.com/notice/ | label notice | no | high | P0 | Covers ZEROBASEONE, Kep1er, izna notices. |
| WAKEONE artists | https://wake-one.com/en/artists/ | official site | no | high | P1 | Good for seed/profile validation. |
| FNC artist schedule | https://fncent.com/SF9/b/schedule | official site | no | medium | P1 | Confirms FNC schedule structure; N.Flying Korea path needs exact probe. |
| N.Flying Japan schedule | https://nflying-official.jp/schedule/list/ | Japan official | no | high | P1 | Clean public schedule page. |
| MAMAMOO official | https://mamamoo.co.kr/notice/69fc74a1e6d83071e5db0b7b | official site / bstage | no | medium | P1 | Notices mention official Schedule menu. Needs parser probe. |
| RBW Japan MAMAMOO | https://rbwjapan.jp/artist/mamamoo.php | Japan official | no | low | P2 | Profile-oriented. |
| PLAVE Weverse notice | https://weverse.io/plave/notice | Weverse | unknown | medium | P1 | Good notice source if Weverse is crawlable. |
| PLAVE Japan schedule | https://plave-official.jp/schedule?cateid=8 | Japan official | no | high | P1 | Public schedule page. |
| VLAST PLAVE profile | https://www.vlast.co.kr/plave/ | official site | no | low | P2 | Profile/content hub, not primary schedule. |
| EDAM IU profile | https://edam-ent.com/eng/sub03/sub03_0301_view | official site | no | low | P1 | Good seed/profile source; schedule source still uncertain. |
| G-DRAGON official community | https://gdragon.ai/ | official community | unknown | low | P1 | Galaxy Corporation footer; schedule crawlability unknown. |
| LLOUD Lisa | https://www.lloud.co/ | official site | no | low | P1 | Profile/news style, not guaranteed schedule feed. |
| JISOO official | https://www.jisoo.io/ | official site | no | low | P1 | Campaign/profile site. Schedule/news structure unclear. |
| TAEYANG official | https://www.taeyangofficial.com/ | official site | no | low | P1 | Official site; parser probe needed. |
| THEBLACKLABEL | https://theblacklabel.com/ | official site | no | low | P1 | Artist/profile source; notices unclear. |
| Feel Ghood Music | https://en.feelghoods.com/ | official shop/site | no | low | P2 | BIBI merch/profile. Better paired with Weverse/SNS. |
| STAYC Weverse notice | https://weverse.io/stayc/notice/24903 | Weverse | unknown | medium | P1 | High Up notices appear on Weverse. |
| Cube / i-dle Japan schedule | https://gidle.cubeent.jp/schedule/ | Japan official | no | high | P1 | Public schedule page for i-dle Japan activities. |
| kpopofficial concerts | https://kpopofficial.com/kpop-concerts/ | aggregator | no | high | P0 | Existing active aggregator; lower trust than official but broad coverage. |

---

## Existing Active Idol Matrix

| artist | agency / solo agency | official profile source | official schedule / notice source | secondary safe source | source type | login required | crawler feasibility | risk | recommended parser | priority | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| NewJeans | ADOR / HYBE | Weverse community / ADOR official TBD | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | HYBE/ADOR source status may change; verify before crawler | `weverse_notice_calendar_probe` | P1 | Use source unknown if official route not public. |
| PENTAGON | Cube Entertainment | Cube profile TBD | Cube / SNS / official notices TBD | kpopofficial concerts | official site / SNS | unknown | low | Cube Korea public schedule unclear | `manual_source_probe` | P2 | Keep in roster, but not a crawler priority. |
| AHOF | F&F Entertainment | F&F / official SNS TBD | official SNS / Weverse Con listings | kpopofficial concerts | SNS / aggregator | unknown | low | young group, official site unclear | `manual_source_probe` | P2 | Verify official fan platform before seed expansion. |
| N.Flying | FNC Entertainment | FNC artist page TBD | https://nflying-official.jp/schedule/list/ | FNC schedule pattern | Japan official | no | high | Japan-only may miss Korea schedules | `japan_schedule_html` | P1 | Public clean schedule page. |
| ENHYPEN | HYBE / BELIFT LAB | BELIFT / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | Weverse technical access unknown | `weverse_notice_calendar_probe` | P0 | HYBE P0 representative. |
| ILLIT | HYBE / BELIFT LAB | BELIFT / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | Weverse technical access unknown | `weverse_notice_calendar_probe` | P0 | Same parser as ENHYPEN if feasible. |
| BTS | HYBE / BigHit Music | BigHit / Weverse | Weverse Notice / Calendar; https://bts-official.jp/ | kpopofficial concerts | Weverse / Japan official | unknown | medium | solo + group events may need idol mapping | `weverse_notice_calendar_probe` | P0 | Must support group and solo detection. |
| CORTIS | HYBE / BigHit Music | BigHit / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | new artist names may need aliases | `weverse_notice_calendar_probe` | P1 | Do not infer activity manually. |
| TXT | HYBE / BigHit Music | BigHit / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | Weverse technical access unknown | `weverse_notice_calendar_probe` | P0 | Existing matcher should include TOMORROW X TOGETHER. |
| BOYNEXTDOOR | HYBE / KOZ | KOZ / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | Weverse technical access unknown | `weverse_notice_calendar_probe` | P0 | HYBE/KOZ source. |
| ZICO | HYBE / KOZ | KOZ / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | solo artist matching needs aliases | `weverse_notice_calendar_probe` | P1 | Keep as solo in seed/crawler matching. |
| SEVENTEEN | HYBE / Pledis | Pledis / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | large volume of merch notices | `weverse_notice_calendar_probe` | P0 | Needs event-type filters. |
| TWS | HYBE / Pledis | Pledis / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | Weverse technical access unknown | `weverse_notice_calendar_probe` | P1 | Same source family as SEVENTEEN. |
| &TEAM | HYBE / YX Labels | YX / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | Japan/Korea source split | `weverse_notice_calendar_probe` | P1 | Include aliases: andTEAM, &TEAM. |
| KATSEYE | HYBE x Geffen Records | official / Weverse TBD | Weverse Notice / official SNS TBD | kpopofficial concerts | Weverse / SNS | unknown | low | global pop schedule may not fit K-pop parser | `manual_source_probe` | P2 | Seed ok, crawler later. |
| DAY6 | JYP Entertainment | JYP artist page | https://day6.jype.com/Mobile/Schedule | kpopofficial concerts | official site | no | high | existing parser already available | `jyp_schedule` | P0 | Existing source. |
| ITZY | JYP Entertainment | JYP artist page | https://itzy.jype.com/Mobile/Schedule | kpopofficial concerts | official site | no | high | existing parser already available | `jyp_schedule` | P0 | Existing source. |
| J.Y. Park | JYP Entertainment | JYP artist page | https://jyp.jype.com/Mobile/Schedule | kpopofficial concerts | official site | no | high | existing parser already available | `jyp_schedule` | P0 | Existing source. |
| NMIXX | JYP Entertainment | JYP artist page | https://nmixx.jype.com/Mobile/Schedule | kpopofficial concerts | official site | no | high | existing parser already available | `jyp_schedule` | P0 | Existing source. |
| Stray Kids | JYP Entertainment | JYP artist page | https://straykids.jype.com/Mobile/Schedule | kpopofficial concerts | official site | no | high | existing parser already available | `jyp_schedule` | P0 | Existing source. |
| TWICE | JYP Entertainment | JYP artist page | https://twice.jype.com/Mobile/Schedule | kpopofficial concerts | official site | no | high | existing parser already available | `jyp_schedule` | P0 | Existing source. |
| Xdinary Heroes | JYP Entertainment | JYP artist page | https://xdinaryheroes.jype.com/Mobile/Schedule | kpopofficial concerts | official site | no | high | existing parser already available | `jyp_schedule` | P0 | Existing source. |
| ATEEZ | KQ Entertainment | KQ / official SNS TBD | TOKTOQ / official SNS TBD | kpopofficial concerts | SNS / app | unknown | low | official app may require auth; public page unclear | `manual_source_probe` | P2 | Keep aggregator for now. |
| xikers | KQ Entertainment | KQ / official SNS TBD | TOKTOQ / official SNS TBD | kpopofficial concerts | SNS / app | unknown | low | same KQ issue as ATEEZ | `manual_source_probe` | P2 | Not a P0 crawler. |
| ARTMS | Modhaus | Modhaus / official SNS TBD | official SNS / fan platform TBD | kpopofficial concerts | SNS | unknown | low | source fragmented | `manual_source_probe` | P2 | Needs separate Modhaus probe. |
| tripleS | Modhaus | Modhaus / official SNS TBD | official SNS / fan platform TBD | kpopofficial concerts | SNS | unknown | low | source fragmented | `manual_source_probe` | P2 | Needs separate Modhaus probe. |
| MAMAMOO | RBW | https://rbwjapan.jp/artist/mamamoo.php | https://mamamoo.co.kr/notice/69fc74a1e6d83071e5db0b7b | RBW notice | official site / Japan official | no | medium | bstage structure needs parser probe | `bstage_notice_schedule_probe` | P1 | Notice confirms official Schedule menu. |
| KISS OF LIFE | S2 Entertainment | official / SNS TBD | official SNS / ticketing TBD | kpopofficial concerts | SNS | unknown | low | official public schedule unknown | `manual_source_probe` | P2 | Keep aggregator. |
| EXO | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | notice is multi-artist and noisy | `smtown_notice` | P0 | Also includes solo/subunit notices. |
| Hearts2Hearts | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | https://smtown-official.jp/pickup/ | official site / label notice | no | medium | new artist aliases need care | `smtown_notice` | P1 | Japan profile lists official SNS. |
| NCT | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | NCT group vs units need mapping | `smtown_notice` | P0 | Add unit seeds before crawler expansion. |
| Red Velvet | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | notice is multi-artist and noisy | `smtown_notice` | P0 | Good SM parser candidate. |
| RIIZE | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | notice is multi-artist and noisy | `smtown_notice` | P0 | Current notices include RIIZE. |
| SHINee | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | solo overlap with KEY/MINHO/TAEMIN | `smtown_notice` | P1 | Add solo seeds later. |
| Super Junior | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | notices include app/lightstick noise | `smtown_notice` | P1 | Filter event types carefully. |
| TVXQ | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | Japan activity likely important | `smtown_notice` | P1 | Consider Japan official as secondary. |
| LE SSERAFIM | SOURCE MUSIC / HYBE | SOURCE / Weverse | Weverse Notice / Calendar | kpopofficial concerts | Weverse | unknown | medium | Weverse technical access unknown | `weverse_notice_calendar_probe` | P0 | HYBE P0 representative. |
| aespa | SM Entertainment (DB typo: SSM) | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | DB agency typo should be fixed in migration 038 | `smtown_notice` | P0 | Correct `SSM Entertainment` to `SM Entertainment`. |
| CRAVITY | Starship Entertainment | official site/SNS TBD | Daum fancafe / official SNS TBD | kpopofficial concerts | SNS / fancafe | unknown | low | Starship public schedule not found | `manual_source_probe` | P2 | Starship needs deeper probe. |
| IVE | Starship Entertainment | http://ive-official.com/ | official SNS / Berriz / fancafe TBD | kpopofficial concerts | official site / SNS | unknown | low | schedule source not confirmed | `manual_source_probe` | P2 | Profile site known; schedule unclear. |
| KiiiKiii | Starship Entertainment | https://kiiikiii.kr/ | official SNS TBD | kpopofficial concerts | official site / SNS | unknown | low | schedule source not confirmed | `manual_source_probe` | P2 | New group, verify official URL. |
| MONSTA X | Starship Entertainment | Starship / official SNS TBD | Daum fancafe / official SNS TBD | kpopofficial concerts | SNS / fancafe | unknown | low | public schedule unclear | `manual_source_probe` | P2 | Do not depend on Weverse. |
| ALLDAY PROJECT | THEBLACKLABEL | https://theblacklabel.com/ | official SNS / label site TBD | kpopofficial concerts | official site / SNS | unknown | low | schedule source unclear | `manual_source_probe` | P2 | Seed ok, crawler later. |
| JEON SOMI | THEBLACKLABEL | https://theblacklabel.com/ | official SNS / label site TBD | kpopofficial concerts | official site / SNS | unknown | low | schedule source unclear | `manual_source_probe` | P2 | Solo source may be SNS-heavy. |
| MEOVV | THEBLACKLABEL | https://theblacklabel.com/ | official SNS / label site TBD | kpopofficial concerts | official site / SNS | unknown | low | schedule source unclear | `manual_source_probe` | P2 | Not crawler priority. |
| ROSÉ | THEBLACKLABEL | https://theblacklabel.com/ | THEBLACKLABEL / official SNS TBD | kpopofficial concerts | official site / SNS | unknown | low | solo + BLACKPINK group split | `manual_source_probe` | P1 | Keep separate from BLACKPINK group. |
| TAEYANG | THEBLACKLABEL | https://www.taeyangofficial.com/ | TAEYANG official / THEBLACKLABEL TBD | kpopofficial concerts | official site | no | low | schedule/news structure unclear | `official_site_probe` | P1 | Also BIGBANG solo. |
| izna | WAKEONE | https://wake-one.com/en/artists/ | https://wake-one.com/notice/ | kpopofficial concerts | label notice | no | high | notices are broad but public | `wakeone_notice` | P0 | P0 source family. |
| Kep1er | WAKEONE | https://wake-one.com/en/artists/ | https://wake-one.com/notice/ | kpopofficial concerts | label notice | no | high | notices are broad but public | `wakeone_notice` | P0 | P0 source family. |
| ZEROBASEONE | WAKEONE | https://wake-one.com/en/artists/ | https://wake-one.com/notice/ | kpopofficial concerts | label notice | no | high | notices are broad but public | `wakeone_notice` | P0 | P0 source family. |
| OH MY GIRL | WM Entertainment | WM official TBD | official SNS / fan cafe TBD | kpopofficial concerts | SNS / fan cafe | unknown | low | public source not confirmed | `manual_source_probe` | P2 | Defer. |
| BABYMONSTER | YG Entertainment | https://ygfamily.com/en | YG artist schedule path TBD; Japan schedule exists | kpopofficial concerts | official site / Japan official | no | medium | exact YG KR schedule path needs probe | `yg_artist_schedule` | P0 | Candidate after BLACKPINK parser. |
| BIGBANG | YG Entertainment | https://ygfamily.com/en | YG notice / member solo sites | kpopofficial concerts | official site / SNS | no | low | group activities rare; solo split important | `manual_source_probe` | P1 | Add G-DRAGON/TAEYANG separately. |
| BLACKPINK | YG Entertainment | https://ygfamily.com/en | https://www.ygfamily.com/ko/artists/blackpink/schedule | kpopofficial concerts | official site | no | high | existing parser family | `blackpink_official_tour` / `yg_artist_schedule` | P0 | Group source separate from solo. |
| TREASURE | YG Entertainment | https://ygfamily.com/en | YG artist schedule path TBD | kpopofficial concerts | official site | no | medium | exact schedule path needs probe | `yg_artist_schedule` | P0 | Same parser family as BLACKPINK if route stable. |

---

## M1b-3 Candidate Matrix

| artist | agency / solo agency | official profile source | official schedule / notice source | secondary safe source | source type | login required | crawler feasibility | risk | recommended parser | priority | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Rain | Rain Company | Rain Company / official SNS TBD | official SNS / event pages TBD | kpopofficial concerts | SNS / ticketing | unknown | low | official public schedule not confirmed | `manual_source_probe` | P2 | Seed candidate, crawler later. |
| IU | EDAM Entertainment | https://edam-ent.com/eng/sub03/sub03_0301_view | EDAM notice / IU official YouTube/SNS TBD | ticketing / kpopofficial concerts | official site / SNS | unknown | low | profile confirmed, schedule feed unclear | `manual_source_probe` | P1 | Important seed candidate. |
| BoA | SM or post-SM status needs verification | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan | official site / label notice | no | low | 2026 contract status must be verified before seed | `manual_source_probe` | P2 | Do not hard-code agency until verified. |
| TAEYEON | SM Entertainment | https://www.smentertainment.com/artist/taeyeon/ | https://www.smtown.com/notice | SM newsroom | official site / label notice | no | medium | solo activity appears in SM newsroom/notices | `smtown_notice` | P1 | Good seed candidate. |
| G-DRAGON | Galaxy Corporation | https://gdragon.ai/ | official community / Galaxy notices TBD | ticketing / kpopofficial concerts | official community | unknown | low | login/crawlability unknown | `manual_source_probe` | P1 | Also BIGBANG solo. |
| AKMU | independent label, formerly YG | official source TBD | official SNS / Weverse Shop legacy / ticketing | YG historical news | SNS / ticketing | unknown | low | 2026 agency/source changed; verify before seed | `manual_source_probe` | P2 | Do not use old YG as current agency without verification. |
| BIBI | Feel Ghood Music / 88rising | https://en.feelghoods.com/ | https://weverse.io/bibi/highlight | ticketing | official site / Weverse | unknown | medium | Weverse route needs probe | `weverse_notice_calendar_probe` | P1 | Good solo seed candidate. |
| i-dle | Cube Entertainment | Cube/i-dle official TBD | https://gidle.cubeent.jp/schedule/ | official SNS | Japan official | no | high | Japan schedule may miss Korea/global events | `japan_schedule_html` | P1 | Use slug `i-dle`; avoid old `(G)I-DLE` legal/name ambiguity in source matching. |
| STAYC | High Up Entertainment | High Up / Weverse | https://weverse.io/stayc/notice/24903 | official SNS | Weverse | unknown | medium | Weverse technical access unknown | `weverse_notice_calendar_probe` | P1 | Official notices appear on Weverse. |
| THE BOYZ | agency status needs verification | One Hundred/IST sources TBD | official SNS / fan index only confirmed | fan index | SNS / fan aggregator | unknown | low | 2026 contract dispute/status unstable | `manual_source_probe` | P2 | Verify agency before seed. |
| PLAVE | VLAST | https://www.vlast.co.kr/plave/ | https://weverse.io/plave/notice; https://plave-official.jp/schedule?cateid=8 | PLAVE Japan official | Weverse / Japan official | unknown / no | high | virtual group; schedule taxonomy differs | `weverse_notice_calendar_probe` / `japan_schedule_html` | P1 | Strong source candidate. |
| NCT 127 | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | unit/member mapping required | `smtown_notice` | P1 | Seed as separate unit. |
| NCT DREAM | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | unit/member mapping required | `smtown_notice` | P1 | Seed as separate unit. |
| NCT WISH | SM Entertainment / Avex Japan | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | Japan-heavy source split | `smtown_notice` | P1 | Seed as separate unit. |
| WayV | SM Entertainment / Label V | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | China/global source split | `smtown_notice` | P2 | Seed after NCT core units. |
| Girls' Generation | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SMTOWN Japan profile | official site / label notice | no | medium | group/solo activity split | `smtown_notice` | P2 | Add if desired, but TAEYEON solo higher ROI. |

---

## Big-Group Solo / Subunit Matrix

| artist | agency / solo agency | official profile source | official schedule / notice source | secondary safe source | source type | login required | crawler feasibility | risk | recommended parser | priority | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| JISOO | Blissoo / Jisoo official | https://www.jisoo.io/ | Jisoo official / Blissoo TBD | BLACKPINK group YG source | official site | no | low | campaign site, no stable schedule found | `official_site_probe` | P1 | Keep separate from BLACKPINK group. |
| JENNIE | ODD ATELIER | https://jennie.kim/ | ODD ATELIER official channels TBD | BLACKPINK group YG source | official site / SNS | unknown | low | OA site stability unclear | `manual_source_probe` | P1 | Verify current official OA URL before seed. |
| ROSÉ | THEBLACKLABEL | https://theblacklabel.com/ | THEBLACKLABEL / official SNS TBD | BLACKPINK group YG source | official site / SNS | unknown | low | label site not schedule-first | `manual_source_probe` | P1 | Existing DB has ROSÉ. |
| LISA | LLOUD | https://www.lloud.co/ | LLOUD official / RCA/ticketing TBD | BLACKPINK group YG source | official site / ticketing | no | low | site is profile/brand focused | `official_site_probe` | P1 | Add as BLACKPINK solo. |
| RM | BigHit Music / HYBE | Weverse BTS community | Weverse Notice / Calendar | BTS Japan official | Weverse | unknown | medium | group/solo notices overlap | `weverse_notice_calendar_probe` | P1 | Use BTS solo aliases. |
| Jin | BigHit Music / HYBE | Weverse BTS community | Weverse Notice / Calendar | BTS Japan official | Weverse | unknown | medium | group/solo notices overlap | `weverse_notice_calendar_probe` | P1 | Use BTS solo aliases. |
| SUGA / Agust D | BigHit Music / HYBE | Weverse BTS community | Weverse Notice / Calendar | BTS Japan official | Weverse | unknown | medium | alias matching required | `weverse_notice_calendar_probe` | P1 | Include both names. |
| j-hope | BigHit Music / HYBE | Weverse BTS community | Weverse Notice / Calendar | BTS Japan official | Weverse | unknown | medium | group/solo notices overlap | `weverse_notice_calendar_probe` | P1 | Use lowercase/stylized alias. |
| Jimin | BigHit Music / HYBE | Weverse BTS community | Weverse Notice / Calendar | BTS Japan official | Weverse | unknown | medium | group/solo notices overlap | `weverse_notice_calendar_probe` | P1 | Solo seed candidate. |
| V | BigHit Music / HYBE | Weverse BTS community | Weverse Notice / Calendar | BTS Japan official | Weverse | unknown | medium | single-letter alias false positives | `weverse_notice_calendar_probe` | P2 | Must include Kim Taehyung alias. |
| Jung Kook | BigHit Music / HYBE | Weverse BTS community | Weverse Notice / Calendar | BTS Japan official | Weverse | unknown | medium | spelling aliases needed | `weverse_notice_calendar_probe` | P1 | Include Jungkook alias. |
| G-DRAGON | Galaxy Corporation | https://gdragon.ai/ | official community / ticketing TBD | BIGBANG YG historical source | official community / ticketing | unknown | low | login/crawlability unknown | `manual_source_probe` | P1 | Also in M1b-3 candidate list. |
| TAEYANG | THEBLACKLABEL | https://www.taeyangofficial.com/ | TAEYANG official / THEBLACKLABEL TBD | BIGBANG YG historical source | official site | no | low | schedule/news structure unclear | `official_site_probe` | P1 | Existing DB has TAEYANG. |
| KEY | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SHINee source | official site / label notice | no | medium | solo/member matching required | `smtown_notice` | P2 | Next phase, not migration 038 required. |
| MINHO | SM Entertainment | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | SHINee source | official site / label notice | no | medium | solo/member matching required | `smtown_notice` | P2 | Next phase. |
| D.O. | Company SooSoo / EXO | official source TBD | official SNS / ticketing TBD | EXO/SM source | SNS / ticketing | unknown | low | solo agency differs from SM | `manual_source_probe` | P2 | Later phase; verify agency. |
| DOYOUNG | SM Entertainment / NCT | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | NCT source | official site / label notice | no | medium | solo/member matching required | `smtown_notice` | P2 | Later phase. |
| MARK | SM Entertainment / NCT | https://www.smentertainment.com/en/artist/ | https://www.smtown.com/notice | NCT source | official site / label notice | no | medium | name collision risk | `smtown_notice` | P2 | Later phase; needs aliases. |

---

## P0 Crawler Candidates

| rank | candidate | why | main risk | proposed next step |
|---|---|---|---|---|
| 1 | JYP schedule extension | Existing parser and source rows already prove the route. | Need seed/source rows for any additional JYP artists only. | Work order can be small and implementation-safe. |
| 2 | YG artist schedule | Existing BLACKPINK official-tour parser proves YG pages are crawlable. | Need confirm generic schedule route for TREASURE/BABYMONSTER and avoid group/solo confusion. | Probe route shapes, then design `yg_artist_schedule`. |
| 3 | WAKEONE notice | Public label notice covers ZB1/Kep1er/izna. | Notices are not all events; need filters and idol matching. | Work order with parser filters and candidate review flow. |
| 4 | SMTOWN notice | Public notice covers many existing and future SM artists. | High noise and multi-artist posts. | Work order with conservative event-type filters, no auto-publish. |
| 5 | Weverse Notice / Calendar | Highest HYBE ROI and covers non-HYBE artists too. | Technical access, login/cookies, dynamic rendering, rate limits. | Separate technical feasibility probe before crawler PR. |

## Not Recommended For Initial Crawlers

| source | reason |
|---|---|
| Official profile pages | Good for seed verification, but not event feeds. |
| Official artist image/profile media | Copyright risk; do not use for automatic avatar ingestion. |
| SNS timelines | API and anti-scraping risk; high noise; hard to guarantee stable parsing. |
| Fan indexes | Useful for manual discovery only, not trusted source ingestion. |
| Ticket resale/marketplaces | Good as secondary corroboration only; not official source. |
| Login-only fan clubs / fancafe | Requires auth and may violate access assumptions. |

## Suggested Next Steps

1. Confirm #45 final text/color backfill is complete; avatar remains manual.
2. Use this inventory to draft migration 038, but only for rows whose agency/source are sufficiently clear.
3. Fix `aespa` agency typo in migration 038: `SSM Entertainment` -> `SM Entertainment`.
4. Draft crawler work orders in this order:
   - JYP extension, if any remaining JYP artist sources are needed
   - YG generic schedule
   - WAKEONE notice
   - SMTOWN notice
   - Weverse technical probe
