// 執行方式：node scripts/check-must12-hot-pages-isr.mjs
// 不連網、不連庫（用假的 fetch 攔截 Supabase 請求）。核對 Must #12 熱門頁 ISR：
// 1. 首頁與行事曆是 ISR（revalidate = 300），沒有 force-dynamic，整條 import 鏈沒有
//    cookies()／headers()／伺服器端登入 client，不會把某人的資料烤進共用快取頁。
// 2. getPublishedEvents 有日期下限、只選需要的欄位、保留 #248 的 FK 指名；
//    需要歷史資料的呼叫端（ICS、atlas）有明確放寬下限。
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    // 只補專案內檔案的 .ts 副檔名，不動 node_modules 裡的 require
    const inProject = !String(context.parentURL ?? '').includes('/node_modules/')
    return nextResolve(
      inProject && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier,
      context,
    )
  },
})

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(ROOT, path), 'utf8')

let pending = Promise.resolve()
function check(name, fn) {
  pending = pending.then(async () => {
    await fn()
    console.log(`PASS ${name}`)
  })
}

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

// ── 假的 Supabase：攔截 fetch，記錄 URL ───────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-for-check-only'
const requests = []
let eventsStatus = 200
let eventsRows = []
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString())
  requests.push(url)
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  if (url.pathname.endsWith('/rest/v1/events')) {
    return eventsStatus === 200 ? json(200, eventsRows) : json(eventsStatus, { code: 'XX000', message: 'boom', details: null, hint: null })
  }
  return json(200, [])
}
const originalConsoleError = console.error
const eventsRequest = () => requests.filter((u) => u.pathname.endsWith('/rest/v1/events')).at(-1)

const events = await import('../src/lib/supabase/events.ts')
const { ICS_FEED_LOOKBACK_DAYS } = await import('../src/lib/ics/feedLookback.ts')

// 台北 2026-11-28 04:00 → 日期下限（預設往前 1 天）= 2026-11-27
const NOW = new Date('2026-11-27T20:00:00.000Z')

check('日期下限條件：結束日以 end_date ?? start_date ?? date 判定', () => {
  assert.equal(
    events.buildPublishedEventsDateFloorFilter('2026-11-27'),
    'end_date.gte.2026-11-27,and(end_date.is.null,start_date.gte.2026-11-27),and(end_date.is.null,start_date.is.null,date.gte.2026-11-27)',
  )
  assert.throws(() => events.buildPublishedEventsDateFloorFilter('2026-11-27)&is_published.eq.false'), /Invalid date floor/)
  assert.throws(() => events.buildPublishedEventsDateFloorFilter(''), /Invalid date floor/)
})

check('預設查詢：只選明列欄位、保留 #248 FK 指名、帶台北日期下限', async () => {
  requests.length = 0
  await events.getPublishedEvents({ now: NOW })
  const url = eventsRequest()
  const select = url.searchParams.get('select')
  assert.ok(select, '沒有 select 參數')
  assert.doesNotMatch(select, /(^|,)\*(,|$)/, '不可再用 select(*)')
  assert.match(select, /idols!events_idol_id_fkey!inner\(slug,avatar_url,color\)/)
  assert.match(select, /event_sources\(id,event_id,level,label,type,url\)/)
  for (const column of events.PUBLISHED_EVENT_COLUMNS) assert.ok(select.split(',').includes(column), `select 少了 ${column}`)
  assert.equal(url.searchParams.get('is_published'), 'eq.true')
  assert.equal(url.searchParams.get('status'), 'neq.cancelled')
  assert.match(url.searchParams.get('trust_level'), /^in\.\(/)
  assert.equal(url.searchParams.get('or'), `(${events.buildPublishedEventsDateFloorFilter('2026-11-27')})`)
  assert.equal(url.searchParams.get('order'), 'date.asc')
})

check('lookbackDays 可放寬；null 代表不設下限（atlas 要看已結束活動）', async () => {
  requests.length = 0
  await events.getPublishedEvents({ now: NOW, lookbackDays: ICS_FEED_LOOKBACK_DAYS })
  assert.equal(eventsRequest().searchParams.get('or'), `(${events.buildPublishedEventsDateFloorFilter('2026-10-28')})`)
  requests.length = 0
  await events.getPublishedEvents({ now: NOW, lookbackDays: null })
  assert.equal(eventsRequest().searchParams.has('or'), false)
  assert.equal(eventsRequest().searchParams.get('is_published'), 'eq.true')
})

check('select 欄位涵蓋 rowToEvent 讀的每個欄位', () => {
  const source = read('src/lib/supabase/events.ts')
  const body = source.split('function rowToEvent(row: SupabaseEventRow): Event {')[1].split('\nfunction rowToIdol')[0]
  const used = new Set([...body.matchAll(/\brow\.([a-z_]+)/g)].map((m) => m[1]))
  for (const embedded of ['idols', 'event_sources']) used.delete(embedded)
  assert.ok(used.size > 20, `只解析到 ${used.size} 個欄位`)
  const columns = new Set(events.PUBLISHED_EVENT_COLUMNS)
  for (const column of used) assert.ok(columns.has(column), `rowToEvent 讀 ${column}，但 PUBLISHED_EVENT_COLUMNS 沒有`)
})

check('只選明列欄位時，回傳的活動欄位仍完整', async () => {
  eventsRows = [{
    id: 'e1', idol_id: 'uuid-1', idol_name: 'A', title: 'T', type: 'concert', sub_type: null, status: 'confirmed',
    trust_level: 'official', date: '2026-12-01', start_date: '2026-12-01', end_date: '2026-12-02', date_label: null,
    time: '19:00', location: 'L', location_name_zh: null, city: '台北', venue_name: 'V', address: null, map_url: null,
    display_title_zh: null, display_summary_zh: null, translation_status: null, country: '台灣', country_flag: 'TW',
    country_code: 'TW', time_status: 'announced', description: 'd', tags: ['x'], ticket_url: 'https://t', stream_url: null,
    published_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z',
    idols: { slug: 'a', avatar_url: null, color: '#fff' }, event_sources: [{ id: 's', event_id: 'e1', level: 'official', label: 'src', type: null, url: 'https://s' }],
  }]
  const [event] = await events.getPublishedEvents({ now: NOW })
  eventsRows = []
  assert.equal(event.idolId, 'a')
  assert.equal(event.endDate, '2026-12-02')
  assert.equal(event.countryCode, 'TW')
  assert.equal(event.timeStatus, 'announced')
  assert.equal(event.city, '台北')
  assert.equal(event.source.label, 'src')
})

check('throwOnQueryError：查詢失敗丟錯（ISR 才會保留舊頁面）；沒有 client 仍回空陣列', async () => {
  eventsStatus = 500
  console.error = () => {}
  try {
    assert.deepEqual(await events.getPublishedEvents({ now: NOW }), [], '預設行為不變：失敗回空陣列')
    await assert.rejects(events.getPublishedEvents({ now: NOW, throwOnQueryError: true }), /query failed/)
    await assert.rejects(events.getPublishedEvents({ now: NOW, throwOnError: true }), /query failed/)
  } finally {
    eventsStatus = 200
    console.error = originalConsoleError
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  try {
    // client 在第一次呼叫時已建立並快取；這裡只驗證沒有環境變數的程式路徑存在
    const source = withoutComments(read('src/lib/supabase/events.ts'))
    assert.match(source, /if \(!supabase\) \{\s*if \(throwOnError\) throw new Error\('Published events client is unavailable'\)\s*return \[\]/)
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
  }
})

// ── 頁面是 ISR，且 import 鏈不碰登入資料 ─────────────────────────────────────
const FORBIDDEN_IN_GRAPH = [
  [/from\s+['"]next\/headers['"]/, 'next/headers'],
  [/\bcookies\s*\(/, 'cookies()'],
  [/\bheaders\s*\(\s*\)/, 'headers()'],
  [/serverClient/, 'serverClient（會讀 cookies）'],
  [/supabase\/auth['"]/, 'lib/supabase/auth（讀登入者）'],
  [/adminAuth/, 'adminAuth'],
  [/serviceClient/, 'serviceClient（service role）'],
  [/unstable_noStore|noStore\s*\(/, 'noStore'],
  [/cache:\s*['"]no-store['"]/, "cache: 'no-store'"],
  [/export const dynamic\s*=\s*['"]force-dynamic['"]/, 'force-dynamic'],
]

function resolveImport(fromFile, specifier) {
  let base
  if (specifier.startsWith('@/')) base = join(ROOT, 'src', specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && /\.(tsx?|mjs)$/.test(candidate)) return candidate
  }
  return null
}

function importGraph(entry) {
  const seen = new Set()
  const stack = [join(ROOT, entry)]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const source = withoutComments(readFileSync(file, 'utf8'))
    for (const m of source.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
      const next = resolveImport(file, m[1] ?? m[2])
      if (next) stack.push(next)
    }
  }
  return [...seen]
}

for (const [route, entry] of [['首頁', 'src/app/page.tsx'], ['行事曆', 'src/app/schedule/page.tsx']]) {
  check(`${route}：revalidate = 300、沒有 force-dynamic、不讀 cookies／headers／searchParams`, () => {
    const code = withoutComments(read(entry))
    assert.match(code, /export const revalidate = 300\b/)
    assert.doesNotMatch(code, /force-dynamic|force-static/)
    assert.doesNotMatch(code, /searchParams/)
    assert.match(code, /getPublishedEvents\(\{ throwOnQueryError: true \}\)/)
  })
  check(`${route}：整條 import 鏈沒有登入／cookies／no-store／service role`, () => {
    const files = importGraph(entry)
    assert.ok(files.length > 10, `import 鏈只解析到 ${files.length} 個檔案，解析器可能壞了`)
    for (const file of files) {
      const source = withoutComments(readFileSync(file, 'utf8'))
      for (const [pattern, label] of FORBIDDEN_IN_GRAPH) {
        assert.doesNotMatch(source, pattern, `${file.slice(ROOT.length + 1)} 含有 ${label}`)
      }
    }
  })
}

check('首頁的個人化元件都是 client 元件，且只用瀏覽器登入狀態', () => {
  for (const name of ['HomeNotificationBell', 'HomePersonalized', 'HomeFollowedIdols', 'HomeDateLabel']) {
    assert.match(read(`src/components/${name}.tsx`), /^'use client'/, `${name} 必須是 client 元件`)
  }
  assert.match(withoutComments(read('src/components/HomeNotificationBell.tsx')), /getBrowserSupabaseClient/)
  const home = withoutComments(read('src/app/page.tsx'))
  assert.match(home, /<HomeDateLabel initialLabel=\{dateStr\} \/>/)
})

check('StaleDayGuard：首頁與行事曆都掛上，只在日期跨日時重新整理一次，且不碰登入資料', async () => {
  for (const entry of ['src/app/page.tsx', 'src/app/schedule/page.tsx']) {
    assert.match(withoutComments(read(entry)), /<StaleDayGuard generatedDayKey=\{taipeiToday\((now)?\)\} \/>/, `${entry} 要掛 StaleDayGuard`)
  }
  const raw = read('src/components/StaleDayGuard.tsx')
  assert.match(raw, /^'use client'/)
  const code = withoutComments(raw)
  assert.match(code, /if \(today === generatedDayKey\) return/)
  assert.match(code, /sessionStorage\.getItem\(flag\)/)
  assert.match(code, /window\.location\.reload\(\)/)
  assert.doesNotMatch(code, /supabase|cookie|localStorage|useAppState/i)
})

check('HomeDateLabel：掛載後用瀏覽器現在的台北日期更新', () => {
  const code = withoutComments(read('src/components/HomeDateLabel.tsx'))
  assert.match(code, /useState\(initialLabel\)/)
  assert.match(code, /useEffect\(\(\) => \{\s*setLabel\(formatTaipeiDateLabel\(new Date\(\)\)\)/)
})

// ── 其他呼叫端：需要歷史資料的要明確放寬 ─────────────────────────────────────
check('ICS（單一偶像、全部追蹤）往前讀 31 天，大於 30 天截止日', () => {
  assert.ok(ICS_FEED_LOOKBACK_DAYS >= 31)
  const idolRoute = withoutComments(read('src/app/api/ics/idols/[slug]/route.ts'))
  assert.match(idolRoute, /getPublishedEvents\(\{\s*throwOnError:\s*true,\s*lookbackDays:\s*ICS_FEED_LOOKBACK_DAYS\s*\}\)/)
  assert.match(idolRoute, /addDaysToKey\(taipeiToday\(\),\s*-30\)/)
  const feedStore = withoutComments(read('src/lib/ics/supabaseFeedStore.ts'))
  assert.match(feedStore, /getPublishedEvents\(\{\s*throwOnError:\s*true,\s*lookbackDays:\s*ICS_FEED_LOOKBACK_DAYS\s*\}\)/)
  assert.match(withoutComments(read('src/lib/ics/followsFeed.ts')), /addDaysToKey\(taipeiToday\(now\),\s*-30\)/)
})

check('/atlas 與城市詳情頁需要已結束活動，明確傳 lookbackDays: null（維持原行為）', () => {
  assert.match(withoutComments(read('src/app/atlas/page.tsx')), /getPublishedEvents\(\{\s*lookbackDays:\s*null\s*\}\)/)
  assert.match(withoutComments(read('src/app/cities/[city]/page.tsx')), /getPublishedEvents\(\{\s*lookbackDays:\s*null\s*\}\)/)
})

check('其餘呼叫端（sitemap、城市、偶像頁、/me）本來就只用未結束活動，使用預設下限', () => {
  const currentOnly = [
    ['src/app/sitemap.ts', /buildSitemapEntries/],
    ['src/app/cities/page.tsx', /buildCityDirectory/],
    ['src/app/idols/[slug]/data.ts', /listCurrentEvents/],
    ['src/app/me/MeClient.tsx', /isEventEnded\(event, now\) === false/],
  ]
  for (const [file, marker] of currentOnly) assert.match(read(file), marker, `${file} 應只用未結束活動`)
  assert.match(read('src/lib/seo/sitemap.ts'), /listCurrentEvents\(events, now\)/)
  assert.match(read('src/lib/cities.ts'), /listCurrentEvents\(events, now\)/)
  for (const file of ['src/app/sitemap.ts', 'src/app/cities/page.tsx', 'src/app/idols/[slug]/data.ts', 'src/app/me/page.tsx']) {
    assert.doesNotMatch(withoutComments(read(file)), /lookbackDays/, `${file} 不需要放寬下限`)
  }
})

check('未動到的頁面：城市、圖鑑、/me、/atlas 仍是 force-dynamic（這次只改首頁與行事曆）', () => {
  for (const file of ['src/app/cities/page.tsx', 'src/app/cities/[city]/page.tsx', 'src/app/idols/page.tsx', 'src/app/me/page.tsx', 'src/app/atlas/page.tsx']) {
    assert.match(read(file), /export const dynamic = 'force-dynamic'/, `${file} 不該在這次被改`)
  }
})

await pending
console.log('ALL PASS')
