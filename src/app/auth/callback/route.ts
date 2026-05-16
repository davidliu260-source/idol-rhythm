import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/serverClient'

/**
 * Magic link callback handler.
 *
 * Supabase redirects the user here after they click the link in their email.
 * The redirect carries a `code` query param (PKCE flow). We exchange that code
 * for a session via @supabase/ssr, which writes the auth cookies into the
 * response automatically.
 *
 * Query params:
 *   - code: PKCE code from Supabase. Required for the exchange.
 *   - next: relative path to redirect to after success. Defaults to /me.
 *   - error / error_description: passed through to /login on failure.
 *
 * This handler does NOT support OAuth callbacks. It is magic-link only.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = sanitizeNextPath(url.searchParams.get('next'))

  // Supabase may also redirect with error params (e.g. expired link).
  // Surface those back on the login page.
  const errParam = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  if (errParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errParam)}`, request.url),
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=' + encodeURIComponent('登入連結缺少 code 參數'), request.url),
    )
  }

  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.redirect(
      new URL('/login?error=' + encodeURIComponent('Supabase 未設定'), request.url),
    )
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=' + encodeURIComponent(error.message), request.url),
    )
  }

  return NextResponse.redirect(new URL(next, request.url))
}

/**
 * Only allow internal relative paths for `next`. Prevents open-redirect
 * (e.g. /auth/callback?next=//evil.com).
 */
function sanitizeNextPath(raw: string | null): string {
  if (!raw) return '/me'
  if (!raw.startsWith('/')) return '/me'
  if (raw.startsWith('//')) return '/me'
  return raw
}
