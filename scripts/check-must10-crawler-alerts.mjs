// 執行方式：node scripts/check-must10-crawler-alerts.mjs
// MUST #10：爬蟲故障提醒（全來源，特別是 KpopOfficial）。
// 只用記憶體裡的假 Supabase 與假 fetch；不連網、不連資料庫、不讀 .env。
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

const dataModule = source => `data:text/javascript,${encodeURIComponent(source)}`
const MOCKS = {
  'next/server': 'export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }',
  'next/cache': 'export const revalidatePath = path => { (globalThis.__alerts.revalidated ??= []).push(path) }',
  '@/lib/supabase/serverClient': 'export const getSupabaseServerClient = () => globalThis.__alerts.client',
  '@/lib/supabase/adminAuth': 'export const getCurrentAdmin = async () => ({ isAdmin: globalThis.__alerts.isAdmin === true })',
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
globalThis.__alerts = {}

const alerts = await import('../src/lib/crawlers/crawlerSourceAlerts.ts')
const { updateRunStatus } = await import('../src/lib/crawlers/crawlerSource.ts')
const { runActiveCrawlerSources } = await import('../src/lib/crawlers/runActiveCrawlerSources.ts')
const route = await import(pathToFileURL(fileURLToPath(new URL('src/app/api/admin/crawler-alerts/route.ts', root))).href)

// 測試期間的 log 很多（故意觸發失敗），全部收起來，另外留一份給斷言用。
const logs = { warn: [], error: [] }
console.log = () => {}
console.warn = (...args) => { logs.warn.push(args.map(String).join(' ')) }
console.error = (...args) => { logs.error.push(args.map(String).join(' ')) }

// ── 假 Supabase ─────────────────────────────────────────────────────────────
// 模擬 migration 072 的重點行為：部分唯一索引、resolved 一致性 CHECK、
// authenticated 不能 INSERT 提醒、只能 UPDATE 指定欄位；以及「072 尚未套用」。

const HEALTH_COLUMNS = ['last_success_at', 'last_fetched_count', 'consecutive_error_count', 'consecutive_zero_fetch_count']
const ADMIN_UPDATABLE_ALERT_COLUMNS = ['status', 'acknowledged_at', 'resolved_at', 'detail']
const UNRESOLVED = ['open', 'acknowledged']

function fakeDb(tables, { role = 'service_role', schema072 = true } = {}) {
  const ops = []
  let alertSeq = 0
  const db = {
    ops,
    tables,
    from(table) {
      const st = { table, kind: 'select', filters: [], row: null, columns: null, limit: null }
      ops.push(st)
      const rows = () => (tables[table] ??= [])
      const match = r => st.filters.every(([k, v, op]) => (op === 'in' ? v.includes(r[k]) : r[k] === v))
      const fail = (code, message) => ({ data: null, error: { code, message } })
      const run = () => {
        if (table === 'crawler_source_alerts') {
          if (!schema072) return fail('PGRST205', "Could not find the table 'public.crawler_source_alerts' in the schema cache")
          if (st.kind === 'delete') return fail('42501', 'permission denied for table crawler_source_alerts')
          if (st.kind === 'insert') {
            if (role !== 'service_role') return fail('42501', 'permission denied for table crawler_source_alerts')
            const row = { status: 'open', acknowledged_at: null, resolved_at: null, detail: null, ...structuredClone(st.row) }
            if (rows().some(r => r.source_id === row.source_id && r.kind === row.kind && UNRESOLVED.includes(r.status))) {
              return fail('23505', 'duplicate key value violates unique constraint "crawler_source_alerts_open_kind_uidx"')
            }
            row.id = ++alertSeq
            rows().push(row)
            return { data: [{ ...row }], error: null }
          }
          if (st.kind === 'update') {
            if (role !== 'service_role' && Object.keys(st.row).some(k => !ADMIN_UPDATABLE_ALERT_COLUMNS.includes(k))) {
              return fail('42501', 'permission denied for table crawler_source_alerts')
            }
            const hit = rows().filter(match)
            for (const r of hit) {
              const next = { ...r, ...st.row }
              if ((next.status === 'resolved') !== (next.resolved_at != null)) {
                return fail('23514', 'violates check constraint "crawler_source_alerts_resolved_consistency"')
              }
            }
            for (const r of hit) Object.assign(r, structuredClone(st.row))
            return { data: hit.map(r => ({ ...r })), error: null }
          }
        }
        if (table === 'crawler_sources' && !schema072) {
          const touchesHealth = st.kind === 'update'
            ? Object.keys(st.row).some(k => HEALTH_COLUMNS.includes(k))
            : HEALTH_COLUMNS.some(c => (st.columns ?? '').includes(c))
          if (touchesHealth) {
            return st.kind === 'update'
              ? fail('PGRST204', "Could not find the 'consecutive_error_count' column of 'crawler_sources' in the schema cache")
              : fail('42703', 'column crawler_sources.last_success_at does not exist')
          }
        }
        if (st.kind === 'insert') {
          const r = { id: `${table}-${rows().length + 1}`, ...structuredClone(st.row) }
          rows().push(r)
          return { data: [r], error: null }
        }
        if (st.kind === 'update') {
          const hit = rows().filter(match)
          for (const r of hit) Object.assign(r, structuredClone(st.row))
          return { data: hit.map(r => ({ ...r })), error: null }
        }
        if (st.kind === 'delete') {
          const hit = rows().filter(match)
          tables[table] = rows().filter(r => !hit.includes(r))
          return { data: hit, error: null }
        }
        const found = rows().filter(match).map(r => ({ ...r }))
        return { data: st.limit == null ? found : found.slice(0, st.limit), error: null }
      }
      let cached
      const exec = () => (cached ??= run())
      const one = () => {
        const { data, error } = exec()
        return { data: error ? null : data[0] ?? null, error }
      }
      const q = {
        select(columns) { if (st.kind === 'select') st.columns = columns; return q },
        order: () => q,
        limit(n) { st.limit = n; return q },
        eq(k, v) { st.filters.push([k, v]); return q },
        in(k, v) { st.filters.push([k, v, 'in']); return q },
        insert(row) { st.kind = 'insert'; st.row = row; return q },
        update(row) { st.kind = 'update'; st.row = row; return q },
        delete() { st.kind = 'delete'; return q },
        maybeSingle: async () => one(),
        single: async () => one(),
        then: (resolve, reject) => Promise.resolve(exec()).then(resolve, reject),
      }
      return q
    },
  }
  return db
}

const KPOP = {
  id: 'cs-kpop', source_key: 'kpopofficial-concerts', name: 'KpopOfficial 演唱會列表', idol_id: null,
  source_url: 'https://kpopofficial.example/concerts', source_type: 'media_outlet', parser_type: 'kpopofficial_concerts',
}
const NOTICE = {
  id: 'cs-notice', source_key: 'generic-yg-notice', name: 'YG 官網公告', idol_id: 'i-1',
  source_url: 'https://yg.example/notice', source_type: 'official_website', parser_type: 'yg_notice',
}
const FRESH_HEALTH = { last_success_at: null, last_fetched_count: null, consecutive_error_count: 0, consecutive_zero_fetch_count: 0 }

function sourceRow(base, overrides = {}) {
  return { is_active: true, config: {}, last_run_at: null, last_status: null, last_error: null, ...FRESH_HEALTH, ...base, ...overrides }
}
/** 072 尚未套用：來源列沒有健康欄。 */
function legacySourceRow(base, overrides = {}) {
  const { last_success_at, last_fetched_count, consecutive_error_count, consecutive_zero_fetch_count, ...row } = sourceRow(base, overrides)
  return row
}

const PUBLISHED_EVENTS = [
  { id: 'ev-1', idol_id: 'i-1', title: 'Published Concert', is_published: true, trust_level: 'official', status: 'confirmed' },
  { id: 'ev-2', idol_id: 'i-1', title: 'Aggregator Concert', is_published: true, trust_level: 'aggregator', status: 'confirmed' },
]

function makeDb(sources, options = {}, extra = {}) {
  return fakeDb({
    crawler_sources: sources,
    crawler_source_alerts: [],
    events: structuredClone(PUBLISHED_EVENTS),
    notifications: [],
    ...extra,
  }, options)
}

const run = (db, source, status, fetched) =>
  updateRunStatus(db, source.id, { last_status: status, last_error: status === 'success' ? null : '測試用錯誤', fetched })
const src = (db, id) => db.tables.crawler_sources.find(r => r.id === id)
const alertsOf = (db, id, kind) => db.tables.crawler_source_alerts.filter(r => r.source_id === id && (!kind || r.kind === kind))
const unresolvedOf = (db, id, kind) => alertsOf(db, id, kind).filter(r => UNRESOLVED.includes(r.status))

/** 守門：已上架活動不變、不刪；粉絲通知表完全沒被寫入。 */
function assertEventsAndFanNotificationsUntouched(db) {
  assert.deepEqual(db.tables.events, PUBLISHED_EVENTS)
  assert.deepEqual(db.ops.filter(op => op.table === 'events' && op.kind !== 'select'), [])
  assert.deepEqual(db.ops.filter(op => op.table === 'notifications'), [])
  assert.deepEqual(db.tables.notifications, [])
}

const HOUR = 3_600_000

// ── 1. 門檻常數 ─────────────────────────────────────────────────────────────

test('門檻是寫死的程式常數：3 次失敗、48 小時、3 次 0 筆', () => {
  assert.equal(alerts.ERROR_STREAK_THRESHOLD, 3)
  assert.equal(alerts.STALE_SUCCESS_MS, 48 * 60 * 60 * 1000)
  assert.equal(alerts.ZERO_FETCH_STREAK_THRESHOLD, 3)
  const source = read('src/lib/crawlers/crawlerSourceAlerts.ts')
  assert.doesNotMatch(source, /process\.env/)
})

// ── 2. 連續失敗 ─────────────────────────────────────────────────────────────

test('連續 3 次 error／partial_error 才開 error_streak（故障）；之後再失敗只更新同一筆', async () => {
  const db = makeDb([sourceRow(NOTICE)])
  assert.equal(await run(db, NOTICE, 'error', 0), null)
  assert.equal(await run(db, NOTICE, 'partial_error', 4), null)
  assert.equal(src(db, NOTICE.id).consecutive_error_count, 2)
  assert.equal(src(db, NOTICE.id).last_fetched_count, 4)
  assert.equal(src(db, NOTICE.id).last_success_at, null, '失敗不得更新 last_success_at')
  assert.deepEqual(db.tables.crawler_source_alerts, [], '未達門檻不產生提醒')

  await run(db, NOTICE, 'error', 0)
  assert.equal(src(db, NOTICE.id).consecutive_error_count, 3)
  assert.equal(src(db, NOTICE.id).consecutive_zero_fetch_count, 0, '失敗不算「成功但 0 筆」')
  const [opened] = db.tables.crawler_source_alerts
  assert.equal(db.tables.crawler_source_alerts.length, 1)
  assert.deepEqual([opened.kind, opened.severity, opened.status, opened.resolved_at], ['error_streak', 'fault', 'open', null])
  assert.match(opened.detail, /連續 3 次執行失敗/)

  const firstTriggered = opened.last_triggered_at
  await new Promise(resolve => setTimeout(resolve, 5))
  await run(db, NOTICE, 'error', 0)
  assert.equal(db.tables.crawler_source_alerts.length, 1, '同一來源同一類型不重複開單')
  assert.match(db.tables.crawler_source_alerts[0].detail, /連續 4 次執行失敗/)
  assert.ok(db.tables.crawler_source_alerts[0].last_triggered_at > firstTriggered)
  assert.equal(db.tables.crawler_source_alerts[0].opened_at, opened.opened_at)
  assertEventsAndFanNotificationsUntouched(db)
})

// ── 3. 成功但 0 筆 ──────────────────────────────────────────────────────────

test('連續 3 次成功且 0 筆：KpopOfficial 是故障，其他來源是警告；未達門檻不產生', async () => {
  const db = makeDb([sourceRow(KPOP), sourceRow(NOTICE)])
  for (const source of [KPOP, NOTICE]) {
    await run(db, source, 'success', 0)
    await run(db, source, 'success', 0)
  }
  assert.deepEqual(db.tables.crawler_source_alerts, [], '2 次 0 筆未達門檻')
  for (const source of [KPOP, NOTICE]) await run(db, source, 'success', 0)

  for (const [source, severity] of [[KPOP, 'fault'], [NOTICE, 'warning']]) {
    const row = src(db, source.id)
    assert.equal(row.consecutive_zero_fetch_count, 3)
    assert.equal(row.consecutive_error_count, 0, '0 筆不算連續失敗')
    assert.equal(row.last_fetched_count, 0)
    assert.ok(row.last_success_at, '成功但 0 筆仍更新 last_success_at（來源有通）')
    const rows = alertsOf(db, source.id)
    assert.equal(rows.length, 1)
    assert.deepEqual([rows[0].kind, rows[0].severity, rows[0].status], ['zero_fetch', severity, 'open'])
    assert.match(rows[0].detail, /連續 3 次執行成功但抓到 0 筆/)
  }
  assert.match(alertsOf(db, KPOP.id)[0].detail, /KpopOfficial 主力來源/, 'KpopOfficial 的說明要明顯標示')
  assert.doesNotMatch(alertsOf(db, NOTICE.id)[0].detail, /KpopOfficial/)
  // 只靠 parser_type 也認得出 KpopOfficial
  assert.equal(alerts.isKpopOfficialSource({ source_key: 'other', parser_type: 'kpopofficial_concerts' }), true)
  assert.equal(alerts.isKpopOfficialSource({ source_key: 'kpopofficial-concerts', parser_type: 'x' }), true)
  assert.equal(alerts.isKpopOfficialSource(NOTICE), false)
  assertEventsAndFanNotificationsUntouched(db)
})

test('成功但 0 筆會解決 error_streak，但失敗不會累加 0 筆計數', async () => {
  const db = makeDb([sourceRow(NOTICE)])
  for (let i = 0; i < 3; i += 1) await run(db, NOTICE, 'error', 0)
  assert.equal(unresolvedOf(db, NOTICE.id, 'error_streak').length, 1)
  await run(db, NOTICE, 'success', 0)
  assert.equal(src(db, NOTICE.id).consecutive_error_count, 0)
  assert.equal(src(db, NOTICE.id).consecutive_zero_fetch_count, 1)
  const [resolved] = alertsOf(db, NOTICE.id, 'error_streak')
  assert.equal(resolved.status, 'resolved')
  assert.ok(resolved.resolved_at)
})

// ── 4. 同類型只有一筆未解決；恢復後自動 resolved ─────────────────────────────

test('恢復成功（fetched>=1）後計數歸零，error_streak／zero_fetch／stale_success 自動 resolved', async () => {
  const stale = new Date(Date.now() - 49 * HOUR).toISOString()
  const db = makeDb([sourceRow(KPOP, { last_success_at: stale, last_fetched_count: 0, consecutive_zero_fetch_count: 2 })])
  await run(db, KPOP, 'success', 0) // 第 3 次 0 筆 → zero_fetch
  for (let i = 0; i < 3; i += 1) await run(db, KPOP, 'error', 0) // → error_streak
  // 手動塞一筆已看過的 stale_success，確認 acknowledged 也會被自動結案
  db.tables.crawler_source_alerts.push({
    id: 99, source_id: KPOP.id, kind: 'stale_success', severity: 'fault', status: 'acknowledged',
    opened_at: stale, last_triggered_at: stale, acknowledged_at: stale, resolved_at: null, detail: '測試',
  })
  assert.deepEqual(unresolvedOf(db, KPOP.id).map(r => r.kind).sort(), ['error_streak', 'stale_success', 'zero_fetch'])
  for (const kind of alerts.ALERT_KINDS) assert.ok(unresolvedOf(db, KPOP.id, kind).length <= 1)

  await run(db, KPOP, 'success', 12)
  const row = src(db, KPOP.id)
  assert.deepEqual(
    [row.consecutive_error_count, row.consecutive_zero_fetch_count, row.last_fetched_count],
    [0, 0, 12],
  )
  assert.ok(Date.parse(row.last_success_at) > Date.parse(stale))
  assert.deepEqual(unresolvedOf(db, KPOP.id), [])
  for (const alert of alertsOf(db, KPOP.id)) {
    assert.equal(alert.status, 'resolved')
    assert.ok(alert.resolved_at, 'resolved 需要 resolved_at')
  }
  // 再壞一次會另開新的一筆，舊的保留為已解決紀錄
  for (let i = 0; i < 3; i += 1) await run(db, KPOP, 'error', 0)
  assert.equal(unresolvedOf(db, KPOP.id, 'error_streak').length, 1)
  assert.equal(alertsOf(db, KPOP.id, 'error_streak').length, 2)
  assertEventsAndFanNotificationsUntouched(db)
})

test('部分唯一索引擋下重複開單時（23505）不丟例外、仍只有一筆', async () => {
  const db = makeDb([sourceRow(NOTICE, { consecutive_error_count: 5 })])
  const original = db.from.bind(db)
  // 模擬競態：查「未解決」時看不到，INSERT 才撞到唯一索引。
  db.tables.crawler_source_alerts.push({
    id: 1, source_id: NOTICE.id, kind: 'error_streak', severity: 'fault', status: 'open',
    opened_at: 'x', last_triggered_at: 'x', acknowledged_at: null, resolved_at: null, detail: '先開的',
  })
  db.from = table => {
    const q = original(table)
    if (table === 'crawler_source_alerts') { const limit = q.limit; q.limit = () => { limit(0); return q } }
    return q
  }
  assert.equal(await run(db, NOTICE, 'error', 0), null)
  assert.equal(db.tables.crawler_source_alerts.length, 1)
})

// ── 5. 48 小時沒有成功 ──────────────────────────────────────────────────────

test('stale_success：上線後已真正執行過、48 小時沒成功才算；上線前的空白不算', async () => {
  const now = Date.parse('2026-11-26T01:00:00Z')
  const ago = hours => new Date(now - hours * HOUR).toISOString()
  const rows = [
    // 從沒成功過，但 072 欄位已被寫過（真正執行過）→ 從 last_run_at 起算
    sourceRow(NOTICE, { id: 'never-ok', source_key: 'never-ok', last_run_at: ago(49), last_status: 'error', consecutive_error_count: 1, last_fetched_count: 0 }),
    // 上線前的空白：072 欄位從沒被寫過 → 不算
    sourceRow(NOTICE, { id: 'pre-launch', source_key: 'pre-launch', last_run_at: ago(500), last_status: 'error' }),
    // 有成功過，但已超過 48 小時
    sourceRow(KPOP, { last_run_at: ago(72), last_status: 'success', last_success_at: ago(72), last_fetched_count: 30 }),
    // 47 小時：未達門檻
    sourceRow(NOTICE, { id: 'fresh', source_key: 'fresh', last_run_at: ago(47), last_status: 'success', last_success_at: ago(47), last_fetched_count: 3 }),
    // 剛好 48 小時：達門檻
    sourceRow(NOTICE, { id: 'edge', source_key: 'edge', last_run_at: ago(48), last_status: 'success', last_success_at: ago(48), last_fetched_count: 3 }),
    // 停用：不新開
    sourceRow(NOTICE, { id: 'inactive', source_key: 'inactive', is_active: false, last_run_at: ago(90), last_success_at: ago(90), last_fetched_count: 3 }),
    // 排程本來就會略過的 parser：不算故障
    sourceRow(NOTICE, { id: 'generic', source_key: 'generic', parser_type: 'generic_webpage', last_run_at: ago(90), last_status: 'skipped', last_success_at: ago(90), last_fetched_count: 1 }),
    sourceRow(NOTICE, { id: 'youtube', source_key: 'youtube', parser_type: 'youtube_official_channel', last_run_at: ago(90), last_status: 'skipped', last_success_at: ago(90), last_fetched_count: 1 }),
  ]
  const kinds = id => alerts.computeSourceAlerts(rows.find(r => r.id === id), now).map(a => `${a.kind}:${a.severity}`)
  assert.deepEqual(kinds('never-ok'), ['stale_success:fault'])
  assert.deepEqual(kinds('pre-launch'), [])
  assert.deepEqual(kinds(KPOP.id), ['stale_success:fault'])
  assert.deepEqual(kinds('edge'), ['stale_success:fault'])
  for (const id of ['fresh', 'inactive', 'generic', 'youtube']) assert.deepEqual(kinds(id), [], id)
  assert.deepEqual(alerts.computeSourceAlerts(legacySourceRow(NOTICE, { last_run_at: ago(500) }), now), [], '072 未套用的來源列不計算')

  const db = makeDb(structuredClone(rows))
  await alerts.sweepStaleSuccessAlerts(db, now)
  assert.deepEqual(db.tables.crawler_source_alerts.map(r => [r.source_id, r.kind, r.severity, r.status]).sort(), [
    [KPOP.id, 'stale_success', 'fault', 'open'],
    ['edge', 'stale_success', 'fault', 'open'],
    ['never-ok', 'stale_success', 'fault', 'open'],
  ])
  const kpopAlert = alertsOf(db, KPOP.id)[0]
  assert.match(kpopAlert.detail, /已 72 小時沒有成功/)
  assert.match(kpopAlert.detail, /KpopOfficial 主力來源/)
  assert.match(kpopAlert.detail, /台北時間/)
  assert.match(alertsOf(db, 'never-ok')[0].detail, /尚未成功過/)
  // 再掃一次只更新，不重複開單；補看不改計數
  await alerts.sweepStaleSuccessAlerts(db, now + HOUR / 2)
  assert.equal(db.tables.crawler_source_alerts.length, 3)
  assert.match(alertsOf(db, KPOP.id)[0].detail, /已 72 小時沒有成功/)
  assert.equal(alertsOf(db, KPOP.id)[0].last_triggered_at, new Date(now + HOUR / 2).toISOString())
  assert.deepEqual(db.ops.filter(op => op.table === 'crawler_sources' && op.kind !== 'select'), [])
  assertEventsAndFanNotificationsUntouched(db)
})

test('台北時間顯示：UTC 01:00 是台北 09:00', () => {
  assert.equal(alerts.formatTaipeiDateTime('2026-11-24T01:00:00Z'), '2026-11-24 09:00')
  assert.equal(alerts.formatTaipeiDateTime('2026-11-24T16:30:00Z'), '2026-11-25 00:30')
  assert.equal(alerts.formatTaipeiDateTime(null), '—')
})

test('失敗的那一輪若距離上次成功已達 48 小時，也會開 stale_success', async () => {
  const db = makeDb([sourceRow(NOTICE, { last_success_at: new Date(Date.now() - 50 * HOUR).toISOString(), last_fetched_count: 3 })])
  await run(db, NOTICE, 'error', 0)
  assert.deepEqual(unresolvedOf(db, NOTICE.id).map(r => r.kind), ['stale_success'])
  assert.equal(src(db, NOTICE.id).consecutive_error_count, 1)
})

test('cron 一進門先補看：排程隔很久才跑也開得了單；來源仍失敗就維持未解決', async () => {
  const long = new Date(Date.now() - 80 * HOUR).toISOString()
  const db = makeDb([
    // 未知 parser → 這一輪記 error（不需要網路）
    sourceRow(NOTICE, { id: 'unknown', source_key: 'unknown', parser_type: 'no_such_parser', last_run_at: long, last_status: 'success', last_success_at: long, last_fetched_count: 5 }),
    // generic_webpage 在排程裡本來就 skip → 不算故障
    sourceRow(NOTICE, { id: 'generic', source_key: 'generic', parser_type: 'generic_webpage', last_run_at: long, last_status: 'success', last_success_at: long, last_fetched_count: 5 }),
  ])
  const { result, error } = await runActiveCrawlerSources(db, { trigger: 'vercel-cron' })
  assert.equal(error, null)
  assert.equal(result.results.length, 2)
  assert.deepEqual(unresolvedOf(db, 'unknown').map(r => r.kind), ['stale_success'])
  assert.deepEqual(alertsOf(db, 'generic'), [])
  assert.equal(src(db, 'generic').last_status, 'skipped')
  assert.equal(src(db, 'generic').last_fetched_count, 5, 'skipped 不改健康欄')
  assertEventsAndFanNotificationsUntouched(db)
})

test('時間不足沒被派到的來源：skipped 不改計數，但一進門的補看仍開得了 stale_success', async () => {
  const long = new Date(Date.now() - 80 * HOUR).toISOString()
  const db = makeDb([sourceRow(KPOP, { last_run_at: long, last_status: 'success', last_success_at: long, last_fetched_count: 5, consecutive_error_count: 2 })])
  const { result } = await runActiveCrawlerSources(db, { trigger: 'vercel-cron', startedAt: Date.now() - 276_000 })
  assert.equal(result.results[0].skipped, 1)
  assert.equal(src(db, KPOP.id).last_status, 'skipped')
  assert.equal(src(db, KPOP.id).consecutive_error_count, 2)
  assert.deepEqual(unresolvedOf(db, KPOP.id).map(r => [r.kind, r.severity]), [['stale_success', 'fault']])
})

// ── 6. skipped／停用 ────────────────────────────────────────────────────────

test('skipped 或停用的來源：不發新提醒、不改連續計數、不清掉已有的故障紀錄', async () => {
  const existing = {
    id: 7, source_id: NOTICE.id, kind: 'error_streak', severity: 'fault', status: 'open',
    opened_at: 'a', last_triggered_at: 'a', acknowledged_at: null, resolved_at: null, detail: '既有',
  }
  for (const overrides of [{}, { is_active: false }]) {
    const db = makeDb(
      [sourceRow(NOTICE, { consecutive_error_count: 9, consecutive_zero_fetch_count: 9, last_fetched_count: 0, ...overrides })],
      {}, { crawler_source_alerts: [{ ...existing }] },
    )
    const statuses = overrides.is_active === false ? ['skipped', 'error', 'success'] : ['skipped']
    for (const status of statuses) assert.equal(await run(db, NOTICE, status, 0), null)
    const row = src(db, NOTICE.id)
    assert.deepEqual([row.consecutive_error_count, row.consecutive_zero_fetch_count, row.last_success_at], [9, 9, null])
    assert.deepEqual(db.tables.crawler_source_alerts, [existing])
    assert.equal(row.last_status, statuses.at(-1), '既有狀態欄照常寫入')
  }
  // 純函式層面再確認一次
  const row = sourceRow(NOTICE, { consecutive_error_count: 2 })
  assert.equal(alerts.nextHealthState(row, { status: 'skipped', fetched: 0, ranAt: 'x' }), null)
  assert.equal(alerts.nextHealthState({ ...row, is_active: false }, { status: 'error', fetched: 0, ranAt: 'x' }), null)
})

// ── 7. 072 尚未套用 ─────────────────────────────────────────────────────────

test('072 尚未套用：updateRunStatus 仍寫入舊的狀態欄並回傳成功，健康步驟只 log', async () => {
  const db = makeDb([legacySourceRow(KPOP)], { schema072: false })
  logs.warn.length = 0
  for (const [status, fetched] of [['error', 0], ['error', 0], ['error', 0], ['success', 0], ['success', 25]]) {
    assert.equal(await run(db, KPOP, status, fetched), null)
    assert.equal(src(db, KPOP.id).last_status, status)
  }
  const row = src(db, KPOP.id)
  assert.ok(row.last_run_at)
  assert.equal(row.last_error, null)
  for (const column of HEALTH_COLUMNS) assert.ok(!(column in row), column)
  assert.deepEqual(db.tables.crawler_source_alerts, [])
  assert.ok(logs.warn.some(line => /migration 072 尚未套用/.test(line)))
  // 既有那一次 update 只寫 020 的四欄
  const statusWrites = db.ops.filter(op => op.table === 'crawler_sources' && op.kind === 'update')
  assert.equal(statusWrites.length, 5)
  for (const op of statusWrites) {
    assert.deepEqual(Object.keys(op.row).sort(), ['last_error', 'last_run_at', 'last_status', 'updated_at'])
  }
  assertEventsAndFanNotificationsUntouched(db)
})

test('072 尚未套用：cron 整輪照跑不崩潰；後台讀取回報 available=false', async () => {
  const db = makeDb([
    legacySourceRow(NOTICE, { id: 'unknown', source_key: 'unknown', parser_type: 'no_such_parser' }),
    legacySourceRow(NOTICE, { id: 'generic', source_key: 'generic', parser_type: 'generic_webpage' }),
  ], { schema072: false })
  const { result, error } = await runActiveCrawlerSources(db, { trigger: 'vercel-cron' })
  assert.equal(error, null)
  assert.equal(result.summary.totalSources, 2)
  assert.equal(result.summary.statusWriteErrorCount, 0)
  assert.equal(src(db, 'unknown').last_status, 'error')
  assert.equal(src(db, 'generic').last_status, 'skipped')
  await alerts.sweepStaleSuccessAlerts(db)
  assert.deepEqual(await alerts.loadCrawlerHealth(db), { available: false, sources: [], alerts: [] })
  for (const code of ['42703', '42P01', 'PGRST204', 'PGRST205']) assert.equal(alerts.isMissingHealthSchemaError({ code, message: '' }), true, code)
  assert.equal(alerts.isMissingHealthSchemaError({ code: '42501', message: 'permission denied' }), false)
  assert.equal(alerts.isMissingHealthSchemaError(null), false)
})

test('健康步驟任何失敗（權限不足、連線例外）都不讓 updateRunStatus 失敗、不回滾 last_status', async () => {
  // 只有提醒表缺（欄位已在）
  const db = makeDb([sourceRow(NOTICE, { consecutive_error_count: 2 })])
  const original = db.from.bind(db)
  db.from = table => {
    if (table === 'crawler_source_alerts') throw new Error('socket hang up')
    return original(table)
  }
  assert.equal(await run(db, NOTICE, 'error', 0), null)
  assert.equal(src(db, NOTICE.id).last_status, 'error')
  assert.equal(src(db, NOTICE.id).consecutive_error_count, 3, '計數欄仍盡力寫入')

  // 計數欄被拒寫（例如 GRANT 還沒下）
  const denied = makeDb([sourceRow(NOTICE)])
  const deniedFrom = denied.from.bind(denied)
  denied.from = table => {
    const q = deniedFrom(table)
    const update = q.update
    q.update = row => ('consecutive_error_count' in row
      ? { eq: async () => ({ data: null, error: { code: '42501', message: 'permission denied for table crawler_sources' } }) }
      : update(row))
    return q
  }
  assert.equal(await run(denied, NOTICE, 'error', 0), null)
  assert.equal(src(denied, NOTICE.id).last_status, 'error')
  assert.equal(src(denied, NOTICE.id).consecutive_error_count, 0)
  await assert.doesNotReject(alerts.recordCrawlerRunHealth({ from() { throw new Error('boom') } }, 'x', { status: 'error', fetched: 0 }))
  await assert.doesNotReject(alerts.sweepStaleSuccessAlerts({ from() { throw new Error('boom') } }))
})

// ── 8. 後台手動執行（登入身分，不能 INSERT 提醒）──────────────────────────────

test('手動執行（authenticated）：INSERT 提醒被拒只 log，計數照寫；後台仍由計數算出故障', async () => {
  const db = makeDb([sourceRow(KPOP)], { role: 'authenticated' })
  for (let i = 0; i < 3; i += 1) assert.equal(await run(db, KPOP, 'error', 0), null)
  assert.equal(src(db, KPOP.id).consecutive_error_count, 3)
  assert.deepEqual(db.tables.crawler_source_alerts, [], 'authenticated 不能開單')

  const health = await alerts.loadCrawlerHealth(db)
  assert.equal(health.available, true)
  const views = alerts.buildAlertViews(health.sources, health.alerts)
  assert.equal(views.length, 1)
  assert.deepEqual(
    [views[0].id, views[0].kind, views[0].severity, views[0].status, views[0].isKpopOfficial],
    [null, 'error_streak', 'fault', 'open', true],
  )
  // 恢復成功時，登入身分可以把既有提醒自動結案（只動 status／resolved_at）
  db.tables.crawler_source_alerts.push({
    id: 1, source_id: KPOP.id, kind: 'error_streak', severity: 'fault', status: 'open',
    opened_at: 'a', last_triggered_at: 'a', acknowledged_at: null, resolved_at: null, detail: 'x',
  })
  await run(db, KPOP, 'success', 8)
  assert.equal(db.tables.crawler_source_alerts[0].status, 'resolved')
  assert.ok(db.tables.crawler_source_alerts[0].resolved_at)
  assert.deepEqual(alerts.buildAlertViews((await alerts.loadCrawlerHealth(db)).sources, []), [])
})

// ── 9. 後台顯示：合併去重、排序、已看過收斂 ──────────────────────────────────

test('後台橫幅：資料表列與計算結果合併去重；KpopOfficial 故障排最前；已看過排後面', async () => {
  const now = Date.parse('2026-11-26T01:00:00Z')
  const ago = hours => new Date(now - hours * HOUR).toISOString()
  const sources = [
    sourceRow(NOTICE, { consecutive_zero_fetch_count: 4, last_success_at: ago(1), last_fetched_count: 0 }), // 警告（計算）
    sourceRow(NOTICE, { id: 'cs-b', source_key: 'b', name: 'B 來源', consecutive_error_count: 3, last_run_at: ago(1), last_success_at: ago(30) }),
    sourceRow(KPOP, { consecutive_error_count: 5, last_run_at: ago(1), last_success_at: ago(100), last_fetched_count: 0 }),
  ]
  const rows = [
    { id: 11, source_id: KPOP.id, kind: 'error_streak', severity: 'fault', status: 'open', opened_at: ago(50), last_triggered_at: ago(1), acknowledged_at: null, resolved_at: null, detail: '資料表裡的說明' },
    { id: 12, source_id: 'cs-b', kind: 'error_streak', severity: 'fault', status: 'acknowledged', opened_at: ago(50), last_triggered_at: ago(2), acknowledged_at: ago(1), resolved_at: null, detail: 'B 已看過' },
    { id: 13, source_id: 'gone', kind: 'error_streak', severity: 'fault', status: 'open', opened_at: ago(50), last_triggered_at: ago(2), acknowledged_at: null, resolved_at: null, detail: '來源已不存在' },
    { id: 14, source_id: KPOP.id, kind: 'zero_fetch', severity: 'fault', status: 'resolved', opened_at: ago(50), last_triggered_at: ago(2), acknowledged_at: null, resolved_at: ago(1), detail: '已解決' },
  ]
  const views = alerts.buildAlertViews(sources, rows, now)
  assert.deepEqual(views.map(v => [v.sourceId, v.kind, v.severity, v.status, v.id]), [
    [KPOP.id, 'error_streak', 'fault', 'open', 11],      // 資料表列優先（可按已看過）
    [KPOP.id, 'stale_success', 'fault', 'open', null],   // 排程沒開單，但由計數算出
    [NOTICE.id, 'zero_fetch', 'warning', 'open', null],
    ['cs-b', 'error_streak', 'fault', 'acknowledged', 12],
  ])
  assert.equal(views[0].detail, '資料表裡的說明')
  assert.equal(new Set(views.map(v => v.key)).size, views.length, '同一來源同一類型只顯示一筆')
  assert.ok(views.filter(v => v.isKpopOfficial).every(v => v.sourceName === KPOP.name))

  const list = read('src/components/admin/CrawlerAlertList.tsx')
  assert.match(list, /view\.status === 'open'/)
  assert.match(list, /<details[\s\S]+已看過、尚未解決/, '已看過的提醒收進可展開區塊')
  assert.match(list, /KPOPOFFICIAL_LABEL/)
  assert.match(list, /\/admin\/sources\/\$\{view\.sourceId\}/)
})

test('/admin、來源列表與來源詳情接上健康區塊；不改用 service client', () => {
  const adminPage = read('src/app/admin/page.tsx')
  assert.match(adminPage, /\{isAdmin && <CrawlerAlertsBanner \/>\}/)
  assert.ok(adminPage.indexOf('<CrawlerAlertsBanner') < adminPage.indexOf('Admin guard notice'), '橫幅在首頁頂端')
  const banner = read('src/components/admin/CrawlerAlertsBanner.tsx')
  assert.match(banner, /getSupabaseServerClient\(\)/)
  assert.match(banner, /if \(!health\.available\) return null/)
  assert.match(banner, /buildAlertViews\(health\.sources, health\.alerts\)/)

  const sourcesPage = read('src/app/admin/sources/page.tsx')
  assert.match(sourcesPage, /loadCrawlerHealth\(supabase\)/)
  // 既有查詢不加新欄：072 未套用時列表照常載入
  assert.match(sourcesPage, /'id, name, source_key, source_type, parser_type, is_active, last_run_at, last_status, idols\(name\)'/)
  const client = read('src/app/admin/sources/SourcesClient.tsx')
  for (const text of ['連續失敗 {source.health.consecutiveErrorCount} 次', '上次成功：', '上次抓到：', '主力來源']) {
    assert.ok(client.includes(text), text)
  }
  const detail = read('src/app/admin/sources/[id]/page.tsx')
  for (const text of ['label="連續失敗"', 'label="上次成功"', 'label="上次抓到"', '<CrawlerAlertList']) {
    assert.ok(detail.includes(text), text)
  }
  assert.match(detail, /'id, name, source_key, source_url, source_type, parser_type, is_active, config, last_run_at, last_status, last_error, created_at, updated_at, idols\(name, slug\)'/)

  for (const path of [
    'src/app/admin/page.tsx', 'src/app/admin/sources/page.tsx', 'src/app/admin/sources/[id]/page.tsx',
    'src/components/admin/CrawlerAlertsBanner.tsx', 'src/components/admin/CrawlerAlertList.tsx',
    'src/components/admin/CrawlerAlertActions.tsx', 'src/app/api/admin/crawler-alerts/route.ts',
    'src/lib/crawlers/crawlerSourceAlerts.ts',
  ]) {
    assert.doesNotMatch(read(path), /getSupabaseServiceClient|serviceClient|SERVICE_ROLE/i, path)
  }
})

// ── 10. 已看過／已解決 route ────────────────────────────────────────────────

const post = body => route.POST({ json: async () => body })

test('acknowledge／resolve route：未登入 401；只 UPDATE 狀態欄；resolved 帶 resolved_at', async () => {
  const seed = () => [
    { id: 1, source_id: KPOP.id, kind: 'error_streak', severity: 'fault', status: 'open', opened_at: 'a', last_triggered_at: 'a', acknowledged_at: null, resolved_at: null, detail: 'KpopOfficial 故障' },
    { id: 2, source_id: NOTICE.id, kind: 'zero_fetch', severity: 'warning', status: 'open', opened_at: 'a', last_triggered_at: 'a', acknowledged_at: null, resolved_at: null, detail: '警告' },
  ]
  const db = makeDb([sourceRow(KPOP, { consecutive_error_count: 3 }), sourceRow(NOTICE)], { role: 'authenticated' }, { crawler_source_alerts: seed() })
  globalThis.__alerts.client = db

  globalThis.__alerts.isAdmin = false
  const denied = await post({ id: 1, action: 'acknowledge' })
  assert.equal(denied.status, 401)
  assert.deepEqual(db.tables.crawler_source_alerts, seed())
  assert.deepEqual(db.ops, [], '未授權時完全不碰資料庫')

  globalThis.__alerts.isAdmin = true
  for (const body of [{ id: 'abc', action: 'acknowledge' }, { id: 1, action: 'delete' }, { id: -1, action: 'resolve' }, {}]) {
    assert.equal((await post(body)).status, 400)
  }
  assert.equal((await route.POST({ json: async () => { throw new Error('bad json') } })).status, 400)

  const ack = await post({ id: 1, action: 'acknowledge' })
  assert.deepEqual([ack.status, ack.body], [200, { ok: true, id: 1, status: 'acknowledged' }])
  const acked = db.tables.crawler_source_alerts[0]
  assert.equal(acked.status, 'acknowledged')
  assert.ok(acked.acknowledged_at)
  assert.equal(acked.resolved_at, null, '已看過仍算未解決')
  // 橫幅收斂：已看過後不再列在「尚未看過的故障」
  const health = await alerts.loadCrawlerHealth(db)
  const views = alerts.buildAlertViews(health.sources, health.alerts)
  assert.deepEqual(views.filter(v => v.status === 'open' && v.severity === 'fault'), [])
  assert.deepEqual(views.filter(v => v.status === 'acknowledged').map(v => v.id), [1])
  // 再按一次已看過：沒有可更新的列
  assert.equal((await post({ id: 1, action: 'acknowledge' })).status, 404)

  for (const id of [1, 2]) {
    const resolved = await post({ id, action: 'resolve' })
    assert.deepEqual([resolved.status, resolved.body], [200, { ok: true, id, status: 'resolved' }])
  }
  for (const row of db.tables.crawler_source_alerts) {
    assert.equal(row.status, 'resolved')
    assert.ok(row.resolved_at, 'resolved 需要 resolved_at')
  }
  assert.equal((await post({ id: 2, action: 'resolve' })).status, 404)
  assert.equal((await post({ id: 404, action: 'resolve' })).status, 404)

  // 只 UPDATE 這三欄；沒有 INSERT／DELETE；沒有碰活動、來源或粉絲通知
  const writes = db.ops.filter(op => op.kind !== 'select')
  assert.ok(writes.length > 0)
  for (const op of writes) {
    assert.equal(op.table, 'crawler_source_alerts')
    assert.equal(op.kind, 'update')
    for (const key of Object.keys(op.row)) assert.ok(['status', 'acknowledged_at', 'resolved_at'].includes(key), key)
  }
  assert.equal(db.tables.crawler_source_alerts.length, 2)
  assertEventsAndFanNotificationsUntouched(db)
  assert.ok(globalThis.__alerts.revalidated.includes('/admin'))
  assert.ok(globalThis.__alerts.revalidated.includes(`/admin/sources/${KPOP.id}`))

  const source = read('src/app/api/admin/crawler-alerts/route.ts')
  assert.match(source, /await getCurrentAdmin\(\)/)
  assert.match(source, /getSupabaseServerClient\(\)/)
  assert.doesNotMatch(source, /\.insert\(|\.delete\(|\.upsert\(/)
})

test('072 尚未套用時 route 回清楚的錯誤、不丟例外', async () => {
  globalThis.__alerts.client = makeDb([legacySourceRow(KPOP)], { role: 'authenticated', schema072: false })
  globalThis.__alerts.isAdmin = true
  const response = await post({ id: 1, action: 'resolve' })
  assert.equal(response.status, 500)
  assert.match(response.body.error, /尚未套用 migration 072（貼上單 M081）/)
})

// ── 11. 守門：來源失效不下架（全來源）────────────────────────────────────────

const ALL_PARSER_SOURCES = [
  KPOP,
  { ...NOTICE },
  { id: 'cs-jyp', source_key: 'jy-park-jyp-notice', name: 'JYP 公告', idol_id: 'i-1', source_url: 'https://jyp.jype.com/notice', source_type: 'official_website', parser_type: 'jyp_notice' },
  { id: 'cs-jyp-old', source_key: 'twice-jyp-schedule', name: 'JYP 舊行程', idol_id: 'i-1', source_url: 'https://jyp.example/schedule', source_type: 'official_website', parser_type: 'jyp_schedule' },
  { id: 'cs-bp', source_key: 'blackpink-official-tour', name: 'BLACKPINK 巡演', idol_id: 'i-1', source_url: 'https://bp.example/tour', source_type: 'official_website', parser_type: 'blackpink_official_tour' },
  { id: 'cs-yg-artist', source_key: 'yg-artist', name: 'YG 藝人行程', idol_id: 'i-1', source_url: 'https://yg.example/artist', source_type: 'official_website', parser_type: 'yg_artist_schedule' },
  { id: 'cs-wakeone', source_key: 'wakeone', name: 'WAKEONE 公告', idol_id: 'i-1', source_url: 'https://wakeone.example/notice', source_type: 'official_website', parser_type: 'wakeone_notice' },
  { id: 'cs-smtown', source_key: 'smtown', name: 'SMTOWN 公告', idol_id: 'i-1', source_url: 'https://smtown.example/notice', source_type: 'official_website', parser_type: 'smtown_notice' },
  { id: 'cs-venue', source_key: 'kaoarena-venue-calendar', name: '高雄巨蛋', idol_id: null, source_url: 'https://venue.example/list', source_type: 'official_website', parser_type: 'venue_calendar' },
  { id: 'cs-unknown', source_key: 'unknown', name: '未知 parser', idol_id: null, source_url: 'https://x.example', source_type: 'unknown', parser_type: 'no_such_parser' },
  { id: 'cs-generic', source_key: 'generic', name: '一般網頁', idol_id: null, source_url: 'https://x.example', source_type: 'unknown', parser_type: 'generic_webpage' },
  { id: 'cs-youtube', source_key: 'youtube', name: 'YouTube', idol_id: 'i-1', source_url: 'https://youtube.example', source_type: 'official_sns', parser_type: 'youtube_official_channel' },
]
const CRON_SKIPPED = ['cs-generic', 'cs-youtube']

test('全來源連續 3 天失敗（連線錯誤、對方 404）：開故障提醒，已上架活動 is_published 不變、不刪', async () => {
  const db = makeDb(ALL_PARSER_SOURCES.map(s => sourceRow(s)), {}, {
    idols: [{ id: 'i-1', slug: 'bigbang', name: 'BIGBANG', alt_names: [], is_active: true }],
    event_candidates: [],
    event_sources: [],
  })
  const original = globalThis.fetch
  const responders = [
    async () => { throw new Error('ECONNRESET') },
    async () => new Response('Not Found', { status: 404 }),
    async () => new Response('Not Found', { status: 404 }),
  ]
  try {
    for (const responder of responders) {
      globalThis.fetch = responder
      const { result, error } = await runActiveCrawlerSources(db, { trigger: 'vercel-cron' })
      assert.equal(error, null)
      assert.equal(result.results.length, ALL_PARSER_SOURCES.length)
    }
  } finally {
    globalThis.fetch = original
  }
  for (const source of ALL_PARSER_SOURCES) {
    const row = src(db, source.id)
    if (CRON_SKIPPED.includes(source.id)) {
      assert.equal(row.last_status, 'skipped', source.id)
      assert.equal(row.consecutive_error_count, 0, source.id)
      assert.deepEqual(alertsOf(db, source.id), [], `${source.id}：排程本來就略過，不算故障`)
      continue
    }
    assert.ok(['error', 'partial_error'].includes(row.last_status), `${source.id} last_status=${row.last_status}`)
    assert.equal(row.consecutive_error_count, 3, source.id)
    assert.equal(row.last_success_at, null, source.id)
    const open = unresolvedOf(db, source.id)
    assert.deepEqual(open.map(r => [r.kind, r.severity]), [['error_streak', 'fault']], source.id)
  }
  assert.match(unresolvedOf(db, KPOP.id)[0].detail, /KpopOfficial 主力來源/)
  // 守門：沒有任何對活動的寫入，也沒有寫粉絲通知
  assertEventsAndFanNotificationsUntouched(db)
  assert.deepEqual(db.ops.filter(op => op.kind === 'delete'), [])
  for (const alert of db.tables.crawler_source_alerts) assert.doesNotMatch(alert.detail, /下架/)
})

test('0 筆、失敗、停用、開單與結案都不會寫 events（is_published、status 不變、不刪）', async () => {
  const db = makeDb([sourceRow(KPOP), sourceRow(NOTICE, { is_active: false })])
  const sequence = [
    ['success', 0], ['success', 0], ['success', 0], // zero_fetch 故障
    ['error', 0], ['partial_error', 2], ['error', 0], // error_streak
    ['skipped', 0],
    ['success', 20], // 恢復
  ]
  for (const [status, fetched] of sequence) {
    await run(db, KPOP, status, fetched)
    await run(db, NOTICE, status, fetched) // 停用來源
    assert.deepEqual(db.tables.events, PUBLISHED_EVENTS)
  }
  assert.ok(alertsOf(db, KPOP.id).length >= 2)
  assert.deepEqual(unresolvedOf(db, KPOP.id), [])
  assert.deepEqual(alertsOf(db, NOTICE.id), [])
  assertEventsAndFanNotificationsUntouched(db)
  assert.deepEqual([...new Set(db.ops.map(op => op.table))].sort(), ['crawler_source_alerts', 'crawler_sources'])
})

// ── 12. 原始碼守門 ──────────────────────────────────────────────────────────

function sourceFiles(dir) {
  const out = []
  const walk = path => {
    for (const name of readdirSync(new URL(path, root))) {
      const child = `${path}${name}`
      if (statSync(new URL(child, root)).isDirectory()) walk(`${child}/`)
      else if (/\.[cm]?[jt]sx?$/.test(name)) out.push(child)
    }
  }
  walk(dir)
  return out
}

const ALERT_FILES = [
  'src/lib/crawlers/crawlerSourceAlerts.ts',
  'src/lib/crawlers/crawlerSource.ts',
  'src/app/api/admin/crawler-alerts/route.ts',
  'src/components/admin/CrawlerAlertsBanner.tsx',
  'src/components/admin/CrawlerAlertList.tsx',
  'src/components/admin/CrawlerAlertActions.tsx',
]

test('爬蟲、排程同步與提醒相關程式沒有任何下架、刪除或批次取消活動的路徑', () => {
  const guarded = [
    ...sourceFiles('src/lib/crawlers/'),
    'src/app/api/cron/sync-candidates/route.ts',
    ...sourceFiles('src/app/api/admin/crawlers/'),
    ...ALERT_FILES,
  ]
  assert.ok(guarded.length > 30)
  for (const path of new Set(guarded)) {
    const source = read(path)
    assert.doesNotMatch(source, /from\(['"]events['"]\)\s*\.(?:update|delete|upsert)/, path)
    assert.doesNotMatch(source, /is_published\s*:\s*false/, path)
    assert.doesNotMatch(source, /status\s*:\s*['"]cancelled['"]/, path)
  }
  // 自動上架只有「把草稿改成上架」與「更新已上架內容」兩條 update，沒有刪除、沒有改回未上架
  const store = read('src/lib/autoPublish/supabaseAutoPublishStore.ts')
  assert.doesNotMatch(store, /\.delete\(/)
  assert.doesNotMatch(store, /is_published\s*:\s*false|cancelled/)
  const eventUpdates = store.match(/from\('events'\)\.update\(patch\)\.eq\('id', id\)\.eq\('is_published', (?:true|false)\)/g) ?? []
  assert.equal(eventUpdates.length, (store.match(/from\('events'\)\.update\(/g) ?? []).length)
  // 提醒模組只碰來源表與提醒表
  const moduleSource = read('src/lib/crawlers/crawlerSourceAlerts.ts')
  const tables = [...moduleSource.matchAll(/\.from\(([^)]+)\)/g)].map(match => match[1])
  assert.deepEqual([...new Set(tables)].sort(), ["'crawler_sources'", 'ALERTS_TABLE'])
  assert.match(moduleSource, /const ALERTS_TABLE = 'crawler_source_alerts'/)
  assert.doesNotMatch(moduleSource, /\.delete\(|\.upsert\(|\.rpc\(/)
})

test('不寫粉絲 notifications、不新增寄信或外部通知、文案沒有「自動下架」', () => {
  const touched = [
    ...ALERT_FILES,
    'src/lib/crawlers/runActiveCrawlerSources.ts',
    'src/app/admin/page.tsx', 'src/app/admin/sources/page.tsx',
    'src/app/admin/sources/SourcesClient.tsx', 'src/app/admin/sources/[id]/page.tsx',
  ]
  for (const path of touched) {
    const source = read(path)
    assert.doesNotMatch(source, /from\(['"]notifications['"]\)/, path)
    assert.doesNotMatch(source, /sendEmail|sendMail|nodemailer|mailto:|sendgrid|mailgun|smtp|slack|webhook/i, path)
    assert.doesNotMatch(source, /\bResend\b|from ['"]resend['"]/, path)
    assert.doesNotMatch(source, /自動下架|已下架/, path)
  }
  for (const path of sourceFiles('src/lib/crawlers/')) {
    const source = read(path)
    assert.doesNotMatch(source, /from\(['"]notifications['"]\)/, path)
    assert.doesNotMatch(source, /sendEmail|sendMail|nodemailer|mailto:|from ['"]resend['"]/i, path)
  }
  const pkg = JSON.parse(read('package.json'))
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  assert.ok(!deps.some(dep => /resend|nodemailer|sendgrid|mailgun|slack/i.test(dep)), deps.join(','))
  // 沒有新增寄信用環境變數
  for (const path of ALERT_FILES) assert.doesNotMatch(read(path), /process\.env/, path)
})

test('既有狀態寫入維持 migration 020 的四欄；fetched 由各呼叫端傳入', () => {
  const source = read('src/lib/crawlers/crawlerSource.ts')
  assert.match(source, /\.update\(\{ \.\.\.expected, updated_at: now \}\)/)
  assert.match(source, /const expected = \{\s*last_run_at: now,\s*last_status: patch\.last_status,\s*last_error: [^\n]+\n\s*\}/)
  assert.match(source, /const STATUS_COLUMNS = 'id, last_run_at, last_status, last_error, updated_at'/)
  assert.match(source, /patch: \{ last_status: RunStatus; last_error: string \| null; fetched\?: number \}/)
  assert.match(source, /write ok[\s\S]+await recordCrawlerRunHealth\(supabase, crawlerSourceId, \{[\s\S]+?\}\)\.catch\(\(\) => \{\}\)\s+return null/)

  let calls = 0
  for (const path of sourceFiles('src/lib/crawlers/').filter(p => /\/run[A-Z]\w+\.ts$/.test(p))) {
    const text = read(path)
    for (const match of text.matchAll(/updateRunStatus\(\s*supabase,[^{]*\{/g)) {
      calls += 1
      const window = text.slice(match.index, match.index + 400)
      assert.match(window.slice(0, window.search(/\n\s*\}\)|\}\)/) + 40), /fetched:/, `${path} 第 ${text.slice(0, match.index).split('\n').length} 行沒有傳 fetched`)
    }
  }
  assert.ok(calls >= 60, `updateRunStatus 呼叫數 ${calls}`)
  const dispatch = read('src/lib/crawlers/runActiveCrawlerSources.ts')
  assert.match(dispatch, /await sweepStaleSuccessAlerts\(supabase\)\.catch\(\(\) => \{\}\)/)
})

test('migration：本張只新增 072（073 已在 main）；072 維持 authenticated 不能 INSERT 提醒', () => {
  const numbers = readdirSync(new URL('supabase/migrations/', root)).map(name => Number(name.match(/^\d+/)?.[0] ?? 0))
  assert.ok(numbers.includes(72), '缺少 072')
  assert.ok(numbers.includes(73), '缺少已在 main 的 073')
  assert.equal(Math.max(...numbers), 73)
  const sql = read('supabase/migrations/072_crawler_source_alerts.sql')
  assert.match(sql, /GRANT SELECT ON TABLE public\.crawler_source_alerts TO authenticated;/)
  assert.match(sql, /GRANT UPDATE \(status, acknowledged_at, resolved_at, detail\)\s+ON TABLE public\.crawler_source_alerts TO authenticated;/)
  assert.doesNotMatch(sql, /GRANT[^;]*INSERT[^;]*TO authenticated/)
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.crawler_source_alerts TO service_role;/)
  assert.doesNotMatch(sql, /(?:\bON|UPDATE|ALTER TABLE|INSERT INTO|DELETE FROM|TRIGGER)\s+(?:TABLE\s+)?public\.(?:events|notifications)\b/i)
})
