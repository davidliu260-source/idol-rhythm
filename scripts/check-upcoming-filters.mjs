import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })
const f = await import('../src/lib/upcomingFilters.ts')
const u = await import('../src/lib/upcomingEvents.ts')
const { EVENT_CATEGORY_ORDER: order, getEventCategory } = await import('../src/lib/eventCategory.ts')
const now = new Date(2026, 10, 12, 10, 0, 0)
function immutable(value, check) {
  for (const item of Object.values(value)) if (item && typeof item === 'object') Object.freeze(item)
  Object.freeze(value)
  const before = JSON.stringify(value)
  check(value)
  assert.equal(JSON.stringify(value), before)
}
const ev = (id, extra = {}) => ({ id, date: '2026-11-12', idolId: 'a', ...extra })
const variants = [{ type: 'concert' }, { subType: 'popup_store' }, { subType: 'fanmeet' }, { subType: 'birthday_cafe' }, { subType: 'exhibition' }, { type: 'ticketing' }, { type: 'livestream' }]
const seven = variants.map((v, i) => ev(String(i), v))
immutable([], input => {
  const counts = f.countUpcomingByCategory(input, now)
  assert.equal(counts.total, 0)
  assert.deepEqual(Object.values(counts.byCategory), Array(7).fill(0))
  assert.deepEqual(f.getVisibleCategories(counts, 'all'), [])
})
console.log('PASS 空清單、七類為零')
immutable([...seven, ev('award', { subType: 'award' }), ev('sign', { subType: 'fansign' }), ev('past', { date: '2026-11-11' }), ev('invalid', { date: 'invalid' })], input => {
  const counts = f.countUpcomingByCategory(input, now)
  assert.equal(counts.total, 9)
  assert.deepEqual(Object.values(counts.byCategory), [2, 1, 2, 1, 1, 1, 1])
  assert.equal(counts.total, Object.values(counts.byCategory).reduce((a, b) => a + b, 0))
  assert.deepEqual(f.countUpcomingByCategory(u.listUpcomingEvents(input, now), now), counts)
  assert.deepEqual(Object.keys(counts.byCategory).sort(), [...order].sort())
  for (const cat of order) assert.equal(counts.byCategory[cat], input.filter(e => e.date === '2026-11-12' && getEventCategory(e) === cat).length)
})
console.log('PASS 七類對應、award／fansign、今天／過去／無效日期、總和、冪等、無 ad key')
for (const size of [1, 2, 7]) immutable(seven.slice(0, size), input => {
  const counts = f.countUpcomingByCategory(input, now)
  immutable(counts.byCategory, () => immutable(counts, () => {
    assert.deepEqual(f.getVisibleCategories(counts, 'all'), order.slice(0, size))
    if (size === 2) {
      assert.deepEqual(f.getVisibleCategories(counts, 'exhibition'), ['concert', 'popup', 'exhibition'])
      assert.deepEqual(f.getVisibleCategories(counts, 'fanmeet'), ['concert', 'popup', 'fanmeet'])
      assert.deepEqual(f.getVisibleCategories(counts, 'concert'), ['concert', 'popup'])
    }
  }))
})
console.log('PASS 一／二／七類、隱藏零場、選中零場保留順序且不重複')
immutable([...seven, ev('last', { type: 'concert', idolId: 'b' })], input => {
  const all = f.filterByCategory(input, 'all')
  assert.deepEqual(all, input)
  assert.notEqual(all, input)
  assert.deepEqual(f.filterByCategory(input, 'concert').map(e => e.id), ['0', 'last'])
  immutable(['a'], ids => {
    for (const cat of [...order, 'all']) assert.deepEqual(f.filterByCategory(u.filterFollowedEvents(input, ids), cat), u.filterFollowedEvents(f.filterByCategory(input, cat), ids))
  })
})
immutable([seven[0]], input => assert.deepEqual(f.filterByCategory(input, 'popup'), []))
console.log('PASS 全部淺拷貝、類型過濾順序、無資料、追蹤疊加、所有輸入不 mutate')
console.log('OK T30d upcoming filters 檢查全部通過')
