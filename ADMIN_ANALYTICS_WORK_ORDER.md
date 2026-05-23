# Admin Analytics Work Order — 後台用戶統計儀表板

> Status: **GPT audit complete — patch applied, ready for merge**.
> Patch: 2026-05-23 (RLS / service_role scope correction per GPT review)
>
> Created: 2026-05-23
> Owner: idol-rhythm

---

## 1. Goal

Provide the site admin with a read-only statistics dashboard at
`/admin/analytics` covering key product health metrics — total users,
active engagement, content pipeline, and crawler coverage. This is an
**aggregate-only** view; no per-user drill-down, no email lists, no
CSV export in v1.

This is a **planning work order only**. No runtime code, no API routes,
no schema changes, no migration, no SQL, no auth / service_role
implementation, no front-end UI changes, no crawler changes, no
notifications changes are included in this PR. Implementation follows
in a separate runtime work order after GPT audit.

---

## 2. Metrics — v1 vs v2

### 2.1 v1 Metrics (implement in runtime work order)

#### Users (requires `service_role`)

| metric | source | note |
|---|---|---|
| Total registered users | `auth.users` COUNT | service_role only; see §4 |
| New users — last 7 days | `auth.users WHERE created_at >= now()-7d` COUNT | service_role |
| New users — last 30 days | `auth.users WHERE created_at >= now()-30d` COUNT | service_role |

#### Interactions (likely require `service_role` for site-wide aggregate — verify RLS before implementation)

> **RLS note**: `user_follows`, `saved_events`, `reminders`, and
> `notifications` all have user-scoped RLS. A standard admin server
> client (authenticated role) can only read the admin's own rows, not
> every user's rows. Site-wide aggregate counts therefore likely require
> the `service_role` client. **Confirm by auditing RLS policies before
> the runtime PR; use `service_role` for these queries if the admin
> role cannot perform a full-table COUNT.**

| metric | source | note |
|---|---|---|
| Total user_follows rows | `user_follows` COUNT | site-wide — likely needs service_role; see RLS note above |
| Unique users with ≥1 follow | `user_follows` COUNT DISTINCT user_id | same |
| Total saved_events rows | `saved_events` COUNT | site-wide — likely needs service_role |
| Unique users with ≥1 save | `saved_events` COUNT DISTINCT user_id | same |
| Total reminders rows | `reminders` COUNT | site-wide — likely needs service_role |
| Unique users with ≥1 reminder | `reminders` COUNT DISTINCT user_id | same |

#### Notifications (likely require `service_role` for site-wide aggregate — verify RLS before implementation)

| metric | source | note |
|---|---|---|
| Total notifications rows | `notifications` COUNT | all users' notifications — likely needs service_role |
| Unread notifications | `notifications WHERE read_at IS NULL` COUNT | site-wide backlog, not the current admin's unread — likely needs service_role |

#### Content

| metric | source | note |
|---|---|---|
| Published events | `events WHERE is_published = true` COUNT | live on front-end |
| Draft events | `events WHERE is_published = false` COUNT | staging |

#### Candidates / Pipeline

| metric | source | note |
|---|---|---|
| Candidates by `review_status` | `event_candidates GROUP BY review_status` | pending / approved / rejected |
| Candidates by `source_type` | `event_candidates GROUP BY source_type` | crawler / manual / etc. |

#### Crawler

| metric | source | note |
|---|---|---|
| Active crawler sources | `crawler_sources WHERE is_active = true` COUNT | — |
| Total crawler sources | `crawler_sources` COUNT | — |
| Crawler sources by `parser_type` | `crawler_sources GROUP BY parser_type` | — |

#### Admin

| metric | source | note |
|---|---|---|
| Admin users | `admin_users` COUNT | — |

---

### 2.2 v2 Metrics (explicitly deferred — do NOT implement in v1)

The following are recorded here for roadmap context only. They must
NOT be implemented as part of the v1 runtime work order.

- Cohort retention (D1 / D7 / D30 from `auth.users.created_at`)
- Precise DAU / MAU from an activity log (no such log exists in v1
  schema; would require a new table or an external analytics service)
- Per-user behavior detail (follows / saves / reminders by individual
  user — privacy concern, out of scope for v1 aggregate view)
- User email list / user search (privacy — admin can only see aggregate
  counts in v1)
- CSV / JSON export of any user-identifying data
- OAuth provider breakdown (would require parsing
  `auth.users.raw_app_meta_data` — complexity not worth it in v1)
- Funnel visualisation (registration → follow → save → reminder)
- Crawler run history / success rate (requires new crawler_runs table)
- Real-time / live refresh without page reload
- Geographic breakdown

---

## 3. Privacy Boundary

The following constraints are **hard limits** for v1 and must be
enforced at the server layer, not just the UI layer:

1. **Aggregate only** — every number returned to the admin browser is a
   scalar count or grouped count. Zero row-level data.
2. **No email list** — the dashboard MUST NOT return any `auth.users`
   email, even in a paginated list. The only user metric is the total
   count and recent-signup count.
3. **No per-user behavior** — `user_follows`, `saved_events`,
   `reminders`, `notifications` queries return aggregate counts only
   (`COUNT(*)`, `COUNT(DISTINCT user_id)`). No user_id, no profile
   data, no content of individual rows.
4. **No CSV / export endpoint** — v1 dashboard has no download button,
   no JSON feed, no export API. Deferred to v2.
5. **No OAuth tokens or refresh tokens** — the dashboard does not touch
   `auth.refresh_tokens` or provider tokens at any point.
6. **Admin-only access** — all data served under `/admin/analytics`
   must pass through the existing `getCurrentAdmin()` guard (returns
   `null` or redirects if not an admin). No public or authenticated-
   non-admin access.

---

## 4. auth.users Access Strategy

`auth.users` lives in the `auth` Postgres schema and is accessible only
to the `service_role` key. Neither the `anon` nor `authenticated` role
can read it.

### Implication

Any metric that touches `auth.users` (total users, new users 7d/30d)
must run in a server context using `getSupabaseServiceClient()` with
the `SUPABASE_SERVICE_ROLE_KEY` environment variable. The key must be:

- A service_role JWT starting with `eyJ...`
- Set in the Vercel **Production** environment only (never Preview,
  never committed to version control, never prefixed `NEXT_PUBLIC_`)
- Imported behind `import 'server-only'` to prevent accidental bundle
  inclusion

### Two access paths

| path | mechanism | when to use |
|---|---|---|
| Server Component | `getSupabaseServiceClient()` called directly in async server component; data passed as props | Approach A (recommended — see §6) |
| API Route | Server-side route handler calls `getSupabaseServiceClient()`, returns aggregate JSON | Approach B (fallback if client-side refresh is needed) |

In both cases, the `service_role` client is **never** instantiated on
the client side.

### Approximation fallback

If `SUPABASE_SERVICE_ROLE_KEY` is unavailable in the runtime
environment:

- `auth.users` metrics (total users, new 7d, new 30d) → display `—`
- User-scoped site-wide aggregates (`user_follows`, `saved_events`,
  `reminders`, `notifications`) that depend on `service_role` to bypass
  user-scoped RLS → also display `—`
- Public non-user tables (`events`, `event_candidates`,
  `crawler_sources`, `admin_users`) have no user-scoped RLS and remain
  readable via the regular server client → continue to display normally

This fallback must be explicitly handled — do NOT throw or crash. The
dashboard must degrade gracefully, showing `—` for the affected metrics
and a brief inline note: "service_role unavailable — user metrics
hidden".

---

## 5. Data Source Inventory

| table | schema | metrics | needs service_role | personal data |
|---|---|---|---|---|
| `auth.users` | auth | total count, new 7d, new 30d | **yes — always** | email, provider, created_at — never exposed to browser |
| `user_follows` | public | count, distinct user_id count | **maybe — likely yes** for site-wide aggregate; verify RLS before implementation | user_id (aggregate only) |
| `saved_events` | public | count, distinct user_id count | **maybe — likely yes** for site-wide aggregate; verify RLS before implementation | user_id (aggregate only) |
| `reminders` | public | count, distinct user_id count | **maybe — likely yes** for site-wide aggregate; verify RLS before implementation | user_id (aggregate only) |
| `notifications` | public | total count, site-wide unread count | **maybe — likely yes** for site-wide aggregate; verify RLS before implementation | user_id (aggregate only) |
| `events` | public | published count, draft count | no | none |
| `event_candidates` | public | grouped by review_status, by source_type | no | none |
| `crawler_sources` | public | active count, total count, by parser_type | no | none |
| `admin_users` | public | count | no | none |

> **RLS audit required before runtime implementation**: The four
> user-scoped tables (`user_follows`, `saved_events`, `reminders`,
> `notifications`) all have RLS policies scoped to `auth.uid()`. An
> admin server client operating under the `authenticated` role will be
> filtered to the admin's own rows only, returning a count of 0 or 1
> rather than a site-wide total. The runtime PR **must audit these
> policies and use `service_role` for any table where the admin role
> cannot perform a full-table COUNT**. Returning `—` is acceptable;
> returning the admin's own row count as if it were a site-wide count
> is not.

All queries return scalars or group-by counts. No per-row data is
fetched or passed to the browser.

---

## 6. Technical Approach

### Approach A — Server Component (recommended for v1)

```
/admin/analytics/page.tsx          ← async Server Component
  await getCurrentAdmin()          ← guard; redirect if null
  getSupabaseServiceClient()       ← service_role for:
                                       • auth.users (always required)
                                       • user_follows / saved_events /
                                         reminders / notifications
                                         (required if RLS audit confirms
                                          admin role cannot full-table COUNT)
  getSupabaseServerClient()        ← regular server client for:
                                       • events / event_candidates /
                                         crawler_sources / admin_users
                                         (no user-scoped RLS)
  parallel Promise.all([...])      ← all aggregate queries in parallel
  <AnalyticsDashboard stats={...} /> ← pure Client Component for rendering
```

**Key constraint**: regardless of which client is used, every query
must return only scalar counts or group-by counts. No `SELECT *`,
no `SELECT user_id`, no `SELECT email` is permitted at any point in
this feature. The `service_role` client bypasses RLS — this power must
be confined to aggregate queries only.

**Advantages**:
- No additional API route needed
- service_role key never leaves the server process
- Data is baked into the HTML — no client-side loading state for initial
  paint
- Consistent with the existing admin page pattern (Server Component
  auth guard + Client Component for interactivity)

**Disadvantages**:
- Full page reload required to refresh numbers
- Vercel Edge cache must be set to `no-store` / `force-dynamic` to avoid
  stale stats (`export const dynamic = 'force-dynamic'`)

### Approach B — API Route + Client Fetch (fallback)

```
/api/admin/analytics/route.ts      ← POST / GET; requires admin session
  getCurrentAdmin()                ← server-side guard
  aggregate queries                ← service_role + server client
  return NextResponse.json({...})  ← aggregate counts only

/admin/analytics/page.tsx          ← Client Component with useEffect fetch
```

**Advantages**:
- Allows client-side refresh button without page reload
- Easier to unit-test the query layer independently

**Disadvantages**:
- Extra surface area (new API route)
- service_role key gating must be enforced in the route handler
  separately from the page guard — two auth checks to maintain
- Loading states on first paint

### Recommendation

**Use Approach A** for v1. The dashboard is admin-internal and
infrequent enough that full-page refresh is acceptable. This avoids
creating a new API route, keeps the service_role usage co-located with
the guard, and follows the established admin page pattern.

---

## 7. UI Sketch

The following is a wire-level description, not an implementation. Exact
styling follows the existing admin panel design language (dark glass
cards, white/opacity text, border-white/8 sections).

```
/admin/analytics

┌─────────────────────────────────────────────────────────┐
│  ← Back to Admin       Analytics                        │
│                              [Refresh] button (v2)      │
│                                                         │
│  ─── Users ──────────────────────────────────────────   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Total    │  │ New (7d) │  │ New (30d)│              │
│  │  users   │  │          │  │          │              │
│  │  12,345  │  │   +42    │  │  +198    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│  ─── Interactions ───────────────────────────────────   │
│  Follows:   total 4,821 · unique users 1,234            │
│  Saves:     total 2,103 · unique users   867            │
│  Reminders: total   954 · unique users   401            │
│                                                         │
│  ─── Notifications ──────────────────────────────────   │
│  Total: 38,211   Unread: 4,102                          │
│                                                         │
│  ─── Content ────────────────────────────────────────   │
│  Published events: 247   Draft: 13                      │
│                                                         │
│  ─── Candidates / Pipeline ──────────────────────────   │
│  pending: 42  approved: 891  rejected: 127              │
│  By source: crawler 856 · manual 204                    │
│                                                         │
│  ─── Crawler Sources ────────────────────────────────   │
│  Active: 6 / 6 total                                    │
│  blackpink_official_tour · jyp_schedule · yg_artist_schedule │
│  wakeone_notice · smtown_notice · kpopofficial_concerts │
│                                                         │
│  ─── Admins ─────────────────────────────────────────   │
│  Admin users: 2                                         │
└─────────────────────────────────────────────────────────┘
```

Stat card visual pattern:
- Same `rounded-[24px] border border-white/8 bg-white/[0.035] p-4`
  card used in existing admin sections
- Large number in `text-2xl font-bold text-white`
- Label in `text-[11px] font-medium uppercase tracking-[0.24em] text-white/40`
- Positive delta in `text-emerald-300`

No chart library is required for v1 — plain numbers only. Charts are v2.

---

## 8. Risks

| risk | mitigation |
|---|---|
| `service_role` key missing from env | Display `—` for auth.users metrics AND for user-scoped site-wide aggregates (user_follows / saved_events / reminders / notifications); public non-user tables still render; never crash the page |
| Admin role blocked by user-scoped RLS on public tables | Audit `user_follows`, `saved_events`, `reminders`, `notifications` RLS policies before runtime implementation; use `service_role` for any table where full-table COUNT is blocked; fail safe to `—` rather than returning the admin's own row count as a site-wide figure |
| `SUPABASE_SERVICE_ROLE_KEY` accidentally set with `NEXT_PUBLIC_` prefix | Block via lint rule or CI env check; document explicitly in runtime work order |
| `service_role` set to `sb_secret_...` format instead of JWT `eyJ...` | Runtime check: if key does not start with `eyJ`, throw server-side with a clear error; never expose message to browser |
| Dashboard slow if all queries run sequentially | Use `Promise.all([...])` for all aggregate queries |
| Stale numbers served from Vercel cache | `export const dynamic = 'force-dynamic'` on the page; never set `revalidate` to a positive number |
| No activity log = no reliable DAU/MAU | Explicitly documented as v2 scope; v1 uses DISTINCT user_id from interaction tables as a floor approximation |
| auth.users schema changes by Supabase | All auth.users queries are COUNT-only; minimal surface area; note in runtime work order to validate after Supabase upgrades |
| Admin sees aggregate that looks like individual data | UI copy must make clear that all numbers are site-wide totals, not linked to any individual user |
| Personal data in aggregate row count | COUNT(*) returns a number — no PII at rest or in transit |

---

## 9. Acceptance Criteria (this planning PR)

This PR is acceptable if and only if:

- [x] All v1 metrics defined with source table and service_role requirement
- [x] All v2 metrics explicitly deferred with reason
- [x] Privacy boundary written (§3) with 6 hard limits
- [x] auth.users access strategy written (§4) with both access paths documented
- [x] Approximation fallback for missing service_role key documented (auth.users → `—`; user-scoped aggregates → `—`; public non-user tables → still render)
- [x] Data source inventory (§5) covers all 9 tables with personal-data flag and corrected service_role column (user-scoped tables marked "maybe — likely yes")
- [x] RLS audit requirement documented: runtime PR must verify whether admin role can full-table COUNT user-scoped tables; use service_role if blocked
- [x] Both technical approaches documented (§6) with trade-offs
- [x] Approach A recommended with rationale
- [x] UI sketch (§7) covers all metric sections
- [x] Risk table (§8) includes service_role mis-configuration, stale cache, no activity log
- [x] No runtime code added in this PR
- [x] No API route added in this PR
- [x] No schema change / migration added in this PR
- [x] No SQL executed in this PR
- [x] No auth / service_role implementation added in this PR
- [x] No front-end UI component added in this PR
- [x] No crawler change in this PR
- [x] No notifications change in this PR
- [x] `WORKING.md` updated with one progress row pointing at this PR

---

## 10. Runtime Work Order Scope (preview — not committed here)

When GPT approves this document, the separate implementation PR must:

1. Create `/admin/analytics/page.tsx` (Approach A — Server Component)
2. Add `export const dynamic = 'force-dynamic'` to prevent caching
3. Use `getSupabaseServiceClient()` for auth.users queries (behind
   `import 'server-only'`)
4. Use parallel `Promise.all([...])` for all aggregate queries
5. **Audit RLS policies** for `user_follows`, `saved_events`, `reminders`,
   `notifications` before writing queries — confirm whether the admin
   role (authenticated) can perform a full-table COUNT; if blocked by
   user-scoped RLS, use `getSupabaseServiceClient()` for those tables too
5a. Handle `service_role` key missing — show `—` for auth.users metrics
   AND for any user-scoped table that requires service_role for site-wide
   aggregation; public non-user tables (`events`, `event_candidates`,
   `crawler_sources`, `admin_users`) still render via regular server client
6. Create `AnalyticsDashboard` client component for rendering only
7. Add link to `/admin/analytics` in the admin nav / sidebar
8. Validate that `SUPABASE_SERVICE_ROLE_KEY` starts with `eyJ` at
   server startup (log warning, do not crash)
9. **No new migration**, **no new table**, **no RLS change**
10. Build must pass; no TypeScript errors

---

## 11. Hand-off Notes

1. The existing admin auth guard is `getCurrentAdmin()` in
   `src/lib/auth/adminAuth.ts`. The runtime page must call this first.
2. `getSupabaseServiceClient()` is in `src/lib/supabase/serverClient.ts`
   (already exists for notifications). Reuse without modification.
3. `SUPABASE_SERVICE_ROLE_KEY` must already be set in Vercel Production
   if the notifications cron is working. Verify before implementing.
4. Do NOT add new environment variables for this feature — reuse
   existing `SUPABASE_SERVICE_ROLE_KEY`.
5. The Supabase `auth` schema query syntax:
   ```ts
   const { count } = await serviceClient
     .from('users')
     .select('*', { count: 'exact', head: true })
     .schema('auth')
   ```
   This is the only way to query `auth.users` via the JS client; raw
   SQL is not available through the SDK in this pattern.
6. Table client selection for the runtime PR:
   - `events`, `event_candidates`, `crawler_sources`, `admin_users` —
     no user-scoped RLS; use regular server client.
   - `user_follows`, `saved_events`, `reminders`, `notifications` —
     have user-scoped RLS (`WHERE user_id = auth.uid()`); a standard
     authenticated client will return only the admin's own rows.
     **Audit these RLS policies first.** If full-table COUNT is blocked,
     use `getSupabaseServiceClient()` and query aggregate counts only
     (never SELECT user_id or row-level data). If the audit reveals an
     existing admin SELECT policy that allows full-table access, the
     regular server client may suffice — document the finding in the
     runtime PR.
