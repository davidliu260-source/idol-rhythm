import type { ReactNode } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { SCHEDULE_ARCHIVE_SHELL } from '@/app/schedule/scheduleTheme'

export default function AuthArchiveLayout({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  icon,
  headerAside,
  children,
}: {
  backHref: string
  backLabel: string
  eyebrow: string
  title: string
  description: ReactNode
  icon: ReactNode
  headerAside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(255,90,174,0.16),transparent_24%),linear-gradient(180deg,#17111d_0%,#09070d_100%)] pb-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:34px_34px] opacity-24" />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pb-6 pt-8">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>

        <section className={clsx(SCHEDULE_ARCHIVE_SHELL, 'px-5 py-5')}>
          <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/6" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.85)_1px,transparent_0)] [background-size:13px_13px]" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-[#ff6cb7]/25 bg-[#ff4ca1]/12 text-[#ff6cb7]">
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/34">
                      {eyebrow}
                    </p>
                    <h1 className="mt-2 text-[34px] font-black leading-none tracking-normal text-white">
                      {title}
                    </h1>
                  </div>
                </div>
                <div className="mt-4 text-sm leading-6 text-white/58">{description}</div>
              </div>
              {headerAside ? (
                <div className="rounded-[18px] border border-white/8 bg-white/[0.045] px-3 py-2 text-right">
                  {headerAside}
                </div>
              ) : null}
            </div>

            <div className="mt-5">{children}</div>
          </div>
        </section>
      </div>
    </div>
  )
}
