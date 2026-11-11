# Crawler Work Order - Weverse Public Probe

> Status: **probe complete — verdict C (abandoned for v1)**.
> See `WEVERSE_PROBE_REPORT.md` for evidence.
>
> Original scope: probe design only. Do NOT implement crawler runtime,
> do NOT add parser_type, do NOT seed `crawler_sources`, do NOT add
> migration, do NOT add API route, do NOT touch schema, do NOT touch
> front-end UI, do NOT touch notifications cron. Do NOT design any
> cookie / login / token / session emulation path. v1 considers
> **public no-login routes only**.
>
> Created: 2026-05-23
> Probe executed: 2026-05-23
> Owner: idol-rhythm

---

## 1. Goal

Determine whether Weverse exposes enough **public, no-login content** to
support a future Idol Rhythm crawler. Closes the open question raised in
`SOURCE_INVENTORY_A.md` and listed as a P0 candidate alongside JYP /
YG / WAKEONE / SMTOWN.

This is a **research work order**. It does NOT commit Idol Rhythm to
implementing a Weverse crawler. The output is a decision document with
three possible verdicts (see §8) and, if applicable, a follow-up
runtime work order.

## 2. In Scope (this work order)

- Public no-login probe of Weverse properties (web only)
- HTML / JSON structure investigation for publicly served pages
- Anti-bot / rate-limit observation
- Decision tree for next-step

## 3. Explicitly Out Of Scope (do NOT propose)

- Cookie / session / token replay
- Login emulation (any provider — email, Apple, Google, NAVER, LINE)
- Private API endpoints discovered via logged-in DevTools traces
- Mobile app API reverse engineering
- WebView / SDK extraction
- DRM / paid-content endpoints
- Comment / member-only post extraction
- Live chat / moment ingestion
- Any path that would require Idol Rhythm to hold Weverse credentials
- Migration, schema change, parser_type registration, crawler_sources
  seed — all deferred to a future runtime work order if v1 verdict is
  green

The constraint is hard: even if a login-required endpoint would be
technically convenient, this work order MUST NOT recommend it.

---

## 4. Current Gap

Active crawler sources today (as of 2026-05-22):

| source family | parser_type | status |
|---|---|---|
| BLACKPINK official tour | `blackpink_official_tour` | live |
| JYP artist schedule | `jyp_schedule` | live |
| YG artist schedule | `yg_artist_schedule` | live |
| WAKEONE notice | `wakeone_notice` | live (migration 044) |
| SMTOWN notice | `smtown_notice` | live (migration 045) |
| `kpopofficial-concerts` aggregator | `kpopofficial_concerts` | live |

A large slice of active idols routes their schedule communication
primarily through Weverse (HYBE-system groups plus several non-HYBE
acts that adopted Weverse Communities). For these artists, JYP / YG /
SMTOWN / WAKEONE parsers do not apply, and the only coverage today is
the aggregator + manual entry.

Weverse is owned by Weverse Company (HYBE subsidiary; Naver and HYBE
joint stake). It serves both web and mobile clients; the web client at
`weverse.io` is the only surface in scope for this probe.

---

## 5. Probe Targets

The Phase A probe must cover, in order of priority, **only the
no-login surfaces** of each:

| target | example URL shape | what to look for |
|---|---|---|
| Community landing | `https://weverse.io/{community-slug}` | public artist page; HTML body or empty React shell? |
| Notice list | `https://weverse.io/{community-slug}/notice` | server-rendered list? client-fetched? requires login wall? |
| Notice detail | `https://weverse.io/{community-slug}/notice/{id}` | permalink stability; public visibility on logged-out view |
| Media list | `https://weverse.io/{community-slug}/media` | are media posts public or membership-gated? |
| Media detail | `https://weverse.io/{community-slug}/media/{id}` | permalink + structured metadata? |
| Event / schedule surface | (TBD per artist) | does Weverse expose a dedicated event tab? |
| Shop / ticket cross-link | (TBD) | are ticket / event announcements posted in notice + shop? |

For every URL, **probe MUST be run while signed out** (incognito /
clean profile). Any field only visible after login is treated as
out-of-scope, regardless of how interesting it looks.

---

## 6. Probe Questions

The probe must produce a concrete yes/no/partial answer for each:

1. Does the public landing return server-rendered HTML, or an empty
   shell that needs JS to populate?
2. If client-rendered, is there a `__NEXT_DATA__`, `__INITIAL_STATE__`,
   or similar inline JSON blob with enough structured content to parse
   without hitting a private API?
3. Is there a public XHR/fetch call (GET, no auth header) that returns
   notice/media data, observable from a clean incognito DevTools
   network tab?
4. Does the notice list require login to view items, or are items
   visible to logged-out users (perhaps with redacted comments)?
5. Are notice detail URLs stable permalinks (e.g. numeric id) suitable
   for `source_url` / `source_hash` dedup?
6. Is there pagination? URL-based (`?page=N`), cursor-based, or
   infinite scroll only?
7. Does the page expose publish timestamps in a machine-parsable
   format?
8. Does the page identify the posting artist explicitly (vs. relying
   on community context)?
9. Does Weverse serve any visible bot-detection or rate-limit response
   for a small number of GETs from a single IP?
10. Are there geographic gates (different content for KR vs. global
    visitors)?
11. Is there a `robots.txt` or terms-of-service statement that
    explicitly forbids automated public-page indexing?

Each question must be answered with **evidence captured during the
probe** (status code, header sample, snippet of HTML/JSON,
DevTools screenshot description). Speculation is not acceptable.

---

## 7. Risk Notes

Even before probing, the following risks must be documented in the
final probe report:

| risk | note |
|---|---|
| Heavier anti-bot than WAKEONE / SMTOWN | Weverse runs on a HYBE/Naver-class stack; WAKEONE/SMTOWN are simple WordPress/static-list pages. Expect Cloudflare / Naver Edge / similar. |
| URL or API rewrites | A consumer-app surface like Weverse changes faster than label notice boards. Any parser will need monitoring. |
| Membership gating | Many posts are visible to logged-out users only as teasers, with full content gated. Parser must tolerate partial visibility. |
| Client-side hydration | If notice content is hydrated via private GraphQL/REST and not present in HTML, the probe MUST mark Weverse as **C. not feasible** rather than reverse-engineer the private API. |
| Language / region splits | Weverse serves localized variants; the canonical KR/EN content for a given post may differ. Probe should note which one to standardize on. |
| Rate limiting / IP bans | A single Vercel edge IP making repeated GETs could be flagged. Document observed limits; do not stress-test. |
| Legal / ToS | Weverse Terms of Service must be skim-checked for explicit anti-scraping clauses. Probe documents any clause found; legal interpretation is out of scope here, but the documented clause goes into the decision. |
| Membership "Membership" content | Paid-tier content is unambiguously out of scope. Do not attempt to fetch even if a public URL appears to expose teaser data. |
| GDPR / personal data | Even public posts may include fan-replies and fan identifiers — parser scope, if approved, must capture artist-authored posts only, never comment threads. |

The risk register is part of the deliverable, not a separate document.

---

## 8. Decision Tree

The probe report must end with one of three verdicts:

### A. Public no-login viable

- Notice list + detail render server-side OR include parseable inline
  JSON, with stable permalinks, observable pagination, parsable
  timestamps, and tolerable anti-bot behaviour.
- **Next step**: open a separate runtime work order
  `CRAWLER_WORK_ORDER_WEVERSE_NOTICE.md` covering parser, fetcher,
  shared-feed source-hash design, idol matching strategy, and
  `crawler_sources` seed scope. Migration number is reserved at that
  point, NOT here.

### B. Partial visibility

- Some artist pages or some post types are publicly readable; others
  are membership-gated or login-walled.
- **Next step**: open a narrower runtime work order scoped only to
  the public subset (e.g. official notices only, no media posts). The
  narrower scope must be evidence-backed by the probe.

### C. Not viable without login

- Public pages are empty shells, hydrate via authenticated APIs,
  consistently 401/403 logged out, or actively serve a login wall.
- **Action**: **abandon Weverse for v1**. Do NOT propose login
  emulation. Document the verdict and revisit only if Weverse opens
  a public read API, or if Idol Rhythm switches to a partnership
  path with HYBE/Weverse.

The verdict must be explicit. "Maybe" is not a valid output.

---

## 9. First-Pass Artist Probe List

Probe these communities in incognito. For each, confirm:

1. Does the community page exist at a public URL?
2. Is content visible logged-out?
3. Slug / id used in URL (record verbatim)

**HYBE-system (high prior probability of Weverse presence)**:

| artist | active in idols table | probe note |
|---|---|---|
| BTS | yes | flagship; if anything is public this group is |
| SEVENTEEN | yes | very high volume of Weverse activity |
| TOMORROW X TOGETHER / TXT | yes | confirm canonical slug `tomorrow_x_together` vs `txt` |
| ENHYPEN | yes | |
| LE SSERAFIM | yes | |
| ILLIT | yes | newer group; community freshness check |
| BOYNEXTDOOR | yes | |
| TWS | yes | |
| KATSEYE | yes | global / multi-region — note locale behaviour |
| &TEAM | yes | KR/JP dual presence — note language behaviour |
| CORTIS | yes | newest HYBE/BigHit group; community may be very new |
| NewJeans / NJZ | **status uncertain** | **flag explicitly**: legal dispute around the NJZ rebrand and ADOR / HYBE dispute means the Weverse community may have changed slug, gone offline, or been re-established under a different name. Probe MUST record current state (active / dormant / redirected / removed) and not assume. |

**Non-HYBE acts known to use Weverse Communities (verify in probe)**:

| artist | active in idols table | probe note |
|---|---|---|
| fromis_9 | yes | community existence + visibility must be confirmed; do not assume from past memory |
| ZEROBASEONE | yes | crosscheck: WAKEONE notice crawler already exists, so Weverse coverage would be **additive, not replacement** |
| ATEEZ | yes | confirm community vs. fan-only platform usage |
| (G)I-DLE | yes | Cube label — verify |
| IVE | yes | Starship — verify |

**Do not assume the above list is exhaustive.** During the probe, run
the same incognito check against any remaining active idol the
researcher suspects has a Weverse Community. Add findings to the
report. **Every entry above is marked "needs Phase A actual probe to
confirm"** — none of these should be hard-coded into a runtime plan
until probed.

---

## 10. Phase A Probe Method (do NOT execute in this PR)

The probe itself is a follow-up activity, NOT part of this work order
PR. The probe steps below describe what the next session (or a human
operator) should do.

### 10.1 Tooling

- `curl -sL -A "<UA>" <url> -o /tmp/weverse_probe_<n>.html`
  for raw HTML capture (mirror the WAKEONE / SMTOWN probe style)
- Browser incognito + DevTools (Network panel, JS-disabled toggle)
  for inline JSON and hydration check
- `file`, `wc -l`, `grep -c`, `xxd | head` for byte-level verification
  (same toolkit used in PR #128 raw-line audit)

### 10.2 Steps per target community

1. Curl the community landing logged-out. Record status, content
   length, presence of `<script id="__NEXT_DATA__">` or similar.
2. If HTML is empty shell, open the URL in incognito Chromium with
   JS enabled, then check Network panel for the first GET that returns
   notice/media data. Record method, URL pattern, request headers,
   whether `Authorization` / `Cookie` is required.
3. Visit notice list URL. Record visibility logged-out.
4. Click into one notice detail. Record permalink URL pattern,
   visibility logged-out, presence of date / artist / body.
5. Toggle "Disable JavaScript" in DevTools and reload notice detail.
   If content disappears entirely, mark as client-hydrated.
6. Inspect `robots.txt` at `https://weverse.io/robots.txt`.
7. Spot-check ToS for explicit anti-scraping clauses (record link +
   verbatim clause snippet).
8. For one community only, fetch ~5 notice pages with 2s spacing.
   Observe whether responses degrade, 429, or remain stable. **Do not
   sustain or repeat. This is observational only, not load test.**
9. Capture region behaviour: repeat one community fetch with `Accept-
   Language: ko-KR` vs `en-US` and note differences.

### 10.3 Output

A probe report appended to the next work order (or as a standalone
`WEVERSE_PROBE_REPORT.md`), containing the answers to every question
in §6 with evidence. The verdict from §8 must be explicit at the top
of the report.

---

## 11. Comparison to Existing Crawlers

| dimension | WAKEONE notice | SMTOWN notice | Weverse (expected) |
|---|---|---|---|
| HTML rendering | server-rendered WordPress | server-rendered template | likely client-hydrated React |
| Detail permalink | per-post URL | none — inline expand | per-post numeric id (probe to confirm) |
| Pagination | `/page/N/` | `?page=N` (0-indexed) | unknown; possibly cursor / infinite scroll |
| Shared feed across artists | yes (label) | yes (label) | **no — per-community URL**, so source-hash design can be simpler |
| Idol matching strategy | name/alt_names against shared title | same + NCT-unit guard | **slug-based directly** — each community maps to one artist |
| Anti-bot exposure | minimal | minimal | likely Cloudflare / Naver Edge |
| Login requirement | none | none | **the central probe question** |
| Membership tiering | no | no | yes (free / paid) — parser must respect |

### Implications if Weverse turns out viable

- Per-community URL → **no shared-feed `#source-{slug}` fragment trick
  needed**; each `crawler_sources` row maps cleanly to one artist.
- `source_url` can be the canonical notice permalink directly; no
  synthetic id needed.
- `source_hash` becomes `computeSourceHash({ sourceUrl: noticeUrl })`
  with no fragment — mirror of the BLACKPINK / YG pattern, not the
  WAKEONE / SMTOWN pattern.
- Parser type would be `weverse_notice` (or `weverse_media` if a
  separate parser is needed). Final naming decided in the runtime
  work order, not here.
- Idol-id linkage is direct (one `crawler_sources` row per artist,
  pointing at the community slug), avoiding the NCT-unit ambiguity.

### Implications if Weverse turns out non-viable

- Public crawler path is closed. No follow-up work order.
- Coverage gap for HYBE-system artists remains; mitigations are
  (a) keep relying on `kpopofficial-concerts` aggregator,
  (b) keep manual candidate entry, or
  (c) explore other publicly-readable sources (artist Twitter/X,
      ticketing sites, broadcast site listings) in future inventory
      passes. None of these are committed in this work order.

---

## 12. Acceptance Criteria (this work order PR)

This PR is acceptable if and only if:

- [x] Document explicitly states Weverse probe is **public no-login only**
- [x] No section recommends cookie / login / token / session emulation
- [x] No section describes private-API reverse engineering
- [x] No `parser_type` is registered in this PR
- [x] No `crawler_sources` row is seeded in this PR
- [x] No migration is created in this PR
- [x] No runtime file is added in this PR
- [x] `WORKING.md` updated with one progress row pointing at this PR
- [x] First-pass artist list flags every entry as "needs Phase A
      confirmation"
- [x] NewJeans / NJZ status flagged as uncertain rather than assumed
- [x] Decision tree (§8) has exactly three terminal verdicts
- [x] Probe steps (§10) are observational only — no sustained load,
      no scripted scraping, no bypass
- [x] Risk register (§7) covers anti-bot, ToS, membership gating,
      and personal-data scope

---

## 13. Hand-off Notes for the Probe Session

Whoever runs Phase A next:

1. Run the probe in an incognito browser AND from a clean curl shell
   (no cookies). Both surfaces must be tested.
2. Capture evidence in `/tmp/weverse_probe_*.html` files + a short
   markdown notes file. Do not check captured HTML into the repo
   (may contain transient personal-data snippets).
3. Produce the verdict per §8 and either:
   - open `CRAWLER_WORK_ORDER_WEVERSE_NOTICE.md` (if A or B), or
   - update this document's status line to "verdict: C — abandoned
     for v1" and stop.
4. If at any point the path requires a cookie, token, login session,
   or `Authorization` header to retrieve the data, the verdict is
   automatically C. There is no judgement call there.

---

## 14. Not In Scope (reminder)

- Any login / cookie / token / session path
- Any non-Weverse property (X/Twitter, YouTube, ticketing, broadcast
  schedules) — separate inventory work
- Any UI surface change in Idol Rhythm
- Any notifications behaviour change
- Any AI / LLM classification of Weverse content
- Any storage of fan / comment data
- Any paid-tier Membership content
