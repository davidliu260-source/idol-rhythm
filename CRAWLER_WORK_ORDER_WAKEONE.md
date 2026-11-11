# Crawler Work Order - WAKEONE Notice

> Status: proposal / work order only.
>
> Scope: design only. Do not implement crawler code, do not add migration,
> do not write to Supabase.
>
> Created: 2026-05-21

---

## Goal

Add a public official WAKEONE source family after approval, so Idol Rhythm can
collect event candidates from WAKEONE notices instead of depending only on
`kpopofficial-concerts` or manual discovery.

This work order covers the design for a future parser/fetcher. It is not the
implementation PR.

## Current Gap

Active crawler sources today:

- JYP artist schedules: official structured sources with existing parser path.
- YG artist schedule: official source family already implemented for
  BLACKPINK / BABYMONSTER / TREASURE.
- `kpopofficial-concerts`: broad aggregator, not an official artist source.

Active WAKEONE-related idols in DB:

| artist | current clear official crawler source | current fallback |
|---|---|---|
| ZEROBASEONE | none | `kpopofficial-concerts` |
| Kep1er | none | `kpopofficial-concerts` |
| izna | none | `kpopofficial-concerts` |
| Jo Yuri | none | manual / future seed follow-up |

This work order only covers WAKEONE label notices for currently seeded WAKEONE
group artists. It does not assume solo artist coverage in the first pass.

## Candidate Official Sources

| source | URL | type | crawler feasibility | notes |
|---|---|---|---|---|
| WAKEONE notice list | `https://wake-one.com/notice/` | label notice | high | Public page, broad coverage for label events, but includes non-event posts. |
| WAKEONE artist list | `https://wake-one.com/en/artists/` | official site | high | Useful for artist validation and alias cross-checking, not itself an event feed. |
| WAKEONE KR site variants | `https://wake-one.com/` | label site | medium | Route structure and notice detail path should be confirmed in probe. |

## Proposed Implementation Shape

### Phase A - Technical Probe PR

Before writing a full fetcher, probe route stability:

- Fetch `https://wake-one.com/notice/`
- Confirm whether the list HTML is server-rendered and stable enough for
  Cheerio parsing.
- Confirm whether notice detail pages are public and directly fetchable.
- Confirm whether list items expose enough structured fields:
  - title
  - date
  - detail URL
  - category / board type if present
- Confirm whether pagination exists and whether page number is URL-driven.
- Confirm whether English and Korean routes differ materially.

Output: a short comment in the implementation PR or a tiny probe doc, not a DB
change.

### Phase B - Parser / Fetcher PR

If probe succeeds, add:

- `src/lib/crawlers/wakeoneNotice.ts`
- `src/lib/crawlers/runWakeoneNoticeFetcher.ts`
- admin manual run route under the existing crawler route pattern, if needed
- cron fan-out support by `parser_type = 'wakeone_notice'`
- migration to seed `crawler_sources` rows only after parser exists

## Parser Contract

Suggested parser type:

```text
wakeone_notice
```

Suggested source row strategy for first pass:

| source_key | idol slug | source_url |
|---|---|---|
| `zerobaseone-wakeone-notice` | `zerobaseone` | `https://wake-one.com/notice/` |
| `kep1er-wakeone-notice` | `kep1er` | `https://wake-one.com/notice/` |
| `izna-wakeone-notice` | `izna` | `https://wake-one.com/notice/` |

All first-pass rows point to the same notice feed. The fetcher must therefore
support multi-artist filtering instead of assuming source-page specificity.

## Candidate Mapping

Unlike artist-specific schedule pages, WAKEONE notice is a shared label feed.
The parser must identify which notice belongs to which artist conservatively.

Mapping rules:

- Match against seeded aliases from `idols.name` and `idols.alt_names`.
- First-pass target idols:
  - `ZEROBASEONE`
  - `Kep1er`
  - `izna`
- Ignore notices that do not clearly mention one of the target idols.
- Do not infer artist ownership from vague pronouns, thumbnails, or unrelated
  body copy.
- If a notice clearly mentions multiple seeded artists, create one candidate
  row per matched idol only if the content is truly shared event information.
- Do not use LLM classification or LLM entity matching.

## Event Candidate Rules

All rows must go into `event_candidates`, never directly into `events`.

Default candidate fields:

| field | rule |
|---|---|
| `detected_idol_id` | matched idol id from alias rules |
| `detected_event_type` | map only when clearly event-like; otherwise null or `other` depending existing enum constraints |
| `detected_date` | parsed ISO date when present and trustworthy |
| `source_name` | crawler source display name |
| `source_type` | `official_website` |
| `ai_confidence` | null |
| `reviewer_note` | `auto-crawled from crawler source: <name>` |
| `raw_data.parser_type` | `wakeone_notice` |
| `raw_data.parser_version` | start at `1` |

Trust behavior:

- Do not auto-approve.
- Do not auto-publish.
- Candidates remain pending for admin review.

## Conservative Event Filter

WAKEONE notices are likely to include both true event information and general
fan/admin announcements. First pass should only keep notices that clearly
describe user-facing schedule items.

Prefer include:

- concert
- fan meeting
- showcase
- tour
- festival
- broadcast appearance
- ticket/opening announcement tied to a real scheduled event
- popup / exhibition / brand event if clearly tied to offline attendance

Prefer exclude:

- merch sales
- membership / fanclub notices
- app updates
- media content release without event date
- birthday posts
- generic greetings / recaps
- winner announcements with no future event

If the notice type is ambiguous, skip it in first pass.

## Date Parsing Policy

WAKEONE notices may include dates in title, body, or attached tables.

Preferred rules:

1. Use explicit full dates from title/body first.
2. If only a date range is present, keep start/end in raw parsing output for
   future model alignment; first parser may map `detected_date` to start date
   only if the schema contract requires a single date for candidates.
3. If no trustworthy explicit date exists, do not fabricate one.
4. Preserve raw Korean/English date text in `raw_content`.

## Dedup / Drift

Use existing crawler patterns:

- Compute `source_hash` from stable notice detail URL.
- Dedup by both `source_hash` and `source_url`.
- Compute `content_hash` with existing `computeContentHash`.
- If existing row content differs:
  - set `needs_recheck = true`
  - update `content_hash`
  - append timestamped reviewer note
  - do not change `review_status`
  - do not change `approved_event_id`
  - do not rewrite raw fields

## Suggested Event Type Mapping

| WAKEONE notice wording | candidate event type |
|---|---|
| concert / world tour / fan concert | `concert` |
| fan meeting / showcase | `fanmeeting` if enum supports it, otherwise `other` |
| festival / event appearance | `festival` or `other` depending existing enum support |
| broadcast schedule / stage appearance | `broadcast` if enum supports it, otherwise `other` |
| popup / exhibition / brand collaboration event | `other` in first pass unless subtype path is already reused safely |

Implementation must check existing `event_type` enum before choosing values.

## Risk Notes

- Shared label feed creates false-positive risk across artists.
- Notices may mention historical recaps, merch, or fanclub information that
  look event-like but should not become candidates.
- Korean-only wording may require explicit keyword dictionaries rather than
  loose substring matching.
- One notice may bundle multiple dates or multiple cities.
- ZEROBASEONE, Kep1er, and izna naming variants must be tested carefully.

## Not In Scope

- Weverse
- SMTOWN
- Google CSE or all-web search
- Image search
- Solo WAKEONE artist expansion before source quality is proven
- Automatic approval / publishing
- Any migration before parser design is accepted

## Acceptance Criteria For Future Implementation

- Dry run fetches WAKEONE notice list and at least one detail page without
  auth.
- Parser extracts title/date/detail URL/raw content from fixture HTML.
- Matching tests cover:
  - `ZEROBASEONE`
  - `Kep1er`
  - `izna`
  - false positive notice with no artist match
  - multi-artist notice behavior
- Filter tests cover:
  - true event notice
  - merch-only notice skipped
  - ambiguous admin notice skipped
- `npm run build` passes.
- Admin manual run route works, if added.
- Cron fan-out only runs active `crawler_sources`.
- Inserted rows are pending candidates only.

