import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 gap-5 text-center">
      <div className="rounded-2xl border border-card-border bg-card p-6 max-w-sm w-full">
        <p className="text-3xl mb-3">🔍</p>
        <h2 className="text-base font-bold text-text-base mb-2">找不到頁面</h2>
        <p className="text-xs text-muted mb-5">你要找的頁面不存在</p>
        <Link
          href="/"
          className="block w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
        >
          回首頁
        </Link>
      </div>
    </div>
  )
}
