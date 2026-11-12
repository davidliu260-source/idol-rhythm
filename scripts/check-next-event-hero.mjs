// 檢查 T30b 首頁英雄卡選卡、副標、日期與白字對比：node scripts/check-next-event-hero.mjs
import assert from 'node:assert/strict'
import * as h from '../src/lib/nextEventHero.ts'
import { EVENT_CATEGORY_ORDER, EVENT_CATEGORIES, HERO_SCRIM_ALPHA, mixHex, contrastRatio, getEventCategory } from '../src/lib/eventCategory.ts'
const NOW = new Date(2026, 10, 12, 10, 0, 0)
const ev = (id, date, extra = {}) => ({ id, date, ...extra })
for (const value of ['2026-11-14','2026-11-12T19:00:00+08:00','2026-11-12 19:00']) assert.equal(h.toDateKey(value), value.slice(0,10))
for (const value of ['',null,undefined,'abc','2026-13-01','2026-02-30','2026-1-5',' 2026-11-12']) assert.equal(h.toDateKey(value), null)
assert.equal(h.getLocalDateKey(NOW),'2026-11-12')
assert.equal(h.getLocalDateKey(new Date(2026,0,5,23,59)),'2026-01-05')
assert.equal(h.addDaysToKey('2026-11-30',1),'2026-12-01')
assert.equal(h.addDaysToKey('2026-12-31',1),'2027-01-01')
assert.equal(h.diffDayKeys('2026-11-12','2026-12-01'),19)
assert.equal(h.diffDayKeys('2026-12-31','2027-01-01'),1)
console.log('PASS A 日期 key')
const past = [ev('p1','2026-11-10'),ev('p2','2026-11-11')]
function selection(label, input, expected, now = NOW) {
  input.forEach(Object.freeze); Object.freeze(input)
  const before = JSON.stringify(input)
  const result = h.selectNextEvent(input, now)
  assert.equal(result?.id ?? null, expected, label)
  assert.equal(JSON.stringify(input),before,label)
  console.log(`PASS ${label}`)
  return result
}
selection('S1 只有過去',past,null)
selection('S2 今天多筆取第一',[ev('f','2026-11-13'),ev('t1','2026-11-12'),ev('t2','2026-11-12')],'t1')
selection('S3 未來排序',[ev('a','2026-11-20'),ev('b','2026-11-14'),ev('c','2026-11-30')],'b')
selection('S4 未來同日',[ev('x','2026-11-14'),ev('y','2026-11-14')],'x')
assert.equal(h.getDaysUntil(selection('S5 不回退過去',[ev('old','2026-01-01'),ev('next','2026-12-01')],'next'),NOW),19)
selection('S6 空陣列',[],null)
const invalid = [ev('bad1',''),ev('bad2','abc'),ev('bad3','2026-02-30')]
selection('S7 無效日期略過',[...invalid,ev('ok','2026-11-15')],'ok'); selection('S7 全無效',invalid,null)
assert.equal(h.getDaysUntil(selection('S8 帶時間字串',[ev('iso','2026-11-12T19:00:00+08:00')],'iso'),NOW),0)
selection('S9 深夜邊界',[ev('d','2026-11-12')],'d',new Date(2026,10,12,23,59,59))
selection('S9 午夜邊界',[ev('d','2026-11-12')],null,new Date(2026,10,13,0,0,1))
selection('S10 進行中多日不算',[ev('run','2026-11-10',{endDate:'2026-11-20'})],null)
const isTicket = e => getEventCategory(e) === 'ticket'
selection('S11 只有過去＝空狀態輸入',past,null)
assert.deepEqual(h.getHomeSubtitleClauses({tomorrowTicketCount:h.countTomorrowTickets(past,isTicket,NOW),nextEventDays:null}),[])
assert.equal(h.getHomeSubtitleText([]),'')
console.log('PASS B 選卡、輸入不變')
for (const n of [0,1,3]) assert.equal(h.getHeroCountdownLabel(n),n === 0 ? '今天' : `還有 ${n} 天`)
assert.equal(h.getDaysUntil(ev('bad','bad'),NOW),null)
const tickets = [ev('k1','2026-11-13',{type:'ticketing'}),ev('k2','2026-11-13',{type:'ticketing',subType:'award'}),ev('k3','2026-11-12',{type:'ticketing'}),ev('k4','2026-11-14',{type:'ticketing'}),ev('k5','2026-11-13',{type:'concert'}),ev('k6','2026-11-13',{type:'ticketing',subType:'fanmeet'})]
assert.equal(h.countTomorrowTickets(tickets,isTicket,NOW),2)
const subtitles = [[2,3,'明天有 2 場開賣，下一場活動在 3 天後'],[0,3,'下一場活動在 3 天後'],[2,0,'明天有 2 場開賣'],[0,null,''],[1,1,'明天有 1 場開賣，下一場活動在 1 天後'],[2,null,'明天有 2 場開賣']]
subtitles.forEach(([tomorrowTicketCount,nextEventDays,expected],i) => {
  const clauses = h.getHomeSubtitleClauses({tomorrowTicketCount,nextEventDays})
  assert.equal(h.getHomeSubtitleText(clauses),expected,`U${i+1}`)
  assert.ok(!/演出|已歸檔/.test(h.getHomeSubtitleText(clauses)))
  if (i === 3) assert.equal(clauses.length,0)
})
assert.deepEqual(h.getHomeSubtitleClauses({tomorrowTicketCount:2,nextEventDays:3}),[{lead:'明天有 ',strong:'2 場開賣'},{lead:'下一場活動在 ',strong:'3 天後'}])
console.log('PASS C 天數、明天開賣計數 2、U1–U6 副標')
const date = h.getHeroDateParts({date:'2026-11-14',time:'19:30'})
assert.deepEqual(date,{month:11,day:14,weekday:'六',timeLabel:'19:30',rangeEndLabel:null})
for (const time of [undefined,null,'','  ']) assert.equal(h.getHeroDateParts({date:'2026-11-14',time}).timeLabel,'時間未定')
for (const [endDate,expected] of [['2026-11-20','至 11/20'],['2026-12-03','至 12/3'],['2026-11-14',null],['2026-11-10',null],['abc',null]]) assert.equal(h.getHeroDateParts({date:'2026-11-14',endDate}).rangeEndLabel,expected)
assert.equal(h.getHeroDateParts({date:'2026-11-12'}).weekday,'四')
assert.equal(h.getHeroDateParts({date:'2026-11-15'}).weekday,'日')
assert.equal(h.getHeroDateParts({date:'bad'}),null)
for (const [level,label] of [['official','官方確認'],['media','媒體確認'],['pending',null],[undefined,null],[null,null],['Official',null]]) assert.equal(h.getTrustLabel(level),label)
for (const [event,label] of [[{venueName:' 示範場館 '},'示範場館'],[{venueName:'',location:'示範地點'},'示範地點'],[{venueName:'  ',location:'  '},null],[{},null]]) assert.equal(h.getHeroVenueLabel(event),label)
assert.equal(h.getHeroAriaLabel({countdownLabel:'還有 2 天',categoryLabel:'演唱會',date,idolName:'示範藝人',title:'示範活動名稱',venueLabel:'示範場館',trustLabel:'官方確認'}),'下一場活動，還有 2 天：演唱會，11月14日 週六 19:30，示範藝人，示範活動名稱，示範場館，官方確認')
assert.equal(h.getHeroAriaLabel({countdownLabel:'今天',categoryLabel:'快閃店',date:h.getHeroDateParts({date:'2026-11-12',endDate:'2026-11-20'}),idolName:'示範藝人',title:'示範快閃店',venueLabel:null,trustLabel:'媒體確認'}),'下一場活動，今天：快閃店，11月12日 週四 時間未定，至 11/20，示範藝人，示範快閃店，媒體確認')
console.log('PASS D 日期分段、多日、信任、場館、aria')
assert.equal(HERO_SCRIM_ALPHA,0.35); assert.equal(h.HERO_SCRIM_END_ALPHA,0.15)
assert.equal(h.heroScrimBackground(HERO_SCRIM_ALPHA,h.HERO_SCRIM_END_ALPHA),'linear-gradient(150deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.15) 100%)')
function colorAt(stops,t) {
  const position = t * 100
  for (let i = 1; i < stops.length; i++) if (position <= stops[i].at) return mixHex(stops[i].color,stops[i-1].color,(position-stops[i-1].at)/(stops[i].at-stops[i-1].at))
  return stops[stops.length-1].color
}
for (const id of EVENT_CATEGORY_ORDER) {
  const {heroStops,label} = EVENT_CATEGORIES[id]
  const start = mixHex('#000000',heroStops[0].color,HERO_SCRIM_ALPHA)
  const ratio = contrastRatio('#ffffff',start)
  assert.ok(ratio >= 4.5,`${id} ${ratio}`)
  console.log(`INFO ${id} 起始色＋遮罩白字 ${ratio.toFixed(2)}`)
  if (['popup','cafe','fanmeet'].includes(id)) console.log(`CHECK ${id} ${label} ${ratio.toFixed(2)}`)
  let minimum = Infinity, minT = 0, zeroMinimum = Infinity
  for (let k=0;k<=20;k++) {
    const t=k/20, color=colorAt(heroStops,t)
    const value=contrastRatio('#ffffff',mixHex('#000000',color,HERO_SCRIM_ALPHA+(h.HERO_SCRIM_END_ALPHA-HERO_SCRIM_ALPHA)*t))
    assert.ok(value >= 4.5,`${id} t=${t} ${value}`)
    if (value < minimum) {minimum=value;minT=t}
    zeroMinimum=Math.min(zeroMinimum,contrastRatio('#ffffff',mixHex('#000000',color,0.35*(1-t))))
  }
  console.log(`INFO ${id} 整張卡最低 ${minimum.toFixed(2)} t=${minT}; 終點 0 最低 ${zeroMinimum.toFixed(2)}（因此終點用 0.15）`)
  assert.ok(contrastRatio('#ffffff',mixHex('#000000',start,0.26)) >= 4.5)
}
assert.ok(contrastRatio('#18102c','#ffffff') >= 4.5)
const header=contrastRatio('#a09db4',mixHex('#ff5aae','#17111d',0.16))
assert.ok(header >= 4.5)
console.log(`INFO 頁首 #a09db4 對粉光 = ${header.toFixed(2)}`)
console.log('INFO #8a87a0 對頁首粉光 = 4.27（不達標，頁首改用 #a09db4）')
console.log('PASS E 七類白字、標籤與頁首對比')
console.log('OK T30b 英雄卡選卡、副標、日期與白字對比檢查全部通過')
