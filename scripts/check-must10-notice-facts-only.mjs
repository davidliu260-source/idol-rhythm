// 執行方式：node scripts/check-must10-notice-facts-only.mjs
// MUST #10：YG 公告（yg_notice）與 SMTOWN 公告（smtown_notice）前台只留事實。
// 只用假資料與假 Supabase，不連任何資料庫，不讀 .env。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const m = globalThis.__must10 = {}

const dataModule = source => `data:text/javascript,${encodeURIComponent(source)}`
const MOCKS = {
  'next/cache': 'export function revalidatePath() {}',
  'next/navigation': `
    export function redirect(url) { throw Object.assign(new Error('NEXT_REDIRECT'), { redirectUrl: url }) }
    export function notFound() { throw new Error('NEXT_NOT_FOUND') }`,
  'next/server': `export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }`,
  '@/lib/supabase/serverClient': 'export const getSupabaseServerClient = () => globalThis.__must10.serverClient',
  '@/lib/supabase/adminAuth': 'export const getCurrentAdmin = async () => ({ isAdmin: true })',
  '@/lib/ai/generateChineseDisplay': 'export const generateChineseDisplayWithClaude = input => globalThis.__must10.generate(input)',
}
const STUB_COMPONENT = `
  const Stub = () => null
  export default Stub
  export const EventWantButton = Stub, EventDetailReminderPicker = Stub, EventDetailShareBtn = Stub`

function withExtension(url) {
  for (const ext of ['.ts', '.tsx']) if (existsSync(fileURLToPath(url + ext))) return url + ext
  return url
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (MOCKS[specifier]) return { url: dataModule(MOCKS[specifier]), shortCircuit: true }
    if (specifier.startsWith('@/components/')) return { url: dataModule(STUB_COMPONENT), shortCircuit: true }
    const parent = context.parentURL ?? ''
    if (specifier === './client' && parent.endsWith('/src/lib/supabase/events.ts')) {
      return { url: dataModule('export const getSupabaseClient = () => globalThis.__must10.publicClient'), shortCircuit: true }
    }
    if (specifier === './data' && parent.includes('/src/app/events/')) {
      return { url: dataModule('export const getEventDetail = async () => globalThis.__must10.detail'), shortCircuit: true }
    }
    if (specifier.startsWith('@/')) return nextResolve(withExtension(new URL(`src/${specifier.slice(2)}`, root).href), context)
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && /\.tsx?$/.test(parent)) {
      return nextResolve(withExtension(new URL(specifier, parent).href), context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.tsx')) return nextLoad(url, context)
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: fileURLToPath(url),
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  },
})

const notice = await import('../src/lib/officialNotice.ts')
const { hasMinimumContent, hasMinimumContentOrOfficialNotice } = await import('../src/lib/autoPublish/minimumContent.ts')
const { runAutoPublish } = await import('../src/lib/autoPublish/runAutoPublish.ts')
const { translateEvent, buildChineseDisplayInput } = await import('../src/lib/ai/autoTranslate.ts')
const { buildEventMeta } = await import('../src/lib/seo/metadata.ts')
const { buildSitemapEntries } = await import('../src/lib/seo/sitemap.ts')
const { buildIcs } = await import('../src/lib/ics/buildIcs.ts')
const { getEventById } = await import('../src/lib/supabase/events.ts')
const candidateActions = await import(pathToFileURL(fileURLToPath(new URL('src/app/admin/event-candidates/[id]/actions.ts', root))).href)
const bulkRoute = await import(pathToFileURL(fileURLToPath(new URL('src/app/api/admin/event-candidates/bulk-review/route.ts', root))).href)
const detailPage = await import(pathToFileURL(fileURLToPath(new URL('src/app/events/[id]/page.tsx', root))).href)

// ── 共用假資料 ────────────────────────────────────────────────────────────────

const SECRET = '公告正文-SECRET-不可外流'
const YG_PAGE = 'https://ygfamily.com/ko/news/notice/1234'
const YG_URL = `${YG_PAGE}#2027-01-10`
const SMTOWN_URL = 'https://www.smtown.com/notice#smtown-777-aespa'
const YG_SCHEDULE_URL = 'https://ygfamily.com/ko/artists/blackpink/schedule'
const TICKET = 'https://tickets.example.com/yg-tour'

const ygRaw = { source: 'yg-notice', parser_type: 'yg_notice', crawler_source_id: 'cs-yg', notice_id: '1234', page_url: YG_PAGE, ticket_url: TICKET }
const smRaw = { source: 'smtown-notice', parser_type: 'smtown_notice', crawler_source_id: 'cs-sm', page_url: 'https://www.smtown.com/notice' }
const schedRaw = { source: 'yg-artist-schedule', parser_type: 'yg_artist_schedule', crawler_source_id: 'cs-sched', ticket_url: TICKET }

const crawlerSources = [
  { id: 'cs-yg', source_key: 'generic-yg-notice', name: 'YG 官方公告', parser_type: 'yg_notice', source_type: 'official_website', source_url: 'https://ygfamily.com/ko/news/notice' },
  { id: 'cs-sm', source_key: 'smtown-aespa', name: 'SMTOWN 公告', parser_type: 'smtown_notice', source_type: 'official_website', source_url: 'https://www.smtown.com/notice' },
  { id: 'cs-sched', source_key: 'yg-schedule', name: 'YG 官方行程', parser_type: 'yg_artist_schedule', source_type: 'official_website', source_url: YG_SCHEDULE_URL },
  { id: 'cs-jyp', source_key: 'jyp', name: 'JYP Schedule', parser_type: 'jyp_schedule', source_type: 'official_website', source_url: 'https://twice.jype.com' },
]

// ── 1. 識別方式 ───────────────────────────────────────────────────────────────

test('識別：parser_type／raw_data.source 為準，網址只認公告頁路徑', () => {
  for (const url of [YG_URL, YG_PAGE, 'https://www.ygfamily.com/en/news/notice/9', 'https://ygfamily.com/ko/news/notice',
    'https://ygfamily.com/news/notice/5', SMTOWN_URL, 'https://smtown.com/notice', 'http://www.smtown.com/notice?page=2']) {
    assert.equal(notice.isOfficialNoticeUrl(url), true, url)
  }
  for (const url of [YG_SCHEDULE_URL, 'https://ygfamily.com/ko/artists/treasure/schedule#2027-01-01', 'https://ygfamily.com/',
    'https://ygfamily.com/ko/news/noticeboard', 'https://www.smtown.com/artist/aespa', 'https://www.smtown.com/notices',
    'https://evil.example.com/ygfamily.com/ko/news/notice', 'https://twice.jype.com/a', '', null, undefined]) {
    assert.equal(notice.isOfficialNoticeUrl(url), false, String(url))
  }

  assert.equal(notice.isFactsOnlyNoticeCandidate({ raw_data: ygRaw }), true)
  assert.equal(notice.isFactsOnlyNoticeCandidate({ raw_data: smRaw }), true)
  assert.equal(notice.isFactsOnlyNoticeCandidate({ raw_data: { source: 'smtown-notice' } }), true)
  assert.equal(notice.isFactsOnlyNoticeCandidate({ raw_data: { parser_type: 'yg_notice' } }), true)
  assert.equal(notice.isFactsOnlyNoticeCandidate({ raw_data: {} }, 'smtown_notice'), true)
  assert.equal(notice.isFactsOnlyNoticeCandidate({ raw_data: schedRaw }), false)
  assert.equal(notice.isFactsOnlyNoticeCandidate({ raw_data: schedRaw }, 'yg_artist_schedule'), false)
  for (const raw_data of [null, undefined, 'yg-notice', [], { source: 'wakeone-notice', parser_type: 'wakeone_notice' }, { parser_type: 'jyp_schedule' }, { parser_type: 'kpopofficial_concerts' }]) {
    assert.equal(notice.isFactsOnlyNoticeCandidate({ raw_data }), false, JSON.stringify(raw_data))
  }
  // 只看網域、不看 parser 的候選不算（例如舊 generic_webpage 指到公告頁）
  assert.equal(notice.isFactsOnlyNoticeCandidate({ raw_data: { provider: 'generic_webpage' }, source_url: YG_URL }), false)

  assert.equal(notice.factsOnlyNoticeTicketUrl({ raw_data: ygRaw }), TICKET)
  assert.equal(notice.factsOnlyNoticeTicketUrl({ raw_data: { ...ygRaw, ticket_url: ' javascript:alert(1) ' } }), null)
  assert.equal(notice.factsOnlyNoticeTicketUrl({ raw_data: { ...smRaw, ticket_url: TICKET } }), null)
  assert.equal(notice.factsOnlyNoticeTicketUrl({ raw_data: schedRaw }), null)

  assert.equal(notice.findOfficialNoticeUrl([{ url: 'https://kpopofficial.com/x' }, { url: ` ${SMTOWN_URL} ` }]), SMTOWN_URL)
  assert.equal(notice.findOfficialNoticeUrl([{ url: YG_SCHEDULE_URL }, { url: null }]), undefined)
  assert.equal(notice.getEventOfficialNoticeUrl({ source: { url: YG_URL } }), YG_URL)
  assert.equal(notice.getEventOfficialNoticeUrl({ source: { url: YG_SCHEDULE_URL } }), undefined)
  assert.equal(notice.getEventOfficialNoticeUrl({ officialNoticeUrl: SMTOWN_URL, source: { url: 'https://kpopofficial.com/x' } }), SMTOWN_URL)
})

// ── 2. 空殼規則 ───────────────────────────────────────────────────────────────

test('空殼：官方公告連結只對這兩個來源算最低內容，其他來源規則不變', () => {
  const ok = (row, factsOnlyNotice, officialNoticeUrl) => hasMinimumContentOrOfficialNotice(row, { factsOnlyNotice, officialNoticeUrl })
  assert.equal(ok({}, true, SMTOWN_URL), true)
  assert.equal(ok({}, true, YG_URL), true)
  assert.equal(ok({}, true, YG_SCHEDULE_URL), false)
  assert.equal(ok({}, true, null), false)
  assert.equal(ok({}, false, SMTOWN_URL), false)
  // 公告來源的正文／摘要不算內容
  assert.equal(ok({ description: SECRET, display_summary_zh: '摘要' }, true, null), false)
  assert.equal(ok({ venue_name: 'KSPO DOME' }, true, null), true)
  // 非範圍來源與原本 hasMinimumContent 完全相同
  for (const row of [{}, { description: 'x' }, { display_summary_zh: 'x' }, { venue_name: ' ' }, { ticket_url: TICKET }]) {
    assert.equal(ok(row, false, YG_URL), hasMinimumContent(row), JSON.stringify(row))
  }
})

// ── 3. 自動上架 ───────────────────────────────────────────────────────────────

const now = new Date('2026-11-24T02:00:00Z')
const draft = {
  id: 'e-draft', idol_id: 'i', title: 'Draft', date: '2027-01-10', is_published: false,
  auto_publish_blocked: false, auto_publish_blocked_reason: 'empty_shell', status: 'confirmed', trust_level: 'pending',
}

async function autoPublish({ candidate, event } = {}) {
  const c = {
    id: 'c1', review_status: 'pending', raw_title: 'Notice Tour', detected_idol_id: 'i', detected_event_type: 'concert',
    detected_date: '2027-01-10', source_name: 'Official', source_type: 'official_website', ai_confidence: null,
    raw_content: SECRET, display_summary_zh: '候選摘要', approved_event_id: event?.id, ...candidate,
  }
  const ctx = { now, idols: [{ id: 'i', name: 'Idol', is_active: true }], crawlerSources, events: event ? [event] : [], eventSources: [] }
  const calls = []
  const responses = {
    readAutoPublishEnabled: { enabled: true }, loadContext: { candidates: [c], ctx, idolNames: new Map([['i', 'Idol']]) },
    getEvent: event, insertDraftEvent: { id: 'new' }, linkCandidate: { updated: 1 }, hasEventSourceUrl: false,
    insertEventSource: { ok: true }, publishEvent: { updated: 1 }, markCandidateApproved: { updated: 1 }, parkCandidate: { updated: 1 },
  }
  const store = Object.fromEntries(Object.entries(responses).map(([name, response]) => [
    name, async (...args) => { calls.push({ name, args: structuredClone(args) }); return response },
  ]))
  const report = await runAutoPublish(store, { now, touched: [{ candidateId: c.id, freshLocation: null }] })
  assert.deepEqual(report.errors, [])
  return { report, calls: calls.map(call => call.name), args: name => calls.find(call => call.name === name)?.args }
}

test('自動上架：有場地的 YG 公告上架，description／摘要為空，售票網址寫入', async () => {
  const { report, args } = await autoPublish({ candidate: {
    raw_data: ygRaw, source_url: YG_URL, ai_confidence: 0.9, detected_venue_name: 'KSPO DOME', detected_city: 'Seoul',
  } })
  const [row] = args('insertDraftEvent')
  assert.equal(row.description, null)
  assert.equal(row.display_summary_zh, null)
  assert.equal(row.ticket_url, TICKET)
  assert.equal(row.venue_name, 'KSPO DOME')
  assert.equal(row.auto_publish_blocked_reason, null)
  assert.equal(report.created.length, 1)
  assert.ok(!JSON.stringify(row).includes(SECRET))
})

test('自動上架：沒有地點的 SMTOWN 公告靠官方連結上架，摘要不帶走', async () => {
  const { report, args } = await autoPublish({ candidate: { raw_data: smRaw, source_url: SMTOWN_URL } })
  const [row] = args('insertDraftEvent')
  assert.equal(row.description, null)
  assert.equal(row.display_summary_zh, null)
  assert.equal(row.ticket_url, null)
  assert.equal(row.city, null)
  assert.equal(row.auto_publish_blocked_reason, null)
  assert.equal(args('publishEvent')[1].is_published, true)
  assert.equal(report.created.length, 1)
  assert.deepEqual(report.held, [])
  // 既有空殼草稿也能靠官方連結上架
  const existing = await autoPublish({ candidate: { raw_data: smRaw, source_url: SMTOWN_URL, display_summary_zh: null }, event: draft })
  assert.equal(existing.report.publishedExisting.length, 1)
  assert.equal(existing.args('publishEvent')[1].auto_publish_blocked_reason, null)
  // 標成公告來源、但網址不是官方公告頁：仍是空殼
  const strange = await autoPublish({ candidate: { raw_data: smRaw, source_url: 'https://www.smtown.com/artist/aespa' } })
  assert.equal(strange.args('insertDraftEvent')[0].auto_publish_blocked_reason, 'empty_shell')
  assert.equal(strange.report.held.length, 1)
})

test('自動上架：其他來源的空殼規則與摘要行為不變', async () => {
  const shell = await autoPublish({ candidate: { raw_data: { crawler_source_id: 'cs-jyp' }, source_url: 'https://twice.jype.com/a', display_summary_zh: null } })
  assert.equal(shell.args('insertDraftEvent')[0].auto_publish_blocked_reason, 'empty_shell')
  assert.equal(shell.report.held.length, 1)

  const jyp = await autoPublish({ candidate: { raw_data: { crawler_source_id: 'cs-jyp' }, source_url: 'https://twice.jype.com/a' } })
  assert.equal(jyp.args('insertDraftEvent')[0].display_summary_zh, '候選摘要')
  assert.equal(jyp.report.created.length, 1)

  const sched = await autoPublish({ candidate: { raw_data: schedRaw, source_url: `${YG_SCHEDULE_URL}#2027-01-10` } })
  const [row] = sched.args('insertDraftEvent')
  assert.equal(row.display_summary_zh, '候選摘要')
  assert.equal(row.ticket_url, null)
  assert.equal(row.description, null)
  assert.equal(sched.report.created.length, 1)
  const schedShell = await autoPublish({ candidate: { raw_data: schedRaw, source_url: `${YG_SCHEDULE_URL}#2027-01-10`, display_summary_zh: null } })
  assert.equal(schedShell.report.held.length, 1)
})

// ── 4. 後台單筆核准、批次核准 ──────────────────────────────────────────────────

function fakeServerClient(candidate) {
  const ops = []
  return {
    ops,
    inserted: table => ops.find(op => op.table === table && op.kind === 'insert')?.row,
    updated: table => ops.filter(op => op.table === table && op.kind === 'update').map(op => op.row),
    from(table) {
      const op = { table, kind: 'select' }
      ops.push(op)
      const result = () => {
        if (op.kind === 'insert') return table === 'events' ? { data: { id: 'new-event' }, error: null } : { error: null }
        if (op.kind === 'update') return { error: null }
        if (table === 'event_candidates') return { data: candidate, error: null }
        if (table === 'idols') return { data: { id: 'i', name: 'Idol' }, error: null }
        return { data: null, error: null }
      }
      const query = {
        select: () => query, eq: () => query, in: () => query, is: () => query,
        insert(row) { op.kind = 'insert'; op.row = row; return query },
        update(row) { op.kind = 'update'; op.row = row; return query },
        single: async () => result(), maybeSingle: async () => result(),
        then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
      }
      return query
    },
  }
}

function candidateRow(overrides) {
  return {
    id: 'cand', review_status: 'pending', raw_title: 'Notice Tour', detected_idol_id: 'i', detected_date: '2027-01-10',
    detected_event_type: 'concert', source_name: 'Official', source_type: 'official_website', raw_content: SECRET,
    display_summary_zh: '候選摘要', display_title_zh: null, location_name_zh: null, translation_status: 'machine', ...overrides,
  }
}

async function approveOne(candidate) {
  const client = m.serverClient = fakeServerClient(candidate)
  await assert.rejects(candidateActions.approveCandidate('cand'), error => error.redirectUrl === '/admin/events/new-event')
  return client.inserted('events')
}

async function approveBulk(candidate) {
  const client = m.serverClient = fakeServerClient(candidate)
  const response = await bulkRoute.POST({ json: async () => ({ ids: ['cand'], action: 'approve' }) })
  assert.equal(response.body.ok, true, JSON.stringify(response.body))
  return client.inserted('events')
}

test('單筆／批次核准：YG／SMTOWN 公告 description、摘要為空，YG 售票網址寫入', async () => {
  for (const approve of [approveOne, approveBulk]) {
    const yg = await approve(candidateRow({ raw_data: ygRaw, source_url: YG_URL, detected_venue_name: 'KSPO DOME' }))
    assert.equal(yg.description, null)
    assert.equal(yg.display_summary_zh, null)
    assert.equal(yg.ticket_url, TICKET)
    assert.equal(yg.venue_name, 'KSPO DOME')
    assert.ok(!JSON.stringify(yg).includes(SECRET))

    const sm = await approve(candidateRow({ raw_data: smRaw, source_url: SMTOWN_URL }))
    assert.equal(sm.description, null)
    assert.equal(sm.display_summary_zh, null)
    assert.equal(sm.ticket_url, null)
  }
})

test('單筆／批次核准：yg_artist_schedule 等其他來源行為不變', async () => {
  for (const approve of [approveOne, approveBulk]) {
    for (const raw_data of [schedRaw, { crawler_source_id: 'cs-jyp' }, undefined]) {
      const row = await approve(candidateRow({ raw_data, source_url: YG_SCHEDULE_URL }))
      assert.equal(row.description, SECRET)
      assert.equal(row.display_summary_zh, '候選摘要')
      assert.equal(row.ticket_url, null)
    }
  }
})

test('重審同步：公告來源不把摘要同步到活動，其他來源照舊', async () => {
  for (const [raw_data, expectSummary] of [[smRaw, false], [ygRaw, false], [schedRaw, true]]) {
    const client = m.serverClient = fakeServerClient({
      review_status: 'approved', approved_event_id: 'ev', display_title_zh: '中文標題', display_summary_zh: '候選摘要',
      location_name_zh: null, translation_status: 'machine', translation_source: 'ai', raw_data,
    })
    assert.deepEqual(await candidateActions.resolveRecheck('cand'), { ok: true, synced: true })
    const [payload] = client.updated('events')
    assert.equal(payload.display_title_zh, '中文標題')
    assert.equal('display_summary_zh' in payload, expectSummary, raw_data.source)
  }
})

// ── 5. 翻譯（後台產生中文、自動翻譯） ─────────────────────────────────────────

test('後台產生中文：公告不送正文、不寫摘要；有名稱或地點即成功', async () => {
  const inputs = []
  m.generate = async input => { inputs.push(input); return m.generated }

  m.generated = { displayTitleZh: '中文標題', displaySummaryZh: '模型摘要', locationNameZh: '首爾 KSPO DOME', notes: '', model: 'test' }
  for (const raw_data of [ygRaw, smRaw]) {
    const client = m.serverClient = fakeServerClient(candidateRow({ raw_data, display_summary_zh: null, translation_status: 'none', detected_venue_name: 'KSPO DOME' }))
    assert.deepEqual(await candidateActions.generateCandidateChineseDisplay('cand'), { ok: true })
    assert.equal(inputs.at(-1).content, null)
    assert.ok(!JSON.stringify(inputs.at(-1)).includes(SECRET))
    const [patch] = client.updated('event_candidates')
    assert.equal(patch.display_summary_zh, null)
    assert.equal(patch.display_title_zh, '中文標題')
    assert.equal(patch.location_name_zh, '首爾 KSPO DOME')
  }

  m.generated = { displayTitleZh: null, displaySummaryZh: null, locationNameZh: '首爾', notes: '', model: 'test' }
  m.serverClient = fakeServerClient(candidateRow({ raw_data: smRaw, display_summary_zh: null, translation_status: 'none' }))
  assert.deepEqual(await candidateActions.generateCandidateChineseDisplay('cand'), { ok: true })

  m.generated = { displayTitleZh: null, displaySummaryZh: '只有摘要', locationNameZh: null, notes: '', model: 'test' }
  const onlySummary = m.serverClient = fakeServerClient(candidateRow({ raw_data: smRaw, display_summary_zh: null, translation_status: 'none' }))
  const result = await candidateActions.generateCandidateChineseDisplay('cand')
  assert.equal(result.ok, false)
  assert.deepEqual(onlySummary.updated('event_candidates'), [])

  // 其他來源不變：送正文、可寫摘要
  m.generated = { displayTitleZh: '中文標題', displaySummaryZh: '模型摘要', locationNameZh: null, notes: '', model: 'test' }
  const sched = m.serverClient = fakeServerClient(candidateRow({ raw_data: schedRaw, display_summary_zh: null, translation_status: 'none' }))
  assert.deepEqual(await candidateActions.generateCandidateChineseDisplay('cand'), { ok: true })
  assert.equal(inputs.at(-1).content, SECRET)
  assert.equal(sched.updated('event_candidates')[0].display_summary_zh, '模型摘要')
})

function translationEvent(url, overrides = {}) {
  return {
    title: 'Notice Tour', description: SECRET, idol_name: 'Idol', type: 'concert', sub_type: null, date: '2027-01-10',
    date_label: null, start_date: '2027-01-10', end_date: null, location: null, city: 'Seoul', venue_name: 'KSPO DOME', address: null,
    is_published: true, translation_status: 'none', translation_attempts: 0, translation_attempted_at: null, translation_last_error: null,
    display_title_zh: null, display_summary_zh: null, location_name_zh: null,
    event_sources: [{ label: 'Official', type: 'official_website', url }], ...overrides,
  }
}

async function translate(event, generated) {
  const inputs = []
  const writes = []
  const failures = []
  const store = {
    getEvent: async () => event, claim: async () => true, resetAttempts: async () => true, restoreClaim: async () => {},
    writeSuccess: async (id, at, patch) => { writes.push(patch); return true },
    writeFailure: async (...args) => { failures.push(args); return true },
  }
  const result = await translateEvent({ store, translator: async input => { inputs.push(input); return generated }, clock: () => now.getTime() }, 'e1')
  return { result, inputs, writes, failures }
}

test('自動翻譯：公告活動只翻名稱與地點，不送正文，摘要寫 null', async () => {
  const full = { displayTitleZh: '中文標題', displaySummaryZh: '模型摘要', locationNameZh: '首爾 KSPO DOME' }
  for (const url of [YG_URL, SMTOWN_URL]) {
    const { result, inputs, writes } = await translate(translationEvent(url), full)
    assert.deepEqual(result, { outcome: 'translated' })
    assert.equal(inputs[0].content, null)
    assert.ok(!JSON.stringify(inputs[0]).includes(SECRET))
    assert.equal(writes[0].display_summary_zh, null)
    assert.equal(writes[0].display_title_zh, '中文標題')
    assert.equal(writes[0].location_name_zh, '首爾 KSPO DOME')
  }
  const titleOnly = await translate(translationEvent(SMTOWN_URL), { displayTitleZh: '中文標題', displaySummaryZh: null, locationNameZh: null })
  assert.deepEqual(titleOnly.result, { outcome: 'translated' })
  const summaryOnly = await translate(translationEvent(SMTOWN_URL), { displayTitleZh: null, displaySummaryZh: '模型摘要', locationNameZh: null })
  assert.equal(summaryOnly.result.outcome, 'failed')
  assert.deepEqual(summaryOnly.writes, [])
  // 多來源：任一來源是公告頁就只留事實
  const mixed = translationEvent('https://kpopofficial.com/x', { event_sources: [{ label: 'K', type: 'media_outlet', url: 'https://kpopofficial.com/x' }, { label: 'YG', type: 'official_website', url: YG_URL }] })
  assert.equal(buildChineseDisplayInput(mixed, mixed.event_sources).content, null)
})

test('自動翻譯：yg_artist_schedule 等其他來源照舊送正文、可寫摘要', async () => {
  for (const url of [YG_SCHEDULE_URL, 'https://twice.jype.com/a', null]) {
    const { result, inputs, writes } = await translate(translationEvent(url), { displayTitleZh: '中文標題', displaySummaryZh: '模型摘要', locationNameZh: null })
    assert.deepEqual(result, { outcome: 'translated' })
    assert.equal(inputs[0].content, SECRET)
    assert.equal(writes[0].display_summary_zh, '模型摘要')
  }
  const summaryOnly = await translate(translationEvent(YG_SCHEDULE_URL), { displayTitleZh: null, displaySummaryZh: '模型摘要', locationNameZh: null })
  assert.deepEqual(summaryOnly.result, { outcome: 'translated' })
})

// ── 6. 前台：活動資料、詳情頁、SEO、sitemap、搜尋、ICS、OG ─────────────────────

function eventRow(sources, overrides = {}) {
  return {
    id: 'ev-1', idol_id: 'i', idol_name: 'Idol', title: 'Notice Tour', type: 'concert', sub_type: null, status: 'confirmed',
    trust_level: 'official', date: '2027-01-10', start_date: '2027-01-10', end_date: null, date_label: null, time: null,
    location: null, location_name_zh: null, city: null, venue_name: null, address: null, map_url: null,
    display_title_zh: null, display_summary_zh: '殘留摘要', translation_status: 'machine', country: '', country_flag: '',
    description: SECRET, tags: [], ticket_url: null, stream_url: null, is_published: true, published_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-20T00:00:00Z', idols: { slug: 'idol', avatar_url: null, color: null },
    event_sources: sources.map((url, index) => ({ id: `s${index}`, event_id: 'ev-1', level: 'official', label: `來源${index}`, type: 'official_website', url })),
    ...overrides,
  }
}

async function loadEvent(row) {
  const query = { select: () => query, eq: () => query, in: () => query, neq: () => query, single: async () => ({ data: row, error: null }) }
  m.publicClient = { from: () => query }
  return getEventById('ev-1')
}

function elements(node, out = []) {
  if (Array.isArray(node)) { for (const child of node) elements(child, out); return out }
  if (node && typeof node === 'object' && 'props' in node) {
    out.push(node)
    elements(node.props.children, out)
  }
  return out
}
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(textOf).join('') : node?.props ? textOf(node.props.children) : ''

async function renderDetail(event) {
  m.detail = { event, isDemoEvent: false }
  const tree = await detailPage.default({ params: Promise.resolve({ id: event.id }) })
  return { all: elements(tree), text: textOf(tree), meta: await detailPage.generateMetadata({ params: Promise.resolve({ id: event.id }) }) }
}

test('活動資料：任一來源是公告頁就帶 officialNoticeUrl，其他活動輸出不變', async () => {
  assert.equal((await loadEvent(eventRow([YG_URL]))).officialNoticeUrl, YG_URL)
  assert.equal((await loadEvent(eventRow(['https://kpopofficial.com/x', SMTOWN_URL]))).officialNoticeUrl, SMTOWN_URL)
  const sched = await loadEvent(eventRow([YG_SCHEDULE_URL]))
  assert.equal('officialNoticeUrl' in sched, false)
  assert.equal(sched.description, SECRET)
})

test('詳情頁：公告活動即使留著正文／摘要也不渲染摘要區塊，有「看官方公告」', async () => {
  for (const url of [YG_URL, SMTOWN_URL]) {
    const event = await loadEvent(eventRow([url]))
    const { all, text, meta } = await renderDetail(event)
    assert.ok(!text.includes(SECRET), url)
    assert.ok(!text.includes('殘留摘要'), url)
    assert.ok(!text.includes('原始摘要') && !text.includes('本地化摘要'), url)
    const link = all.find(el => el.type === 'a' && textOf(el).includes('看官方公告'))
    assert.ok(link, url)
    assert.equal(link.props.href, url)
    assert.equal(link.props.target, '_blank')
    assert.equal(link.props.rel, 'noopener noreferrer')
    assert.ok(!text.includes('查看來源'))
    assert.ok(text.includes('Notice Tour') || all.some(el => el.props?.event?.title === 'Notice Tour'))
    assert.ok(!JSON.stringify(meta).includes(SECRET) && !JSON.stringify(meta).includes('殘留摘要'))
  }
  // 主要來源網址就是公告頁（沒有 officialNoticeUrl 欄位）也一樣
  const fallback = await loadEvent(eventRow([SMTOWN_URL]))
  delete fallback.officialNoticeUrl
  assert.ok(!(await renderDetail(fallback)).text.includes(SECRET))
})

test('詳情頁：其他來源照舊顯示摘要與「查看來源」', async () => {
  const event = await loadEvent(eventRow([YG_SCHEDULE_URL]))
  const { text, all } = await renderDetail(event)
  assert.ok(text.includes('殘留摘要'))
  assert.ok(text.includes('本地化摘要'))
  assert.ok(text.includes('查看來源'))
  assert.ok(!all.some(el => textOf(el) === '看官方公告'))
  const original = await loadEvent(eventRow([YG_SCHEDULE_URL], { display_summary_zh: null }))
  const rendered = await renderDetail(original)
  assert.ok(rendered.text.includes(SECRET) && rendered.text.includes('原始摘要'))
})

test('buildEventMeta：公告活動不帶正文／摘要，只留名稱、日期、地點與主辦公告提示', async () => {
  const base = { id: 'ev-1', idolName: 'Idol', title: 'Notice Tour', date: '2027-01-10', city: 'Seoul', description: SECRET, displaySummaryZh: '殘留摘要' }
  for (const event of [{ ...base, officialNoticeUrl: YG_URL }, { ...base, source: { level: 'official', label: 'YG', url: SMTOWN_URL } }]) {
    const meta = buildEventMeta(event)
    const text = JSON.stringify(meta)
    assert.ok(!text.includes(SECRET) && !text.includes('殘留摘要'))
    assert.match(meta.description, /Idol/)
    assert.match(meta.description, /Seoul/)
    assert.match(meta.description, /以主辦公告為準/)
  }
  const other = buildEventMeta({ ...base, source: { level: 'official', label: 'YG', url: YG_SCHEDULE_URL } })
  assert.match(other.description, /殘留摘要/)
  assert.match(buildEventMeta(base).description, /殘留摘要/)
})

test('sitemap：公告活動把官方連結算進最低內容，其他來源不變', async () => {
  const sitemapNow = new Date('2026-11-24T00:00:00Z')
  const events = await Promise.all([
    loadEvent(eventRow([SMTOWN_URL], { id: 'sm', description: null, display_summary_zh: null })),
    loadEvent(eventRow([YG_URL], { id: 'yg' })),
    loadEvent(eventRow(['https://twice.jype.com/a'], { id: 'shell', description: null, display_summary_zh: null })),
    loadEvent(eventRow([YG_SCHEDULE_URL], { id: 'sched' })),
  ])
  events.forEach((event, index) => { event.id = ['sm', 'yg', 'shell', 'sched'][index] })
  const urls = buildSitemapEntries({ idols: [], events, now: sitemapNow }).map(entry => entry.url)
  assert.ok(urls.some(url => url.endsWith('/events/sm')))
  assert.ok(urls.some(url => url.endsWith('/events/yg')))
  assert.ok(!urls.some(url => url.endsWith('/events/shell')))
  assert.ok(urls.some(url => url.endsWith('/events/sched')))
})

test('站內搜尋：公告活動的 haystack 不放正文，其他活動照舊', () => {
  const source = read('src/app/schedule/ScheduleClient.tsx')
  const haystack = source.slice(source.indexOf('function getSearchHaystack'), source.indexOf('function matchesPlatformKeyword'))
  assert.match(haystack, /getEventOfficialNoticeUrl\(event\) \? undefined : event\.description/)
  assert.equal([...haystack.matchAll(/event\.description/g)].length, 1)
  assert.doesNotMatch(haystack, /displaySummaryZh/)
})

test('ICS、OG／Twitter 圖不含公告正文或摘要（回歸）', async () => {
  const event = await loadEvent(eventRow([YG_URL], { city: 'Seoul', venue_name: 'KSPO DOME' }))
  const ics = buildIcs('Idol', [event], 'https://idol-rhythm.vercel.app')
  assert.ok(!ics.includes(SECRET) && !ics.includes('殘留摘要'))
  assert.match(ics, /SUMMARY:Notice Tour/)
  for (const path of ['src/app/events/[id]/opengraph-image.tsx', 'src/app/events/[id]/twitter-image.tsx']) {
    const source = read(path)
    assert.doesNotMatch(source, /description|displaySummaryZh|display_summary_zh|raw_content/, path)
  }
  assert.doesNotMatch(read('src/lib/ics/buildIcs.ts'), /event\.description|displaySummaryZh/)
})

test('範圍守門：不改爬蟲存檔格式、不新增 migration', () => {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const base = git('merge-base', 'origin/main', 'HEAD').trim()
  assert.equal(git('diff', '--name-only', base, '--', 'src/lib/crawlers', 'supabase'), '')
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', 'src/lib/crawlers', 'supabase'), '')
  const numbers = readdirSync(new URL('supabase/migrations/', root)).map(name => Number(name.match(/^\d+/)?.[0] ?? 0))
  assert.equal(Math.max(...numbers), 71)
})
