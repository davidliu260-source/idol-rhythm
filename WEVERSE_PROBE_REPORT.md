# Weverse Public-Probe Report

> **Verdict: C — Not viable without login. Abandoned for v1.**
>
> Probe executed: 2026-05-23
> Work order: `CRAWLER_WORK_ORDER_WEVERSE.md` (PR #131 merged)
> Method: §10.1 — `curl` + observational fetches, no browser DevTools
> session; signed-out, cookie-free requests only.

---

## 1. TL;DR

`weverse.io` ships a **single 5478-byte React SPA shell** for every
public route the probe touched. There is no server-rendered content,
no inline JSON, no public read API observable without a browser
session, and the listed sitemap is itself the SPA shell rather than a
real index. Per the work order's hard rule, any path that requires JS
hydration via authenticated endpoints automatically yields **Verdict
C**, and that is the case here.

No follow-up runtime work order will be opened. Weverse coverage gap
for HYBE-system artists remains and is left to existing mitigations
(aggregator + manual entry).

---

## 2. Evidence

### 2.1 Shell uniformity

Every URL touched returned the same `Content-Length: 5478` HTML body
served by CloudFront with `cache-control: no-store, no-cache,
must-revalidate`. Verified for:

| URL | HTTP | bytes |
|---|---:|---:|
| `https://weverse.io/bts` | 200 | 5478 |
| `https://weverse.io/bts/notice` | 200 | 5478 |
| `https://weverse.io/bts/artist` | 200 | 5478 |
| `https://weverse.io/bts/media` | 200 | 5478 |
| `https://weverse.io/bts/moment` | 200 | 5478 |
| `https://weverse.io/bts/shop` | 200 | 5478 |
| `https://weverse.io/bts/fanletter` | 200 | 5478 |
| `https://weverse.io/bts/live` | 200 | 5478 |
| `https://weverse.io/bts/notice/1` | 200 | 5478 |
| `https://weverse.io/bts/notice/100` | 200 | 5478 |
| `https://weverse.io/bts/notice/12345` | 200 | 5478 |
| `https://weverse.io/bts/notice/999999` | 200 | 5478 |
| `https://weverse.io/sitemap.xml` | 200 | 5478 (text/html, NOT xml) |

All twelve files were byte-identical. The shell is a single
`<div id="root"></div>` plus a theme-bootstrap script and ~16 Vite-
bundled JS asset preloads from `cdn-v2pstatic.weverse.io`. Even
deliberately invalid notice ids returned the same 200 OK shell, which
is canonical SPA behaviour — the server has no knowledge of which
artist or which notice is being requested.

### 2.2 Inline JSON / hydration markers

```
grep -ciE "__NEXT_DATA__|__INITIAL_STATE__|window\.__|application/json"
  /tmp/weverse_bts_landing.html
0
```

**Zero hits.** The shell contains a theme script, preconnect hints,
and asset preloads — nothing else. No SSR snapshot, no preloaded
state, no JSON-LD article markup, no Open Graph notice metadata
worth parsing.

### 2.3 Content-bearing tags

```
grep -ciE "notice|article|post|<h1|<h2|bts" /tmp/weverse_bts_landing.html
0
```

The HTML does not contain the artist's name or any post / notice /
article tag. Title is the generic "Global Fandom Platform - Weverse".

### 2.4 Community existence sweep

All probe-list communities exist as URLs (200 OK):

```
seventeen, txt, enhypen, lesserafim, katseye,
fromis_9, zerobaseone, ateez, ive  → all 200
```

But existence is moot: each one would serve the same empty shell.
Per-community membership / login state is not visible in the static
response and would require a JS + API session to evaluate.

### 2.5 robots.txt

```
User-agent: *

Sitemap: https://weverse.io/sitemap.xml
```

No `Disallow` directives — permissive on paper. **However the cited
sitemap is itself the SPA shell** (text/html, 5478 bytes), so the
robots.txt does not actually expose a machine-readable URL index. The
permissiveness is academically true but practically meaningless
because the server publishes nothing parseable to follow.

### 2.6 Anti-bot / rate-limit

5 sequential GETs to `https://weverse.io/bts` with 2s spacing all
returned HTTP 200 from CloudFront. No 429, no challenge page. This is
**not** evidence of crawler-friendly behaviour — it merely reflects
that we were fetching a cacheable static SPA shell, not real data.
The actual content APIs (`accountapi.weverse.io`,
`global.apis.naver.com`) were not touched in this probe and their
anti-bot posture is unknown. Out of scope per the work order.

### 2.7 Locale split

```
Accept-Language: ko-KR  → 200, 5478 bytes
Accept-Language: en-US  → 200, 5478 bytes
```

Same shell. Locale handling is entirely client-side.

### 2.8 SDK preconnect hints (read at face value)

The shell preconnects to:

- `web-account-sdk.weverse.io`
- `accountapi.weverse.io`
- `global.apis.naver.com`
- `weverse-phinf.pstatic.net` (image CDN)
- `cdn-v2pstatic.weverse.io` (JS bundles)

`account` and `accountapi` are explicit account-state endpoints. The
SPA boots, asks the account SDK who the viewer is, then fetches
content from one of the API surfaces with whatever credentials it
established. **The probe makes no attempt to hit those surfaces.**

---

## 3. Probe Questions (from work order §6)

| # | Question | Answer |
|---|---|---|
| 1 | Public landing server-rendered or empty shell? | **Empty shell** (single `<div id="root">` + spinner) |
| 2 | Inline `__NEXT_DATA__` / `__INITIAL_STATE__` / JSON? | **None** — zero grep hits |
| 3 | Public no-auth XHR returning notice/media? | **Not observable from static probe.** SPA preconnects to `accountapi.weverse.io` and `global.apis.naver.com`; any meaningful read requires hitting those, which is out of scope. |
| 4 | Notice list visible logged-out? | **Cannot tell from static HTML** — but moot, since the static HTML carries nothing regardless |
| 5 | Notice detail URLs are stable permalinks? | **URL pattern exists** (`/bts/notice/{id}`) but every id, valid or not, returns the same shell — so the URL has no parseable identity at the static layer |
| 6 | Pagination? | **Not observable in static layer.** Client-side, likely cursor-based |
| 7 | Publish timestamps machine-parsable? | **N/A** — no timestamps in static HTML |
| 8 | Artist attribution explicit? | **N/A** — no artist marker in static HTML |
| 9 | Bot-detection on small fetch volume? | **No 429 / challenge** at 5 × 2s on the static shell. Real API behaviour unknown. |
| 10 | Geographic gating? | **Same shell** for ko-KR and en-US |
| 11 | robots.txt / ToS anti-scraping clause? | robots.txt permissive but its cited sitemap is fake (SPA shell). ToS not skim-checked in this probe — not needed because Verdict C is reached without it. |

---

## 4. Verdict

### C. Not viable without login.

Per the work order's hard rule (§10.3, hand-off note 4):

> If at any point the path requires a cookie, token, login session,
> or `Authorization` header to retrieve the data, the verdict is
> automatically C. There is no judgement call there.

Weverse meets this trigger by construction: the static HTML carries
no content of any kind, and the only way to populate the page is to
execute the bundled JS, which preconnects to account / API endpoints
that exist solely to operate against a session. There is no
intermediate "partial public surface" path to design around (which
would have been Verdict B).

### What we are NOT doing as a result

- ❌ No `CRAWLER_WORK_ORDER_WEVERSE_NOTICE.md`
- ❌ No `parser_type = 'weverse_*'`
- ❌ No `crawler_sources` seed for any Weverse community
- ❌ No migration 046 / 047 for Weverse
- ❌ No cookie / login / token / SDK replay path (explicitly forbidden
       by work order §3; verdict reinforces this)
- ❌ No reverse engineering of `accountapi.weverse.io` or the Naver
       API endpoints

### What remains

- HYBE-system artists (BTS / SEVENTEEN / TXT / ENHYPEN / LE SSERAFIM
  / ILLIT / BOYNEXTDOOR / TWS / KATSEYE / &TEAM / CORTIS) continue
  to rely on:
  - `kpopofficial-concerts` aggregator (broad, not artist-specific)
  - Manual candidate entry via `/admin/event-candidates`
- Non-HYBE Weverse-using artists (fromis_9 / ATEEZ / (G)I-DLE / IVE)
  same as above. ZEROBASEONE additionally has WAKEONE notice
  crawler coverage (PR #126, migration 044).
- The Weverse gap is logged but not actively chased in v1.

---

## 5. Revisit Triggers

Re-open this probe only if one of:

1. Weverse Company / HYBE publishes a public, documented read API
   for community notices / events. (No such announcement at probe
   time.)
2. Idol Rhythm strikes a partnership / data-licensing agreement with
   Weverse Company. (Out of scope for the engineering track.)
3. Weverse adds server-side rendering for `/notice` or `/media`
   surfaces, which would change the static-HTML evidence in §2.

A change in the React build version (`cdn-v2pstatic.weverse.io/
weverse3/3_14_0/...` at probe time) is not by itself a trigger;
re-check only if behaviour observably differs.

---

## 6. Probe Artifacts

Captured for verification but **not** committed to the repo (transient
HTML; may include personal-data snippets in a future state — kept off
version control on principle, per work order §13 step 2):

- `/tmp/weverse_bts_landing.html` (5478 bytes)
- `/tmp/wv_notice.html`, `/tmp/wv_artist.html`, `/tmp/wv_media.html`,
  `/tmp/wv_moment.html`, `/tmp/wv_shop.html`, `/tmp/wv_fanletter.html`,
  `/tmp/wv_live.html` (each 5478 bytes, byte-identical to landing)
- `/tmp/wv_n_1.html`, `/tmp/wv_n_100.html`, `/tmp/wv_n_12345.html`,
  `/tmp/wv_n_999999.html` (each 5478 bytes)
- `/tmp/wv_sitemap.xml` (5478 bytes; content-type text/html, not xml)
- `/tmp/wv_bts_ko.html`, `/tmp/wv_bts_en.html` (each 5478 bytes)

All artifacts reproducible by running the curl commands described in
§2 with no cookies and a desktop Chrome UA.
