import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? specifier + '.ts' : specifier, context)
  },
})

const { runAutoPublish } = await import('../src/lib/autoPublish/runAutoPublish.ts')
const { AUTO_PUBLISH_RULE_VERSION } = await import('../src/lib/autoPublish/evaluateCandidate.ts')
const { hasMinimumContent, MIN_CONTENT_FIELDS, TITLE_CITY_COUNTS_AS_CONTENT } = await import('../src/lib/autoPublish/minimumContent.ts')
const { normalizeCrawledEvent } = await import('../src/lib/crawlers/taiwanEventCleanup.ts')

const now = new Date('2026-11-21T02:00:00Z')
const source = { id: 'cs', source_key: 'jyp', name: 'JYP Schedule', parser_type: 'jyp_schedule', source_type: 'official_website' }
const draft = {
  id: 'e1', idol_id: 'i', title: 'Draft', date: '2027-01-01',
  is_published: false, auto_publish_blocked: false, auto_publish_blocked_reason: 'empty_shell',
  status: 'confirmed', trust_level: 'pending',
}

async function run({ candidate = {}, event, freshLocation = null } = {}) {
  const c = {
    id: 'c1', review_status: 'pending', raw_title: 'TWICE Tour', detected_idol_id: 'i',
    detected_event_type: 'concert', detected_date: '2027-01-01', source_url: 'https://twice.jype.com/a',
    source_name: source.name, source_type: source.source_type, raw_data: { crawler_source_id: source.id },
    approved_event_id: event?.id, ...candidate,
  }
  const ctx = {
    now, idols: [{ id: 'i', name: 'TWICE', is_active: true }], crawlerSources: [source],
    events: event ? [event] : [], eventSources: [],
  }
  const calls = []
  const responses = {
    readAutoPublishEnabled: { enabled: true },
    loadContext: { candidates: [c], ctx, idolNames: new Map([['i', 'TWICE']]) },
    getEvent: event,
    insertDraftEvent: { id: 'new' },
    linkCandidate: { updated: 1 },
    hasEventSourceUrl: false,
    insertEventSource: { ok: true },
    publishEvent: { updated: 1 },
    markCandidateApproved: { updated: 1 },
  }
  const store = Object.fromEntries(Object.entries(responses).map(([name, response]) => [
    name, async (...args) => { calls.push({ name, args: structuredClone(args) }); return response },
  ]))
  const report = await runAutoPublish(store, { now, touched: [{ candidateId: c.id, freshLocation }] })
  assert.deepEqual(report.errors, [])
  return { calls: calls.map(call => call.name), args: name => calls.find(call => call.name === name)?.args, report }
}

function assertHeld(result) {
  const { calls, args, report } = result
  assert.deepEqual(calls, ['readAutoPublishEnabled', 'loadContext', 'insertDraftEvent', 'linkCandidate', 'insertEventSource'])
  const [row] = args('insertDraftEvent')
  assert.equal(row.auto_publish_blocked_reason, 'empty_shell')
  assert.equal(row.auto_publish_blocked, false)
  assert.equal(row.is_published, false)
  assert.equal(row.city, null)
  assert.equal(row.location_autofilled_at, null)
  assert.equal(row.location_autofill_meta, null)
  assert.deepEqual(args('linkCandidate'), ['c1', 'new'])
  assert.equal(args('insertEventSource')[0].event_id, 'new')
  assert.deepEqual(report.held, [{ candidateId: 'c1', eventId: 'new', target: 'create_event' }])
  assert.deepEqual(report.created, [])
}

test('hold new shells, including candidate-only content and whitespace', async () => {
  assertHeld(await run())
  assertHeld(await run({ candidate: { raw_content: 'Location: Arena', detected_map_url: 'https://example.com/map' } }))
  assertHeld(await run({ candidate: {
    detected_city: '  ', detected_venue_name: '\t', detected_address: ' ',
    location_name_zh: '\n', display_summary_zh: '  ',
  } }))
})

test('each supported new-event field can independently allow publication', async () => {
  for (const [candidateField, eventField] of [
    ['detected_venue_name', 'venue_name'], ['detected_city', 'city'], ['detected_address', 'address'],
    ['location_name_zh', 'location_name_zh'], ['display_summary_zh', 'display_summary_zh'],
  ]) {
    const { report, args } = await run({ candidate: { [candidateField]: 'Content' } })
    const [row] = args('insertDraftEvent')
    assert.equal(row[eventField], 'Content', candidateField)
    assert.equal(row.auto_publish_blocked_reason, null)
    assert.equal(args('publishEvent')[1].is_published, true)
    assert.equal(report.created.length, 1)
    assert.deepEqual(report.held, [])
  }
})

test('each minimum-content field on an existing draft can independently allow publication', async () => {
  for (const field of MIN_CONTENT_FIELDS) {
    const { report, args } = await run({ event: { ...draft, [field]: 'Content' } })
    assert.equal(report.publishedExisting.length, 1, field)
    assert.equal(args('publishEvent')[1].auto_publish_blocked_reason, null)
  }
})

test('title-only city stays out of held drafts', async () => {
  const taiwanTitle = 'TWICE Tour in Taipei'
  assert.equal(normalizeCrawledEvent({ rawTitle: taiwanTitle, type: 'concert', subType: null }).city, '台北')
  for (const raw_title of ['Stray Kids World Tour <RUN IT> SEATTLE', taiwanTitle]) {
    assertHeld(await run({ candidate: { raw_title } }))
  }
})

test('fresh venue resumes a held linked draft in one publish patch', async () => {
  const { report, args } = await run({
    event: draft,
    freshLocation: { detected_venue_name: 'Fresh Arena', detected_city: null, detected_address: null },
  })
  assert.equal(report.publishedExisting.length, 1)
  const [id, patch, guards] = args('publishEvent')
  assert.equal(id, draft.id)
  assert.equal(patch.venue_name, 'Fresh Arena')
  assert.equal(patch.auto_publish_blocked_reason, null)
  assert.deepEqual(guards, { venue_name: null })
})

test('held drafts without persisted or planned content cause no writes', async () => {
  const { report, calls } = await run({
    candidate: { display_summary_zh: '候選摘要' },
    event: { ...draft, time: '  ', description: '\t' },
  })
  assert.deepEqual(calls, ['readAutoPublishEnabled', 'loadContext', 'getEvent'])
  assert.equal(report.skipped.empty_shell, 1)
})

test('permanently blocked drafts cause no writes regardless of reason', async () => {
  for (const reason of [null, 'empty_shell']) {
    const { report, calls } = await run({
      event: { ...draft, auto_publish_blocked: true, auto_publish_blocked_reason: reason, venue_name: 'Arena' },
    })
    assert.deepEqual(calls, ['readAutoPublishEnabled', 'loadContext'])
    assert.equal(report.publishedExisting.length, 0)
  }
})

test('ordinary drafts do not touch the reason column; manual reason without block is not cleared', async () => {
  for (const reason of [null, 'manual']) {
    const { report, args } = await run({ event: { ...draft, auto_publish_blocked_reason: reason, venue_name: 'Arena' } })
    assert.equal(report.publishedExisting.length, 1, String(reason))
    assert.equal('auto_publish_blocked_reason' in args('publishEvent')[1], false, String(reason))
  }
  const { calls, report } = await run({ event: { ...draft, auto_publish_blocked_reason: 'manual' } })
  assert.deepEqual(calls, ['readAutoPublishEnabled', 'loadContext', 'getEvent'])
  assert.equal(report.skipped.empty_shell, 1)
})

test('fresh payload location lets a new candidate publish', async () => {
  const { report, args } = await run({ freshLocation: { detected_venue_name: 'Fresh Hall', detected_city: null, detected_address: null } })
  const [row] = args('insertDraftEvent')
  assert.equal(row.venue_name, 'Fresh Hall')
  assert.equal(row.auto_publish_blocked_reason, null)
  assert.equal(report.created.length, 1)
  assert.deepEqual(report.held, [])
})

test('minimum content trims values and uses the v2 rule defaults', () => {
  assert.deepEqual(MIN_CONTENT_FIELDS, [
    'time', 'location', 'venue_name', 'city', 'address', 'location_name_zh',
    'description', 'display_summary_zh', 'ticket_url', 'stream_url',
  ])
  assert.equal(hasMinimumContent({ title: 'Tour', date: '2027-01-01' }), false)
  for (const field of MIN_CONTENT_FIELDS) {
    for (const empty of [null, undefined, '', ' \t\n']) assert.equal(hasMinimumContent({ [field]: empty }), false, field)
    assert.equal(hasMinimumContent({ [field]: ' Content ' }), true, field)
  }
  assert.equal(TITLE_CITY_COUNTS_AS_CONTENT, false)
  assert.equal(AUTO_PUBLISH_RULE_VERSION, 't34-v2')
})

test('069 grants only the reason column and protected paths match the branch point', () => {
  const root = new URL('../', import.meta.url)
  const migration = 'supabase/migrations/069_auto_publish_blocked_reason.sql'
  const sql = readFileSync(new URL(migration, root), 'utf8')
  assert.match(sql, /GRANT\s+UPDATE\s*\(\s*auto_publish_blocked_reason\s*\)\s+ON\s+public\.events\s+TO\s+service_role\s*;/i)
  for (const grant of sql.match(/\bGRANT\b[^;]+;/gi) ?? []) {
    if (/\bTO\s+service_role\b/i.test(grant)) assert.doesNotMatch(grant, /\bauto_publish_blocked\b/i)
  }

  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const base = git('merge-base', 'origin/main', 'HEAD').trim()
  const protectedPaths = [
    'src/lib/crawlers', 'src/app/api/cron', 'src/app/api/ics', 'src/lib/ics',
    'src/lib/reminderDispatch.ts', 'package.json', 'vercel.json',
    'supabase/migrations', `:(exclude)${migration}`,
    ':(exclude)supabase/migrations/070_event_translation_attempts.sql', ':(exclude)supabase/migrations/071_event_error_reports.sql', ':(exclude)supabase/migrations/072_crawler_source_alerts.sql', ':(exclude)src/app/api/cron/sync-candidates/route.ts',
    // MUST #10（JYP 改用公告頁）只放行這幾支爬蟲檔
    ':(exclude)src/lib/crawlers/jypNotice.ts', ':(exclude)src/lib/crawlers/runActiveCrawlerSources.ts', ':(exclude)src/lib/crawlers/runJypNoticeFetcher.ts', ':(exclude)src/lib/crawlers/runJypScheduleFetcher.ts',
    // T35 只放行 migration 073 與林口→桃園
    ':(exclude)supabase/migrations/073_t35_ticket_sales_country_time_status.sql', ':(exclude)src/lib/crawlers/taiwanEventCleanup.ts',
  ]
  assert.equal(git('diff', '--name-only', base, '--', ...protectedPaths), '')
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths), '')

  const envPaths = ':(glob)**/.env*'
  assert.equal(git('diff', '--cached', '--name-only', base, '--', envPaths), '')
  // The tar test copy deliberately omits all .env* files.
  const envDiffOptions = process.env.GIT_WORK_TREE ? ['--diff-filter=d'] : []
  assert.equal(git('diff', '--name-only', ...envDiffOptions, base, '--', envPaths), '')
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', envPaths), '')
})
