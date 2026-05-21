export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Mail, ShieldCheck } from 'lucide-react'
import AuthArchiveLayout from '@/components/AuthArchiveLayout'
import { getCurrentUser } from '@/lib/supabase/auth'
import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string }
}) {
  const user = await getCurrentUser()
  const next = sanitizeNextPath(searchParams.next)

  // Already signed in
  if (user) {
    return (
      <AuthArchiveLayout
        backHref="/me"
        backLabel="回到個人頁"
        eyebrow="ACCESS ARCHIVE"
        title="會員入口"
        description="你目前已經在 archive 內。若要查看提醒、收藏與通知入口，可以直接回到個人控制台。"
        icon={<ShieldCheck className="h-5 w-5" />}
        headerAside={
          <>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-200/60">
              Session
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-200">已登入</p>
          </>
        }
      >
        <div className="rounded-[24px] border border-emerald-400/18 bg-emerald-400/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-100">已登入</p>
              <p className="mt-1 break-all text-xs leading-6 text-emerald-100/72">
                {user.email ?? '—'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/me"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.1]"
            >
              前往我的控制台
            </Link>
            <Link
              href={next}
              className="inline-flex items-center rounded-full border border-[#ff6cb7]/24 bg-[#ff4ca1]/14 px-4 py-2 text-sm font-semibold text-[#ff9ed3] transition-colors hover:bg-[#ff4ca1]/20"
            >
              繼續原本流程
            </Link>
          </div>
        </div>
      </AuthArchiveLayout>
    )
  }

  return (
    <AuthArchiveLayout
      backHref="/me"
      backLabel="回到個人頁"
      eyebrow="ACCESS ARCHIVE"
      title="登入會員"
      description="把你的收藏、追蹤、提醒和通知入口同步到帳號裡。之後換裝置、登入 app，都能回到同一份 archive。"
      icon={<Mail className="h-5 w-5" />}
      headerAside={
        <>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
            Entry
          </p>
          <p className="mt-1 text-xs font-semibold text-white">Login / Signup</p>
        </>
      }
    >
      {searchParams.error ? (
        <div className="mb-4 rounded-[22px] border border-red-400/25 bg-red-500/10 px-4 py-3">
          <p className="text-xs leading-6 text-red-200">
            登入失敗：{searchParams.error}
          </p>
        </div>
      ) : null}

      <LoginForm nextPath={next} />
    </AuthArchiveLayout>
  )
}

/**
 * Only accept internal relative paths for `next`.
 * Rejects external URLs (https://evil.com) and protocol-relative URLs (//evil.com).
 * Mirrors the sanitization in /auth/callback/route.ts so both layers agree.
 */
function sanitizeNextPath(raw: string | undefined): string {
  if (!raw) return '/me'
  if (!raw.startsWith('/')) return '/me'
  if (raw.startsWith('//')) return '/me'
  return raw
}
