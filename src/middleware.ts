import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase auth session refresh middleware.
 *
 * Why this exists
 * ───────────────
 * `@supabase/ssr` in Next.js App Router requires a middleware that runs on
 * every request to:
 *
 *   1. Read auth cookies from the incoming request
 *   2. If the access_token is expired, call refresh_token → new access_token
 *   3. Write the refreshed cookies back onto the response
 *
 * Without this, the access_token quietly expires in the user's browser. The
 * NEXT page load then triggers a refresh inside whichever Supabase call
 * happens first — and on the client side that refresh can silent-hang,
 * breaking /me and /favorites with an infinite "載入中…" spinner.
 *
 * `src/lib/supabase/serverClient.ts` originally noted this was "to be added
 * in a later phase" — this file is that later phase.
 *
 * Scope
 * ─────
 * - Reads session, refreshes if needed, writes cookies back. Nothing else.
 * - Does NOT gate routes (no redirects). Auth-protected pages still gate
 *   themselves with `getCurrentUser()` / `getCurrentAdmin()`.
 *
 * Matcher excludes Next.js internals + public assets so we don't pay the
 * refresh cost on /_next/static, image optimizer, manifest, etc.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // Touching auth here is what triggers the refresh-if-needed flow. The
  // return value is intentionally discarded — we only care about the
  // cookie side-effects landing on `response`.
  await supabase.auth.getUser()

  return response
}

export const config = {
  /**
   * Run on every request except:
   *   - Next.js internals (_next/static, _next/image)
   *   - Common static files at the root
   *   - API routes that have their own auth (admin guards, cron secret)
   *
   * Keeping API routes out avoids double cookie writes when an admin
   * action also calls supabase.auth on the server.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|api/).*)',
  ],
}
