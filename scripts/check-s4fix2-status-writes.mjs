import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import { test } from 'node:test'

// These scenarios finish before HTML parsing. Fail immediately if they reach it.
const noParser = 'data:text/javascript,export function load() { throw Error("Unexpected HTML parsing") }'
let cheerioPath = noParser
try {
  cheerioPath = createRequire(import.meta.url).resolve('cheerio')
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error
}
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cheerio') return nextResolve(cheerioPath, context)
    const path = context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)
      ? `${specifier}.ts` : specifier
    return nextResolve(path, context)
  },
})

const { runActiveCrawlerSources, runCrawlerSource } = await import('../src/lib/crawlers/runActiveCrawlerSources.ts')
const { runYgNoticeFetcher } = await import('../src/lib/crawlers/runYgNoticeFetcher.ts')
const { YG_NOTICE_URL } = await import('../src/lib/crawlers/ygNotice.ts')
const { KAOARENA_LIST_URL } = await import('../src/lib/crawlers/venueCalendar.ts')
hooks.deregister()

const yg = {
  id: 'yg-id', source_key: 'generic-yg-notice', name: 'YG', is_active: true,
  parser_type: 'yg_notice', source_type: 'official_website', source_url: YG_NOTICE_URL,
  idol_id: 'bigbang', config: { locale: 'ko', maxPages: 5, memberSlugs: [] },
}
const venue = {
  id: 'venue-id', source_key: 'kaoarena-venue-calendar', name: '高雄巨蛋', is_active: true,
  parser_type: 'venue_calendar', source_type: 'official_website', source_url: KAOARENA_LIST_URL,
  idol_id: null, config: { venueKey: 'kaoarena' },
}

function mockSupabase({ lookup = () => yg, rows = [yg], writeResult, onWrite } = {}) {
  const writes = []
  const statusRows = new Map()
  const lookups = []
  const idolQueries = []
  return {
    writes, lookups, idolQueries,
    from(table) {
      if (table === 'idols') {
        const query = {
          select: () => query, eq: () => query,
          in: (column, values) => {
            idolQueries.push([column, values])
            return query
          },
          order: async () => ({ data: [{ id: 'bigbang', slug: 'bigbang', name: 'BIGBANG', alt_names: [] }] }),
        }
        return query
      }
      assert.equal(table, 'crawler_sources')
      let readId
      const query = {
        select: () => query,
        eq(column, value) {
          if (column === 'source_key') lookups.push(value)
          if (column === 'id') readId = value
          return query
        },
        order: async () => ({ data: rows }),
        maybeSingle: async () => ({ data: readId ? statusRows.get(readId) : lookup(lookups.at(-1)) }),
        update(patch) {
          return {
            eq(column, id) {
              assert.equal(column, 'id')
              assert.ok(Number.isFinite(Date.parse(patch.last_run_at)))
              writes.push({ id, status: patch.last_status, error: patch.last_error })
              return { select: async () => {
                onWrite?.()
                if (writeResult) return writeResult
                const row = { id, ...patch }
                statusRows.set(id, row)
                return { data: [row], error: null }
              } }
            },
          }
        },
      }
      return query
    },
  }
}

test('YG writes errors for mismatched config, missing lookup and thrown lookup', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected fetch'))
  const scenarios = [
    {
      lookup: () => ({
        ...yg, parser_type: 'unexpected', source_type: 'unknown', source_url: 'https://example.invalid',
        config: { locale: 'en', maxPages: 1, memberSlugs: ['!'] },
      }),
      status: 400,
      details: ['parser_type=unexpected', 'source_type=unknown', 'source_url=https://example.invalid',
        'config 型別=object', 'locale="en"', 'maxPages=1', 'memberSlugs=["!"]'],
    },
    { lookup: () => ({ ...yg, config: null }), status: 400, details: ['config 型別=null'] },
    { lookup: () => null, status: 500, details: ['找不到 crawler_sources'] },
    { lookup: () => { throw new Error('lookup threw') }, status: 500, details: ['lookup threw'] },
  ]
  for (const { lookup, status, details } of scenarios) {
    const supabase = mockSupabase({ lookup })
    const result = await runCrawlerSource(supabase, yg, false)
    assert.equal(result.mode, 'insert')
    assert.equal(result.status, status)
    assert.equal(result.inserted, 0)
    assert.equal(result.errors.length, 1)
    for (const detail of details) assert.ok(result.errors[0].includes(detail))
    assert.deepEqual(supabase.writes, [{ id: yg.id, status: 'error', error: result.errors[0] }])
  }
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('YG M068 config reaches fetch in dry-run and writes status on HTTP failure', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }))
  const supabase = mockSupabase()
  const result = await runYgNoticeFetcher(supabase, { sourceKey: yg.source_key, dryRun: true })
  assert.equal(result.mode, 'dry-run')
  assert.equal(result.status, 502)
  assert.equal(result.inserted, 0)
  assert.ok(supabase.idolQueries[0][1].includes('bigbang'))
  assert.equal(fetchMock.mock.callCount(), 1)
  assert.match(result.errors[0], /HTTP 503/)
  assert.deepEqual(supabase.writes, [{ id: yg.id, status: 'error', error: result.errors[0] }])
})

test('YG and venue expose DB errors and zero-row writes in results and summary', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }))
  const logger = t.mock.method(console, 'error', () => {})
  const dbError = { code: '42501', message: 'permission denied' }
  for (const [source, writeResult, expected] of [
    [yg, { data: null, error: dbError }, /permission denied/],
    [venue, { data: [], error: null }, /實際更新 0 列/],
  ]) {
    const supabase = mockSupabase({ rows: [source], lookup: () => source, writeResult })
    const { result, error } = await runActiveCrawlerSources(supabase)
    assert.equal(error, null)
    assert.equal(result.summary.errorCount, 1)
    assert.equal(result.summary.statusWriteErrorCount, 1)
    assert.match(result.results[0].errors[0], /HTTP 503/)
    const writeError = result.results[0].errors[1]
    assert.match(writeError, expected)
    assert.ok(writeError.includes(`crawlerSourceId=${source.id}`))
    assert.equal(supabase.writes.length, 1)
    assert.equal(supabase.writes[0].id, source.id)
    assert.equal(logger.mock.calls.at(-1).arguments[0], writeError)
  }
  const statusLogs = logger.mock.calls.filter(({ arguments: [message] }) =>
    typeof message === 'string' && message.startsWith('crawler_sources 狀態寫入失敗'),
  )
  assert.equal(statusLogs.length, 2)
  assert.equal(statusLogs[0].arguments[1], dbError)
})

test('after the 25-second reserve begins, remaining sources skip without counting as errors', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 })
  const fetchMock = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected fetch'))
  const supabase = mockSupabase({
    lookup: () => ({ ...yg, is_active: false }),
    rows: [yg, venue, { ...yg, id: 'later-id', source_key: 'later-yg' }],
    onWrite: () => t.mock.timers.setTime(276000),
  })
  const { result, error } = await runActiveCrawlerSources(supabase)
  assert.equal(error, null)
  assert.deepEqual(supabase.lookups, [yg.source_key])
  assert.equal(fetchMock.mock.callCount(), 0)
  assert.deepEqual(supabase.writes.slice(1), [venue.id, 'later-id'].map((id) => ({
    id, status: 'skipped', error: '本輪剩餘時間不足，下輪再跑',
  })))
  assert.deepEqual(result.results.slice(1).map(({ errors, skipped }) => [errors, skipped]), [[[], 1], [[], 1]])
  assert.equal(result.summary.errorCount, 1)
  assert.equal(result.summary.successCount, 2)
  assert.equal(result.summary.statusWriteErrorCount, 0)
})
