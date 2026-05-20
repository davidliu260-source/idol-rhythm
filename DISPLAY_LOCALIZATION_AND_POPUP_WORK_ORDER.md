# Display Localization + Popup Event Model Work Order

> Status: work order only.
>
> Scope: planning only. Do not add migration, do not change UI, do not change
> crawler behavior in this PR.
>
> Created: 2026-05-20

## Goal

Crawler coverage is now good enough that raw English / Korean titles are
arriving quickly. Idol Rhythm's product difference is Chinese-first event
reading, but translation must not become a manual per-row chore.

This work order defines the next data-model and product direction for:

- Chinese display fields
- original/raw source preservation
- AI or rule-based Chinese summaries
- manual override behavior
- popup store / exhibition / brand-event support
- date ranges and richer location fields

## Current Problem

Current rows can store:

- `events.title`
- `events.description`
- `events.date`
- `events.location`
- `event_candidates.raw_title`
- `event_candidates.raw_content`

These fields are enough for early manual data entry, but not enough for a
large crawler pipeline:

- official sources often arrive in Korean or English
- K-pop schedule titles can be terse
- popup stores need date ranges, not just one date
- brand/exhibition events need venue / city / address separation
- admins should review correctness, not translate every row by hand

## Product Rules

### Keep All Original Source Text

Original crawler output remains source-of-truth evidence.

Do not overwrite or translate away:

- `event_candidates.raw_title`
- `event_candidates.raw_content`
- `events.title` until migration strategy is chosen
- `events.description` until migration strategy is chosen
- `raw_data`

Chinese fields should be additive or clearly derived, not destructive.

### Chinese Is Display Metadata

Chinese presentation should be stored separately from source evidence.

Suggested target fields, pending migration design:

| target | purpose |
|---|---|
| `display_title_zh` | concise Chinese card/detail title |
| `display_summary_zh` | short Chinese explanation for detail page |
| `location_name_zh` | Chinese display venue/location when useful |
| `translation_status` | `none` / `machine` / `reviewed` / `manual` |
| `translation_source` | `rule` / `ai` / `admin` / `import` |
| `translation_updated_at` | audit timestamp |

Open decision: whether these fields live on `events` only, or also on
`event_candidates` so admins can review Chinese text before approving.

Recommendation: add candidate-level fields first or mirror both candidate and
event fields during approval, because admins need to see the Chinese output
before publishing.

### AI / Rule Generation Boundary

Allowed:

- translate title and summary for display
- normalize obvious category words
- preserve artist names, official venue names, and brand names
- produce short Chinese summaries from raw source text

Not allowed:

- invent missing dates
- invent venue/address
- infer active/inactive idol status
- rewrite source evidence
- silently replace official source text

AI output must be reviewable and overrideable.

### Manual Override

Admins should be able to edit Chinese fields without changing raw source text.

Manual edits should set:

- `translation_status = manual` or `reviewed`
- `translation_source = admin`
- `translation_updated_at = now()`

Future auto-refresh should not overwrite manual/reviewed Chinese fields unless
admin explicitly asks to regenerate.

## Popup / Exhibition / Brand Event Model

### Event Type Strategy

Current `event_type` includes `brand`, which can temporarily hold popup stores.
Longer-term, popup stores deserve explicit subtype support.

Recommended minimal path:

- keep main `type = brand`
- add subtypes instead of adding a new top-level type immediately

Suggested `event_sub_type` additions:

| subtype | use |
|---|---|
| `popup_store` | pop-up store / 快閃店 |
| `exhibition` | exhibition / 展覽 |
| `brand_event` | brand launch / brand appearance |

Open decision: current `event_sub_type` is an enum. Adding these requires
migration.

### Date Range

Popup stores often run for multiple days or weeks. One `date` column is not
enough.

Recommended additions:

| field | purpose |
|---|---|
| `start_date` | first public date |
| `end_date` | final public date, nullable |
| `date_label` | optional original display text when source is ambiguous |

Compatibility rule:

- keep existing `date` as sort key / primary date
- set `date = start_date` for range events
- frontend can show `start_date - end_date` when available

### Location Structure

Current `country`, `country_flag`, `location` are useful but too coarse.

Recommended additions:

| field | purpose |
|---|---|
| `city` | city-level filtering/display |
| `venue_name` | mall / venue / store |
| `address` | full address when source provides it |
| `map_url` | official map / venue map when available |

Do not require every field; official sources often omit address detail.

## Frontend Display Rules

Cards should prefer Chinese display fields when available:

1. `display_title_zh`
2. fallback to original `title`

Detail pages should show:

- Chinese title if available
- source/original title in a small "原文" row when different
- Chinese summary if available
- original source URL preserved
- range display for popup/exhibition events

Suggested date rendering:

- single-day: `2026-06-01`
- range same month: `2026-06-01 - 06-15`
- range cross-month/year: `2026-06-28 - 2026-07-05`

## Admin Workflow

Candidate detail should eventually show:

- raw title/content
- generated Chinese title/summary
- source type/risk badge
- regenerate Chinese button
- manual edit fields
- translation status badge

Approval should copy Chinese fields from candidate to event draft.

Publishing should remain conservative:

- official/media source can publish after admin action
- aggregator/community/unknown source remains blocked until source is improved
- Chinese missing should warn but not necessarily block, depending product
  choice

## Crawler Rules

Crawlers should continue to store original raw text.

They may optionally send normalized hints:

- detected language
- raw category
- possible subtype
- date range when source has explicit start/end
- venue/city/address when source has explicit fields

Crawlers should not call AI translation directly in the same run unless a
separate rate-limit and failure policy is designed. Prefer a follow-up admin
action or queued job.

## Proposed Engineering Split

### PR A - Migration Design

Produce migration SQL only after review.

Potential scope:

- add Chinese display fields to `event_candidates`
- add Chinese display fields to `events`
- add `translation_status`, `translation_source`, `translation_updated_at`
- add date range fields
- add richer location fields
- extend `event_sub_type` enum for popup/exhibition/brand_event

### PR B - Admin Candidate / Draft UI

- show generated/display Chinese fields
- allow manual edit
- show translation status
- copy candidate Chinese fields to draft events on approval

### PR C - Frontend Display

- cards and detail pages prefer Chinese fields
- show original title when different
- render date ranges
- add popup/exhibition subtype badges

### PR D - Chinese Generation

- rule-based title cleanup for common crawler patterns
- AI generation endpoint or admin action
- never overwrite manual/reviewed text by default

### PR E - Popup Source Support

- update crawler parsing rules to detect popup/exhibition/brand events
- add official source work orders where needed
- keep source trust rules unchanged

## Acceptance Criteria For This Work Order

- no migration added
- no code behavior changed
- product rules for Chinese display are explicit
- popup store model decisions are narrowed
- next implementation PRs are separable
