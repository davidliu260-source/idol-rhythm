# Crawler Work Order - SMTOWN Notice

> Status: proposal / work order only.
>
> Scope: design only. Do not implement crawler code, do not add migration,
> do not write to Supabase.
>
> Created: 2026-05-21

---

## Goal

Add a public official SMTOWN notice source family after approval, so Idol
Rhythm can collect candidate events from SM official notices instead of
depending only on `kpopofficial-concerts` or manual discovery.

This work order covers the design for a future parser/fetcher. It is not the
implementation PR.

## Current Gap

Active crawler sources today:

- JYP artist schedules: official structured sources with existing parser path.
- YG artist schedule: official source family already implemented for
  BLACKPINK / BABYMONSTER / TREASURE.
- WAKEONE notice: design work order complete, implementation not started.
- `kpopofficial-concerts`: broad aggregator, not an official artist source.

Active SM-related idols already in DB include at least:

| artist family | current clear official crawler source | current fallback |
|---|---|---|
| aespa | none | `kpopofficial-concerts` |
| EXO | none | `kpopofficial-concerts` |
| NCT | none | `kpopofficial-concerts` |
| Red Velvet | none | `kpopofficial-concerts` |
| RIIZE | none | `kpopofficial-concerts` |
| SHINee | none | `kpopofficial-concerts` |
| Super Junior | none | `kpopofficial-concerts` |
| TVXQ | none | `kpopofficial-concerts` |

Important nuance:

- SMTOWN notices are a shared label feed, not artist-specific pages.
- SM group, unit, and solo activities often appear in the same ecosystem.
- First pass should not attempt full solo/subunit coverage if alias ambiguity is
  too high.

## Candidate Official Sources

| source | URL | type | crawler feasibility | notes |
|---|---|---|---|---|
| SMTOWN notice | `https://www.smtown.com/notice` | label notice | medium | Public multi-artist notice feed with potentially high noise. |
| SM artist page | `https://www.smentertainment.com/en/artist/` | official site | medium | Useful for seed/alias validation, not itself an event feed. |
| SMTOWN Japan pickup/profile | `https://smtown-official.jp/pickup/` | Japan official | medium | Useful secondary source for Japan-heavy acts, but not first-pass parser target. |

## Proposed Implementation Shape

### Phase A - Technical Probe PR

Before writing a full fetcher, probe route stability:

- Fetch `https://www.smtown.com/notice`
- Confirm whether notice list HTML is server-rendered and stable enough for
  Cheerio parsing.
- Confirm whether notice detail pages are public and directly fetchable.
- Confirm whether list items expose enough structured fields:
  - title
  - publish date
  - detail URL
  - category / label if present
- Confirm whether pagination exists and whether paging is URL-driven.
- Confirm whether old and new SMTOWN routes behave consistently.

Output: a short comment in the implementation PR or a tiny probe doc, not a DB
change.

### Phase B - Parser / Fetcher PR

If probe succeeds, add:

- `src/lib/crawlers/smtownNotice.ts`
- `src/lib/crawlers/runSmtownNoticeFetcher.ts`
- admin manual run route under the existing crawler route pattern, if needed
- cron fan-out support by `parser_type = 'smtown_notice'`
- migration to seed `crawler_sources` rows only after parser exists

## Parser Contract

Suggested parser type:

```text
smtown_notice
```

Suggested first-pass source row strategy:

| source_key | idol slug | source_url |
|---|---|---|
| `aespa-smtown-notice` | `aespa` | `https://www.smtown.com/notice` |
| `riize-smtown-notice` | `riize` | `https://www.smtown.com/notice` |
| `red-velvet-smtown-notice` | `red-velvet` | `https://www.smtown.com/notice` |
| `exo-smtown-notice` | `exo` | `https://www.smtown.com/notice` |
| `nct-smtown-notice` | `nct` | `https://www.smtown.com/notice` |

These rows share the same feed, so matching must be conservative. First pass
should prefer clearer high-signal groups before expanding to unit-heavy or
solo-heavy cases.

## Candidate Mapping

Unlike artist-specific schedule pages, SMTOWN notice is a shared label feed.
The parser must identify artist ownership conservatively.

Mapping rules:

- Match against seeded aliases from `idols.name` and `idols.alt_names`.
- First-pass target artists should prioritize clear, high-signal names:
  - `aespa`
  - `RIIZE`
  - `Red Velvet`
  - `EXO`
  - `NCT`
- Do not infer artist ownership from images, hashtags, or adjacent recommendations.
- NCT-related notices are especially risky:
  - group notices may actually be `NCT 127`, `NCT DREAM`, `NCT WISH`, or `WayV`
  - first pass should not map unit-only notices to root `NCT` unless the notice
    explicitly says `NCT`
- EXO / SHINee / Super Junior / TVXQ solo overlap must be treated carefully.
- If a notice clearly belongs to a soloist or subunit that is not yet seeded as
  its own crawler target, skip it in first pass rather than forcing a group map.
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
| `raw_data.parser_type` | `smtown_notice` |
| `raw_data.parser_version` | start at `1` |

Trust behavior:

- Do not auto-approve.
- Do not auto-publish.
- Candidates remain pending for admin review.

## Conservative Event Filter

SMTOWN notices are likely to mix real schedule items with merch, fanclub,
platform, recruitment, and promotional announcements.

Prefer include:

- concert
- tour
- fan meeting
- showcase
- festival / live event appearance
- broadcast or stage schedule when clearly date-based and public
- ticket/opening announcement tied to a real scheduled event
- popup / exhibition / brand event if clearly tied to offline attendance

Prefer exclude:

- merch / MD sales
- membership / fanclub recruitment
- app / platform updates
- album teaser drops without event schedule
- birthday or anniversary posts
- recap / thank-you / behind content
- press-only or investor-style announcements

If the notice type is ambiguous, skip it in first pass.

## Date Parsing Policy

SMTOWN notices may put dates in title, body text, or attachment/table blocks.

Preferred rules:

1. Use explicit full dates from title/body first.
2. If multiple dates exist, preserve raw text and only map the first usable date
   into `detected_date` unless future schema work supports richer candidate
   date ranges directly.
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

| SMTOWN notice wording | candidate event type |
|---|---|
| concert / world tour / live tour | `concert` |
| fan meeting / showcase | `fanmeeting` if enum supports it, otherwise `other` |
| festival / live appearance | `festival` or `other` depending existing enum support |
| broadcast / stage schedule | `broadcast` if enum supports it, otherwise `other` |
| popup / exhibition / brand event | `other` in first pass unless subtype path is already reused safely |

Implementation must check existing `event_type` enum before choosing values.

## Risk Notes

- Shared label feed creates false-positive risk across artists.
- NCT family naming is especially noisy because group and unit names overlap.
- Solo notices may tempt over-mapping to parent groups.
- Japan-heavy acts may have better secondary sources than global SMTOWN notices.
- Some notices may be event-like but still not useful for user-facing schedule
  publication.

## Not In Scope

- Weverse
- WAKEONE implementation
- Google CSE or all-web search
- Image search
- Solo/subunit expansion before first-pass quality is proven
- Automatic approval / publishing
- Any migration before parser design is accepted

## Acceptance Criteria For Future Implementation

- Dry run fetches SMTOWN notice list and at least one detail page without auth.
- Parser extracts title/date/detail URL/raw content from fixture HTML.
- Matching tests cover:
  - `aespa`
  - `RIIZE`
  - `Red Velvet`
  - explicit `NCT` notice
  - unit-only `NCT 127` notice skipped or handled conservatively
  - false positive notice with no artist match
- Filter tests cover:
  - true event notice
  - merch-only notice skipped
  - ambiguous admin/promo notice skipped
- `npm run build` passes.
- Admin manual run route works, if added.
- Cron fan-out only runs active `crawler_sources`.
- Inserted rows are pending candidates only.

