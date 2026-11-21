import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { cleanCrawledTitle, inferTaiwanCity, normalizeCrawledEvent, refineEventCategory } from '../src/lib/crawlers/taiwanEventCleanup.ts'

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const path = context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)
      ? `${specifier}.ts` : specifier
    return nextResolve(path, context)
  },
})
const { runAutoPublish } = await import('../src/lib/autoPublish/runAutoPublish.ts')
hooks.deregister()

test('clean crawler prefixes and retain the original when the remainder is empty', () => {
  assert.equal(cleanCrawledTitle('ITZY 官方 JYP Schedule - KBS 뮤직뱅크'), 'KBS 뮤직뱅크')
  assert.equal(cleanCrawledTitle('  Custom [Source] — Show – Part II ', { sourceName: 'Custom [Source]' }), 'Show – Part II')
  assert.equal(cleanCrawledTitle('BLACKPINK 官方 yg schedule – Show'), 'Show')
  assert.equal(cleanCrawledTitle('Show - Part II'), 'Show - Part II')
  assert.equal(cleanCrawledTitle('ITZY 官方 JYP Schedule -  '), 'ITZY 官方 JYP Schedule -  ')
})

test('infer a single Taiwanese city from a venue or a city name', () => {
  for (const [title, city] of [
    ['WORLD TOUR IN TAIPEI', '台北'], ['NEW TAIPEI', '新北'], ['KAOHSIUNG', '高雄'],
    ['高雄巨蛋', '高雄'], ['Kaohsiung Arena', '高雄'], ['臺北小巨蛋', '台北'],
    ['台北大巨蛋', '台北'], ['Taipei Dome', '台北'], ['林口體育館', '新北'],
    ['Legacy Taipei', '台北'], ['타이베이', '台北'], ['Clapper Studio', '台北'],
    ['TAIPEI / KAOHSIUNG', null], ['Legacy Max / 衛武營', null],
    ['首爾／東京', null], ['TAIPEIX', null],
  ]) assert.equal(inferTaiwanCity({ title }), city, title)
  assert.equal(inferTaiwanCity({ title: 'IN TAIPEI', venueName: '衛武營' }), '高雄')
  assert.equal(inferTaiwanCity({ title: 'Show', locationText: '桃園巨蛋' }), '桃園')
})

test('refine only Other and apply category rules in priority order', () => {
  for (const [title, type, subType, expectedType, expectedSubType] of [
    ['2ND WORLD TOUR IN TAIPEI', 'official', null, 'concert', null],
    ['FANMEETING TOUR', 'official', null, 'concert', 'fanmeet'],
    ['팬사인회', null, null, 'official', 'fansign'],
    ['POP-UP STORE', 'official', null, 'brand', 'popup_store'],
    ['전시', 'official', null, 'official', 'exhibition'],
    ['KBS 뮤직뱅크', 'media', null, 'media', null],
    ['KBS Concert Special', 'media', 'musicshow', 'media', 'musicshow'],
    ['FANMEETING TOUR', 'ticketing', null, 'ticketing', null],
    ['TOUR', 'brand', 'popup_store', 'brand', 'popup_store'],
  ]) {
    const result = refineEventCategory({ title, type, subType })
    assert.deepEqual([result.type, result.subType], [expectedType, expectedSubType], title)
  }
  const result = normalizeCrawledEvent({
    rawTitle: 'ITZY 官方 JYP Schedule - TOUR TAIPEI',
    city: '高雄', type: 'official', subType: null,
  })
  assert.deepEqual(result, {
    title: 'TOUR TAIPEI', city: '高雄', type: 'concert', subType: null, rules: ['clean_title', 'concert'],
  })
})

test('ignore city false positives and overseas tour-stop lists', () => {
  for (const title of ['신주쿠 팝업스토어', '舞台中央', '後臺北側', '平臺南側']) {
    assert.equal(inferTaiwanCity({ title }), null, title)
  }
  assert.equal(inferTaiwanCity({ title: 'Show', venueName: '舞台中央', locationText: '後台北側' }), null)
  assert.equal(inferTaiwanCity({ title: '신주 콘서트' }), '新竹')
  for (const separator of ['/', ',', '·', '、', '|', '／', '，', '｜', '&']) {
    const title = ['ASIA TOUR: SEOUL', 'TAIPEI', 'BANGKOK'].join(` ${separator} `)
    assert.equal(inferTaiwanCity({ title }), null)
    assert.equal(inferTaiwanCity({ title, venueName: '南港展覽館' }), '台北')
  }
  assert.equal(inferTaiwanCity({ title: '香港 | TAIPEI / KAOHSIUNG', locationText: '桃園巨蛋' }), '桃園')
})

test('skip title-based city inference for the expanded overseas stop list', () => {
  assert.equal(inferTaiwanCity({ title: 'SEOUL／TAIPEI' }), null)
  for (const city of [
    'BUSAN', 'INCHEON', 'NAGOYA', 'FUKUOKA', 'YOKOHAMA', 'SAITAMA', 'SYDNEY', 'MELBOURNE',
    'HO CHI MINH', 'HANOI', '부산', '마닐라', '雅加達', '吉隆坡', '釜山',
  ]) {
    const title = `${city} & TAIPEI`
    assert.equal(inferTaiwanCity({ title }), null, title)
  }
})

test('protect existing categories and exclude sales and release titles', () => {
  for (const [title, type, subType] of [
    ['Simply K-Pop CON-TOUR', 'media', null],
    ['5TH WORLD TOUR IN JAPAN Blu-ray & DVD release', 'official', null],
    ['2ND WORLD TOUR IN TAIPEI 티켓 오픈 안내', 'official', null],
    ['ONLINE CONCERT', 'livestream', null],
    ['콘서트 영화 공개', 'streaming', null],
    ['FANMEETING TICKET OPEN', 'official', 'announcement'],
    ['FANMEETING', 'official', 'announcement'],
    ['WORLD TOUR', 'brand', 'release'],
    ['POP-UP STORE', 'media', null],
    ['EXHIBITION TICKETING', 'official', null],
    ['WORLD TOUR IN TAIPEI TICKETS ON SALE', 'official', null],
    ['투어스', 'official', null],
  ]) {
    assert.deepEqual(refineEventCategory({ title, type, subType }), { type, subType, rule: null }, title)
  }
})

test('exclude plural sales and release terms and ticket notices independently', () => {
  for (const notice of ['TICKETS', 'ALBUMS', 'RELEASES', 'PRESALES', 'ON SALE', '預售', '購票', '抽選']) {
    const title = `WORLD TOUR IN TAIPEI ${notice}`
    assert.deepEqual(refineEventCategory({ title, type: 'official', subType: null }), {
      type: 'official', subType: null, rule: null,
    }, title)
  }
})

test('preserve non-concert subtypes for fan signing, pop-up and exhibition titles', () => {
  for (const subType of ['musicshow', 'variety', 'interview', 'release', 'announcement', 'magazine', 'brand_event']) {
    for (const title of ['FAN SIGNING', 'POP-UP STORE 오픈 안내', 'EXHIBITION']) {
      assert.deepEqual(refineEventCategory({ title, type: 'official', subType }), {
        type: 'official', subType, rule: null,
      }, `${subType}: ${title}`)
    }
  }
})

test('distinguish exhibition halls from exhibitions and recognize fan signing', () => {
  for (const title of [
    '2ND WORLD TOUR @ Nangang Exhibition Center',
    'WORLD TOUR @ Exhibition Centre',
    'WORLD TOUR @ Exhibition Hall',
    '콘서트 @ KINTEX 제1전시장',
    '콘서트 @ 전시관',
    '巡演 @ 南港展覽館',
    '巡演 @ 香港會議展覽中心',
  ]) {
    assert.deepEqual(refineEventCategory({ title, type: 'official', subType: null }), {
      type: 'concert', subType: null, rule: 'concert',
    }, title)
  }
  assert.deepEqual(refineEventCategory({ title: 'PHOTO EXHIBITION', type: 'official', subType: null }), {
    type: 'official', subType: 'exhibition', rule: 'exhibition',
  })
  assert.deepEqual(refineEventCategory({ title: 'FAN SIGNING', type: 'brand', subType: null }), {
    type: 'brand', subType: 'fansign', rule: 'fansign',
  })
})

const now = new Date('2026-11-21T02:00:00Z')
const source = {
  id: 'source', name: 'Custom Schedule', source_key: 'jyp',
  parser_type: 'jyp_schedule', source_type: 'official_website',
}
const rawTitle = 'Custom Schedule — 2ND WORLD TOUR IN TAIPEI'

async function run(overrides = {}, events = [], freshLocation = null) {
  const candidate = {
    id: 'candidate', review_status: 'pending', raw_title: rawTitle,
    detected_idol_id: 'idol', detected_event_type: 'official', detected_date: '2027-01-01',
    source_url: 'https://twice.jype.com/a', source_type: 'official_website',
    raw_data: { crawler_source_id: source.id }, ...overrides,
  }
  const ctx = {
    now, idols: [{ id: 'idol', name: 'TWICE', is_active: true }],
    crawlerSources: [source], events, eventSources: [],
  }
  const drafts = []
  const patches = []
  const store = {
    readAutoPublishEnabled: async () => ({ enabled: true }),
    loadContext: async () => ({ candidates: [candidate], ctx, idolNames: new Map([['idol', 'TWICE']]) }),
    getEvent: async id => events.find(event => event.id === id) ?? null,
    insertDraftEvent: async row => { drafts.push(row); return { id: 'new-event' } },
    linkCandidate: async () => ({ updated: 1 }),
    hasEventSourceUrl: async () => false,
    insertEventSource: async () => ({ ok: true }),
    publishEvent: async (id, patch) => { patches.push({ id, patch }); return { updated: 1 } },
    markCandidateApproved: async () => ({ updated: 1 }),
  }
  const report = await runAutoPublish(store, {
    touched: [{ candidateId: candidate.id, freshLocation }], now,
  })
  assert.equal(candidate.raw_title, rawTitle)
  return { report, drafts, patches }
}

test('create_event writes the cleaned title, inferred city and refined category', async () => {
  const { report, drafts } = await run({ display_summary_zh: '巡演資訊' })
  assert.deepEqual(report.errors, [])
  assert.equal(report.created[0].locationPending, false)
  assert.deepEqual(report.created[0].cleanupRules, ['clean_title', 'infer_city', 'concert'])
  assert.equal(drafts[0].title, '2ND WORLD TOUR IN TAIPEI')
  assert.equal(drafts[0].type, 'concert')
  assert.equal(drafts[0].sub_type, null)
  assert.equal(drafts[0].city, '台北')
  assert.equal(drafts[0].location_autofilled_at, now.toISOString())
  assert.deepEqual(drafts[0].location_autofill_meta[0].fields, { city: '台北' })
})

test('create_event prefers fresh venue evidence and preserves an existing city', async () => {
  const candidate = { detected_venue_name: 'Taipei Arena' }
  const freshLocation = { detected_city: null, detected_venue_name: '高雄巨蛋', detected_address: null }
  const inferred = await run(candidate, [], freshLocation)
  assert.equal(inferred.drafts[0].venue_name, '高雄巨蛋')
  assert.equal(inferred.drafts[0].city, '高雄')
  assert.ok(inferred.report.created[0].cleanupRules.includes('infer_city'))

  const existing = await run({ ...candidate, detected_city: '桃園' })
  assert.equal(existing.drafts[0].city, '桃園')
  assert.ok(!existing.report.created[0].cleanupRules.includes('infer_city'))
})

test('missing and invalid type still prevent draft creation', async () => {
  for (const [type, message] of [[null, 'missing_type'], ['festival', 'invalid_type']]) {
    const { report, drafts, patches } = await run({ detected_event_type: type })
    assert.deepEqual(report.errors, [{ candidateId: 'candidate', eventId: null, step: 'event_type', message }])
    assert.deepEqual(drafts, [])
    assert.deepEqual(patches, [])
  }
})

test('publishing an existing event does not write its title or category', async () => {
  const existing = {
    id: 'existing', idol_id: 'idol', title: 'Original draft', type: 'official',
    date: '2027-01-01', is_published: false, auto_publish_blocked: false,
    status: 'confirmed', trust_level: 'pending', venue_name: 'Arena',
  }
  const { report, drafts, patches } = await run({ approved_event_id: existing.id }, [existing])
  assert.deepEqual(report.errors, [])
  assert.deepEqual(drafts, [])
  assert.equal(patches[0].id, existing.id)
  for (const field of ['title', 'type', 'sub_type', 'city']) assert.ok(!(field in patches[0].patch))
})
