// 執行方式：node scripts/check-must10-jyp-notice.mjs
// MUST #10：JYP 改用官網 /notice 公告頁（停用 /api/schedules）。
// 只用 scripts/fixtures/jyp-notice/ 的 HTML 與假 fetch／假 Supabase；不連網、不連資料庫、不讀 .env。
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const fixture = name => read(`scripts/fixtures/jyp-notice/${name}`)

const dataModule = source => `data:text/javascript,${encodeURIComponent(source)}`
const MOCKS = {
  'next/server': `export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }`,
  '@/lib/supabase/serverClient': 'export const getSupabaseServerClient = () => globalThis.__jyp.client',
  '@/lib/supabase/adminAuth': 'export const getCurrentAdmin = async () => ({ isAdmin: true })',
}
function withExtension(url) {
  for (const ext of ['.ts', '.tsx']) if (existsSync(fileURLToPath(url + ext))) return url + ext
  return url
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (MOCKS[specifier]) return { url: dataModule(MOCKS[specifier]), shortCircuit: true }
    if (specifier.startsWith('@/')) return nextResolve(withExtension(new URL(`src/${specifier.slice(2)}`, root).href), context)
    const parent = context.parentURL ?? ''
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && /\.tsx?$/.test(parent)) {
      return nextResolve(withExtension(new URL(specifier, parent).href), context)
    }
    return nextResolve(specifier, context)
  },
})
globalThis.__jyp = {}

const jyp = await import('../src/lib/crawlers/jypNotice.ts')
const fetcher = await import('../src/lib/crawlers/runJypNoticeFetcher.ts')
const { runJypScheduleFetcher, JYP_SCHEDULE_DISABLED_MESSAGE } = await import('../src/lib/crawlers/runJypScheduleFetcher.ts')
const { runCrawlerSource, runActiveCrawlerSources } = await import('../src/lib/crawlers/runActiveCrawlerSources.ts')
const { evaluateCandidate, NULL_CONFIDENCE_OK_PARSERS } = await import('../src/lib/autoPublish/evaluateCandidate.ts')
const routeUrl = path => pathToFileURL(fileURLToPath(new URL(path, root))).href
const jypScheduleRoute = await import(routeUrl('src/app/api/admin/crawlers/jyp-schedule/run/route.ts'))
const twiceScheduleRoute = await import(routeUrl('src/app/api/admin/crawlers/twice-schedule/run/route.ts'))
const jypNoticeRoute = await import(routeUrl('src/app/api/admin/crawlers/jyp-notice/run/route.ts'))

// ── 假 Supabase（記錄每張表的操作） ──────────────────────────────────────────

function fakeDb(tables) {
  const ops = []
  return {
    ops,
    tables,
    from(table) {
      const st = { table, kind: 'select', filters: [], row: null }
      ops.push(st)
      const rows = () => (tables[table] ??= [])
      const match = r => st.filters.every(([k, v, op]) => (op === 'in' ? v.includes(r[k]) : r[k] === v))
      const exec = () => {
        if (st.kind === 'insert') {
          const r = { id: `${table}-${rows().length + 1}`, ...structuredClone(st.row) }
          rows().push(r)
          return [r]
        }
        if (st.kind === 'update') {
          const hit = rows().filter(match)
          for (const r of hit) Object.assign(r, structuredClone(st.row))
          return hit.map(r => ({ ...r }))
        }
        return rows().filter(match).map(r => ({ ...r }))
      }
      const q = {
        select: () => q, order: () => q,
        eq(k, v) { st.filters.push([k, v]); return q },
        in(k, v) { st.filters.push([k, v, 'in']); return q },
        insert(row) { st.kind = 'insert'; st.row = row; return q },
        update(row) { st.kind = 'update'; st.row = row; return q },
        delete() { st.kind = 'delete'; return q },
        maybeSingle: async () => ({ data: exec()[0] ?? null, error: null }),
        single: async () => ({ data: exec()[0] ?? null, error: null }),
        then: (resolve, reject) => Promise.resolve({ data: exec(), error: null }).then(resolve, reject),
      }
      return q
    },
  }
}

const PUBLISHED_EVENT = { id: 'ev-old', idol_id: 'i-jyp', title: 'Old JYP Concert', is_published: true, trust_level: 'official', status: 'confirmed' }

function sourceRow(overrides = {}) {
  return {
    id: 'cs-jyp', source_key: 'jy-park-jyp-notice', name: 'J.Y. Park 官網公告', idol_id: 'i-jyp',
    source_url: 'https://jyp.jype.com/notice', source_type: 'official_website', parser_type: 'jyp_notice',
    is_active: true, config: {}, ...overrides,
  }
}

function makeDb(source = sourceRow(), extra = {}) {
  return fakeDb({
    crawler_sources: [source],
    idols: [{ id: 'i-jyp', slug: 'jy-park', name: 'J.Y. Park', is_active: true }],
    events: [{ ...PUBLISHED_EVENT }],
    event_sources: [{ event_id: 'ev-old', url: 'https://jyp.jype.com/Mobile/Schedule#old' }],
    event_candidates: [],
    ...extra,
  })
}

const assertEventsUntouched = db => {
  assert.deepEqual(db.ops.filter(op => ['events', 'event_sources'].includes(op.table) && op.kind !== 'select'), [])
  assert.deepEqual(db.tables.events, [PUBLISHED_EVENT])
}

// ── 假 fetch ────────────────────────────────────────────────────────────────

const ROBOTS = 'User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /_next/\n'
const DETAIL_149 = `<html><body><script>self.__next_f.push([1,"x"])</script><div class="noticeView">
  <h3>2026 박진영 콘서트 &lt;WET&gt; 10/6(화) 티켓 오픈!</h3>
  <p>공연 일시 : 2026년 12월 19일(토) ~ 2026년 12월 20일(일)</p>
  <p>공연 장소 : KSPO DOME</p><p>예매 : 10월 6일(화) 20시</p></div></body></html>`

function fakeFetch(routes) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url: String(url), init })
    const r = typeof routes === 'function' ? routes(String(url)) : routes[String(url)]
    if (r instanceof Error) throw r
    if (!r) return new Response('<html><div class="noticeView"><p>본문</p></div></html>', { status: 200 })
    return new Response(r.body ?? '', { status: r.status ?? 200 })
  }
  fn.calls = calls
  return fn
}
function fakeSleep() {
  const waits = []
  const fn = async ms => { waits.push(ms) }
  fn.waits = waits
  return fn
}

const LIST_ROUTES = {
  'https://jyp.jype.com/robots.txt': { body: ROBOTS },
  'https://jyp.jype.com/notice': { body: fixture('jy-park-notice-p1.html') },
  'https://jyp.jype.com/notice?PgIndex=2': { body: fixture('twice-notice-p1.html') },
  'https://jyp.jype.com/notice?PgIndex=3': { body: fixture('itzy-notice-p1.html') },
  'https://jyp.jype.com/notice/7fl2r8yw?NoticeNumber=149': { body: DETAIL_149 },
}

function assertPoliteRequests(fetch, sleep) {
  for (const { url, init } of fetch.calls) {
    assert.ok(jyp.isAllowedJypRequestUrl(url), url)
    assert.doesNotMatch(url, /\/api\/|\/_next\//)
    assert.equal(init.headers['User-Agent'], jyp.JYP_NOTICE_USER_AGENT)
    assert.equal(init.headers.Accept, 'text/html')
    assert.ok(!Object.keys(init.headers).some(k => /cookie|authorization/i.test(k)))
    assert.equal(init.credentials, 'omit')
    assert.equal(init.redirect, 'manual')
  }
  assert.equal(sleep.waits.length, Math.max(0, fetch.calls.length - 1))
  assert.ok(sleep.waits.every(ms => ms >= 2000), JSON.stringify(sleep.waits))
}

// ── 1. 列表解析 ─────────────────────────────────────────────────────────────

test('列表 fixture：解析標題、發布日、官方連結（三站同版型）', () => {
  for (const [file, origin, first] of [
    ['jy-park-notice-p1.html', 'https://jyp.jype.com', { noticeNumber: '149', noticeId: '7fl2r8yw', title: '2026 박진영 콘서트 <WET> 10/6(화) 티켓 오픈!', noticeDate: '2026-10-06' }],
    ['twice-notice-p1.html', 'https://twice.jype.com', { noticeNumber: '1453', noticeId: 'clzqjhdo', title: 'NAYEON “BABY ANGEL” M/V', noticeDate: '2026-11-20' }],
    ['itzy-notice-p1.html', 'https://itzy.jype.com', { noticeNumber: '1688', noticeId: 'b8p1k32f', title: 'CHAERYEONG <Lovesick> Performance Video BEHIND', noticeDate: '2026-11-23' }],
  ]) {
    const entries = jyp.parseJypNoticeListHtml(fixture(file), origin)
    assert.equal(entries.length, 10, file)
    assert.deepEqual(entries[0], { ...first, detailUrl: `${origin}/notice/${first.noticeId}?NoticeNumber=${first.noticeNumber}` })
    for (const e of entries) {
      assert.match(e.noticeDate, /^\d{4}-\d{2}-\d{2}$/)
      assert.ok(jyp.isAllowedJypRequestUrl(e.detailUrl), e.detailUrl)
    }
    assert.equal(new Set(entries.map(e => e.noticeNumber)).size, 10)
  }
  assert.deepEqual(jyp.parseJypNoticeListHtml('<html><body>no list</body></html>', 'https://twice.jype.com'), [])
})

const CTX = {
  crawlerSourceId: 'cs-jyp', sourceKey: 'jy-park-jyp-notice', sourceName: 'J.Y. Park 官網公告', sourceType: 'official_website',
  parserType: 'jyp_notice', listUrl: 'https://jyp.jype.com/notice', idolId: 'i-jyp', idolSlug: 'jy-park',
}

test('發布日不當成活動日：payload 的 detected_date 為空，發布日只存在 raw_data.notice_date', () => {
  const entries = jyp.parseJypNoticeListHtml(fixture('jy-park-notice-p1.html'), 'https://jyp.jype.com')
  for (const entry of entries) {
    const p = jyp.entryToCandidatePayload(entry, CTX)
    assert.equal(p.detected_date, null, entry.title)
    assert.equal(p.detected_start_date, null)
    assert.equal(p.detected_venue_name, null)
    assert.equal(p.raw_data.notice_date, entry.noticeDate)
    assert.equal(p.raw_data.parser_type, 'jyp_notice')
    assert.equal(p.raw_data.source, 'jyp-notice')
    assert.equal(p.source_url, entry.detailUrl)
    assert.equal(p.raw_title, entry.title)
    assert.equal(p.ai_confidence, null)
  }
  // 標題日期：只認含年份的完整日期，且不是售票／發行
  assert.deepEqual(jyp.extractEventDateFromTitle('TWICE FANMEETING 2027.01.10 - 2027.01.11'), { start: '2027-01-10', end: '2027-01-11' })
  assert.deepEqual(jyp.extractEventDateFromTitle('DAY6 콘서트 2027년 3월 5일 공연 안내'), { start: '2027-03-05', end: null })
  for (const title of ['2026 박진영 콘서트 <WET> 10/6(화) 티켓 오픈!', 'NAYEON 2026.11.20 M/V', 'CONCERT 2026.12.01 TICKET OPEN', '2027.02.30 concert', 'Happy Birthday']) {
    assert.equal(jyp.extractEventDateFromTitle(title), null, title)
  }
})

test('詳情：只從「일시／장소」標籤行抽活動日與地點，沒標籤不猜', () => {
  const d = jyp.parseJypNoticeDetailHtml(DETAIL_149)
  assert.equal(d.eventDate, '2026-12-19')
  assert.equal(d.eventEndDate, '2026-12-20')
  assert.equal(d.venue, 'KSPO DOME')
  assert.ok(!d.bodyText.includes('__next_f'))
  const none = jyp.parseJypNoticeDetailHtml('<div class="noticeView"><p>2026.12.19 서울에서 만나요</p></div>')
  assert.equal(none.eventDate, null)
  assert.equal(none.venue, null)
})

test('沒有活動日的公告：自動上架停在 missing_date；有活動日才上架，且不是 unknown_parser', () => {
  assert.ok(NULL_CONFIDENCE_OK_PARSERS.includes('jyp_notice'))
  const [entry] = jyp.parseJypNoticeListHtml(fixture('jy-park-notice-p1.html'), 'https://jyp.jype.com')
  const ctx = {
    now: new Date('2026-11-24T02:00:00Z'),
    idols: [{ id: 'i-jyp', name: 'J.Y. Park', is_active: true }],
    crawlerSources: [sourceRow()], events: [], eventSources: [],
  }
  const asCandidate = p => ({ id: 'c1', review_status: 'pending', created_at: '2026-11-24T00:00:00Z', ...p })
  const noDate = evaluateCandidate(asCandidate(jyp.entryToCandidatePayload(entry, CTX)), ctx)
  assert.equal(noDate.action, 'park')
  assert.equal(noDate.parkReason, 'missing_date')
  assert.ok(!noDate.allReasons.includes('unknown_parser'))
  const dated = evaluateCandidate(asCandidate(jyp.entryToCandidatePayload(entry, CTX, jyp.parseJypNoticeDetailHtml(DETAIL_149))), ctx)
  assert.equal(dated.action, 'publish_official', JSON.stringify(dated))
  assert.equal(dated.locationStatus, 'has_location')
})

// ── 2. 允許路徑與 robots ────────────────────────────────────────────────────

test('只允許 /robots.txt、/notice、/notice?PgIndex=、/notice/{id}?NoticeNumber=', () => {
  for (const url of ['https://twice.jype.com/robots.txt', 'https://twice.jype.com/notice', 'https://jyp.jype.com/notice?PgIndex=3',
    'https://xdinaryheroes.jype.com/notice/clzqjhdo?NoticeNumber=1453']) {
    assert.equal(jyp.isAllowedJypRequestUrl(url), true, url)
  }
  for (const url of ['https://twice.jype.com/api/schedules?groupId=1', 'https://twice.jype.com/api/groups/twice', 'https://twice.jype.com/_next/data/x.json',
    'https://twice.jype.com/schedule', 'https://twice.jype.com/Mobile/Schedule', 'http://twice.jype.com/notice', 'https://evil.com/notice',
    'https://twice.jype.com/notice?PgIndex=2&x=1', 'https://twice.jype.com/notice/abc', 'https://twice.jype.com/notice/../api/x', 'https://u:p@twice.jype.com/notice']) {
    assert.equal(jyp.isAllowedJypRequestUrl(url), false, url)
  }
  assert.equal(jyp.jypNoticeListUrl('https://jyp.jype.com/notice'), 'https://jyp.jype.com/notice')
  assert.equal(jyp.jypNoticeListUrl('https://twice.jype.com/Mobile/Schedule'), null)
  assert.equal(jyp.jypNoticeListUrl('https://twice.jype.com/api/schedules'), null)
})

test('robots 解析：今天的 JYP robots 允許 /notice；Disallow /notice 或 /notice* 時不允許', () => {
  assert.equal(jyp.robotsAllowsNotice(jyp.parseRobotsTxt(ROBOTS)), true)
  assert.equal(jyp.robotsAllowsPath(jyp.parseRobotsTxt(ROBOTS), '/api/schedules'), false)
  for (const text of [`${ROBOTS}Disallow: /notice\n`, 'User-agent: *\nDisallow: /\n', 'User-agent: IdolRhythm-Bot\nDisallow: /notice/\n\nUser-agent: *\nAllow: /\n', 'User-agent: *\nDisallow: /*?PgIndex=\n']) {
    assert.equal(jyp.robotsAllowsNotice(jyp.parseRobotsTxt(text)), false, text)
  }
  assert.equal(jyp.parseRobotsTxt(`${ROBOTS}Crawl-delay: 5\n`).crawlDelaySeconds, 5)
  assert.equal(jyp.parseRobotsTxt(ROBOTS).crawlDelaySeconds, null)
})

test('常數：MAX_PAGES = 3、間隔 >= 2000ms、詳情 10、單輪 60（寫死在程式，不讀環境變數）', () => {
  assert.equal(fetcher.MAX_PAGES, 3)
  assert.ok(fetcher.MIN_REQUEST_INTERVAL_MS >= 2000)
  assert.equal(fetcher.MAX_DETAILS_PER_RUN, 10)
  assert.equal(fetcher.MAX_ENTRIES_PER_RUN, 60)
  for (const path of ['src/lib/crawlers/runJypNoticeFetcher.ts', 'src/lib/crawlers/jypNotice.ts']) {
    assert.doesNotMatch(read(path), /process\.env/, path)
  }
})

// ── 3. fetcher 整輪（fixture） ──────────────────────────────────────────────

test('fetcher：先 robots、最多 3 頁、每拍 >= 2 秒、詳情有限度、只寫候選', async () => {
  const db = makeDb()
  const fetch = fakeFetch(LIST_ROUTES)
  const sleep = fakeSleep()
  const r = await fetcher.runJypNoticeFetcher(db, { sourceKey: 'jy-park-jyp-notice', deps: { fetch, sleep } })
  assert.deepEqual(r.errors, [])
  assert.equal(r.status, 200)
  assert.equal(fetch.calls[0].url, 'https://jyp.jype.com/robots.txt')
  assert.deepEqual(fetch.calls.slice(1, 4).map(c => c.url), ['https://jyp.jype.com/notice', 'https://jyp.jype.com/notice?PgIndex=2', 'https://jyp.jype.com/notice?PgIndex=3'])
  assert.ok(!fetch.calls.some(c => /PgIndex=4/.test(c.url)))
  const detailCalls = fetch.calls.filter(c => /NoticeNumber=/.test(c.url))
  assert.ok(detailCalls.length >= 1 && detailCalls.length <= fetcher.MAX_DETAILS_PER_RUN)
  assert.equal(r.detailsFetched, detailCalls.length)
  assertPoliteRequests(fetch, sleep)

  assert.equal(r.fetched, 30)
  assert.equal(r.inserted, 30)
  const rows = db.tables.event_candidates
  const row149 = rows.find(c => c.raw_data.notice_number === '149')
  assert.equal(row149.detected_date, '2026-12-19')
  assert.equal(row149.detected_end_date, '2026-12-20')
  assert.equal(row149.detected_venue_name, 'KSPO DOME')
  assert.equal(row149.raw_data.event_date_origin, 'detail')
  assert.equal(row149.source_url, 'https://jyp.jype.com/notice/7fl2r8yw?NoticeNumber=149')
  for (const c of rows.filter(c => c !== row149)) {
    assert.equal(c.detected_date, null, c.raw_title)
    assert.equal(c.raw_data.source, 'jyp-notice')
    assert.equal(c.raw_data.parser_type, 'jyp_notice')
  }
  assert.equal(db.tables.crawler_sources[0].last_status, 'success')
  assertEventsUntouched(db)

  // 第二輪：都已入庫 → 不再看詳情，也不因「上輪有看詳情」誤判內容變更
  const fetch2 = fakeFetch(LIST_ROUTES)
  const sleep2 = fakeSleep()
  const r2 = await fetcher.runJypNoticeFetcher(db, { sourceKey: 'jy-park-jyp-notice', deps: { fetch: fetch2, sleep: sleep2 } })
  assert.equal(r2.inserted, 0)
  assert.equal(r2.recheck, 0)
  assert.equal(r2.skipped, 30)
  assert.equal(fetch2.calls.filter(c => /NoticeNumber=/.test(c.url)).length, 0)
  assertPoliteRequests(fetch2, sleep2)
})

test('fetcher：Crawl-delay 比 2 秒長時用 Crawl-delay', async () => {
  const fetch = fakeFetch({ ...LIST_ROUTES, 'https://jyp.jype.com/robots.txt': { body: `${ROBOTS}Crawl-delay: 5\n` } })
  const sleep = fakeSleep()
  await fetcher.runJypNoticeFetcher(makeDb(), { sourceKey: 'jy-park-jyp-notice', dryRun: true, deps: { fetch, sleep } })
  assert.ok(sleep.waits.length > 0 && sleep.waits.every(ms => ms === 5000))
})

test('fetcher：robots 禁止 /notice 時本輪停止並記 error，不抓列表', async () => {
  for (const robots of [`${ROBOTS}Disallow: /notice\n`, 'User-agent: *\nDisallow: /\n']) {
    const db = makeDb()
    const fetch = fakeFetch({ 'https://jyp.jype.com/robots.txt': { body: robots } })
    const r = await fetcher.runJypNoticeFetcher(db, { sourceKey: 'jy-park-jyp-notice', deps: { fetch, sleep: fakeSleep() } })
    assert.deepEqual(fetch.calls.map(c => c.url), ['https://jyp.jype.com/robots.txt'])
    assert.match(r.errors[0], /robots\.txt 已禁止 \/notice/)
    assert.equal(db.tables.crawler_sources[0].last_status, 'error')
    assert.equal(db.tables.event_candidates.length, 0)
    assertEventsUntouched(db)
  }
})

test('fetcher：403／429／5xx 記失敗並停止，不重試、不改打 /api/', async () => {
  for (const [where, status] of [['robots', 429], ['list', 403], ['list', 503]]) {
    const db = makeDb()
    const routes = { ...LIST_ROUTES }
    routes[where === 'robots' ? 'https://jyp.jype.com/robots.txt' : 'https://jyp.jype.com/notice'] = { status, body: 'blocked' }
    const fetch = fakeFetch(routes)
    const sleep = fakeSleep()
    const r = await fetcher.runJypNoticeFetcher(db, { sourceKey: 'jy-park-jyp-notice', deps: { fetch, sleep } })
    assert.equal(fetch.calls.length, where === 'robots' ? 1 : 2, `${where} ${status}`)
    assert.ok(!fetch.calls.some(c => /\/api\//.test(c.url)))
    assert.equal(r.errors.length, 1)
    assert.match(r.errors[0], new RegExp(`HTTP ${status}`))
    assert.equal(db.tables.crawler_sources[0].last_status, 'error')
    assertPoliteRequests(fetch, sleep)
    assertEventsUntouched(db)
  }
  // 詳情 429：停止看後面的詳情，列表照常入庫，記 partial_error
  const db = makeDb()
  const fetch = fakeFetch({ ...LIST_ROUTES, 'https://jyp.jype.com/notice/7fl2r8yw?NoticeNumber=149': { status: 429 } })
  const r = await fetcher.runJypNoticeFetcher(db, { sourceKey: 'jy-park-jyp-notice', deps: { fetch, sleep: fakeSleep() } })
  assert.equal(fetch.calls.filter(c => /NoticeNumber=/.test(c.url)).length, 1)
  assert.equal(r.inserted, 30)
  assert.equal(db.tables.crawler_sources[0].last_status, 'partial_error')
  // 轉址不跟隨（避免被導去 /api/）
  const redirectDb = makeDb()
  const redirect = fakeFetch({ ...LIST_ROUTES, 'https://jyp.jype.com/notice': { status: 302 } })
  const rr = await fetcher.runJypNoticeFetcher(redirectDb, { sourceKey: 'jy-park-jyp-notice', deps: { fetch: redirect, sleep: fakeSleep() } })
  assert.equal(redirect.calls.length, 2)
  assert.match(rr.errors[0], /轉址/)
})

test('fetcher：列表版型不符時停止，不退回 /api/', async () => {
  const db = makeDb()
  const fetch = fakeFetch({ ...LIST_ROUTES, 'https://jyp.jype.com/notice': { body: '<html><body>maintenance</body></html>' } })
  const r = await fetcher.runJypNoticeFetcher(db, { sourceKey: 'jy-park-jyp-notice', deps: { fetch, sleep: fakeSleep() } })
  assert.equal(fetch.calls.length, 2)
  assert.match(r.errors[0], /版型不符/)
})

test('fetcher：舊 /Mobile/Schedule 網址或非 jyp_notice parser 不發任何請求', async () => {
  for (const source of [sourceRow({ source_url: 'https://jyp.jype.com/Mobile/Schedule' }), sourceRow({ parser_type: 'jyp_schedule' })]) {
    const db = makeDb(source)
    const fetch = fakeFetch(LIST_ROUTES)
    const r = await fetcher.runJypNoticeFetcher(db, { sourceKey: 'jy-park-jyp-notice', deps: { fetch, sleep: fakeSleep() } })
    assert.equal(fetch.calls.length, 0)
    assert.equal(r.status, 500)
  }
})

// ── 4. 停用 jyp_schedule：不得打 /api/ ──────────────────────────────────────

const OLD_SOURCES = ['twice', 'stray-kids', 'itzy', 'nmixx', 'day6', 'xdinary-heroes', '2pm', 'jy-park'].map(slug => ({
  id: `old-${slug}`, source_key: `${slug}-jyp-schedule`, name: `${slug} JYP Schedule`, idol_id: `i-${slug}`,
  source_url: `https://${slug === 'jy-park' ? 'jyp' : slug.replace(/-/g, '')}.jype.com/Mobile/Schedule`,
  source_type: 'official_website', parser_type: 'jyp_schedule', is_active: true, config: { groupId: 'g', artistSlug: slug },
}))

async function withGlobalFetch(run) {
  const original = globalThis.fetch
  const fetch = fakeFetch(() => { throw new Error('不應發出任何請求') })
  globalThis.fetch = fetch
  try { await run() } finally { globalThis.fetch = original }
  return fetch.calls
}

test('jyp_schedule：fetcher、cron、後台 route 都不對 /api/schedules 或 /api/groups/ 發請求', async () => {
  const calls = await withGlobalFetch(async () => {
    const db = fakeDb({ crawler_sources: OLD_SOURCES.map(s => ({ ...s })), events: [{ ...PUBLISHED_EVENT }] })
    for (const s of OLD_SOURCES) {
      const r = await runJypScheduleFetcher(db, { sourceKey: s.source_key })
      assert.deepEqual(r.errors, [JYP_SCHEDULE_DISABLED_MESSAGE])
      assert.equal(r.fetched + r.inserted, 0)
    }
    assert.match(JYP_SCHEDULE_DISABLED_MESSAGE, /robots\.txt/)
    assert.match(JYP_SCHEDULE_DISABLED_MESSAGE, /Disallow: \/api\//)
    assert.match(JYP_SCHEDULE_DISABLED_MESSAGE, /\/notice/)
    assert.match(JYP_SCHEDULE_DISABLED_MESSAGE, /需求單/)
    assert.ok(db.tables.crawler_sources.every(s => s.last_status === 'error' && s.last_error === JYP_SCHEDULE_DISABLED_MESSAGE))

    // cron：8 筆舊來源被重新打開
    const cronDb = fakeDb({ crawler_sources: OLD_SOURCES.map(s => ({ ...s })), events: [{ ...PUBLISHED_EVENT }] })
    const { result } = await runActiveCrawlerSources(cronDb, { trigger: 'vercel-cron' })
    assert.equal(result.results.length, 8)
    assert.ok(result.results.every(r => r.errors[0] === JYP_SCHEDULE_DISABLED_MESSAGE && r.fetched === 0))
    assertEventsUntouched(cronDb)
    const single = await runCrawlerSource(cronDb, OLD_SOURCES[0], false, 'admin-manual')
    assert.equal(single.errors[0], JYP_SCHEDULE_DISABLED_MESSAGE)

    // 後台 route
    globalThis.__jyp.client = fakeDb({ crawler_sources: OLD_SOURCES.map(s => ({ ...s })) })
    const res = await jypScheduleRoute.POST({ json: async () => ({ sourceKey: 'twice-jyp-schedule' }) })
    assert.equal(res.body.ok, false)
    assert.equal(res.status, 410)
    assert.equal(res.body.errors[0], JYP_SCHEDULE_DISABLED_MESSAGE)
    const legacy = await twiceScheduleRoute.POST()
    assert.equal(legacy.body.ok, false)
  })
  assert.deepEqual(calls, [])
  // 原始碼回歸：舊 fetcher 不再組 /api/ 網址、不再呼叫 fetch
  const src = read('src/lib/crawlers/runJypScheduleFetcher.ts')
  assert.doesNotMatch(src, /fetch\(|\$\{[^}]*\}\/api\//)
  assert.doesNotMatch(read('src/app/admin/sources/[id]/RunSourceButton.tsx'), /jyp-schedule\/run/)
})

test('後台 jyp-notice route：跑 runJypNoticeFetcher，sourceKey 必填', async () => {
  globalThis.__jyp.client = makeDb(sourceRow({ is_active: false }))
  const missing = await jypNoticeRoute.POST({ json: async () => ({}) })
  assert.equal(missing.status, 400)
  const calls = await withGlobalFetch(async () => {
    const res = await jypNoticeRoute.POST({ json: async () => ({ sourceKey: 'jy-park-jyp-notice' }) })
    assert.equal(res.body.source, 'jyp-notice')
    assert.match(res.body.errors[0], /來源已停用/)
  })
  assert.deepEqual(calls, [])
  assert.match(read('src/app/admin/sources/[id]/RunSourceButton.tsx'), /case 'jyp_notice':\s*return \{\s*endpoint: '\/api\/admin\/crawlers\/jyp-notice\/run'/)
})

// ── 5. 來源停用／失敗不下架 ──────────────────────────────────────────────────

test('來源停用、robots 失敗、fetcher 例外：已上架活動 is_published 不變、不刪', async () => {
  // 停用
  const disabled = makeDb(sourceRow({ is_active: false }))
  const fetch = fakeFetch(LIST_ROUTES)
  const r = await fetcher.runJypNoticeFetcher(disabled, { sourceKey: 'jy-park-jyp-notice', deps: { fetch, sleep: fakeSleep() } })
  assert.equal(fetch.calls.length, 0)
  assert.equal(disabled.tables.crawler_sources[0].last_status, 'skipped')
  assertEventsUntouched(disabled)
  // 網路錯誤
  const down = makeDb()
  await fetcher.runJypNoticeFetcher(down, { sourceKey: 'jy-park-jyp-notice', deps: { fetch: fakeFetch(() => new Error('ECONNRESET')), sleep: fakeSleep() } })
  assert.equal(down.tables.crawler_sources[0].last_status, 'error')
  assertEventsUntouched(down)
  // cron 裡 fetcher 拋例外（global fetch 爆掉）
  const cronDb = makeDb()
  const original = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('boom') }
  try {
    const { result } = await runActiveCrawlerSources(cronDb, { trigger: 'vercel-cron' })
    assert.equal(result.results.length, 1)
    assert.ok(result.results[0].errors.length > 0)
  } finally { globalThis.fetch = original }
  assertEventsUntouched(cronDb)
  // 原始碼回歸：爬蟲目錄沒有任何寫 events 的路徑（不下架、不刪）
  const dir = new URL('src/lib/crawlers/', root)
  for (const name of readdirSync(dir)) {
    const path = new URL(name, dir)
    if (!statSync(path).isFile()) continue
    const src = readFileSync(path, 'utf8')
    assert.doesNotMatch(src, /from\(['"]events['"]\)\s*\.(?:update|delete|upsert)/, name)
    assert.doesNotMatch(src, /is_published\s*:\s*false/, name)
  }
})

// ── 6. 不接 X／Twitter API ──────────────────────────────────────────────────

test('沒有 X／Twitter API 呼叫、套件或環境變數', () => {
  const pkg = JSON.parse(read('package.json'))
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  assert.ok(!deps.some(d => /twitter|(^|[/-])x-api|twit/i.test(d)), deps.join(','))
  for (const path of ['src/lib/crawlers/jypNotice.ts', 'src/lib/crawlers/runJypNoticeFetcher.ts', 'src/lib/crawlers/runJypScheduleFetcher.ts',
    'src/lib/crawlers/runActiveCrawlerSources.ts', 'src/app/api/admin/crawlers/jyp-notice/run/route.ts']) {
    assert.doesNotMatch(read(path), /api\.twitter\.com|api\.x\.com|TWITTER_|X_BEARER|bearer/i, path)
  }
})
