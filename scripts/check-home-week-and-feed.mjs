// 檢查 T30g 本週條／最新發佈／已結束規則：node scripts/check-home-week-and-feed.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })
const h = await import('../src/lib/homeWeekAndFeed.ts')
const { EVENT_CATEGORY_ORDER } = await import('../src/lib/eventCategory.ts')
const now = new Date(2026, 10, 12, 10, 0, 0)
const DAY = 86_400_000
const ago = ms => new Date(now.getTime() - ms).toISOString()
const ev = (id, extra = {}) => ({ id, date: '2026-11-12', publishedAt: ago(DAY), ...extra })
const test = (name, check) => { check(); console.log(`PASS ${name}`) }
const samples = { concert: { type: 'concert' }, popup: { type: 'brand', subType: 'popup_store' }, fanmeet: { type: 'concert', subType: 'fanmeet' }, exhibition: { subType: 'exhibition' }, ticket: { type: 'ticketing' }, other: { type: 'media' } }
const crowded = ['other', 'ticket', 'exhibition', 'popup', 'concert', 'concert'].map((id, i) => ev(String(i), samples[id]))
const five = [1, 3, 2, 5, 4].map(days => ev(String(days), { publishedAt: ago(days * DAY) }))
const ended = [ev('ongoing', { date: '2026-11-01', endDate: '2026-11-20' }), ev('past', { date: '2026-11-01', endDate: '2026-11-11' }), ev('today', { date: '2026-11-01', endDate: '2026-11-12' })]
test('W1 七天含今天', () => { const days = h.getWeekDays(now); assert.deepEqual(days.map(d => d.key), Array.from({ length: 7 }, (_, i) => `2026-11-${12 + i}`)); assert.deepEqual(days.map(d => d.isToday), [true, false, false, false, false, false, false]) })
test('W2 一字星期', () => assert.deepEqual(h.getWeekDays(now).map(d => d.label), ['今天', '五', '六', '日', '一', '二', '三']))
test('W3 跨月年', () => { const last = h.getWeekDays(new Date(2026, 10, 28, 10))[6]; assert.deepEqual([last.key, last.month, last.day], ['2026-12-04', 12, 4]); assert.equal(h.getWeekDays(new Date(2026, 11, 29, 10))[6].key, '2027-01-04') })
test('W4 空日與鍵對齊', () => { const dots = h.getWeekDots([ev('one', { date: '2026-11-14' })], now); assert.deepEqual(dots.map(d => d.key), h.getWeekDays(now).map(d => d.key)); assert.equal(dots.filter(d => !d.categories.length).length, 6) })
test('W5 範圍外', () => assert.equal(h.hasWeekEvents([ev('y', { date: '2026-11-11' }), ev('far', { date: '2026-11-19' })], now), false))
test('W6 三點依 ORDER 去重', () => assert.deepEqual(h.getWeekDots(crowded, now)[0].categories, ['concert', 'popup', 'exhibition']))
test('W7 不足三點依 ORDER', () => assert.deepEqual(h.getWeekDots([ev('t', samples.ticket), ev('f', samples.fanmeet)], now)[0].categories, ['fanmeet', 'ticket']))
test('W8 篩選與全部', () => { assert.deepEqual(h.getWeekDots(crowded, now, 'exhibition').map(d => d.categories), [['exhibition'], [], [], [], [], [], []]); assert.deepEqual(h.getWeekDots(crowded, now, 'cafe').map(d => d.categories), Array.from({ length: 7 }, () => [])); assert.deepEqual(h.getWeekDots(crowded, now, 'all'), h.getWeekDots(crowded, now)) })
test('W9 開始日與非法日期', () => { const dots = h.getWeekDots([ev('range', { date: '2026-11-10', endDate: '2026-11-20' }), ev('iso', { date: '2026-11-13T19:00:00+09:00' }), ev('bad', { date: 'invalid' })], now); assert.equal(dots.filter(d => d.categories.length).length, 1); assert.deepEqual(dots[1].categories, ['other']) })
test('W10 空資料', () => { assert.equal(h.hasWeekEvents([], now), false); assert.deepEqual(h.getWeekDots([], now).map(d => d.categories), Array.from({ length: 7 }, () => [])) })
test('L1 十四天邊界', () => assert.deepEqual(h.listLatestPublished([ev('in', { publishedAt: ago(14 * DAY) }), ev('out', { publishedAt: ago(14 * DAY + 1) })], now).map(e => e.id), ['in']))
test('L2 非法 publishedAt', () => { for (const publishedAt of [undefined, null, '', 'not-a-date']) assert.deepEqual(h.listLatestPublished([ev('bad', { publishedAt })], now), []) })
test('L3 未結束與 endDate 優先', () => assert.deepEqual(h.listLatestPublished([ev('y', { date: '2026-11-11' }), ev('ongoing', { date: '2026-11-11', endDate: '2026-11-12' }), ev('today'), ev('inverted', { date: '2026-11-13', endDate: '2026-11-11' }), ev('bad-end', { endDate: 'bad' })], now).map(e => e.id), ['ongoing', 'today']))
test('L4 三筆排序與 id', () => { assert.deepEqual(h.listLatestPublished(five, now).map(e => e.id), ['1', '2', '3']); assert.deepEqual(h.listLatestPublished([ev('b'), ev('a')], now).map(e => e.id), ['a', 'b']) })
test('L5 不受類型影響', () => { assert.equal(h.listLatestPublished.length, 2); assert.equal(h.listLatestPublished([ev('c', samples.concert), ev('p', samples.popup), ev('t', samples.ticket)], now).length, 3) })
test('L6 NEW 邊界與未來', () => { for (const [publishedAt, expected] of [[ago(7 * DAY), true], [ago(7 * DAY + 1), false], [ago(-DAY), true], [undefined, false]]) assert.equal(h.isNewlyPublished(ev('n', { publishedAt }), now), expected) })
test('E1 日期計數', () => assert.equal(h.countEndedEvents([ev('y', { date: '2026-11-11' }), ev('t'), ev('f', { date: '2026-11-13' })], now), 1))
test('E2 endDate 優先', () => assert.equal(h.countEndedEvents(ended, now), 1))
test('E3 無法判斷', () => { assert.equal(h.isEventEnded(ev('bad', { date: 'bad' }), now), null); assert.equal(h.countEndedEvents([ev('bad', { date: 'bad' })], now), 0); assert.equal(h.countEndedEvents([], now), 0) })
test('E4 互斥', () => { const latest = h.listLatestPublished(ended, now); assert.equal(latest.some(e => h.isEventEnded(e, now)), false) })
function immutable(input, check) { input.forEach(Object.freeze); Object.freeze(input); const before = JSON.stringify(input); check(input); assert.equal(JSON.stringify(input), before) }
test('M1 輸入不變', () => { for (const input of [crowded, five, ended]) immutable(input, events => { h.getWeekDays(now); h.getWeekDots(events, now); h.hasWeekEvents(events, now); h.countEndedEvents(events, now); events.forEach(e => { h.isEventEnded(e, now); h.isNewlyPublished(e, now); h.parsePublishedAt(e.publishedAt) }); assert.notEqual(h.listLatestPublished(events, now), events) }) })
test('S1 原始碼護欄', () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  assert.ok(read('src/lib/types.ts').includes('publishedAt?: string'))
  assert.ok(read('src/lib/supabase/events.ts').includes('publishedAt: row.published_at'))
  const page = read('src/app/page.tsx')
  const positions = ['<HomeNextEventHero', '<HomeWeekStrip', '<HomeUpcomingList', '<HomeCategoryLegend', '<HomeFollowedIdols', '<HomeLatestPublished', '<HomePersonalized', '已結束'].map(s => page.indexOf(s))
  assert.ok(positions.every((p, i) => p >= 0 && (!i || p > positions[i - 1])))
  assert.ok(!page.includes('已歸檔'))
  for (const path of ['src/lib/homeWeekAndFeed.ts', 'src/components/HomeWeekStrip.tsx', 'src/components/HomeLatestPublished.tsx', 'src/app/page.tsx']) assert.ok(!read(path).includes('color-mix'))
  for (const text of ['toLocaleDateString', 'Intl.', 'new Date(event']) assert.ok(!read('src/lib/homeWeekAndFeed.ts').includes(text))
  assert.equal(EVENT_CATEGORY_ORDER.length, 7)
})
console.log('OK T30g 全部通過')
