# Chinese Display Generation Work Order

> Scope: plan the next implementation PR for generating Traditional Chinese
> display fields. This document is a work order only. It does not change schema,
> crawler behavior, AI prompts, or runtime code.

## Context

Migration 041 added display/localization fields to `events` and
`event_candidates`:

- `display_title_zh`
- `display_summary_zh`
- `location_name_zh`
- `translation_status`
- `translation_source`
- `translation_updated_at`

PR #85 added admin candidate/draft UI for these fields. PR #86 made the public
frontend prefer Chinese display fields when present. PR #88 fixed frontend
fallback copy so raw descriptions are no longer labeled as AI Chinese summaries.

The missing piece is generation: admins still need to fill Chinese display text
manually.

## Goals

- Add an admin-only way to generate Traditional Chinese display text for one
  candidate or draft event at a time.
- Preserve original source text. Do not mutate `raw_title`, `raw_content`,
  `title`, or `description`.
- Never overwrite human-reviewed or manual Chinese fields by default.
- Keep crawlers simple: crawlers store original text and hints only; they do not
  call AI translation during sync.
- Produce concise, user-facing Traditional Chinese suitable for public cards and
  detail pages, not a literal full translation of every source sentence.

## Non-Goals

- No schema / migration changes.
- No automatic batch generation.
- No generation during crawler runs or cron fan-out.
- No Google CSE or whole-web image/search integration.
- No LLM-based idol active/inactive decision.
- No auto-publish or trust-level changes.

## Proposed Split

### PR A - Candidate Generation

Add generation for `/admin/event-candidates/[id]`.

Suggested implementation:

- Create `src/lib/ai/generateChineseDisplay.ts`.
- Create admin-only route or server action, for example:
  - `POST /api/admin/event-candidates/[id]/generate-chinese`
  - or a colocated server action in `src/app/admin/event-candidates/[id]/actions.ts`
- Add a button on candidate detail:
  - label: `產生繁中顯示文案`
  - disabled unless active admin
  - show loading and error state
- On success, write to candidate fields:
  - `display_title_zh`
  - `display_summary_zh`
  - optionally `location_name_zh` only when source text clearly contains a
    user-facing place name
  - `translation_status = 'machine'`
  - `translation_source = 'ai'`
  - `translation_updated_at = now()`

Overwrite rule:

- If `translation_status IN ('manual', 'reviewed')`, block by default and show a
  clear admin message.
- If any target field already has a value, block by default unless a later
  explicit "regenerate and overwrite machine text" control is added.
- The first implementation should not include force-overwrite.

### PR B - Draft Event Generation

After PR A is accepted, add the same generation flow to draft event edit/detail.

Suggested constraints:

- Only draft events (`is_published = false`) can be updated from this action.
- Published events should require manual edit workflow or unpublish first.
- Keep `translation_status = 'machine'` unless an admin edits and saves via the
  existing manual fields, which already uses `translation_source = 'admin'`.

### PR C - Review / Manual Polish

Optional follow-up after machine generation exists:

- Add "mark reviewed" admin action for generated Chinese fields.
- This should set:
  - `translation_status = 'reviewed'`
  - `translation_source` remains `ai` unless text was manually changed.
- Do not bundle this with PR A unless reviewer explicitly approves.

## AI Contract

Use the existing Anthropic env setup pattern from `src/lib/ai/parseCandidate.ts`,
but keep this as a separate helper because the task is generation, not
classification.

Input should include:

- original title
- original content/description
- detected or existing event type / subtype
- idol name
- date/range hints
- location hints
- source name / source type

The model should return strict JSON:

```json
{
  "display_title_zh": "string | null",
  "display_summary_zh": "string | null",
  "location_name_zh": "string | null",
  "notes": "string"
}
```

Validation rules:

- Parse JSON defensively, same style as `parseCandidate.ts`.
- Reject non-object output.
- Ignore unknown keys.
- Trim all strings.
- Clamp field lengths before writing:
  - title: suggested max 80 chars
  - summary: suggested max 280 chars
  - location: suggested max 80 chars
- Empty strings become null.
- Do not trust the model for IDs, enums, active status, trust level, publish
  state, or source reliability.

Prompt rules:

- Output Traditional Chinese.
- Keep artist names, tour names, venue names, and official event names readable.
- Do not invent dates, venues, ticket links, prices, or countries.
- If source text is too thin, return null fields instead of guessing.
- Summary should be a concise public-facing description, not raw scraper debug
  text.
- Do not translate URLs.

## Admin UX

Candidate detail should show:

- current translation status
- generate button
- generated result written into the existing Chinese display section
- warning when fields are protected by manual/reviewed status

The button should be close to the Chinese display fields, not next to approve /
reject, so admins understand generation is a content aid and not an approval.

Error copy should be explicit:

- missing API key
- AI call failed
- existing manual/reviewed translation blocked
- generated output empty

## Data Safety

- Admin guard is mandatory.
- Use server-side Supabase client with existing RLS.
- Do not use service role for this admin action unless a reviewer explicitly
  approves it.
- Do not write to `events` from candidate generation except through the existing
  approval flow.
- Approval should continue copying candidate Chinese fields into the draft event,
  as implemented in PR #85.

## Acceptance Criteria

For PR A:

- Candidate detail has an admin-only generate button.
- Button writes generated Chinese fields only to the selected candidate.
- Manual/reviewed rows are protected from overwrite.
- `translation_status/source/updated_at` are updated correctly on successful
  generation.
- No crawler, cron, source matching, trust-level, or publish behavior changes.
- `npm run build` passes.

## Open Questions For Review

- Should machine-generated title/summary be allowed on public frontend before
  human review, or should publish flow warn when `translation_status = 'machine'`?
- Do we need a separate "regenerate machine text" flow for fields that are
  already machine-generated?
- Should `location_name_zh` be generated in PR A, or left manual until we see
  real source quality?
