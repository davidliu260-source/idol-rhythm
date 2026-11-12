import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context)
  }
  return nextResolve(specifier, context)
} })
const u = await import('../src/lib/upcomingEvents.ts')
const { getHeroDateParts, getHeroVenueLabel } = await import('../src/lib/nextEventHero.ts')
const now = new Date(2026, 10, 12, 10, 0, 0)
const ev = (id, date = '2026-11-12', extra = {}) => ({ id, date, idolId: 'neutral', ...extra })
function immutable(input, check) {
  input.forEach(Object.freeze)
  Object.freeze(input)
  const before = JSON.stringify(input)
  check(input)
  assert.equal(JSON.stringify(input), before)
}
immutable([], input => assert.deepEqual(u.listUpcomingEvents(input, now), []))
console.log('PASS 空清單')
for (const total of [1, 9, 10, 30, 35]) {
  immutable(Array.from({ length: total }, (_, i) => ev(String(i))), input => {
    const events = u.listUpcomingEvents(input, now)
    assert.equal(events.length, total)
    assert.equal(u.getVisibleEvents(events, false).length, Math.min(total, 9))
    assert.equal(u.getRemainingCount(total, false), Math.max(0, total - 9))
    assert.equal(u.getVisibleEvents(events, true).length, total)
    assert.equal(u.getRemainingCount(total, true), 0)
  })
  console.log(`PASS ${total} 場：收合、剩餘、展開、輸入不變`)
}
immutable([ev('future', '2026-11-13'), ev('none'), ev('blank', undefined, { time: '  ' }), ev('b', undefined, { time: ' 12:00 ' }), ev('a', undefined, { time: '12:00' }), ev('early', undefined, { time: '09:00' }), ev('yesterday', '2026-11-11'), ev('ongoing', '2026-11-10', { endDate: '2026-11-20' }), ...['', 'abc', '2026-02-30'].map((date, i) => ev(`invalid${i}`, date))], input => {
  assert.deepEqual(u.listUpcomingEvents(input, now).map(e => e.id), ['early', 'a', 'b', 'blank', 'none', 'future'])
})
console.log('PASS 日期／時間／id 排序、今天列入、昨天／無效日期／進行中多日排除')
immutable([ev('a', undefined, { idolId: 'one' }), ev('b'), ev('c', undefined, { idolId: 'one' })], input => {
  assert.deepEqual(u.filterFollowedEvents(input, Object.freeze(['one'])).map(e => e.id), ['a', 'c'])
  assert.deepEqual(u.filterFollowedEvents(input, []), [])
  assert.equal(u.getVisibleEvents(input, false, 2).length, 2)
  assert.equal(u.getRemainingCount(3, false, 2), 1)
})
console.log('PASS 追蹤過濾保持排序、自訂 limit、輸入不變')
assert.equal(u.formatListMeta('12:00', '台北信義'), '12:00　台北信義')
assert.equal(u.formatListMeta('時間未定', null), '時間未定')
assert.equal(u.formatListMeta('12:00', null), '12:00')
const date = getHeroDateParts(ev('date'))
assert.deepEqual([`${date.month}月`, String(date.day), `週${date.weekday}`, date.timeLabel], ['11月', '12', '週四', '時間未定'])
assert.equal(getHeroVenueLabel({ venueName: ' 場館 ', location: '地點' }), '場館')
assert.equal(getHeroVenueLabel({ location: ' 地點 ' }), '地點')
assert.equal(getHeroVenueLabel({}), null)
console.log('PASS meta、缺時間、日期分段、場館優先與缺漏')
console.log('OK T30c upcoming events 檢查全部通過')
