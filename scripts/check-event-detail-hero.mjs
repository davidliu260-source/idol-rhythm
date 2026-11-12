// 檢查 T30f 詳情頁頂部日期、標籤、場館、售票與白字對比：node scripts/check-event-detail-hero.mjs
// 另跑 TZ=America/Los_Angeles node scripts/check-event-detail-hero.mjs 驗證時區不漂移。
import assert from 'node:assert/strict'
import * as h from '../src/lib/eventDetailHero.ts'
import { HERO_SCRIM_ALPHA, EVENT_CATEGORY_ORDER, EVENT_CATEGORIES, mixHex, contrastRatio, getCategoryTokens, CATEGORY_NEUTRALS } from '../src/lib/eventCategory.ts'
const inputs = []
function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value) }
  inputs.push([value, JSON.stringify(value)])
  return value
}
const event = (overrides = {}) => frozen({ title: '活動', date: '2026-11-14', time: '19:30', source: { level: 'official' }, ...overrides })
assert.equal(HERO_SCRIM_ALPHA, .35)
assert.equal(h.HERO_SCRIM_END_ALPHA, .15)
assert.equal(h.heroScrimBackground(.35, .15), 'linear-gradient(150deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.15) 100%)')
assert.equal(h.HERO_TYPE_CHIP_BACKGROUND, 'rgba(0, 0, 0, 0.26)')
assert.equal(h.DETAIL_PAGE_BACKGROUND, '#08070d')
assert.ok(!/color-mix|transparent/.test(h.HERO_FADE_BACKGROUND))
console.log('PASS A 常數與遮罩')
for (const value of frozen(['2026-11-14', '2026-11-14T19:30:00+09:00'])) assert.deepEqual(h.parseYmd(value), { year:2026, month:11, day:14, weekday:6 })
for (const value of frozen(['', null, undefined, 'abc', '2026-02-30', '2026-13-01', '14/11/2026'])) assert.equal(h.parseYmd(value), null)
assert.equal(h.parseYmd('2026-01-01').day, 1)
assert.equal(h.parseYmd('2026-01-01').weekday, 4)
assert.deepEqual(h.getHeroDateParts(event()), { monthLabel:'11月', dayLabel:'14', metaLabel:'週六 · 19:30' })
assert.equal(h.getHeroDateParts(event({date:'2026-12-03'})).dayLabel, '3')
assert.equal(h.getHeroDateParts(event({date:'2026-12-03'})).monthLabel, '12月')
assert.equal(h.getHeroDateParts(event({startDate:'2026-12-03'})).dayLabel, '3')
assert.equal(h.getHeroDateParts(event({date:'abc'})), null)
console.log('PASS B 日期分段與時區')
for (const value of frozen([undefined, '', '  '])) assert.equal(h.formatTimeLabel(value), '時間未定')
assert.equal(h.formatTimeLabel('19:30'), '19:30')
assert.equal(h.getHeroDateParts(event({time:undefined})).metaLabel, '週六 · 時間未定')
const range = event({endDate:'2026-11-30',time:'11:00'})
assert.equal(h.getRangeEndLabel(range), '至 11/30')
assert.equal(h.getHeroDateParts(range).metaLabel, '週六 · 11:00 · 至 11/30')
assert.deepEqual(h.getInfoDateRow(range), {key:'期間',main:'11 月 14 日 至 11 月 30 日',sub:'11:00'})
assert.equal(h.getRangeEndLabel(event({date:'2026-12-28',endDate:'2027-01-03'})), '至 1/3')
for (const endDate of frozen(['2026-11-14','2026-11-13','abc',undefined])) {
 const e=event({endDate}); assert.equal(h.getRangeEndLabel(e),null); assert.equal(h.getInfoDateRow(e).key,'日期')
}
assert.deepEqual(h.getInfoDateRow(event()), {key:'日期',main:'11 月 14 日　週六',sub:'19:30'})
assert.equal(h.getInfoDateRow(event({date:'abc',dateLabel:'2026 年冬季'})).main,'2026 年冬季')
assert.equal(h.getInfoDateRow(event({date:'abc'})).main,'日期未定')
console.log('PASS C 時間與區間')
assert.equal(h.getTrustBadgeLabel('official'),'官方確認')
assert.equal(h.getTrustBadgeLabel('media'),'媒體確認')
for (const level of frozen(['pending','',undefined,'confirmed'])) assert.equal(h.getTrustBadgeLabel(level),null)
console.log('PASS D 信任只看 level')
const venues = frozen([
 [{venueName:'Arena',location:'Zepp'}, {main:'Arena',sub:null}],
 [{location:'Zepp'}, {main:'Zepp',sub:null}],
 [{venueName:'  ',location:'Zepp'}, {main:'Zepp',sub:null}],
 [{venueName:'Arena',city:'吉隆坡',country:'馬來西亞'}, {main:'Arena',sub:'馬來西亞・吉隆坡'}],
 [{venueName:'Arena',city:'新加坡',country:'新加坡'}, {main:'Arena',sub:'新加坡'}],
 [{city:'吉隆坡',country:'馬來西亞'}, {main:'馬來西亞・吉隆坡',sub:null}],
 [{},null],
])
for (const [input, expected] of venues) { const output=h.getVenueRow(event(input));assert.deepEqual(output,expected);assert.ok(!JSON.stringify(output).includes('地點未定')) }
console.log('PASS E 場館與缺漏')
assert.deepEqual(h.getTicketRow('https://ticket.example/x'),{main:'官方售票中',sub:'以官方連結為準',href:'https://ticket.example/x'})
for (const url of frozen([undefined,'','  '])) assert.deepEqual(h.getTicketRow(url),{main:'連結待補',sub:'尚未取得官方售票連結',href:null})
console.log('PASS F 售票')
function colorAt(stops,t) {
 const p=t*100
 for(let i=1;i<stops.length;i++) if(p<=stops[i].at) return mixHex(stops[i-1].color,stops[i].color,1-(p-stops[i-1].at)/(stops[i].at-stops[i-1].at))
 return stops.at(-1).color
}
for(const id of EVENT_CATEGORY_ORDER) {
 const {label,heroStops:stops}=EVENT_CATEGORIES[id]
 const start=contrastRatio('#ffffff',mixHex('#000000',stops[0].color,HERO_SCRIM_ALPHA)); assert.ok(start>=4.5)
 console.log(`INFO ${id} ${label} 起始色＋遮罩白字 ${start.toFixed(2)}`)
 let minimum=Infinity,at=0,zero=Infinity,chip=Infinity,white=Infinity
 for(let i=0;i<=20;i++) {
  const t=i/20,color=colorAt(stops,t),bg=mixHex('#000000',color,.35+(.15-.35)*t)
  const ratio=contrastRatio('#ffffff',bg);assert.ok(ratio>=4.5,`${id} t=${t} ${ratio}`)
  if(ratio<minimum){minimum=ratio;at=t}
  zero=Math.min(zero,contrastRatio('#ffffff',mixHex('#000000',color,.35*(1-t))))
  const chipRatio=contrastRatio('#ffffff',mixHex('#000000',bg,.26));assert.ok(chipRatio>=4.5)
  chip=Math.min(chip,chipRatio);white=Math.min(white,contrastRatio('#ffffff',mixHex('#ffffff',bg,.2)))
 }
 console.log(`INFO ${id} ${label} 最低 ${minimum.toFixed(2)} @t=${at}; 終點0最低 ${zero.toFixed(2)}; 黑26%標籤 ${chip.toFixed(2)}; 設計稿白20%標籤 ${white.toFixed(2)}`)
 if(['popup','cafe','fanmeet'].includes(id)) console.log(`CHECK ${id} ${label} 最低 ${minimum.toFixed(2)} @t=${at}`)
 const tokens=getCategoryTokens(id),icon=contrastRatio(tokens.accent,tokens.infoIconBackground);assert.ok(icon>=3);console.log(`INFO ${id} 資訊列圖示 ${icon.toFixed(2)}`)
}
assert.ok(contrastRatio(h.HERO_TRUST_CHIP.color,h.HERO_TRUST_CHIP.background)>=4.5)
for(const color of [CATEGORY_NEUTRALS.faint,CATEGORY_NEUTRALS.muted,CATEGORY_NEUTRALS.text]) { const ratio=contrastRatio(color,h.DETAIL_PAGE_BACKGROUND);assert.ok(ratio>=4.5);console.log(`INFO 資訊列 ${color} ${ratio.toFixed(2)}`) }
console.log('PASS G 七類白字、標籤與資訊列對比')
for(const [input,before] of inputs) assert.equal(JSON.stringify(input),before)
console.log('PASS H 所有輸入不變')
console.log('OK T30f 詳情頁頂部檢查全部通過')
