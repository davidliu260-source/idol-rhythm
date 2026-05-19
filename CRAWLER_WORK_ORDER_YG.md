# Crawler Work Order - YG Artist Schedule / Notice

> Status: proposal / work order only.
>
> Scope: design only. Do not implement crawler code, do not add migration,
> do not write to Supabase.
>
> Created: 2026-05-19

---

## Goal

Add an official YG source family after approval, so Idol Rhythm does not rely
on `kpopofficial-concerts` alone for YG artists.

This work order covers the design for a future parser/fetcher. It is not the
implementation PR.

## Current Gap

Active crawler sources today:

- JYP artist schedules: clear official coverage for JYP artists with source rows.
- BLACKPINK official tour page: clear official source for BLACKPINK group tour.
- kpopofficial.com: broad aggregator, not an official artist source.

Active YG-related idols in DB:

| artist | current clear official crawler source | current fallback |
|---|---|---|
| BLACKPINK | `blackpink-official-tour` for group tour only | `kpopofficial-concerts` |
| BABYMONSTER | none | `kpopofficial-concerts` |
| TREASURE | none | `kpopofficial-concerts` |
| BIGBANG | none | `kpopofficial-concerts` |

BLACKPINK solo artists should not be treated as YG artist schedule coverage:

| artist | solo agency |
|---|---|
| JISOO | Blissoo |
| JENNIE | ODD ATELIER |
| ROSÉ | THEBLACKLABEL |
| LISA | LLOUD |

## Candidate Official Sources

| source | URL | type | crawler feasibility | notes |
|---|---|---|---|---|
| BABYMONSTER schedule | `https://ygfamily.com/ko/artists/babymonster/schedule` | official site / artist schedule | high | Search result exposes structured categories: TELECAST / RADIO / STAGE with dates and times. |
| BLACKPINK schedule | `https://www.ygfamily.com/ko/artists/blackpink/schedule` | official site / artist schedule | medium | Existing BLACKPINK tour parser uses a separate tour page; this schedule page may be useful for non-tour appearances. |
| TREASURE schedule | `https://ygfamily.com/ko/artists/treasure/schedule` | official site / artist schedule | medium | Route should be probed directly before implementation. |
| TREASURE tour page | `https://artist.ygfamily.com/ARTISTS/TREASURE/concert/PULSE-ON/index.html` | official tour page | medium | Similar to existing BLACKPINK tour page pattern, but page structure may differ. |
| BLACKPINK tour page | `https://artist.ygfamily.com/ARTISTS/BLACKPINK/concert/2025TOUR/index.html` | official tour page | already implemented adjacent | Existing parser points to a BLACKPINK official tour route. |
| BABYMONSTER Japan schedule | `https://yg-babymonster-official.jp/schedule/` | Japan official | medium | Useful secondary source; may duplicate Korean YG schedule. |

## Proposed Implementation Shape

### Phase A - Technical Probe PR

Before writing a full fetcher, probe route stability:

- Fetch `https://ygfamily.com/ko/artists/babymonster/schedule`
- Fetch `https://ygfamily.com/ko/artists/treasure/schedule`
- Fetch `https://www.ygfamily.com/ko/artists/blackpink/schedule`
- Confirm whether HTML is static enough for Cheerio parsing.
- Confirm whether schedule items include enough date context:
  - full year or only month/day
  - category
  - title
  - time
  - permalink/detail URL
- Confirm whether pagination or month selection is needed.

Output: a short comment in the implementation PR or a tiny probe doc, not a DB
change.

### Phase B - Parser / Fetcher PR

If probe succeeds, add:

- `src/lib/crawlers/ygArtistSchedule.ts`
- `src/lib/crawlers/runYgArtistScheduleFetcher.ts`
- admin route under existing crawler route pattern, if needed
- cron fan-out support by `parser_type = 'yg_artist_schedule'`
- migration to seed `crawler_sources` rows only after parser exists

## Parser Contract

Suggested parser type:

```text
yg_artist_schedule
```

Suggested source rows:

| source_key | idol slug | source_url |
|---|---|---|
| `babymonster-yg-schedule` | `babymonster` | `https://ygfamily.com/ko/artists/babymonster/schedule` |
| `treasure-yg-schedule` | `treasure` | `https://ygfamily.com/ko/artists/treasure/schedule` |
| `blackpink-yg-schedule` | `blackpink` | `https://www.ygfamily.com/ko/artists/blackpink/schedule` |

Do not add BIGBANG in the first implementation unless a stable active route is
confirmed. BIGBANG group activity and member solo activity should remain
separate.

## Candidate Mapping

Each source row should carry a single `idol_id`. Unlike aggregators, YG artist
schedule pages are artist-specific, so the fetcher should prefer
`crawler_sources.idol_id` and only fall back by the configured slug when needed.

Mapping rules:

- BABYMONSTER page -> `babymonster`
- TREASURE page -> `treasure`
- BLACKPINK page -> `blackpink`
- Do not map BLACKPINK group schedule to JISOO / JENNIE / ROSÉ / LISA.
- Do not infer BIGBANG solo events from YG unless the official page explicitly
  belongs to BIGBANG group.

## Event Candidate Rules

All rows must go into `event_candidates`, never directly into `events`.

Default candidate fields:

| field | rule |
|---|---|
| `detected_idol_id` | source row idol id |
| `detected_event_type` | map from category when clear; otherwise `other` or null depending existing enum constraints |
| `detected_date` | parsed ISO date if complete; null if year/date is ambiguous |
| `source_name` | crawler source display name |
| `source_type` | `official_website` |
| `ai_confidence` | null |
| `reviewer_note` | `auto-crawled from crawler source: <name>` |
| `raw_data.parser_type` | `yg_artist_schedule` |
| `raw_data.parser_version` | start at `1` |

Trust behavior:

- Do not auto-approve.
- Do not auto-publish.
- Candidates remain pending for admin review.

## Date Parsing Policy

YG schedule pages may show month/day without a year. The parser must not guess
carelessly.

Preferred rules:

1. If the page exposes a year/month context, use it.
2. If the item only has `MM.DD`, infer year only from an explicit page/month
   selector or URL context.
3. If year cannot be proven, set `detected_date = null` and keep the raw text in
   `raw_content`.
4. Never fabricate dates from current year if the page may include past/future
   schedules.

## Dedup / Drift

Use existing crawler patterns:

- Compute `source_hash` from stable `source_url` when an item permalink exists.
- If no item permalink exists, synthesize a stable fragment URL:
  - `<source_url>#<date>-<category>-<normalized-title>`
- Compute `content_hash` with existing `computeContentHash`.
- Dedup by both `source_hash` and `source_url`.
- If existing row content differs:
  - set `needs_recheck = true`
  - update `content_hash`
  - append timestamped reviewer note
  - do not change `review_status`
  - do not change `approved_event_id`
  - do not rewrite raw fields

## Suggested Category Mapping

| YG category | candidate event type |
|---|---|
| CONCERT / TOUR / FAN CONCERT | `concert` |
| STAGE / TELECAST / RADIO | `broadcast` if enum supports it; otherwise `other` |
| NOTICE | null / other; only parse if event-like |
| RELEASE / ALBUM | `release` if enum supports it; otherwise `other` |

Implementation must check existing `event_type` enum before choosing values.

## Risk Notes

- Schedule pages may be mostly promotional appearances, not all user-facing
  events are worth publishing.
- Korean text categories require conservative mapping.
- BLACKPINK group and BLACKPINK solo must remain separate.
- Tour pages and artist schedule pages may duplicate the same event; future M2
  event-key dedupe will help, but this parser should still dedup by source.
- YG route shapes may differ between Korean artist pages and campaign/tour
  microsites.

## Not In Scope

- Google CSE or all-web search
- Image search
- BLACKPINK solo agency sources
- THEBLACKLABEL sources
- BIGBANG member solo sources
- M2 cross-source event key
- Automatic approval / publishing
- Any migration before parser design is accepted

## Acceptance Criteria For Future Implementation

- Dry run fetches at least one YG artist page without auth.
- Parser extracts item title/category/date/time/raw content from fixture HTML.
- Unit-level parser tests cover:
  - full date item
  - month/day item with explicit year context
  - item without year -> `detected_date = null`
  - duplicate item stable source URL generation
- `npm run build` passes.
- Admin manual run route works, if added.
- Cron fan-out only runs active `crawler_sources`.
- Inserted rows are pending candidates only.
- Existing BLACKPINK official tour parser remains unchanged.

