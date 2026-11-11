# Account Settings v1 — Work Order

> Status: **proposal / work order only**.
>
> Scope: design only. Do NOT implement runtime code, do NOT change `/me`,
> do NOT add API routes, do NOT touch schema, do NOT add migration in this
> PR. Implementation is a separate PR after GPT audit of this work order.
>
> Created: 2026-05-22
> Owner: idol-rhythm

---

## 1. Goal

Let an authenticated user change their email and delete their own account
from inside the app, without admin intervention. This closes the largest
remaining account-management gap (`/me` currently only supports sign-out).

This work order covers v1 only. Future scope (2FA, change password,
export data, account deactivation, admin-initiated deletion of others'
accounts) is explicitly out of scope.

---

## 2. In Scope (v1)

- User changes their own email
- User deletes their own account (irreversible)

## 3. Out of Scope (v1)

- 2FA / MFA
- Change password (a separate `/forgot-password` flow already exists)
- Export personal data
- Soft deactivation (vs hard delete)
- Admin deleting other users' accounts (no UI, no API surface)
- Re-registering with the same email immediately after delete (no
  cooldown / reservation logic in v1)

---

## 4. Change-Email Flow

### 4.1 Trigger

User opens an account-settings entry point (see §7) and submits a new
email address from a small form.

### 4.2 Mechanism

- Client calls `supabase.auth.updateUser({ email: newEmail })` using the
  browser Supabase client (existing `browserClient.ts`).
- Supabase sends a confirmation email to the **new** address.
- The current session email does NOT change until the user clicks the
  confirmation link in that email. (This is Supabase's standard
  "secure email change" behaviour; we do not bypass it.)

### 4.3 UI States

| State | What user sees |
|---|---|
| Idle | Current email + input field for new email + "Send confirmation" button |
| Invalid input | Inline error: "Email format invalid" or "Same as current email" |
| Loading | Disabled button + spinner |
| Success | Banner: "Confirmation email sent to {newEmail}. Click the link to complete the change. Your current email stays active until then." |
| Error | Inline error from Supabase (translated to plain Chinese if reasonable; do not leak raw stack) |

### 4.4 Known Risks / Open Questions

| Risk | Note |
|---|---|
| New email already used | Supabase returns error → surface as friendly message |
| OAuth (Google) user changing email | **Behaviour must be empirically tested** before claiming support. Some providers tie account identity to provider email; calling `updateUser({ email })` on a Google-OAuth user may either (a) succeed and decouple Supabase email from Google identity, or (b) fail. Implementation PR must include a manual test result with both an email/password account and a Google account. |
| Future Apple Sign-In | Same uncertainty as Google. Apple even returns a relay email by default. Out of v1 scope, but the change-email UI should NOT hide the option for OAuth users — the failure (if any) should be a clear error message, not a UI block. |
| User loses access to the new email midway | Confirmation never clicks → no change happens. Document in UI copy that the link is required. |
| Rate limiting | Supabase enforces its own email rate limits. Don't add custom throttle in v1; rely on Supabase's response. |

### 4.5 Server / Schema Touchpoints

- **None.** Change-email is fully handled by `supabase.auth.updateUser`
  on the browser client. No API route, no migration, no RLS change.

---

## 5. Delete-Account Flow

### 5.1 Identity Model

Delete logic keys off `auth.users.id` — the canonical Supabase user id —
**not** off the login provider. This means a single delete path covers:

- Email / password accounts
- Google OAuth accounts
- Future Apple Sign-In accounts

`auth.users.id` is stable across providers for a given Supabase user.

### 5.2 Trigger

User opens account settings, scrolls to a clearly marked **Danger Zone**,
clicks "Delete account". A second-confirmation modal appears.

### 5.3 Confirmation Modal

Modal must include:

- Heading: "刪除帳號（不可復原）" / "Delete account (irreversible)"
- Plain-language list of what will be erased:
  - 追蹤的偶像（user_follows）
  - 收藏的活動（saved_events）
  - 個人提醒（reminders）
  - 站內通知（notifications）
  - 帳號本身（auth.users）
- One of (decide in implementation PR; either is acceptable):
  - **Option Conservative**: user types their current email exactly to enable the confirm button
  - **Option Lighter**: user ticks a checkbox "我了解此操作不可復原 / I understand this is irreversible" to enable the confirm button
- A "Cancel" button (default focus) and a destructive "Delete account" button (red).
- Disable the destructive button until confirmation gate passes.

### 5.4 Wire Protocol

- New server route: `POST /api/account/delete`
- **Body is intentionally empty**. The route must NOT accept a `userId`
  field. The target user is always the currently authenticated session
  user.
- Response: `{ ok: true }` on success, `{ ok: false, error: "..." }` on
  failure.
- Cookies / session are cleared in the same response or by a subsequent
  client-side `supabase.auth.signOut()` (whichever is more reliable on
  Next.js App Router + SSR middleware; implementation PR decides).

### 5.5 Server Logic (high level — not code)

```
POST /api/account/delete
  1. user = await getCurrentUser()          // server, reads session cookie
  2. if (!user) return 401
  3. service = getSupabaseServiceClient()   // server-only, throws if env missing
  4. const { error } = await service.auth.admin.deleteUser(user.id)
  5. if (error) {
       log internally;
       return 500 with a generic message — do NOT echo service-role error to client
     }
  6. return { ok: true }
```

Notes:

- The handler MUST use `getCurrentUser()` (which calls
  `supabase.auth.getUser()` against the session cookie) and pass
  `user.id` into `admin.deleteUser`. It MUST NOT take a userId from the
  request body, query string, header, or anywhere else client-controlled.
- `getSupabaseServiceClient()` already enforces `'server-only'` at import
  time. Do not relax that guard.
- If `SUPABASE_SERVICE_ROLE_KEY` is missing in env, the helper already
  throws loudly; the handler should turn that into a clean 500 with a
  non-leaking message ("帳號刪除暫不可用").

### 5.6 Client Post-Delete

After the API returns success:

1. Client calls `supabase.auth.signOut()` to drop the local cookie/session.
2. Client redirects to `/` or `/login` (decide in implementation PR;
   `/` with a one-time toast "帳號已刪除" is friendlier).
3. The deleted session must NOT be able to load `/me`, `/favorites`, etc.
   on the next request. (Verify via the SSR middleware behaviour.)

---

## 6. Data Cleanup — Cascade Inventory

### 6.1 What was checked

`grep -nE "REFERENCES auth.users|CASCADE|SET NULL"` across all migrations:

| Table | FK column | Behaviour | Source |
|---|---|---|---|
| `user_follows` | `user_id` | **ON DELETE CASCADE** | migration 001 line 231 |
| `saved_events` | `user_id` | **ON DELETE CASCADE** | migration 001 line 247 |
| `reminders` | `user_id` | **ON DELETE CASCADE** | migration 001 line 263 |
| `notifications` | `user_id` | **ON DELETE CASCADE** | migration 042 line 68 |
| `admin_users` | `user_id` | **ON DELETE CASCADE** | migration 002 line 52 |
| `event_candidates` | reviewer-style FK | `ON DELETE SET NULL` | migration 001 line 315 |
| `event_sources` | `created_by` | `ON DELETE SET NULL` | migration 001 line 333 |
| `user_activity_logs` | `user_id` | `ON DELETE SET NULL` | migration 001 line 349 |

### 6.2 Method A (cascade complete) — current state

All four user-scoped tables that hold personal user data
(`user_follows`, `saved_events`, `reminders`, `notifications`) already
cascade-delete on `auth.users`. Calling
`supabase.auth.admin.deleteUser(user.id)` will:

- Remove the `auth.users` row
- Auto-remove all rows in the four tables above for that user_id
- Auto-remove the `admin_users` row if the deleted user happened to be
  an admin (no UI prevents this; flagged as known behaviour)
- Null out `user_id` on `event_candidates`, `event_sources`,
  `user_activity_logs` — these are audit / history records that must
  survive user deletion. Correct by design.

**Conclusion: Method A applies. No migration 046 needed for v1.**

### 6.3 Method B (cascade incomplete) — not needed, but documented

If a future audit discovers a user-scoped table without ON DELETE
CASCADE, the implementation PR would need:

- migration 046 to add `ON DELETE CASCADE` (or an explicit cleanup step
  in the delete API)
- A pre-implementation re-check of every FK that references
  `auth.users(id)`

We do not branch into Method B in v1.

### 6.4 Acceptance verification (during implementation PR)

After the delete API runs, the test plan must include a SQL check (in
Supabase SQL Editor against a throwaway test account):

```sql
SELECT 'user_follows'  AS tbl, COUNT(*) FROM public.user_follows  WHERE user_id = '<deleted-uuid>'
UNION ALL
SELECT 'saved_events',         COUNT(*) FROM public.saved_events  WHERE user_id = '<deleted-uuid>'
UNION ALL
SELECT 'reminders',            COUNT(*) FROM public.reminders     WHERE user_id = '<deleted-uuid>'
UNION ALL
SELECT 'notifications',        COUNT(*) FROM public.notifications WHERE user_id = '<deleted-uuid>'
UNION ALL
SELECT 'admin_users',          COUNT(*) FROM public.admin_users   WHERE user_id = '<deleted-uuid>';
```

All five counts must be `0`. If any row >0, that table's FK is broken
and Method B must kick in before shipping.

---

## 7. UI / Entry-Point Plan

### 7.1 Option chosen (recommended for implementation PR)

Add a new page **`/account/settings`** and link to it from `/me`.
Reason: `/me` is already a dense Personal Console; account settings
deserve their own surface and are not used often enough to share screen
space.

### 7.2 Page structure (text sketch)

```
/account/settings
├─ Page header: "帳號設定"
├─ Section: 目前帳號
│   ├─ Email: {user.email}                     (read-only display)
│   └─ 登入方式: Email / Google / Apple        (read-only, derived from auth.users.identities)
├─ Section: 更改 email
│   ├─ Input: 新 email
│   ├─ Button: 寄送確認信
│   └─ Helper text: "我們會寄出確認連結到新 email，點擊後才會生效。原 email 在確認前仍然有效。"
├─ Section: 危險區（Danger Zone）— red border / red header
│   ├─ Heading: 刪除帳號
│   ├─ Body: "刪除後將無法復原。我們會永久刪除..."
│   ├─ Bullet list (see §5.3)
│   └─ Button: 刪除帳號 → opens confirmation modal
└─ Footer: 回到 /me
```

### 7.3 Where in `/me` does the link live

A single discrete "帳號設定" item somewhere in the existing Personal
Console — not in a destructive location. The exact placement is a UI
detail for the implementation PR (do NOT redesign `/me` in v1).

### 7.4 Not-logged-in state

`/account/settings` must redirect to `/login?returnUrl=/account/settings`
if `getCurrentUser()` returns null on SSR. Mirrors existing behaviour of
`/me`, `/favorites`, `/notifications`.

---

## 8. Security Boundary Checklist

The implementation PR must satisfy every item below; otherwise GPT
should block the merge.

- [ ] `POST /api/account/delete` is server-side only (Next.js route
      handler).
- [ ] Route handler calls `getCurrentUser()` and returns 401 on null.
- [ ] Route handler ignores any client-supplied `userId` / `email` /
      `target` field. Target id is always `user.id` from server session.
- [ ] `getSupabaseServiceClient()` is called inside the route handler;
      the existing `'server-only'` guard remains in place.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` stays out of `NEXT_PUBLIC_*` env.
- [ ] No client component imports `serviceClient.ts` (build-time check
      via `'server-only'` already enforces this; do not weaken it).
- [ ] On `auth.admin.deleteUser` error, the response body returns a
      generic message; the raw error is only logged server-side. Do not
      echo Supabase Auth error codes / stacks to the browser.
- [ ] On success, client clears the session (`supabase.auth.signOut()`)
      and redirects away from authenticated areas.
- [ ] `/account/settings` SSR loader redirects to `/login` when no
      session.
- [ ] Change-email path uses the browser client + `updateUser({ email })`
      only. It does NOT touch the service role and does NOT add a server
      route.
- [ ] No new GRANT, RLS change, or schema change.

---

## 9. Acceptance Criteria (plain language)

### 9.1 Change email

- [ ] Logged-in email/password user can submit a new email and sees a
      confirmation banner pointing at the new inbox.
- [ ] Submitting an email already used returns a friendly inline error.
- [ ] Submitting the same email as the current one returns a friendly
      inline error (no API call needed).
- [ ] Submitting an invalid format returns a client-side validation
      error.
- [ ] Until the confirmation link in the new inbox is clicked, the user
      can still sign in with the old email.
- [ ] Google OAuth account behaviour is empirically tested and
      documented in the implementation PR description — pass or fail.
      Failure must surface a clear error in the UI, not a silent crash.

### 9.2 Delete account

- [ ] Unauthenticated request to `POST /api/account/delete` returns 401.
- [ ] Body containing `{ userId: "<other-user>" }` is ignored —
      authenticated requests always delete the session user.
- [ ] The confirmation modal blocks the destructive button until the
      gate (typed email or ticked checkbox) is satisfied.
- [ ] After success, the original session cookie no longer authenticates
      on subsequent requests (`/me` and `/favorites` redirect to
      `/login`).
- [ ] After success, the SQL check in §6.4 returns 0 rows in all five
      tables for the deleted user_id.
- [ ] Google OAuth user can delete and end up in the same final state
      (no `auth.users` row, no related rows).
- [ ] Future Apple Sign-In user (when added) reuses the same endpoint
      with no code change.
- [ ] No service-role token is observable in browser DevTools network
      tab on any response.

---

## 10. Migration 046 — decision gate

- Current cascade audit (see §6.1) shows Method A applies → **no
  migration needed in v1**.
- The implementation PR must re-run the cascade audit before coding to
  confirm nothing changed in between. If a new user-scoped table was
  added without ON DELETE CASCADE (e.g. a future "user preferences"
  table), block the implementation PR until that table's FK is fixed
  (Method B). Do not bypass.
- migration 046 may NOT be introduced in this work-order PR. It can
  only be added as part of a separate implementation PR if cascade gaps
  are found at that point.

---

## 11. Risks / Things to Watch

- **Admin self-delete**: a Supabase user who is in `admin_users` and
  uses `/account/settings` to delete themselves will lose admin access.
  The cascade in migration 002 removes the `admin_users` row, which is
  the desired outcome (no orphan admin record). UI does not need to
  block this in v1.
- **In-flight notification cron**: if the user is deleted while N6/N7
  dispatch crons are running, the cascade may delete `notifications`
  rows mid-loop. The current dispatch routes use `service_role` upserts
  with `ignoreDuplicates`; they should not crash on a missing user, but
  the implementation PR should sanity-check that branch with a manual
  delete during a manual cron trigger.
- **Re-registration with the same email**: Supabase allows the same
  email to register again after delete. v1 makes no promise of
  cooldown / reservation. Document this in the confirmation modal copy
  if space allows.
- **OAuth provider state**: deleting `auth.users` does NOT revoke
  Google's OAuth grant on the user's side. The user may need to revoke
  app access in their Google Account → Security → Third-party apps.
  Mention in delete confirmation copy.
- **Localization**: v1 copy is Chinese-first; English fallback strings
  optional in v1 since the rest of the app is Chinese-first.

---

## 12. Implementation PR — Hand-off Notes

When this work order is approved, the implementation PR should:

1. Re-run the cascade audit (§6.1) on the latest schema.
2. Add `/account/settings/page.tsx` + a client component for the form +
   the destructive modal. Reuse existing form styles from
   `/forgot-password` / `/reset-password` where reasonable.
3. Add `src/app/api/account/delete/route.ts` (server route, satisfies
   §8 checklist).
4. Add a discrete "帳號設定" entry from `/me` (no `/me` redesign).
5. No new env vars. No new dependencies.
6. `npm run build` passes.
7. Manual test with both an email/password account and a Google OAuth
   account; record results in the PR body.

The implementation PR should NOT add 2FA, change-password, soft-delete,
or any other feature beyond v1.

---

## 13. Not In Scope (reminder)

- 2FA / MFA
- Change password
- Export personal data
- Soft account deactivation
- Admin-side user deletion UI
- Re-registration cooldown
- Cross-device session revocation beyond what `signOut()` already does
