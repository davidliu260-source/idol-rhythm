// 檢查 T30a 活動類型判斷與色彩 token：node scripts/check-event-category.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EVENT_CATEGORY_ORDER, EVENT_CATEGORIES, ALL_CATEGORY, CATEGORY_NEUTRALS, HERO_SCRIM_ALPHA, withAlpha, mixHex, relativeLuminance, contrastRatio, heroGradient, getCategoryTokens, getEventCategory } from '../src/lib/eventCategory.ts'

const order = ['concert', 'popup', 'fanmeet', 'cafe', 'exhibition', 'ticket', 'other']
const metadata = [
  ['演唱會', '#9a7cff', [['#5a2df0', 0], ['#a022b8', 55], ['#f0307f', 100]]],
  ['快閃店', '#ff9a3d', [['#f59e0b', 0], ['#e8481c', 100]]],
  ['見面會', '#f45da8', [['#ff5fae', 0], ['#cf1259', 100]]],
  ['生咖', '#2fcf9b', [['#12bd88', 0], ['#0a6f66', 100]]],
  ['展覽', '#4da3ff', [['#4f93ff', 0], ['#4034c4', 100]]],
  ['售票', '#ff5468', [['#ff5a6c', 0], ['#9c1530', 100]]],
  ['其他', '#9aa0b8', [['#2a2938', 0], ['#15141d', 100]]],
]
assert.deepEqual(EVENT_CATEGORY_ORDER, order)
assert.deepEqual(Object.keys(EVENT_CATEGORIES).sort(), [...order].sort())
assert.ok(!Object.keys(EVENT_CATEGORIES).includes('ad'))
order.forEach((id, i) => {
  const [label, accent, stops] = metadata[i]
  assert.deepEqual(EVENT_CATEGORIES[id], { id, label, accent, heroStops: stops.map(([color, at]) => ({ color, at })) })
  assert.notEqual(EVENT_CATEGORIES[id].label, '應援廣告')
})
assert.equal(heroGradient('concert'), 'linear-gradient(150deg, #5a2df0 0%, #a022b8 55%, #f0307f 100%)')
assert.equal(heroGradient('other'), 'linear-gradient(150deg, #2a2938 0%, #15141d 100%)')
assert.deepEqual(ALL_CATEGORY, { id: 'all', label: '全部', accent: '#e9e6f5', chipIconBackground: 'linear-gradient(135deg, #ff2d95, #8b5cf6 60%, #22d3ee)', legendBackground: '#1c1b27' })
assert.deepEqual(CATEGORY_NEUTRALS, { surface: '#15141d', surface2: '#1c1b27', line: 'rgba(255, 255, 255, 0.07)', text: '#f6f4fb', muted: '#a09db4', faint: '#8a87a0', tileBase: '#14131c', cardEnd: '#16151f', weekdayBase: '#c9c6dc', brandPink: '#ff2d95' })
assert.notEqual(CATEGORY_NEUTRALS.faint, '#6c6982')
assert.equal(HERO_SCRIM_ALPHA, 0.35)
console.log('PASS A 類型清單、固定 token 與漸層')

const edges = [
  ['E1', {type:'concert',subType:'fanmeet'}, 'fanmeet'],
  ['E2', {type:'concert',subType:'fansign'}, 'fanmeet'],
  ['E3', {type:'concert',subType:'award'}, 'concert'],
  ['E4', {type:'media',subType:'award'}, 'concert'],
  ['E5', {type:'ticketing',subType:'award'}, 'ticket'],
  ['E6', {type:'ticketing',subType:'fanmeet'}, 'fanmeet'],
  ['E7', {type:'brand',subType:'popup_store'}, 'popup'],
  ['E8', {type:'brand',subType:'exhibition'}, 'exhibition'],
  ['E9', {type:'brand',subType:'brand_event'}, 'other'],
  ['E10', {type:'brand'}, 'other'],
  ['E11', {type:'concert',subType:'musicshow'}, 'concert'],
  ['E12', {type:'media',subType:'musicshow'}, 'other'],
  ['E13', {type:'official',subType:'birthday_cafe'}, 'cafe'],
  ['E14', {type:'concert',subType:'birthday_cafe'}, 'cafe'],
  ['E15', {type:'concert',subType:null}, 'concert'],
  ['E16', {type:'concert',subType:''}, 'concert'],
  ['E17', {type:'ticketing',subType:undefined}, 'ticket'],
  ['E18', {}, 'other'], ['E19', null, 'other'], ['E20', undefined, 'other'],
  ['E21', {type:'CONCERT'}, 'other'],
  ['E22', {type:'festival',subType:'fan_ad'}, 'other'],
  ['E23', {type:'media',subType:'ad'}, 'other'],
  ['E24', {type:null,subType:'popup_store'}, 'popup'],
  ['E25', {type:'livestream',subType:'Fanmeet'}, 'other'],
]
function check(input, expected, label) {
  const before = structuredClone(input)
  const jsonBefore = JSON.stringify(input)
  if (input) Object.freeze(input)
  const result = getEventCategory(input)
  assert.equal(result, expected, label)
  assert.ok(order.includes(result), label)
  assert.notEqual(result, 'ad', label)
  assert.notEqual(result, 'all', label)
  assert.deepEqual(input, before, label)
  assert.equal(JSON.stringify(input), jsonBefore, label)
}
for (const [label, input, expected] of edges) check(input, expected, label)
// Independent lookup oracle: explicit subtype overrides, then type, then award fallback.
function expectedCategory({ type, subType }) {
  const overrides = new Map([['fanmeet','fanmeet'], ['fansign','fanmeet'], ['popup_store','popup'], ['exhibition','exhibition'], ['birthday_cafe','cafe']])
  const byType = new Map([['ticketing','ticket'], ['concert','concert']])
  return overrides.get(subType) ?? byType.get(type) ?? (subType === 'award' ? 'concert' : 'other')
}
const TYPES = ['concert','ticketing','livestream','streaming','media','brand','official',null,undefined,'','festival']
const SUBS = [null,undefined,'','fanmeet','fansign','musicshow','variety','interview','award','release','announcement','magazine','popup_store','exhibition','brand_event','birthday_cafe','fan_ad','unknown_x']
for (const type of TYPES) for (const subType of SUBS) {
  const input = {type, subType}
  check(input, expectedCategory(input), `${type}/${subType}`)
}
check({type:' concert'}, 'other', 'no trim')
console.log(`PASS B E1–E25、${TYPES.length * SUBS.length} 全組合、精確比對、輸入不變、從不回 ad/all`)
console.log('INFO birthday_cafe -> cafe（T4 預留；目前 EventSubType 無此值，正式資料不會出現生咖）')
console.log('INFO fanmeet/fansign -> fanmeet（首頁拆開；行事曆頁 matchesScheduleCategory 仍併入演唱會，等 T6）')

assert.equal(withAlpha('#9a7cff', 0.4), 'rgba(154, 124, 255, 0.4)')
assert.equal(withAlpha('#9A7CFF', 1), 'rgba(154, 124, 255, 1)')
assert.equal(withAlpha('#9a7cff', -1), 'rgba(154, 124, 255, 0)')
assert.equal(withAlpha('#9a7cff', 2), 'rgba(154, 124, 255, 1)')
for (const bad of ['9a7cff', '#fff', '#gggggg']) {
  assert.throws(() => withAlpha(bad, 0.4))
  assert.throws(() => mixHex(bad, '#ffffff', 0.4))
  assert.throws(() => mixHex('#ffffff', bad, 0.4))
}
assert.equal(mixHex('#9a7cff', '#16151f', 0.4), '#4b3e79')
assert.equal(mixHex('#9a7cff', '#000000', 0.6), '#5c4a99')
for (const w of [1, 2]) assert.equal(mixHex('#000000', '#ffffff', w), '#000000')
for (const w of [0, -1]) assert.equal(mixHex('#000000', '#ffffff', w), '#ffffff')
assert.equal(mixHex('#FFFFFF', '#000000', 0.5), '#808080')
assert.equal(relativeLuminance('#000000'), 0)
assert.equal(relativeLuminance('#ffffff'), 1)
assert.ok(Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 1e-9)
assert.equal(contrastRatio('#9a7cff', '#16151f'), contrastRatio('#16151f', '#9a7cff'))
const exact = [['#2c2645','#cfc0ff'], ['#3e2b22','#ffcfa2'], ['#3c2035','#fab1d5'], ['#193533','#9be8cf'], ['#1e2d45','#aad3ff'], ['#3e1f2a','#ffadb7'], ['#2c2c38','#cfd1dd']]
order.forEach((id, i) => {
  const t = getCategoryTokens(id), c = metadata[i][1]
  assert.deepEqual(t, {
    accent: c, heroBackground: heroGradient(id),
    cardBackground: `linear-gradient(100deg, #15141d 24%, ${mixHex(c, '#16151f', 0.4)} 100%)`,
    cardBorder: withAlpha(c, 0.22), cardGlow: `radial-gradient(circle, ${withAlpha(c, 0.38)}, transparent 70%)`,
    tileBackground: exact[i][0], tileBorder: withAlpha(c, 0.4), tileWeekday: mixHex(c, '#c9c6dc', 0.4), glyphColor: exact[i][1],
    chipIconBackground: `linear-gradient(145deg, ${c}, ${mixHex(c, '#000000', 0.6)})`,
    chipActiveBackground: mixHex(c, '#15141d', 0.22), infoIconBackground: mixHex(c, '#15141d', 0.15), infoIconBorder: withAlpha(c, 0.32),
  }, id)
})
console.log('PASS C 色彩函式、夾值、非法輸入、逐類精確衍生 token')

function minimum(a, b, threshold, label) {
  assert.ok(contrastRatio(a, b) >= threshold, `${label}: ${contrastRatio(a, b)} < ${threshold}`)
}
for (const id of order) {
  const {accent:c, heroStops} = EVENT_CATEGORIES[id], t = getCategoryTokens(id)
  const end = mixHex(c, '#16151f', 0.4)
  minimum(c, t.tileBackground, 4.5, `${id} accent/tile`)
  minimum(t.tileWeekday, t.tileBackground, 4.5, `${id} weekday/tile`)
  minimum(c, '#15141d', 4.5, `${id} accent/surface`)
  minimum('#a09db4', mixHex(end, '#15141d', 0.5), 4.5, `${id} muted/card`)
  minimum(t.glyphColor, end, 3, `${id} glyph/card`)
  minimum('#ffffff', mixHex('#000000', heroStops[0].color, HERO_SCRIM_ALPHA), 4.5, `${id} hero/scrim`)
  console.log(`INFO ${id} 原始英雄起始色白字對比 ${contrastRatio('#ffffff', heroStops[0].color).toFixed(2)}`)
}
for (const key of ['faint','muted','text']) for (const bg of ['#07070f','#0b0a11','#15141d']) minimum(CATEGORY_NEUTRALS[key], bg, 4.5, `${key}/${bg}`)
console.log(`INFO #6c6982 對 #0b0a11 = ${contrastRatio('#6c6982', '#0b0a11').toFixed(2)}（舊 faint 未達標）`)
console.log('PASS D 所有類別與中性色對比度門檻')
const iconSource = readFileSync(new URL('../src/components/category/CategoryIcon.tsx', import.meta.url), 'utf8')
assert.match(iconSource, /other:\s*Ellipsis/)
assert.equal(iconSource.includes('Megaphone'), false)
assert.equal(EVENT_CATEGORIES.other.accent, '#9aa0b8')
console.log('PASS 其他小圖示為 Ellipsis（⋯），中性灰 #9aa0b8 不變')
console.log('OK T30a 活動類型判斷與色彩 token 檢查全部通過')
