import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import { test } from 'node:test'

const cheerioPath = createRequire(import.meta.url).resolve('cheerio')
const serviceStub = 'data:text/javascript,export function getSupabaseServiceClient() { return client } export let client; export function setClient(value) { client = value }'
const crawlerSourceUrl = new URL('../src/lib/crawlers/crawlerSource.ts', import.meta.url)
const venueStub = 'data:text/javascript,' + encodeURIComponent(`
  import { updateRunStatus } from ${JSON.stringify(crawlerSourceUrl.href)}
  export async function runVenueCalendarFetcher(client, { sourceId, sourceKey }) {
    await updateRunStatus(client, sourceId, { last_status: 'success', last_error: null })
    const error = await updateRunStatus(client, sourceId, {
      last_status: 'partial_error', last_error: 'x'.repeat(500),
    })
    return { sourceKey, touched: [], status: 200, errors: error ? [error] : [] }
  }
`)
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cheerio') return nextResolve(cheerioPath, context)
    if (specifier === 'next/server') return nextResolve('next/server.js', context)
    if (specifier === '@/lib/supabase/serviceClient') return nextResolve(serviceStub, context)
    if (specifier === './runVenueCalendarFetcher' && context.parentURL?.endsWith('/runActiveCrawlerSources.ts?two-writes')) {
      return nextResolve(venueStub, context)
    }
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context)
    }
    const path = context.parentURL?.split('?')[0].endsWith('.ts') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)
      ? `${specifier}.ts` : specifier
    return nextResolve(path, context)
  },
})
const { updateRunStatus, STATUS_WRITE_ERROR_PREFIX } = await import('../src/lib/crawlers/crawlerSource.ts')
const { runActiveCrawlerSources } = await import('../src/lib/crawlers/runActiveCrawlerSources.ts')
const { runActiveCrawlerSources: runWithVenueStub } = await import('../src/lib/crawlers/runActiveCrawlerSources.ts?two-writes')
const { GET } = await import('../src/app/api/cron/sync-candidates/route.ts')
const { setClient } = await import(serviceStub)
hooks.deregister()

const columns = 'id, last_run_at, last_status, last_error, updated_at'
const patch = { last_status: 'partial_error', last_error: 'fixture error' }
const id = 'fixture'
const missingSource = { id, source_key: 'missing-jyp', name: 'JYP', parser_type: 'jyp_schedule' }

function mockClient({
  returning = (row) => [row], readBack = (row) => row, rows = [], listError = null,
} = {}) {
  let written
  return {
    from(table) {
      assert.equal(table, 'crawler_sources')
      const query = {
        update(values) {
          return {
            eq(column, value) {
              assert.equal(column, 'id')
              written = { id: value, ...values }
              return {
                select: async (fields) => {
                  assert.equal(fields, columns)
                  return { data: returning(written), error: null }
                },
              }
            },
          }
        },
        select(fields) {
          return {
            eq(column, value) {
              if (column === 'is_active') {
                assert.equal(value, true)
                return { order: async () => ({ data: rows, error: listError }) }
              }
              if (column === 'source_key') return { maybeSingle: async () => ({ data: null }) }
              assert.equal(column, 'id')
              assert.equal(fields, columns)
              assert.equal(value, written.id)
              return { maybeSingle: async () => ({ data: readBack(written), error: null }) }
            },
          }
        },
      }
      return query
    },
  }
}

test('matching RETURNING and read-back accept equivalent timestamps and log success', async (t) => {
  const log = t.mock.method(console, 'log', () => {})
  const readBack = (row) => ({ ...row, last_run_at: row.last_run_at.replace('Z', '+00:00') })
  assert.equal(await updateRunStatus(mockClient({ readBack }), id, patch), null)
  const [prefix, payload] = log.mock.calls[0].arguments
  assert.equal(prefix, '[crawler-status] write ok')
  assert.match(JSON.parse(payload).last_run_at, /\+00:00$/)
  assert.equal(JSON.parse(payload).last_status, patch.last_status)
})

test('last_error longer than 2000 characters is written and verified at its stored length', async (t) => {
  t.mock.method(console, 'log', () => {})
  const lastError = '錯'.repeat(2000)
  const readBack = (row) => {
    assert.equal(row.last_error, lastError)
    return row
  }
  assert.equal(await updateRunStatus(mockClient({ readBack }), id, {
    ...patch, last_error: lastError + '超出的內容',
  }), null)
})

test('wrong row count, missing read-back and status, timestamp or error mismatches fail', async (t) => {
  for (const [options, detail, actual] of [
    [{ returning: () => [] }, /實際更新 0 列/, '實際讀回=null'],
    [{ returning: (row) => [row, row] }, /實際更新 2 列/, '實際讀回=null'],
    [{ returning: (row) => [{ ...row, last_error: null }] }, /RETURNING狀態不一致/, '"last_error_head":null,"last_error_length":0'],
    [{ readBack: () => null }, /讀不到/, '實際讀回=null'],
    [{ readBack: (row) => ({ ...row, last_status: 'error' }) }, /讀回狀態不一致/, '"last_status":"error"'],
    [{ readBack: (row) => ({ ...row, last_run_at: '2000-01-01T00:00:00Z' }) }, /讀回狀態不一致/, '2000-01-01T00:00:00Z'],
    [{ readBack: (row) => ({ ...row, last_error: null }) }, /讀回狀態不一致/, '"last_error_head":null,"last_error_length":0'],
  ]) {
    const logs = t.mock.method(console, 'error', () => {})
    const result = await updateRunStatus(mockClient(options), id, patch)
    assert.ok(result.startsWith(STATUS_WRITE_ERROR_PREFIX))
    assert.match(result, detail)
    assert.ok(result.includes('預期='))
    assert.ok(result.includes('"last_status":"partial_error"'))
    assert.ok(result.includes(actual))
    assert.equal(logs.mock.calls[0].arguments[0], result)
    logs.mock.restore()
  }
})

test('a source that writes twice logs both calls and caps the last error in the end line', async (t) => {
  const info = t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'error', () => {})
  const source = { id, source_key: 'venue-twice', parser_type: 'venue_calendar' }
  const readBack = (row) => row.last_error ? { ...row, last_error: row.last_error + 'y' } : row
  const { result } = await runWithVenueStub(mockClient({ rows: [source], readBack }))
  const [error] = result.results[0].errors
  assert.ok(error.startsWith(`${STATUS_WRITE_ERROR_PREFIX}（crawlerSourceId=${id}）`))
  assert.match(error, /讀回狀態不一致/)
  const [, expected, returning, actual] = error.split(/；(?:預期|RETURNING|實際讀回)=/)
  for (const [row, length] of [
    [JSON.parse(expected), 500], [JSON.parse(returning)[0], 500], [JSON.parse(actual), 501],
  ]) {
    assert.equal(row.last_error, undefined)
    assert.equal(row.last_error_head, 'x'.repeat(200))
    assert.equal(row.last_error_length, length)
  }
  const end = info.mock.calls.find(({ arguments: [prefix] }) => prefix === '[crawler-source] end')
  const payload = JSON.parse(end.arguments[1])
  assert.equal(payload.source_key, source.source_key)
  assert.equal(payload.statusWriteCalls, 2)
  assert.equal(payload.lastStatusWriteResult, error.slice(0, 300))
})

test('parallel source loops keep tracking separate and log a missing write at error level', async (t) => {
  const info = t.mock.method(console, 'log', () => {})
  const errors = t.mock.method(console, 'error', () => {})
  const skipped = { id: 'skip', source_key: 'skip', parser_type: 'generic_webpage' }
  const [missing, guarded] = await Promise.all([
    runActiveCrawlerSources(mockClient({ rows: [missingSource] })),
    runActiveCrawlerSources(mockClient({ rows: [skipped] }), { startedAt: Date.now() - 275_000 }),
  ])
  const starts = info.mock.calls.filter(({ arguments: [prefix] }) => prefix === '[crawler-source] start')
  assert.deepEqual(starts.map(({ arguments: [, json] }) => JSON.parse(json).source_key), ['missing-jyp', 'skip'])
  const [[, missingEnd]] = errors.mock.calls.map((call) => call.arguments)
  assert.equal(errors.mock.calls[0].arguments[0], '[crawler-source] end')
  assert.deepEqual(
    (({ source_key, statusWriteCalls, lastStatusWriteResult, status, errorCount }) =>
      [source_key, statusWriteCalls, lastStatusWriteResult, status, errorCount])(JSON.parse(missingEnd)),
    ['missing-jyp', 0, null, missing.result.results[0].status, 1],
  )
  assert.equal(missing.result.summary.statusWriteErrorCount, 0)
  const end = info.mock.calls.find(({ arguments: [prefix] }) => prefix === '[crawler-source] end')
  assert.equal(JSON.parse(end.arguments[1]).statusWriteCalls, 1)
  assert.equal(JSON.parse(end.arguments[1]).lastStatusWriteResult, 'ok')
  assert.equal(guarded.result.results[0].skipped, 1)
})

test('mock cron responses log crawler summary at the appropriate level', async (t) => {
  const info = t.mock.method(console, 'log', () => {})
  const errors = t.mock.method(console, 'error', () => {})
  const savedEnv = process.env
  process.env = { CRON_SECRET: 'fixture-only' }
  try {
    for (const [client, status, sink] of [
      [mockClient(), 200, info],
      [mockClient({
        rows: [{ id, source_key: 'web-only', name: 'Web', parser_type: 'generic_webpage' }],
        returning: () => [],
      }), 502, errors],
      [mockClient({ listError: { message: 'fixture list error' } }), 500, errors],
    ]) {
      setClient(client)
      const response = await GET({
        nextUrl: new URL('https://example.invalid/api/cron/sync-candidates?dryRun=1'),
        headers: new Headers({ authorization: 'Bearer fixture-only' }),
      })
      assert.equal(response.status, status)
      const [prefix, json] = sink.mock.calls.at(-1).arguments
      assert.equal(prefix, '[crawler-cron] summary')
      const payload = JSON.parse(json)
      const body = await response.json()
      assert.equal(payload.mode, 'dry-run')
      assert.ok(payload.elapsedMs >= 0)
      if (status === 500) {
        assert.equal(payload.error, body.error)
      } else {
        assert.equal(payload.summary.statusWriteErrorCount, status === 502 ? 1 : 0)
        assert.deepEqual(payload.summary, body.summary)
        assert.deepEqual(payload.results, body.results.map(({ sourceKey, status, errors }) => ({ sourceKey, status, errors })))
      }
    }
  } finally {
    process.env = savedEnv
    setClient(undefined)
  }
})
