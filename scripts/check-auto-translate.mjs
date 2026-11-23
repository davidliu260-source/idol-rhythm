import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return next('data:text/javascript,export {}', context)
    if (specifier === './generateChineseDisplay' && context.parentURL?.endsWith('/claudeTranslator.ts')) {
      return next('data:text/javascript,export const generateChineseDisplayWithClaude = input => globalThis.mockClaude(input)', context)
    }
    return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? specifier + '.ts' : specifier, context)
  },
})

const {
  AUTO_TRANSLATE_TIME_BUDGET_MS, buildChineseDisplayInput,
  isTranslatable, previewPublishedBackfill, runPublishedBackfill, translateAfterAutoPublish,
  translateEvent, translateEvents, TranslatorConfigError,
} = await import('../src/lib/ai/autoTranslate.ts')
const { createSupabaseAutoTranslateStore } = await import('../src/lib/ai/supabaseAutoTranslateStore.ts')
const { claudeTranslator } = await import('../src/lib/ai/claudeTranslator.ts')
const { runAutoPublish } = await import('../src/lib/autoPublish/runAutoPublish.ts')

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const now = new Date('2026-11-22T16:01:00Z') // Already 11/23 in Taipei.
const at = now.toISOString()
const routePath = 'src/app/api/cron/sync-candidates/route.ts'
const migrationPath = 'supabase/migrations/070_event_translation_attempts.sql'
const fields = ['display_title_zh', 'display_summary_zh', 'location_name_zh']
const output = { displayTitleZh: '巡演', displaySummaryZh: null, locationNameZh: null }

function event(id = 'e1', patch = {}) {
  return {
    id, title: 'Tour', description: null, idol_name: 'TWICE', type: 'concert', sub_type: null,
    date: '2026-11-23', date_label: null, start_date: '2026-11-23', end_date: null,
    location: null, city: null, venue_name: null, address: null,
    is_published: true, published_at: at,
    display_title_zh: null, display_summary_zh: null, location_name_zh: null,
    translation_status: 'none', translation_attempts: 0, translation_attempted_at: null,
    translation_last_error: null, event_sources: [], ...patch,
  }
}

// In-memory PostgREST double. Selects and updates share the same guard evaluation.
function fixture(rows = [event()], generate = async () => output) {
  const events = new Map(rows.map(row => [row.id, row]))
  const calls = []
  const writes = []

  function compare(column, op, expected, row) {
    const value = row[column]
    if (op === 'is') return value === null && expected === null
    if (op === 'not') {
      assert.equal(expected, 'is.null')
      return value !== null
    }
    if (column.endsWith('_at') && value != null && expected != null) {
      return compare('timestamp', op, Date.parse(expected), { timestamp: Date.parse(value) })
    }
    if (op === 'eq') return value === expected
    if (op === 'lt') return value != null && value < expected
    if (op === 'gte') return value != null && value >= expected
    throw new Error(`Unexpected filter ${column} ${op}`)
  }

  function from(table) {
    assert.equal(table, 'events')
    const predicates = []
    const ordering = []
    let patch
    let first = 0
    let last = Infinity
    let single = false
    const bind = op => (column, value) => {
      predicates.push(row => compare(column, op, value, row))
      return query
    }
    const query = {
      select: () => query,
      update(values) { patch = values; return query },
      eq: bind('eq'),
      is: bind('is'),
      lt: bind('lt'),
      gte: bind('gte'),
      in(column, values) { predicates.push(row => values.includes(row[column])); return query },
      or(expression) {
        const clauses = expression.match(/and\([^)]+\)|[^,]+/g)
        predicates.push(row => clauses.some(clause => clause.replace(/^and\(|\)$/g, '').split(',').every(term => {
          const [, column, op, raw] = /^(\w+)\.(\w+)\.(.*)$/.exec(term)
          return compare(column, op, raw === 'null' ? null : raw, row)
        })))
        return query
      },
      order(column, { ascending = true, nullsFirst = false } = {}) {
        ordering.push((a, b) => {
          if (a[column] === b[column]) return 0
          if (a[column] == null) return nullsFirst ? -1 : 1
          if (b[column] == null) return nullsFirst ? 1 : -1
          return (a[column] < b[column] ? -1 : 1) * (ascending ? 1 : -1)
        })
        return query
      },
      range(from, to) { first = from; last = to; return query },
      limit(count) { last = count - 1; return query },
      maybeSingle() { single = true; return query },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          const matches = [...events.values()].filter(row => predicates.every(predicate => predicate(row)))
          matches.sort((a, b) => ordering.reduce((result, cmp) => result || cmp(a, b), 0))
          const selected = matches.slice(first, last + 1)
          if (patch) {
            writes.push({ patch, ids: selected.map(row => row.id) })
            selected.forEach(row => Object.assign(row, patch))
          }
          return { data: single ? structuredClone(selected[0] ?? null) : structuredClone(selected), error: null }
        }).then(resolve, reject)
      },
    }
    return query
  }

  const store = createSupabaseAutoTranslateStore({ from })
  const deps = {
    store, clock: () => now.getTime(),
    translator: async input => { calls.push(input); return generate(input, events) },
  }
  return { deps, store, calls, writes, events }
}

test('1. manual/reviewed 不呼叫 AI，不寫入', async () => {
  for (const translation_status of ['manual', 'reviewed']) {
    const { deps, calls, writes } = fixture([event('e1', { translation_status })])
    assert.equal((await translateEvent(deps, 'e1', { resetAttempts: true })).reason, 'protected')
    assert.deepEqual(calls, [])
    assert.deepEqual(writes, [])
  }
})

test('2. 任一中文欄已有內容或原標題空白即跳過', async () => {
  for (const patch of [...fields.map(field => ({ [field]: ' 中文 ' })), { title: ' \t' }]) {
    const { deps, calls, writes } = fixture([event('e1', patch)])
    assert.equal((await translateEvent(deps, 'e1')).outcome, 'skipped')
    assert.deepEqual(calls, [])
    assert.deepEqual(writes, [])
  }
  assert.equal(isTranslatable(event('e1', { display_title_zh: ' \t', location_name_zh: '\n' })), true)
})

test('3. none 全空只翻一次，寫入欄位與輸入組法符合既有規格', async () => {
  const row = event('e1', {
    start_date: '2026-11-24', end_date: '2026-11-25', location: 'TW', city: 'Taipei', venue_name: 'Arena',
    event_sources: [{ label: 'Official', type: 'official' }, { label: 'Second', type: 'media' }],
  })
  const { deps, calls, writes } = fixture([row])
  assert.deepEqual(await translateEvent(deps, 'e1'), { outcome: 'translated' })
  assert.deepEqual(calls, [{
    title: 'Tour', content: null, idolName: 'TWICE', eventType: 'concert', eventSubType: null,
    dateText: '2026-11-24 - 2026-11-25', locationText: 'TW / Taipei / Arena',
    sourceName: 'Official', sourceType: 'official',
  }])
  assert.equal(buildChineseDisplayInput({ ...row, date_label: 'Nov 24–25' }, []).dateText, 'Nov 24–25')
  assert.equal(buildChineseDisplayInput({ ...row, start_date: null, end_date: null }, []).dateText, row.date)
  assert.deepEqual(writes.map(({ patch }) => patch), [
    { translation_attempted_at: at, translation_last_error: null },
    { display_title_zh: '巡演', display_summary_zh: null, location_name_zh: null,
      translation_status: 'machine', translation_source: 'ai', translation_updated_at: at, translation_last_error: null },
  ])
  assert.equal((await translateEvent(deps, 'e1')).reason, 'has_chinese')
  assert.equal(calls.length, 1)
})

test('4. 已上架可翻，後台 Server Action 與詳情按鈕都可用', async () => {
  const { deps } = fixture()
  assert.equal((await translateEvent(deps, 'e1', { resetAttempts: true })).outcome, 'translated')
  const actions = read('src/app/admin/events/[id]/actions.ts')
  assert.doesNotMatch(actions, /throw new Error\('已發布活動不支援|\.eq\('is_published', false\)/)
  assert.match(actions, /translateEvent\([\s\S]+\{ resetAttempts: true \}/)
  assert.doesNotMatch(read('src/app/admin/events/[id]/page.tsx'), /已發布活動不支援直接產生繁中欄位/)
})

test('5. 條件寫入遇人工變更即跳過，認領衝突不呼叫 AI', async () => {
  const { deps, writes } = fixture([event()], async (_, events) => {
    events.get('e1').translation_status = 'manual'
    return output
  })
  assert.deepEqual(await translateEvent(deps, 'e1'), { outcome: 'skipped', reason: 'state_changed' })
  assert.deepEqual(writes[1].ids, [])
  const claimed = fixture([event('e1', { translation_attempted_at: at })])
  assert.equal((await translateEvent(claimed.deps, 'e1')).reason, 'claimed_or_changed')
  assert.equal(claimed.calls.length, 0)
})

test('6. AI 丟錯、格式錯、全 null 都會寫可安全顯示的失敗摘要', async () => {
  for (const generator of [
    async () => { throw new Error('failure ' + 'x'.repeat(220)) },
    async () => ({ ...output, locationNameZh: 3 }),
    async () => ({ ...output, displayTitleZh: null }),
  ]) {
    const { deps, events } = fixture([event('e1', { translation_attempts: 1 })], generator)
    const result = await translateEvent(deps, 'e1')
    assert.equal(result.outcome, 'failed')
    assert.equal(events.get('e1').translation_attempts, 2)
    assert.equal(events.get('e1').translation_last_error, result.message)
    assert.equal(events.get('e1').translation_attempted_at, null)
    assert.ok(result.message.length > 0 && result.message.length <= 200)
    assert.equal((await translateEvent(deps, 'e1', { resetAttempts: true })).outcome, 'failed')
    assert.equal(events.get('e1').translation_attempts, 1)
  }
})

test('7. 自動上架兩筆後才翻，其中一筆失敗仍保留兩筆上架，HTTP 判斷獨立', async () => {
  const source = { id: 'cs', source_key: 'jyp', name: 'JYP Schedule', parser_type: 'jyp_schedule', source_type: 'official_website' }
  const candidates = [1, 2].map(number => ({
    id: 'c' + number, review_status: 'pending', raw_title: 'TWICE Tour ' + number,
    detected_idol_id: 'i', detected_event_type: 'concert', detected_date: `2027-01-0${number}`,
    detected_venue_name: 'Arena', source_url: `https://twice.jype.com/${number}`,
    source_name: source.name, source_type: source.source_type, raw_data: { crawler_source_id: source.id },
  }))
  const { deps, events, calls } = fixture([], async input => {
    assert.equal([...events.values()].filter(row => row.is_published).length, 2)
    if (input.title.endsWith('2')) throw new Error('fixture failure')
    return output
  })
  const report = await runAutoPublish({
    readAutoPublishEnabled: async () => ({ enabled: true }),
    loadContext: async () => ({
      candidates, idolNames: new Map([['i', 'TWICE']]),
      ctx: { now, idols: [{ id: 'i', name: 'TWICE', is_active: true }], crawlerSources: [source], events: [], eventSources: [] },
    }),
    insertDraftEvent: async row => {
      const id = 'e' + (events.size + 1)
      events.set(id, event(id, row))
      return { id }
    },
    linkCandidate: async () => ({ updated: 1 }),
    insertEventSource: async () => ({ ok: true }),
    publishEvent: async (id, patch) => {
      Object.assign(events.get(id), patch)
      return { updated: 1 }
    },
    markCandidateApproved: async () => ({ updated: 1 }),
  }, { now, touched: candidates.map(({ id }) => ({ candidateId: id })) })
  assert.deepEqual(report.errors, [])
  assert.equal(report.created.length, 2)
  const summary = await translateAfterAutoPublish(deps, report.created.map(({ eventId }) => eventId), now.getTime())
  assert.equal(calls.length, 2)
  assert.equal(summary.translated, 1)
  assert.equal(summary.failed, 1)
  assert.ok([...events.values()].every(row => row.is_published))

  const route = read(routePath)
  assert.ok(route.indexOf('await runAutoPublish(') < route.indexOf('await translateAfterAutoPublish('))
  assert.match(route, /if \(!dryRun && AUTO_TRANSLATE_ENABLED && autoPublish\.switch === 'on'\)/)
  assert.match(route, /try\s*\{(?:(?!\bcatch\b)[\s\S])*await translateAfterAutoPublish\([\s\S]*?\n    \} catch \(error\)/)
  assert.match(route, /const allFailed\s*=\s*results\.length > 0 && results\.every\(\(r\) => r\.errors\.length > 0\)/)
  assert.match(route, /if \(allFailed\) \{[\s\S]*?autoTranslate,[\s\S]*?status: 502/)
  assert.match(route, /ok: true,[\s\S]*autoTranslate,[\s\S]*status: 200/)
})

test('8. 150 筆止於 100；超過從路由開始算的 240 秒即停止', async () => {
  const rows = Array.from({ length: 150 }, (_, index) => event(String(index), { translation_attempts: index >= 40 ? 1 : 0 }))
  const { deps, calls } = fixture(rows)
  const ids = rows.map(({ id }) => id)
  const summary = await translateAfterAutoPublish(deps, ids.slice(0, 40), now.getTime())
  assert.equal(calls.length, 100)
  assert.equal(summary.stoppedBy, 'limit')

  const exact = fixture(Array.from({ length: 100 }, (_, index) => event(String(index))))
  assert.equal((await translateAfterAutoPublish(exact.deps, ids.slice(0, 100), now.getTime())).stoppedBy, null)
  const limited = fixture(ids.slice(0, 101).map(id => event(id)))
  assert.equal((await translateAfterAutoPublish(limited.deps, ids.slice(0, 101), now.getTime())).stoppedBy, 'limit')
  assert.equal(limited.events.get('100').translation_last_error, 'deferred:limit')
  assert.equal(limited.events.get('100').translation_attempts, 0)

  const slow = fixture([event('1'), event('2'), event('manual', { translation_status: 'manual' }),
    event('chinese', { display_title_zh: '人工' })], async () => {
    slow.deps.clock = () => now.getTime() + AUTO_TRANSLATE_TIME_BUDGET_MS + 1
    return output
  })
  const timed = await translateAfterAutoPublish(slow.deps, ['1', '2', 'manual', 'chinese'], now.getTime())
  assert.equal(timed.stoppedBy, 'time')
  assert.equal(slow.calls.length, 1)
  assert.deepEqual(slow.writes.at(-1), { ids: ['2'], patch: { translation_last_error: 'deferred:time' } })
  assert.equal(slow.events.get('2').translation_attempts, 0)
  slow.deps.clock = () => now.getTime()
  assert.deepEqual(await slow.store.listPendingForCron(now, 10, new Set()), ['2'])
})

test('9. 補翻預覽無 AI、預設 25 且最多 50，包含跨日未結束，進行中即拒絕', async () => {
  const rows = [
    ...Array.from({ length: 60 }, (_, index) => event(String(index))),
    event('ongoing', { start_date: '2026-11-20', end_date: '2026-11-23' }),
    event('ended', { start_date: '2026-11-20', end_date: '2026-11-22' }),
    event('legacy', { start_date: null }),
    event('exhausted', { translation_attempts: 3 }),
    event('draft', { is_published: false }),
    ...fields.flatMap(field => [
      event(field + '-empty', { [field]: '' }),
      event(field + '-blank', { [field]: ' \t', translation_attempts: 3 }),
    ]),
  ]
  const { deps, store, calls, writes } = fixture(rows)
  assert.deepEqual(await previewPublishedBackfill(store, now), {
    eligible: 62, exhausted: 1, batchCount: 25,
    estimatedTypicalUsd: 0.0375, estimatedConservativeUsd: 25 * 0.0021,
  })
  assert.equal((await previewPublishedBackfill(store, now, 60)).batchCount, 50)
  assert.deepEqual(calls, [])
  assert.deepEqual(writes, [])
  const { eventIds, summary } = await runPublishedBackfill(deps)
  assert.equal(eventIds[0], 'ongoing')
  assert.ok(!eventIds.includes('ended'))
  assert.equal(summary.translated, 25)

  const bigger = fixture(rows.map(({ id }) => event(id)))
  assert.equal((await runPublishedBackfill(bigger.deps, 60)).summary.translated, 50)

  const busy = fixture([event('busy', { translation_attempted_at: at })])
  await assert.rejects(runPublishedBackfill(busy.deps), /已有補翻批次進行中/)
  assert.deepEqual(busy.calls, [])
  assert.equal((await runPublishedBackfill(fixture().deps, 1)).summary.stoppedBy, null)
})

test('10. cron 只撿失敗或延後的未結束活動，達上限的活動可單筆歸零重試', async () => {
  const { deps, store, calls, events, writes } = fixture([
    event('max', { translation_attempts: 3 }),
    event('old', { published_at: '2026-11-21T15:59:59Z' }),
    event('new'),
    event('retry1', { translation_attempts: 1, published_at: '2026-10-01T00:00:00Z' }),
    event('retry2', { translation_attempts: 2, published_at: '2026-11-01T00:00:00Z' }),
    event('deferred', { translation_last_error: 'deferred:time' }),
    event('ended', { end_date: '2026-11-22', translation_attempts: 1 }),
    event('busy', { translation_attempted_at: at, translation_attempts: 1 }),
    event('draft', { is_published: false, translation_attempts: 1 }),
    ...fields.map(field => event(field, { [field]: ' ', translation_attempts: 1 })),
  ])
  assert.deepEqual(await store.listPendingForCron(now, 10, new Set()), ['retry1', 'retry2', 'deferred'])
  const summary = await translateAfterAutoPublish(deps, ['max'], now.getTime())
  assert.equal(summary.skipped, 1)
  assert.equal(calls.length, 3)
  assert.equal((await translateEvent(deps, 'max', { resetAttempts: true })).outcome, 'translated')
  assert.ok(writes.some(({ ids, patch }) => ids.includes('max') && patch.translation_attempts === 0))
  assert.equal(events.get('max').translation_attempts, 0)
})

test('config 錯誤停止批次，恢復認領且保留之前的失敗計數及摘要', async () => {
  const prior = event('e1', { translation_attempts: 2, translation_last_error: 'previous', translation_attempted_at: '2026-11-22T00:00:00Z' })
  const { deps, calls, events } = fixture([structuredClone(prior), event('e2')], async () => {
    throw new TranslatorConfigError('missing config')
  })
  const summary = await translateEvents(deps, ['e1', 'e2'], { maxCount: 100, deadlineMs: now.getTime() + 1 })
  assert.equal(summary.stoppedBy, 'config')
  assert.equal(summary.failed, 0)
  assert.equal(calls.length, 1)
  assert.deepEqual(events.get('e1'), prior)
  await assert.rejects(translateEvent(deps, 'e1', { resetAttempts: true }), TranslatorConfigError)
  assert.deepEqual(events.get('e1'), prior)
})

test('Claude adapter 將 401、403 與帳務錯誤分類為 config，cron 延後本輪其餘活動', () => withMockClaude(async () => {
  for (const error of ['401 authentication_error', '403 permission_error', '400 CrEdIt BaLaNcE is too low', 'BILLING']) {
    const { deps, calls, events } = fixture([event('e1'), event('e2')], claudeTranslator)
    globalThis.mockClaude = async () => { throw new Error(`AI 呼叫失敗：${error} secret`) }
    const summary = await translateAfterAutoPublish(deps, ['e1', 'e2'], now.getTime())
    assert.equal(summary.stoppedBy, 'config')
    assert.equal(summary.failed, 0)
    assert.equal(calls.length, 1)
    assert.equal(summary.failures[0].message, 'AI 驗證、權限或帳務設定有誤')
    for (const row of events.values()) {
      assert.equal(row.translation_attempts, 0)
      assert.equal(row.translation_attempted_at, null)
      assert.equal(row.translation_last_error, 'deferred:config')
    }
  }
}))

test('連續三筆 API 失敗即停，格式錯誤及全 null 會中斷連續計數', () => withMockClaude(async () => {
  const errors = [
    'AI 呼叫失敗：429 secret', 'AI 呼叫失敗：overloaded_error secret', 'AI 回傳格式錯誤：401 secret',
    'AI 呼叫失敗：429 secret', 'AI 呼叫失敗：429 secret', 'AI 未產生可寫入的繁中欄位',
    'AI 呼叫失敗：429 secret', 'AI 呼叫失敗：overloaded_error secret', 'AI 呼叫失敗：529 secret',
  ]
  globalThis.mockClaude = async () => { throw new Error(errors.shift()) }
  const rows = Array.from({ length: 10 }, (_, index) => event(String(index)))
  const { deps, calls, events } = fixture(rows, claudeTranslator)
  const summary = await translateAfterAutoPublish(deps, rows.map(({ id }) => id), now.getTime())
  assert.equal(summary.stoppedBy, 'api')
  assert.equal(summary.failed, 9)
  assert.equal(calls.length, 9)
  assert.deepEqual(summary.failures.slice(-3).map(({ message }) => message), [
    'AI 呼叫失敗（HTTP 429）', 'AI 呼叫失敗（overloaded_error）', 'AI 呼叫失敗（HTTP 529）',
  ])
  assert.deepEqual([...events.values()].map(row => row.translation_attempts), [1, 1, 1, 1, 1, 1, 1, 1, 1, 0])
  assert.equal(events.get('9').translation_last_error, 'deferred:api')

  globalThis.mockClaude = async () => { throw new Error('AI 呼叫失敗：429 secret') }
  const split = fixture([event('new'), ...['retry1', 'retry2', 'retry3'].map(id =>
    event(id, { translation_attempts: 1, translation_last_error: 'previous' }))], claudeTranslator)
  const acrossPasses = await translateAfterAutoPublish(split.deps, ['new'], now.getTime())
  assert.equal(acrossPasses.stoppedBy, 'api')
  assert.equal(split.calls.length, 3)
  assert.equal(split.events.get('retry3').translation_attempts, 1)
}))

test('Claude 逾時算一次一般失敗，並解除認領', t => withMockClaude(async () => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signalStarted
  const started = new Promise(resolve => { signalStarted = resolve })
  globalThis.mockClaude = () => {
    signalStarted()
    return new Promise(() => {})
  }
  const { deps, events } = fixture([event()], claudeTranslator)
  const result = translateEvent(deps, 'e1')
  await started
  t.mock.timers.tick(45_000)
  assert.deepEqual(await result, { outcome: 'failed', reason: 'api', message: 'AI 呼叫逾時' })
  assert.equal(events.get('e1').translation_attempts, 1)
  assert.equal(events.get('e1').translation_attempted_at, null)
}))

async function withMockClaude(run) {
  // The adapter reads a dummy value from this isolated environment object.
  const env = process.env
  process.env = { ANTHROPIC_API_KEY: 'test-placeholder' }
  try {
    await run()
  } finally {
    process.env = env
    delete globalThis.mockClaude
  }
}

test('070 只新增三欄及指定的欄位級 UPDATE 權限', () => {
  const sql = read(migrationPath).replace(/^\s*--.*$/gm, '')
  assert.deepEqual([...sql.matchAll(/ADD COLUMN IF NOT EXISTS ([^,;]+)/g)].map(match => match[1]), [
    'translation_attempts int NOT NULL DEFAULT 0', 'translation_last_error text', 'translation_attempted_at timestamptz',
  ])
  const tracking = ['translation_attempts', 'translation_last_error', 'translation_attempted_at']
  const grants = [...sql.matchAll(/GRANT UPDATE\s*\(([^)]+)\)\s+ON public\.events TO (\w+);/g)]
  assert.deepEqual(grants.map(([, columns, role]) => [role, columns.trim().split(/\s*,\s*/)]), [
    ['service_role', [...fields, 'translation_status', 'translation_source', 'translation_updated_at', ...tracking]],
    ['authenticated', tracking],
  ])
  assert.equal([...sql.matchAll(/\bGRANT\b/g)].length, 2)
  assert.doesNotMatch(sql, /\b(?:UPDATE\s+\S+\s+SET|DELETE\s+FROM|(?:CREATE|DROP)\s+POLICY)\b/i)
})

test('受保護路徑維持與 origin/main 的 merge base 一致', () => {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const base = git('merge-base', 'origin/main', 'HEAD').trim()
  const paths = [
    'src/lib/crawlers', 'src/lib/ics', 'src/app/api/ics', 'src/app/api/cron',
    'src/lib/reminderDispatch.ts', 'supabase/migrations', 'package.json', 'vercel.json',
    'src/lib/autoPublish/minimumContent.ts', 'src/lib/autoPublish/evaluateCandidate.ts', 'src/lib/autoPublish/runAutoPublish.ts',
    'src/lib/ai/generateChineseDisplay.ts', 'src/lib/ai/parseCandidate.ts',
    `:(exclude)${routePath}`, `:(exclude)${migrationPath}`,
    ':(exclude)supabase/migrations/071_event_error_reports.sql',
  ]
  assert.equal(git('diff', '--name-only', base, '--', ...paths), '')
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...paths), '')
})
