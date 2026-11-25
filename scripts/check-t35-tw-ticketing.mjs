// T35：售票階段、國家代碼、時間狀態、管線小修。node scripts/check-t35-tw-ticketing.mjs
// 另跑 TZ=America/Los_Angeles node scripts/check-t35-tw-ticketing.mjs 驗證時區不漂移。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
registerHooks({ resolve(s, c, n) { return n(s.startsWith('.') && !c.parentURL?.includes('/node_modules/') && !/\.[a-z]+$/i.test(s) ? s + '.ts' : s, c) } })

const tp = await import('../src/lib/ticketPlatforms.ts')
const regions = await import('../src/lib/regions.ts')
const { inferCountryCode, inferRegionFields } = await import('../src/lib/regionInference.ts')
const hero = await import('../src/lib/eventDetailHero.ts')
const ts = await import('../src/lib/ticketSales.ts')
const form = await import('../src/lib/admin/ticketSalesForm.ts')
const { evaluateCandidate, evaluateCandidates, NULL_CONFIDENCE_OK_PARSERS } = await import('../src/lib/autoPublish/evaluateCandidate.ts')
const { runAutoPublish } = await import('../src/lib/autoPublish/runAutoPublish.ts')
const { venueCalendarFields } = await import('../src/lib/autoPublish/venueCalendarFields.ts')
const { isSameShow, canonicalCityKey, groupPossibleDuplicates } = await import('../src/lib/autoPublish/sameShow.ts')
const { inferTaiwanCity } = await import('../src/lib/crawlers/taiwanEventCleanup.ts')
const { touchedFromPayload } = await import('../src/lib/crawlers/touchedCandidate.ts')
const { TICKET_SAFETY_NOTICE } = await import('../src/lib/ticketSafetyCopy.ts')

// ── A-5 平台表 ────────────────────────────────────────────────────────────────
test('A-5 官方售票網域：子網域嚴格比對、惡意相似網域不算、未驗證候選不參與判斷', () => {
  for (const url of ['https://tixcraft.com/activity/detail/26_youngk', 'https://www.tixcraft.com/x', 'https://kktix.com/events/x',
    'https://farglorycreative.kktix.cc/events/cofr3t', 'https://ticket.ibon.com.tw/ActivityInfo/Details/39961', 'https://ticket.com.tw/x',
    'https://kham.com.tw/application/UTK02/UTK0201_.aspx?PRODUCT_ID=P1HF3HRY', 'https://ticketplus.com.tw/activity/x',
    'https://www.klook.com/zh-TW/event/x', 'https://weverse.io/nct127/notice/41024', 'HTTPS://TIXCRAFT.COM/x']) {
    assert.equal(tp.isOfficialTicketUrl(url), true, url)
  }
  for (const url of ['https://evil-tixcraft.com/x', 'https://tixcraft.com.evil.io/x', 'https://tixcraftcom.io', 'https://kktix.cc.evil.com',
    'https://notkktix.cc/x', 'https://ibon.com.tw/x', 'https://myticket.com.tw/x', 'javascript:alert(1)', 'ftp://tixcraft.com/x', 'tixcraft.com', '', null, undefined]) {
    assert.equal(tp.isOfficialTicketUrl(url), false, String(url))
  }
  assert.equal(tp.platformForUrl('https://farglorycreative.kktix.cc/events/x').code, 'kktix')
  assert.equal(tp.platformForUrl('https://evil-tixcraft.com/x'), null)
  assert.equal(tp.platformByCode('ERA').name, '年代售票')
  assert.equal(tp.platformByCode('nope'), null)
  // 未驗證候選：不是官方，但也不警示
  assert.equal(tp.isOfficialTicketUrl('https://www.cityline.com/x'), false)
  assert.equal(tp.unknownTicketPlatformWarning('https://www.cityline.com/x'), null)
  assert.equal(tp.unknownTicketPlatformWarning('https://example.com/ticket'), '非已知官方售票平台')
  assert.equal(tp.unknownTicketPlatformWarning('https://evil-tixcraft.com/x'), '非已知官方售票平台')
  for (const p of tp.TICKET_PLATFORMS) if (!p.verified) assert.ok(['HK', 'SG', 'MY'].some(c => p.countries.includes(c)), p.code)
  // 前置提醒只寫來源明講的拓元、KKTIX
  assert.deepEqual(tp.TICKET_PLATFORMS.filter(p => p.prerequisite).map(p => p.code).sort(), ['kktix', 'tixcraft'])
})

// ── regions / regionInference ────────────────────────────────────────────────
test('regions 對照與存檔補欄位', () => {
  assert.deepEqual(['TW', 'HK', 'SG', 'MY', 'JP', 'KR'].map(c => regions.regionByCode(c).name), ['台灣', '香港', '新加坡', '馬來西亞', '日本', '韓國'])
  assert.equal(regions.regionByCode('tw').flag, '🇹🇼')
  assert.equal(regions.regionByCode('US'), null)
  assert.equal(regions.regionByCountryName('臺灣').code, 'TW')
  assert.deepEqual(regions.resolveCountryFields({ countryCode: 'TW', country: '亂填', countryFlag: '' }), { country_code: 'TW', country: '台灣', country_flag: '🇹🇼' })
  assert.deepEqual(regions.resolveCountryFields({ countryCode: '', country: ' 美國 ', countryFlag: '🇺🇸' }), { country_code: null, country: '美國', country_flag: '🇺🇸' })
})

test('B-1 regionInference：台北／高雄／桃園 → TW＋台灣＋🇹🇼；港星馬；無法判斷 → NULL', () => {
  for (const city of ['台北', '高雄', '桃園', 'Taipei', '臺北小巨蛋', 'Kaohsiung Arena']) {
    assert.deepEqual(inferRegionFields({ city }), { country_code: 'TW', country: '台灣', country_flag: '🇹🇼' }, city)
  }
  assert.equal(inferCountryCode({ venueName: 'Kaohsiung National Stadium' }), 'TW')
  assert.equal(inferCountryCode({ venueName: '林口體育館' }), 'TW')
  assert.equal(inferCountryCode({ city: 'Hong Kong', venueName: 'AsiaWorld-Expo' }), 'HK')
  assert.equal(inferCountryCode({ venueName: 'Kai Tak Stadium' }), 'HK')
  assert.equal(inferCountryCode({ venueName: 'Singapore Indoor Stadium' }), 'SG')
  assert.equal(inferCountryCode({ venueName: 'National Stadium' }), 'SG')
  assert.equal(inferCountryCode({ city: '吉隆坡' }), 'MY')
  assert.equal(inferCountryCode({ venueName: 'Axiata Arena, Bukit Jalil' }), 'MY')
  assert.equal(inferCountryCode({ venueName: 'Bukit Jalil National Stadium' }), 'MY')
  for (const evidence of [{}, { city: '' }, { city: 'Seoul' }, { city: 'Auckland' }, { city: '台北', venueName: 'AsiaWorld-Expo' }]) {
    assert.deepEqual(inferRegionFields(evidence), { country_code: null, country: '', country_flag: '' }, JSON.stringify(evidence))
  }
})

// ── A-3 時間狀態、售票階段 ────────────────────────────────────────────────────
test('A-3 formatTimeLabel 三種 time_status', () => {
  assert.equal(hero.formatTimeLabel(null, 'tba'), '官方尚未公布')
  assert.equal(hero.formatTimeLabel('', 'unknown'), '時間未定')
  assert.equal(hero.formatTimeLabel(undefined, undefined), '時間未定')
  assert.equal(hero.formatTimeLabel('19:00', 'announced'), '19:00')
  assert.equal(hero.formatTimeLabel(null, 'announced'), '時間未定')
  assert.equal(hero.getInfoDateRow({ title: 'IU', date: '2027-02-13', timeStatus: 'tba', source: { level: 'official' } }).sub, '官方尚未公布')
  assert.equal(hero.getHeroDateParts({ title: 'IU', date: '2027-02-13', timeStatus: 'tba', source: { level: 'official' } }).metaLabel, '週六 · 官方尚未公布')
})

const sale = (over = {}) => ({ id: 's', stage: 'general', label: '一般售票', startsAt: null, endsAt: null, platform: null, url: null,
  eligibility: 'public', eligibilityNote: null, requiresVerification: null, sourceUrl: null, verifiedAt: null, ...over })

test('A-3 售票狀態以台北時間計算：未開賣＋距離／進行中／已結束', () => {
  const now = new Date('2026-11-25T08:00:00Z') // 台北 11/25 16:00
  assert.equal(ts.formatTaipeiSaleTime('2026-11-28T12:00:00+08:00'), '11/28（六）12:00')
  assert.equal(ts.formatTaipeiSaleTime('2026-11-28T04:00:00Z'), '11/28（六）12:00')
  assert.equal(ts.formatTaipeiSaleTime('2026-11-27T16:30:00Z'), '11/28（六）00:30')
  assert.equal(ts.formatTaipeiSaleTime('bad'), null)
  assert.deepEqual(ts.ticketSaleStatus(sale({ startsAt: '2026-11-28T12:00:00+08:00' }), now), { status: 'upcoming', label: '未開賣・還有 2 天' })
  assert.deepEqual(ts.ticketSaleStatus(sale({ startsAt: '2026-11-25T19:00:00+08:00' }), now), { status: 'upcoming', label: '未開賣・還有 3 小時' })
  assert.deepEqual(ts.ticketSaleStatus(sale({ startsAt: '2026-11-25T16:20:00+08:00' }), now), { status: 'upcoming', label: '未開賣・還有 20 分鐘' })
  assert.equal(ts.ticketSaleStatus(sale({ startsAt: '2026-11-25T12:00:00+08:00' }), now).status, 'open')
  assert.equal(ts.ticketSaleStatus(sale({ startsAt: '2026-11-25T12:00:00+08:00', endsAt: '2026-11-25T23:59:00+08:00' }), now).label, '進行中')
  assert.equal(ts.ticketSaleStatus(sale({ startsAt: '2026-09-01T10:00:00+08:00', endsAt: '2026-09-01T13:00:00+08:00' }), now).label, '已結束')
  assert.equal(ts.ticketSaleStatus(sale({ startsAt: '2026-11-25T16:00:00+08:00' }), now).status, 'open') // 剛好開賣
  assert.equal(ts.ticketSaleStatus(sale(), now).status, 'unknown')
  const view = ts.toTicketSaleView(sale({ stage: 'presale', label: 'My Day 會員預購', eligibility: 'fanclub_member', platform: 'tixcraft', url: 'https://tixcraft.com/a', eligibilityNote: '須先在 FANS 完成預購登記', startsAt: '2026-11-28T12:00:00+08:00' }), now)
  assert.equal(view.stageLabel, '預購'); assert.equal(view.eligibilityLabel, '官方會員'); assert.equal(view.platformName, '拓元售票')
  assert.equal(view.timeLabel, '11/28（六）12:00'); assert.equal(view.unknownPlatformWarning, null)
  assert.equal(ts.toTicketSaleView(sale({ url: 'https://evil-tixcraft.com/a' }), now).unknownPlatformWarning, '非已知官方售票平台')
  assert.deepEqual(Object.values(ts.ELIGIBILITY_LABELS).sort(), ['信用卡', '公開', '合作平台', '主辦會員', '官方會員', '抽選', '須先登記', '電信會員'].sort())
  // 排序：依開賣時間，無時間放最後
  assert.deepEqual(ts.sortTicketSales([sale({ label: 'b' }), sale({ label: 'late', startsAt: '2026-12-01T00:00:00Z' }), sale({ label: 'early', startsAt: '2026-11-01T00:00:00Z' })]).map(s => s.label), ['early', 'late', 'b'])
  // 前置提醒：只列平台表有寫的（ibon 沒寫 → 不列）
  assert.deepEqual(ts.platformPrerequisites([sale({ platform: 'tixcraft' }), sale({ url: 'https://ticket.ibon.com.tw/x' }), sale({ platform: 'tixcraft' })], 'https://farglorycreative.kktix.cc/e').map(p => p.code), ['tixcraft', 'kktix'])
  // 防詐提醒：有 sales 或 ticket_url 就顯示
  assert.equal(ts.hasTicketInfo([], null), false); assert.equal(ts.hasTicketInfo([], ' '), false)
  assert.equal(ts.hasTicketInfo([sale()], null), true); assert.equal(ts.hasTicketInfo([], 'https://tixcraft.com/a'), true)
  assert.equal(TICKET_SAFETY_NOTICE, '只在下列官方平台購票；主辦不會用私訊或社群要求匯款；轉讓票請避開來路不明的賣家。')
})

test('A-3 開賣徽章：只取未來最近一列，沒有就不顯示', () => {
  const now = new Date('2026-11-25T08:00:00Z')
  assert.equal(ts.nextTicketSaleBadge(['2026-11-28T12:00:00+08:00', '2026-11-26T12:00:00+08:00', '2026-11-20T12:00:00+08:00'], now), '11/26 12:00 開賣')
  assert.equal(ts.nextTicketSaleBadge(['2026-11-20T12:00:00+08:00'], now), null)
  assert.equal(ts.nextTicketSaleBadge([], now), null)
  assert.equal(ts.nextTicketSaleBadge(undefined, now), null)
  assert.equal(ts.nextTicketSaleBadge([null, 'bad'], now), null)
})

test('A-4 後台售票階段：台北時間轉換、http(s)、重複 stage＋label 擋存檔、警示不擋', () => {
  assert.equal(ts.taipeiLocalToIso('2026-11-28T12:00'), '2026-11-28T12:00:00+08:00')
  assert.equal(ts.taipeiLocalToIso(''), null)
  assert.equal(ts.taipeiLocalToIso('2026-02-30T12:00'), undefined)
  assert.equal(ts.isoToTaipeiLocal('2026-11-28T04:00:00Z'), '2026-11-28T12:00')
  const row = (over = {}) => ({ ...form.emptyTicketSaleFormRow(), label: '一般售票', ...over })
  const ok = form.validateTicketSaleRows([row({ startsAt: '2026-11-28T12:00', url: 'https://example.com/x' }), row({ stage: 'presale', label: '一般售票' })])
  assert.equal(ok.ok, true)
  assert.equal(ok.rows[0].starts_at, '2026-11-28T12:00:00+08:00')
  assert.equal(ok.rows[0].url, 'https://example.com/x') // 非官方網域不擋存檔
  assert.equal(form.ticketSaleRowWarning({ url: 'https://example.com/x' }), '非已知官方售票平台')
  assert.equal(form.ticketSaleRowWarning({ url: 'https://tixcraft.com/x' }), null)
  assert.match(form.validateTicketSaleRows([row(), row({ label: ' 一般售票 ' })]).error, /相同/)
  assert.match(form.validateTicketSaleRows([row({ url: 'javascript:alert(1)' })]).error, /http/)
  assert.match(form.validateTicketSaleRows([row({ label: ' ' })]).error, /名稱/)
  assert.match(form.validateTicketSaleRows([row({ startsAt: '2026-11-28T12:00', endsAt: '2026-11-28T11:00' })]).error, /結束時間/)
  assert.match(form.validateTicketSaleRows([row({ eligibility: 'vip' })]).error, /資格/)
  const plan = form.planTicketSaleChanges(['a', 'b'], [{ ...ok.rows[0], id: 'a' }, { ...ok.rows[1], id: null }])
  assert.deepEqual(plan.deleteIds, ['b']); assert.equal(plan.updates[0].id, 'a'); assert.equal(plan.inserts.length, 1); assert.equal('id' in plan.inserts[0], false)
  assert.equal(form.planTicketSaleChanges([], [{ ...ok.rows[0], id: 'zzz' }]).ok, false)
})

// ── B-2 白名單、B-4 去重 ──────────────────────────────────────────────────────
const NOW = new Date('2026-11-25T02:00:00Z')
const IDOL = { id: 'i', name: 'TWICE', is_active: true }
const CS_JYP = { id: 'cs-jyp', source_key: 'jyp', name: 'TWICE JYP Notice', parser_type: 'jyp_notice', source_type: 'official_website', source_url: 'https://twice.jype.com/notice' }
const CS_YG = { id: 'cs-yg', source_key: 'yg-notice', name: 'YG Notice', parser_type: 'yg_notice', source_type: 'official_website', source_url: 'https://www.ygfamily.com/ko/news/notice' }
const CS_YG_MEDIA = { ...CS_YG, id: 'cs-yg-media', name: 'YG Notice mirror', source_type: 'media_outlet', source_url: 'https://news.example.com/yg' }
const CS_KAO = { id: 'cs-kao', source_key: 'kaoarena-venue-calendar', name: '高雄巨蛋行事曆', parser_type: 'venue_calendar', source_type: 'official_website', source_url: 'https://www.kaoarena.com.tw/Home/CalendarList' }
const CS_KAO_COMM = { ...CS_KAO, id: 'cs-kao-comm', name: 'Venue fan wiki', source_type: 'community', source_url: 'https://wiki.example.com/venue' }
const CS_KAO_NOTYPE = { ...CS_KAO, id: 'cs-kao-x', name: 'Venue mirror', source_type: 'unknown', source_url: 'https://x.example.com/venue' }
const SOURCES = [CS_JYP, CS_YG, CS_YG_MEDIA, CS_KAO, CS_KAO_COMM, CS_KAO_NOTYPE]
const cand = (cs, over = {}) => ({ id: 'c1', review_status: 'pending', raw_title: 'TWICE Fan Meeting', raw_content: null,
  raw_data: { crawler_source_id: cs.id, parser_type: cs.parser_type }, detected_idol_id: 'i', detected_event_type: 'concert', detected_date: '2026-12-19',
  detected_city: '高雄', detected_venue_name: '高雄巨蛋', detected_address: null, location_name_zh: null,
  source_url: `${cs.source_url}#a`, source_name: cs.name, source_type: cs.source_type, ai_confidence: null, approved_event_id: null, created_at: '2026-11-20T00:00:00Z', ...over })
const ctxWith = (events = [], eventSources = []) => ({ now: NOW, idols: [IDOL], crawlerSources: SOURCES, events, eventSources })

test('B-2 yg_notice／venue_calendar 加入白名單：官方來源放行、非官方仍 park', () => {
  assert.ok(NULL_CONFIDENCE_OK_PARSERS.includes('yg_notice') && NULL_CONFIDENCE_OK_PARSERS.includes('venue_calendar'))
  for (const cs of [CS_YG, CS_KAO]) {
    const d = evaluateCandidate(cand(cs), ctxWith())
    assert.equal(d.action, 'publish_official', cs.id); assert.equal(d.trustLevel, 'official')
  }
  // 媒體等級的 YG 鏡像：不再是 unknown_source，但 OFFICIAL_TIER_ONLY → 仍 unknown_parser
  const media = evaluateCandidate(cand(CS_YG_MEDIA), ctxWith())
  assert.equal(media.action, 'park'); assert.equal(media.parkReason, 'unknown_parser')
  const comm = evaluateCandidate(cand(CS_KAO_COMM), ctxWith())
  assert.equal(comm.action, 'park'); assert.equal(comm.parkReason, 'aggregator_not_allowlisted'); assert.ok(comm.allReasons.includes('unknown_parser'))
  const unknown = evaluateCandidate(cand(CS_KAO_NOTYPE), ctxWith())
  assert.equal(unknown.action, 'park'); assert.equal(unknown.parkReason, 'unknown_source')
  // 其他 parser 不受影響：未知 parser 照樣 unknown_parser
  const other = evaluateCandidate(cand({ ...CS_JYP, id: 'cs-x', parser_type: 'mystery' }, { raw_data: { crawler_source_id: 'cs-x', parser_type: 'mystery' } }), { ...ctxWith(), crawlerSources: [...SOURCES, { ...CS_JYP, id: 'cs-x', parser_type: 'mystery' }] })
  assert.equal(other.parkReason, 'unknown_parser')
})

test('B-4 同藝人＋同日＋同城：不論標題語言，命中已發布活動 → merge；命中草稿 → duplicate；命中封鎖 → skip', () => {
  assert.equal(canonicalCityKey('Taipei'), '台北'); assert.equal(canonicalCityKey('臺北市'), '台北'); assert.equal(canonicalCityKey('新加坡'), 'singapore')
  assert.ok(isSameShow({ idolId: 'i', date: '2026-12-19', city: 'Kaohsiung' }, { idolId: 'i', date: '2026-12-19T00:00:00', city: '高雄' }))
  assert.ok(isSameShow({ idolId: 'i', date: '2026-12-19', venue: 'K-ARENA 高雄巨蛋' }, { idolId: 'i', date: '2026-12-19', venue: 'k-arena  高雄巨蛋' }))
  assert.ok(!isSameShow({ idolId: 'i', date: '2026-12-19', city: '高雄' }, { idolId: 'j', date: '2026-12-19', city: '高雄' }))
  assert.ok(!isSameShow({ idolId: 'i', date: '2026-12-19', city: '高雄' }, { idolId: 'i', date: '2026-12-20', city: '高雄' }))
  assert.ok(!isSameShow({ idolId: 'i', date: '2026-12-19' }, { idolId: 'i', date: '2026-12-19' }))
  const ev = (over) => ({ id: 'e1', idol_id: 'i', title: 'TWICE WORLD TOUR IN KAOHSIUNG', date: '2026-12-19', is_published: true, trust_level: 'aggregator', status: 'confirmed', auto_publish_blocked: false, city: 'Kaohsiung', venue_name: null, ...over })
  const c = cand(CS_JYP, { raw_title: 'TWICE 高雄演唱會' })
  assert.deepEqual(evaluateCandidate(c, ctxWith([ev()])), { ruleVersion: 't34-v2', candidateId: 'c1', crawlerSourceId: 'cs-jyp', parserType: 'jyp_notice', action: 'merge', trustLevel: 'official', existingEventId: 'e1', mergeWithCandidateId: null })
  assert.equal(evaluateCandidate(c, ctxWith([ev({ is_published: false, trust_level: 'pending' })])).parkReason, 'duplicate')
  assert.deepEqual(evaluateCandidate(c, ctxWith([ev({ is_published: false, auto_publish_blocked: true })])).skipReason, 'auto_publish_blocked')
  assert.equal(evaluateCandidate(c, ctxWith([ev({ status: 'cancelled' })])).action, 'publish_official')
  assert.equal(evaluateCandidate(c, ctxWith([ev({ city: 'Taipei' })])).action, 'publish_official')
  assert.equal(evaluateCandidate(c, ctxWith([ev(), ev({ id: 'e2' })])).parkReason, 'duplicate')
  // 可能重複清單：同藝人同日同城（跨語言）
  const groups = groupPossibleDuplicates([ev(), ev({ id: 'e2', city: '高雄' }), ev({ id: 'e3', city: 'Taipei' }), ev({ id: 'e4', idol_id: 'j' })])
  assert.deepEqual(groups.map(g => g.map(e => e.id)), [['e1', 'e2']])
})

function fixture(candidates, events = [], over = {}) {
  const calls = []
  let n = 0
  const impl = {
    readAutoPublishEnabled: async () => ({ enabled: true }),
    loadContext: async () => ({ candidates, ctx: ctxWith(events), idolNames: new Map([['i', 'TWICE']]) }),
    getEvent: async id => events.find(e => e.id === id) ?? null,
    insertDraftEvent: async () => ({ id: `new-${++n}` }), linkCandidate: async () => ({ updated: 1 }), hasEventSourceUrl: async () => false,
    insertEventSource: async () => ({ ok: true }), insertTicketSale: async () => ({ ok: true }), publishEvent: async () => ({ updated: 1 }),
    fillEventLocation: async () => ({ updated: 1 }), markCandidateApproved: async () => ({ updated: 1 }), parkCandidate: async () => ({ updated: 1 }), ...over,
  }
  const store = Object.fromEntries(Object.entries(impl).map(([name, fn]) => [name, async (...args) => { calls.push({ name, args: structuredClone(args) }); return fn(...args) }]))
  return { calls, args: name => calls.filter(c => c.name === name).map(c => c.args), run: () => runAutoPublish(store, { touched: candidates.map(c => touchedFromPayload(c.id, 'cs', 'unchanged', {})), now: NOW }) }
}

test('B-4 同批兩個候選（英文／中文標題、Taipei／台北）只產生一列活動，另一個併成來源', async () => {
  const a = cand(CS_JYP, { id: 'c-en', raw_title: 'TWICE WORLD TOUR IN TAIPEI', detected_city: 'Taipei', detected_venue_name: 'Taipei Dome', created_at: '2026-11-20T00:00:00Z', source_url: 'https://twice.jype.com/notice/1' })
  const b = cand(CS_YG, { id: 'c-zh', raw_title: 'TWICE 台北大巨蛋演唱會', detected_city: '台北', detected_venue_name: '臺北大巨蛋', created_at: '2026-11-21T00:00:00Z', source_url: 'https://www.ygfamily.com/notice/2' })
  const d = evaluateCandidates([b, a], ctxWith())
  assert.equal(d[0].action, 'merge'); assert.equal(d[0].mergeWithCandidateId, 'c-en'); assert.equal(d[1].action, 'publish_official')
  const f = fixture([b, a]); const r = await f.run()
  assert.equal(f.args('insertDraftEvent').length, 1)
  assert.equal(r.created.length, 1); assert.deepEqual(r.merged, [{ candidateId: 'c-zh', eventId: 'new-1', sourceAdded: true }])
  assert.deepEqual(f.args('insertEventSource').map(([row]) => [row.event_id, row.url]), [['new-1', 'https://twice.jype.com/notice/1'], ['new-1', 'https://www.ygfamily.com/notice/2']])
  assert.deepEqual(f.args('linkCandidate').map(([id, eventId]) => [id, eventId]), [['c-en', 'new-1'], ['c-zh', 'new-1']])
  // 已存在的已發布活動：不建新列、只加來源（已有同網址就不重複加）
  const existing = { id: 'e1', idol_id: 'i', title: 'TWICE 台北場', date: '2026-12-19', is_published: true, trust_level: 'official', status: 'confirmed', auto_publish_blocked: false, city: '台北', venue_name: null }
  const g = fixture([a], [existing], { hasEventSourceUrl: async () => true }); const r2 = await g.run()
  assert.equal(g.args('insertDraftEvent').length, 0); assert.equal(g.args('insertEventSource').length, 0)
  assert.deepEqual(r2.merged, [{ candidateId: 'c-en', eventId: 'e1', sourceAdded: false }])
  // 同批較早那一場沒有上架（寫入失敗）→ 後一個 park duplicate，不另建
  const h = fixture([b, a], [], { insertDraftEvent: async () => ({ error: 'denied' }) }); const r3 = await h.run()
  assert.equal(h.args('insertDraftEvent').length, 1); assert.equal(r3.parked.duplicate, 1)
})

// ── B-1／B-3 建活動帶入國家、時間、售票 ─────────────────────────────────────
test('B-1 create_event 填 country_code／country／country_flag；推不出來保持 NULL 與 ""', async () => {
  for (const [city, venue] of [['台北', null], ['高雄', null], ['桃園', null], [null, '林口體育館']]) {
    const f = fixture([cand(CS_JYP, { detected_city: city, detected_venue_name: venue })]); await f.run()
    const [row] = f.args('insertDraftEvent')[0]
    assert.deepEqual([row.country_code, row.country, row.country_flag, row.time_status, row.time], ['TW', '台灣', '🇹🇼', 'unknown', null], `${city}/${venue}`)
  }
  const f = fixture([cand(CS_JYP, { detected_city: 'Auckland', detected_venue_name: 'Spark Arena' })]); await f.run()
  const [row] = f.args('insertDraftEvent')[0]
  assert.deepEqual([row.country_code, row.country, row.country_flag], [null, '', ''])
})

test('B-3 venue_calendar：show_time → time＋announced；官方 ticket_url → ticket_url；on_sale 一般售票 → 一列 event_ticket_sales', async () => {
  const raw = { crawler_source_id: 'cs-kao', parser_type: 'venue_calendar', show_time: '18:00', ticket_url: 'https://tixcraft.com/activity/detail/26_topkh', price_text: '5800',
    on_sale: [{ label: '官方會員 TOPSX 預購', starts_at: '2026-10-03T12:00:00+08:00', ends_at: '2026-10-03T23:59:00+08:00' }, { label: '全面開賣', starts_at: '2026-10-04T12:00:00+08:00', ends_at: null }] }
  const c = cand(CS_KAO, { raw_title: 'T.O.P 高雄演唱會', raw_data: raw, source_url: 'https://www.kaoarena.com.tw/Home/CalendarDetail?id=99' })
  const f = fixture([c]); await f.run()
  const [row] = f.args('insertDraftEvent')[0]
  assert.equal(row.time, '18:00'); assert.equal(row.time_status, 'announced'); assert.equal(row.ticket_url, 'https://tixcraft.com/activity/detail/26_topkh')
  assert.equal(row.country_code, 'TW')
  assert.deepEqual(f.args('insertTicketSale').map(([s]) => s), [{ event_id: 'new-1', stage: 'general', label: '全面開賣', starts_at: '2026-10-04T12:00:00+08:00', ends_at: null, platform: 'tixcraft', url: 'https://tixcraft.com/activity/detail/26_topkh', eligibility: 'public', source_url: 'https://www.kaoarena.com.tw/Home/CalendarDetail?id=99' }])
  // 售票寫入失敗不擋上架
  const g = fixture([c], [], { insertTicketSale: async () => ({ error: 'relation does not exist' }) }); const r = await g.run()
  assert.equal(r.created.length, 1); assert.equal(r.errors[0].step, 'ticket_sale')
  // 沒抽到就留空；非官方網域不帶入
  assert.deepEqual(venueCalendarFields({ raw_data: { show_time: undefined, ticket_url: 'https://evil-tixcraft.com/x' }, source_url: null }, 'venue_calendar'), { time: null, timeStatus: null, ticketUrl: null, sale: null })
  assert.deepEqual(venueCalendarFields({ raw_data: raw, source_url: null }, 'jyp_notice'), { time: null, timeStatus: null, ticketUrl: null, sale: null })
  assert.equal(venueCalendarFields({ raw_data: { on_sale: [{ label: '會員預購', starts_at: '2026-10-03T12:00:00+08:00' }] }, source_url: null }, 'venue_calendar').sale, null)
  assert.equal(venueCalendarFields({ raw_data: { show_time: '25:00' }, source_url: null }, 'venue_calendar').time, null)
  // 其他來源不寫售票
  const h = fixture([cand(CS_JYP)]); await h.run(); assert.equal(h.args('insertTicketSale').length, 0)
})

// ── B-5 林口 → 桃園 ──────────────────────────────────────────────────────────
test('B-5 林口體育館／Linkou Arena 歸桃園', () => {
  assert.equal(inferTaiwanCity({ title: 'K-WONDER BAND STAGE', venueName: '林口體育館' }), '桃園')
  assert.equal(inferTaiwanCity({ title: 'BOYNEXTDOOR TOUR', venueName: 'Linkou Arena' }), '桃園')
  assert.equal(inferTaiwanCity({ title: 'X', venueName: 'Zepp New Taipei' }), '新北')
})

// ── migration 073 靜態檢查 ───────────────────────────────────────────────────
test('migration 073 靜態檢查', () => {
  const sql = readFileSync(new URL('../supabase/migrations/073_t35_ticket_sales_country_time_status.sql', import.meta.url), 'utf8')
  const body = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
  const has = (re) => assert.match(body, re, String(re))
  has(/ADD COLUMN IF NOT EXISTS country_code text/)
  has(/ADD COLUMN IF NOT EXISTS time_status\s+text NOT NULL DEFAULT 'unknown'/)
  has(/DROP CONSTRAINT IF EXISTS events_country_code_chk[\s\S]*CHECK \(country_code IS NULL OR country_code ~ '\^\[A-Z\]\{2\}\$'\)/)
  has(/DROP CONSTRAINT IF EXISTS events_time_status_chk[\s\S]*CHECK \(time_status IN \('unknown', 'announced', 'tba'\)\)/)
  for (const [zh, code] of [['台灣', 'TW'], ['香港', 'HK'], ['新加坡', 'SG'], ['馬來西亞', 'MY'], ['日本', 'JP'], ['韓國', 'KR']]) has(new RegExp(`WHEN '${zh}'\\s+THEN '${code}'`))
  has(/WHERE country_code IS NULL/)
  has(/GRANT UPDATE \(country_code, time_status\) ON public\.events TO authenticated/)
  const table = body.match(/CREATE TABLE IF NOT EXISTS public\.event_ticket_sales \(([\s\S]*?)\n\);/)[1]
  for (const col of ['id', 'event_id', 'stage', 'label', 'starts_at', 'ends_at', 'platform', 'url', 'eligibility', 'eligibility_note', 'requires_verification', 'source_url', 'verified_at', 'created_at', 'updated_at']) {
    assert.match(table, new RegExp(`^\\s+${col}\\s`, 'm'), col)
  }
  assert.match(table, /id\s+uuid\s+PRIMARY KEY DEFAULT gen_random_uuid\(\)/)
  assert.match(table, /event_id\s+uuid\s+NOT NULL REFERENCES public\.events\(id\) ON DELETE CASCADE/)
  assert.match(table, /CHECK \(stage IN \('presale', 'general', 'added', 'apply', 'other'\)\)/)
  assert.match(table, /eligibility\s+text\s+NOT NULL DEFAULT 'public'/)
  assert.match(table, /CHECK \(eligibility IN \('public', 'fanclub_member', 'promoter_member', 'telco_member', 'card_or_sponsor', 'partner_platform', 'registration_required', 'lottery'\)\)/)
  assert.match(table, /CHECK \(requires_verification IN \('phone_sms', 'real_name', 'member_login', 'other'\)\)/)
  assert.match(table, /UNIQUE \(event_id, stage, label\)/)
  assert.doesNotMatch(table, /platform[^\n]*CHECK/)
  has(/ON public\.event_ticket_sales \(event_id\)/); has(/ON public\.event_ticket_sales \(starts_at\)/)
  has(/BEFORE UPDATE ON public\.event_ticket_sales\s+FOR EACH ROW EXECUTE FUNCTION public\.set_updated_at\(\)/)
  for (const t of ['event_ticket_sales', 'event_artists']) {
    has(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`))
    has(new RegExp(`DROP POLICY IF EXISTS "${t}: public read via published events"[\\s\\S]*CREATE POLICY "${t}: public read via published events"\\s+ON public\\.${t} FOR SELECT\\s+TO anon, authenticated[\\s\\S]*?e\\.is_published = true[\\s\\S]*?trust_level IN \\('official', 'media', 'aggregator'\\)`))
    has(new RegExp(`CREATE POLICY "${t}: admin_users all"\\s+ON public\\.${t} FOR ALL\\s+TO authenticated\\s+USING \\([\\s\\S]*?admin_users\\.is_active = true[\\s\\S]*?WITH CHECK`))
    has(new RegExp(`GRANT SELECT ON public\\.${t} TO anon`))
    has(new RegExp(`GRANT SELECT, INSERT, UPDATE, DELETE ON public\\.${t} TO authenticated`))
    has(new RegExp(`GRANT SELECT, INSERT ON public\\.${t} TO service_role`))
  }
  const artists = body.match(/CREATE TABLE IF NOT EXISTS public\.event_artists \(([\s\S]*?)\n\);/)[1]
  assert.match(artists, /event_id\s+uuid\s+NOT NULL REFERENCES public\.events\(id\) ON DELETE CASCADE/)
  assert.match(artists, /idol_id\s+uuid\s+NOT NULL REFERENCES public\.idols\(id\)\s+ON DELETE CASCADE/)
  assert.match(artists, /role\s+text\s+NOT NULL DEFAULT 'participant'\s+CHECK \(role IN \('headliner', 'participant'\)\)/)
  assert.match(artists, /PRIMARY KEY \(event_id, idol_id\)/)
  has(/ON public\.event_artists \(idol_id, event_id\)/)
  has(/INSERT INTO public\.event_artists \(event_id, idol_id, role, sort_order\)\s+SELECT id, idol_id, 'headliner', 0\s+FROM public\.events\s+WHERE idol_id IS NOT NULL\s+ON CONFLICT DO NOTHING/)
  has(/SECURITY DEFINER\s+SET search_path = public/)
  has(/DELETE FROM public\.event_artists\s+WHERE event_id = NEW\.id AND idol_id = OLD\.idol_id AND role = 'headliner'/)
  has(/DROP TRIGGER IF EXISTS trg_events_sync_headliner_artist ON public\.events;\s+CREATE TRIGGER trg_events_sync_headliner_artist\s+AFTER INSERT OR UPDATE OF idol_id ON public\.events/)
  // 不自動從 ticket_url 產生 sales；不加同場唯一索引
  assert.doesNotMatch(body, /INSERT INTO public\.event_ticket_sales/)
  assert.doesNotMatch(body, /CREATE UNIQUE INDEX/)
  // 檔頭：回滾與匿名讀測試（註解）
  assert.match(sql, /回滾 SQL[\s\S]*--\s+DROP TABLE IF EXISTS public\.event_ticket_sales;/)
  assert.match(sql, /--\s+BEGIN;[\s\S]*--\s+SET LOCAL ROLE anon;[\s\S]*--\s+ROLLBACK;/)
})
