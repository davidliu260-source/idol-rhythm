// 執行方式：node scripts/check-must12-ics-cache-middleware.mjs
// 不連網、不連庫。核對：middleware 略過靜態檔但仍涵蓋頁面／後台／登入；
// 公開 ICS 帶 1 小時 CDN 快取標頭；私人 ICS 維持 private、不公開快取。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier,
      context,
    )
  },
})

const {
  PUBLIC_ICS_CACHE_CONTROL,
  PUBLIC_ICS_CACHE_HEADERS,
  PUBLIC_ICS_NOT_FOUND_HEADERS,
  PUBLIC_ICS_REVALIDATE_SECONDS,
  PUBLIC_ICS_STALE_WHILE_REVALIDATE_SECONDS,
  PUBLIC_ICS_UNCACHEABLE_HEADERS,
  publicIdolIcsHeaders,
} = await import('../src/lib/ics/publicIcsCache.ts')

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

function check(name, fn) {
  fn()
  console.log(`PASS ${name}`)
}

function withoutLineComments(source) {
  return source
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

function extractMatcherPattern(source) {
  const block = source.match(/export const config = \{[\s\S]*?matcher:\s*\[([\s\S]*?)\]/)
  assert.ok(block, '找不到 middleware config.matcher')
  const literals = [...block[1].matchAll(/'((?:\\.|[^'])*)'/g)].map((m) => Function(`return '${m[1]}'`)())
  assert.equal(literals.length, 1, `預期只有一個 matcher，實際 ${literals.length}`)
  return literals[0]
}

function matcherRegex(pattern) {
  assert.ok(pattern.startsWith('/'), `matcher 應以 / 開頭：${pattern}`)
  return new RegExp(`^${pattern}$`)
}

function isMiddlewarePath(regex, pathname) {
  return regex.test(pathname)
}

const middlewareSource = read('src/middleware.ts')
const publicIcsSource = read('src/app/api/ics/idols/[slug]/route.ts')
const personalIcsSource = read('src/app/api/ics/me/[token]/route.ts')
const followsFeedSource = read('src/lib/ics/followsFeed.ts')
const pattern = extractMatcherPattern(middlewareSource)
const regex = matcherRegex(pattern)

const MUST_RUN = [
  '/',
  '/schedule',
  '/idols',
  '/idols/bigbang',
  '/events/00000000-0000-0000-0000-000000000000',
  '/login',
  '/me',
  '/admin',
  '/admin/login',
  '/admin/events',
  '/admin/events/abc',
  '/account/settings',
  '/notifications',
  '/auth/callback',
  '/forgot-password',
  '/reset-password',
  '/atlas',
  '/cities',
  '/cities/taipei',
  '/opengraph-image',
]

const MUST_SKIP = [
  '/idol-marks/bigbang.svg',
  '/idol-marks/aespa.svg',
  '/favicon.ico',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/_next/static/chunks/main.js',
  '/_next/image',
  '/api/ics/idols/bigbang',
  '/api/ics/me/token',
  '/api/cron/sync-candidates',
  '/api/calendar-feed',
  '/api/account/delete',
  '/brand.webp',
  '/og.png',
  '/photo.jpg',
  '/photo.jpeg',
  '/anim.gif',
  '/hero.avif',
  '/fonts/NotoSansTC.woff',
  '/fonts/NotoSansTC.woff2',
  '/fonts/NotoSansTC.ttf',
  '/fonts/NotoSansTC.otf',
  '/fonts/fallback.eot',
]

check('middleware matcher 略過靜態檔，但仍涵蓋頁面、後台與登入／auth', () => {
  const missed = MUST_RUN.filter((path) => !isMiddlewarePath(regex, path))
  const leaked = MUST_SKIP.filter((path) => isMiddlewarePath(regex, path))
  assert.deepEqual(missed, [], `這些路徑應該跑 middleware：${missed.join(', ')}`)
  assert.deepEqual(leaked, [], `這些路徑不該跑 middleware：${leaked.join(', ')}`)
  assert.ok(middlewareSource.includes('supabase.auth.getUser()'), 'middleware 仍應在命中時呼叫 getUser')
  assert.ok(
    pattern.includes('idol-marks') === false && pattern.includes('svg'),
    'matcher 應用副檔名排除 SVG，而不是寫死單一目錄',
  )
})

check('公開 ICS 拿掉 force-dynamic，活動網址用 SITE_URL，並宣告 1 小時 CDN 快取', () => {
  const code = withoutLineComments(publicIcsSource)
  assert.match(code, /export const revalidate = 3600\b/)
  assert.doesNotMatch(code, /force-dynamic/)
  assert.doesNotMatch(code, /force-static/)
  assert.match(code, /SITE_URL/)
  assert.doesNotMatch(code, /request\.url/)
  assert.match(code, /getPublishedEvents\(\{\s*throwOnError:\s*true,\s*lookbackDays:\s*ICS_FEED_LOOKBACK_DAYS\s*\}\)/)
  assert.equal(PUBLIC_ICS_REVALIDATE_SECONDS, 3600)
  assert.equal(PUBLIC_ICS_STALE_WHILE_REVALIDATE_SECONDS, 86400)
})

check('公開 ICS 成功回應帶 Cache-Control 與 CDN 快取標頭（s-maxage=3600, SWR=86400）', () => {
  assert.equal(
    PUBLIC_ICS_CACHE_CONTROL,
    'public, s-maxage=3600, stale-while-revalidate=86400',
  )
  const headers = publicIdolIcsHeaders('bigbang')
  assert.equal(headers['Content-Type'], 'text/calendar; charset=utf-8')
  assert.equal(headers['Content-Disposition'], 'inline; filename="bigbang.ics"')
  for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
    assert.equal(headers[name], PUBLIC_ICS_CACHE_CONTROL, name)
    assert.equal(PUBLIC_ICS_CACHE_HEADERS[name], PUBLIC_ICS_CACHE_CONTROL, name)
  }
  const response = new Response('BEGIN:VCALENDAR', { headers })
  assert.equal(response.headers.get('Cache-Control'), PUBLIC_ICS_CACHE_CONTROL)
  assert.equal(response.headers.get('CDN-Cache-Control'), PUBLIC_ICS_CACHE_CONTROL)
  assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), PUBLIC_ICS_CACHE_CONTROL)
  assert.match(publicIcsSource, /publicIdolIcsHeaders\(/)
})

check('公開 ICS 找不到偶像或查詢失敗時不進 CDN 快取', () => {
  for (const headers of [PUBLIC_ICS_NOT_FOUND_HEADERS, PUBLIC_ICS_UNCACHEABLE_HEADERS]) {
    assert.equal(headers['Cache-Control'], 'private, no-store')
    assert.equal(headers['CDN-Cache-Control'], 'no-store')
    assert.equal(headers['Vercel-CDN-Cache-Control'], 'no-store')
  }
  const notFound = new Response('Not Found', { status: 404, headers: PUBLIC_ICS_UNCACHEABLE_HEADERS })
  assert.equal(notFound.status, 404)
  assert.equal(notFound.headers.get('Cache-Control'), 'private, no-store')
  const failed = new Response('Service Unavailable', { status: 503, headers: PUBLIC_ICS_UNCACHEABLE_HEADERS })
  assert.equal(failed.status, 503)
  assert.equal(failed.headers.get('CDN-Cache-Control'), 'no-store')
  const code = withoutLineComments(publicIcsSource)
  assert.match(code, /status: 404, headers: PUBLIC_ICS_UNCACHEABLE_HEADERS/)
  assert.match(code, /status: 503,\s*headers: PUBLIC_ICS_UNCACHEABLE_HEADERS/)
})

check('私人／token ICS 維持動態，且不是公開 CDN 快取', () => {
  assert.match(personalIcsSource, /export const dynamic = 'force-dynamic'/)
  assert.doesNotMatch(personalIcsSource, /CDN-Cache-Control/)
  assert.doesNotMatch(personalIcsSource, /s-maxage/)
  assert.doesNotMatch(personalIcsSource, /export const revalidate/)
  assert.match(followsFeedSource, /'Cache-Control': 'private, max-age=900'/)
  assert.match(followsFeedSource, /'Cache-Control': 'no-store'/)
  assert.doesNotMatch(followsFeedSource, /s-maxage/)
  assert.doesNotMatch(followsFeedSource, /CDN-Cache-Control/)
})

console.log('全部通過')
console.log(`middleware matcher: ${pattern}`)
