// 執行方式：node scripts/check-must6-seo.mjs
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { sep } from 'node:path'
import { test } from 'node:test'
import nextConfig from '../next.config.mjs'
import { truncateShareTitle } from '../src/app/_share/title.ts'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })

const { buildCityMeta, buildEventMeta, buildIdolMeta, SITE_URL } = await import('../src/lib/seo/metadata.ts')
const { robotsPolicy } = await import('../src/lib/seo/robots.ts')
const { buildSitemapEntries } = await import('../src/lib/seo/sitemap.ts')
const { cityHref } = await import('../src/lib/cities.ts')
const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

const idol = { id: 'test-group', name: 'Test Group', koreanName: '테스트' }
const event = {
  id: 'live', title: '測試演唱會', idolName: idol.name, date: '2026-11-21',
  city: ' 臺北 ', status: 'confirmed', description: '原始摘要', publishedAt: '2026-11-10T12:00:00Z',
}
const now = new Date('2026-11-20T16:01:00Z')

const disallowedPaths = [
  '/admin', '/api', '/me', '/notifications', '/account', '/login',
  '/forgot-password', '/reset-password', '/auth', '/atlas', '/favorites',
]
const disallow = robotsPolicy.rules.disallow

test('robots 列出禁止路徑、正式站與 sitemap', () => {
  assert.equal(robotsPolicy.rules.userAgent, '*')
  assert.ok(robotsPolicy.rules.allow.includes('/'))
  assert.deepEqual(disallow, disallowedPaths)
  // 只用純前綴：`$`、`*` 會讓 /login?next=/ 這類帶查詢字串的網址漏擋。
  assert.ok(disallow.every(rule => /^\/[a-z-]+$/.test(rule)), '禁止規則必須是純前綴')
  assert.equal(robotsPolicy.host, SITE_URL)
  assert.equal(robotsPolicy.sitemap, new URL('/sitemap.xml', SITE_URL).href)
})

test('robots 前綴不擋住公開頁面', () => {
  const publicPaths = new Set([
    '/', '/schedule', '/idols', '/idols/stray-kids',
    '/events/123e4567-e89b-12d3-a456-426614174000', '/cities', '/cities/%E5%8F%B0%E5%8C%97',
  ])
  for (const file of readdirSync(new URL('src/app/', root), { recursive: true })) {
    const segments = file.split(sep)
    if (segments.pop() !== 'page.tsx' || segments.some(segment => segment.startsWith('_'))) continue
    const route = '/' + segments
      .filter(segment => !/^\([^()]+\)$|^@/.test(segment))
      .join('/')
    // 只略過禁止路由及其子路由，讓 /media、/members 這類前綴碰撞仍會報錯。
    if (disallowedPaths.some(path => route === path || route.startsWith(`${path}/`))) continue
    publicPaths.add(route.replace(/\[\[\.\.\.[^\]]+\]\]|\[[^\]]+\]/g, 'sample'))
  }
  for (const path of publicPaths) {
    for (const rule of disallow) {
      assert.ok(!path.startsWith(rule), `${path} 被 robots 前綴 ${rule} 擋住`)
    }
  }
})

test('sitemap 收錄固定頁、偶像、有場次的城市及合格活動，網址唯一', () => {
  const entries = buildSitemapEntries({
    idols: [idol, idol], now,
    events: [
      event, event,
      { ...event, id: 'overseas', city: '首爾', date: '2026-11-19', endDate: '2026-11-22' },
      { ...event, id: 'ended', date: '2026-11-20', city: '大阪' },
      { ...event, id: 'empty', city: '', description: '　' },
      { ...event, id: 'cancelled', city: '高雄', status: 'cancelled' },
      { ...event, id: 'localized', city: '', description: '', displaySummaryZh: '公開摘要' },
    ],
  })
  const expectedPaths = [
    '/', '/schedule', '/idols', '/cities', '/privacy', '/terms', '/disclaimer',
    '/idols/test-group', cityHref('台北'), cityHref('首爾'),
    '/events/live', '/events/overseas', '/events/localized',
  ]
  const urls = entries.map(entry => entry.url)
  assert.deepEqual([...urls].sort(), expectedPaths.map(path => new URL(path, SITE_URL).href).sort())
  assert.equal(new Set(urls).size, urls.length)
  assert.equal(entries.find(entry => entry.url.endsWith('/events/live')).lastModified, event.publishedAt)
  assert.equal(buildSitemapEntries({ idols: [], events: [], now }).length, 7)
})

test('sitemap 使用公開查詢，查詢失敗時退回固定頁', () => {
  const reads = read('src/lib/supabase/events.ts')
  const query = reads.split('export async function getPublishedEvents')[1].split('export async function getActiveIdols')[0]
  assert.match(query, /\.eq\('is_published', true\)/)
  assert.match(query, /\.neq\('status', 'cancelled'\)/)
  assert.match(query, /\.in\('trust_level', \[\.\.\.PUBLIC_TRUST_LEVELS\]\)/)
  const route = read('src/app/sitemap.ts')
  assert.match(route, /getPublishedEvents\(\{ throwOnError: true \}\)/)
  assert.match(route, /getActiveIdols\(\{ throwOnError: true \}\)/)
  assert.match(route, /catch\s*\{\s*return buildSitemapEntries\(\{ idols: \[\], events: \[\], now \}\)/)
})

test('動態 metadata 包含專屬標題、台北日期、摘要、canonical 與 OG 圖', () => {
  const idolMeta = buildIdolMeta(idol, 3)
  const eventMeta = buildEventMeta({ ...event, displaySummaryZh: '繁中摘要'.repeat(55) })
  const cityMeta = buildCityMeta('台北', 4)
  for (const metadata of [idolMeta, eventMeta, cityMeta]) {
    assert.ok(metadata.title && metadata.description)
    assert.ok(Array.from(metadata.description).length <= 120)
    assert.doesNotMatch(metadata.description, /[場地方式]。以主辦/)
    assert.ok(metadata.description.endsWith('以主辦公告為準。'))
    assert.equal(metadata.twitter.card, 'summary_large_image')
    assert.equal(new URL(metadata.openGraph.images[0].url, SITE_URL).origin, SITE_URL)
  }
  assert.match(idolMeta.title, /Test Group.*台灣.*演唱會/)
  assert.match(idolMeta.description, /테스트.*3 場未結束活動/)
  assert.match(idolMeta.description, /活動日期及場地以主辦公告為準。$/)
  assert.match(buildIdolMeta({ ...idol, koreanName: '' }, 0).description, /目前沒有公開場次/)
  assert.equal(idolMeta.alternates.canonical, '/idols/test-group')
  assert.equal(eventMeta.title, '測試演唱會｜Test Group')
  assert.match(eventMeta.description, /2026 年 11 月 21 日.*繁中摘要.*…以主辦公告為準。$/)
  assert.doesNotMatch(eventMeta.description, /原始摘要/)
  assert.match(buildEventMeta(event).description, /臺北。原始摘要。以主辦公告為準。$/)
  assert.equal(eventMeta.alternates.canonical, '/events/live')
  assert.equal(cityMeta.title, '台北偶像演唱會與活動')
  assert.match(cityMeta.description, /4 場/)
  assert.match(cityMeta.description, /活動時間、場地及入場方式以主辦公告為準。$/)
  assert.equal(cityMeta.alternates.canonical, cityHref('台北'))
})

test('活動沒有摘要時，公告提醒以活動資訊為主詞', () => {
  const metadata = buildEventMeta({
    ...event, idolName: 'Stray Kids', date: '2026-12-20', city: '台北',
    displaySummaryZh: '　', description: ' ',
  })
  assert.equal(metadata.description, 'Stray Kids・2026 年 12 月 20 日 週日・台北。活動資訊以主辦公告為準。')
})

test('公開與帳號頁接上 metadata，示範活動設為 noindex', () => {
  const layout = read('src/app/layout.tsx')
  for (const field of ['metadataBase', 'openGraph', 'twitter', 'summary_large_image']) assert.ok(layout.includes(field))
  for (const route of ['', 'schedule/', 'idols/', 'cities/', 'idols/[slug]/', 'events/[id]/', 'cities/[city]/']) {
    assert.match(read(`src/app/${route}page.tsx`), /export (const metadata|async function generateMetadata)/)
  }
  for (const route of ['me', 'notifications', 'account/settings', 'login', 'forgot-password', 'reset-password']) {
    assert.match(read(`src/app/${route}/page.tsx`), /robots: \{ index: false, follow: false \}/)
  }
  assert.match(read('src/app/events/[id]/page.tsx'), /detail\.isDemoEvent.*robots: \{ index: false \}/)
})

test('分享圖路由提供 1200×630 PNG，使用本地授權字型與幾何圖形', () => {
  assert.equal(new URL('/opengraph-image', SITE_URL).href, `${SITE_URL}/opengraph-image`)
  for (const route of ['', 'idols/[slug]/', 'events/[id]/']) {
    const og = read(`src/app/${route}opengraph-image.tsx`)
    assert.match(og, /size = \{ width: 1200, height: 630 \}/)
    assert.match(og, /export const alt = '.+'/)
    assert.match(og, /contentType = 'image\/png'/)
    assert.doesNotMatch(og, /avatarUrl|idol-marks|<img|https?:\/\//i)
    assert.match(read(`src/app/${route}twitter-image.tsx`), /from '.\/opengraph-image'/)
  }
  const renderer = read('src/app/_share/image.tsx')
  assert.doesNotMatch(renderer, /avatarUrl|idol-marks|<img|https?:\/\//i)
  assert.match(renderer, /NotoSansTC-Bold-subset\.otf/)
  for (const file of ['NotoSansTC-Bold-subset.otf', 'OFL.txt', 'README.md']) {
    assert.ok(statSync(new URL(`assets/fonts/${file}`, root)).size > 0)
  }
})

test('分享圖標題以 28 個全形字寬為上限，半形字計半寬', () => {
  const fullWidth = '場'.repeat(28)
  const halfWidth = 'A'.repeat(56)
  const mixed = '場'.repeat(27) + 'AB'
  for (const title of [fullWidth, halfWidth, mixed]) {
    assert.equal(truncateShareTitle(title), title)
  }
  assert.equal(truncateShareTitle(fullWidth + '場'), '場'.repeat(27) + '…')
  assert.equal(truncateShareTitle(halfWidth + 'A'), 'A'.repeat(54) + '…')
  assert.equal(truncateShareTitle(mixed + 'C'), '場'.repeat(27) + '…')
})

test('偶像與活動的 OG 與 Twitter 圖成功和回退時皆使用短快取', () => {
  const renderer = read('src/app/_share/image.tsx')
  assert.match(renderer, /export const dynamicShareImageHeaders = \{\s*'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'/)
  assert.match(renderer, /new ImageResponse\([\s\S]*\{ \.\.\.size, fonts: .*?, headers \}/)
  for (const route of ['idols/[slug]', 'events/[id]']) {
    const og = read(`src/app/${route}/opengraph-image.tsx`)
    assert.match(og, /return await shareImage\(size, \{[\s\S]*?\}, dynamicShareImageHeaders\)/, route)
    assert.match(og, /return shareImage\(size, undefined, dynamicShareImageHeaders\)/, route)
    assert.match(read(`src/app/${route}/twitter-image.tsx`), /export \{ default, .* \} from '.\/opengraph-image'/, route)
  }
})

test('OG 與 Twitter 分享圖的部署檔案包含本地字型', () => {
  const routeGlob = '/**/{opengraph,twitter}-image'
  assert.ok(nextConfig.outputFileTracingIncludes?.[routeGlob]?.includes('./assets/fonts/NotoSansTC-Bold-subset.otf'))
})
