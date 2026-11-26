// M087：已結束預購不得擋住進行中的一般購票。node scripts/check-m087-onsale-not-blocked.mjs
// 另跑 TZ=America/Los_Angeles node scripts/check-m087-onsale-not-blocked.mjs 驗證時區不漂移。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
registerHooks({ resolve(s, c, n) { return n(s.startsWith('.') && !c.parentURL?.includes('/node_modules/') && !/\.[a-z]+$/i.test(s) ? s + '.ts' : s, c) } })

const ts = await import('../src/lib/ticketSales.ts')
const hero = await import('../src/lib/eventDetailHero.ts')

const sale = (over = {}) => ({
  id: 's',
  stage: 'general',
  label: '一般購票',
  startsAt: null,
  endsAt: null,
  platform: null,
  url: null,
  eligibility: 'public',
  eligibilityNote: null,
  requiresVerification: null,
  sourceUrl: null,
  verifiedAt: null,
  ...over,
})

// 與需求單相同結構：4 列已結束預購 + 1 列一般購票進行中（開賣時間較晚、ends_at 為空）。
const NOW = new Date('2026-11-26T08:00:00Z') // 台北 11/26 16:00
const bigbangSales = [
  sale({ id: 'vip', stage: 'presale', label: 'V.I.P 優先購', startsAt: '2026-09-17T10:00:00+08:00', endsAt: '2026-09-17T23:59:00+08:00', eligibility: 'promoter_member' }),
  sale({ id: 'ctbc', stage: 'presale', label: '中國信託鼎鑽卡', startsAt: '2026-09-18T10:00:00+08:00', endsAt: '2026-09-18T23:59:00+08:00', eligibility: 'card_or_sponsor' }),
  sale({ id: 'uniopen', stage: 'presale', label: 'uniopen 全卡友', startsAt: '2026-09-19T10:00:00+08:00', endsAt: '2026-09-19T23:59:00+08:00', eligibility: 'card_or_sponsor' }),
  sale({ id: 'presale4', stage: 'presale', label: '優先購（其他）', startsAt: '2026-09-20T10:00:00+08:00', endsAt: '2026-09-20T23:59:00+08:00' }),
  sale({ id: 'general', stage: 'general', label: '一般購票', startsAt: '2026-09-22T10:00:00+08:00', endsAt: null }),
]

test('M087 單列狀態不變：預購已結束、一般購票進行中', () => {
  assert.equal(ts.ticketSaleStatus(bigbangSales[0], NOW).label, '已結束')
  assert.equal(ts.ticketSaleStatus(bigbangSales[1], NOW).label, '已結束')
  assert.equal(ts.ticketSaleStatus(bigbangSales[2], NOW).label, '已結束')
  assert.equal(ts.ticketSaleStatus(bigbangSales[3], NOW).label, '已結束')
  assert.deepEqual(ts.ticketSaleStatus(bigbangSales[4], NOW), { status: 'open', label: '進行中' })
  // 日期仍是 2026/9/17–9/19，不可被改成進行中
  assert.equal(ts.formatTaipeiSaleTime(bigbangSales[0].startsAt), '9/17（四）10:00')
  assert.equal(ts.formatTaipeiSaleTime(bigbangSales[0].endsAt), '9/17（四）23:59')
  assert.equal(ts.formatTaipeiSaleTime(bigbangSales[1].startsAt), '9/18（五）10:00')
  assert.equal(ts.formatTaipeiSaleTime(bigbangSales[2].startsAt), '9/19（六）10:00')
})

test('M087 依開賣時間的舊排序不變（後台仍用）；前台把進行中放到已結束前面', () => {
  const chrono = ts.sortTicketSales(bigbangSales).map((s) => s.id)
  assert.deepEqual(chrono, ['vip', 'ctbc', 'uniopen', 'presale4', 'general'])
  const display = ts.sortTicketSalesForDisplay(bigbangSales, NOW).map((s) => s.id)
  assert.deepEqual(display, ['general', 'vip', 'ctbc', 'uniopen', 'presale4'])
  const { active, ended } = ts.partitionTicketSalesForDisplay(bigbangSales, NOW)
  assert.deepEqual(active.map((s) => s.id), ['general'])
  assert.deepEqual(ended.map((s) => s.id), ['vip', 'ctbc', 'uniopen', 'presale4'])
  assert.equal(ts.endedTicketSalesToggleLabel(ended), '已結束的優先購（4）')
})

test('M087 活動層摘要與售票列：有進行中一般購票時寫「一般購票進行中」，不得寫已結束', () => {
  assert.equal(ts.ticketSalesHeadline(bigbangSales, NOW), '一般購票進行中')
  const row = hero.getTicketRow('https://kham.com.tw/application/UTK02/UTK0201_.aspx?PRODUCT_ID=P1EVUYWG', bigbangSales, NOW)
  assert.deepEqual(row, { main: '一般購票進行中', sub: '以官方連結為準', href: 'https://kham.com.tw/application/UTK02/UTK0201_.aspx?PRODUCT_ID=P1EVUYWG' })
  assert.notEqual(row.main, '已結束')
  // 沒有 ticket_url 時，摘要仍可出現，只是沒有連結
  assert.equal(hero.getTicketRow(null, bigbangSales, NOW).main, '一般購票進行中')
  assert.equal(hero.getTicketRow(null, bigbangSales, NOW).href, null)
})

test('M087 有 ticket_url、但還沒有進行中階段時，維持「官方售票中」；舊呼叫方式不變', () => {
  assert.deepEqual(hero.getTicketRow('https://ticket.example/x'), { main: '官方售票中', sub: '以官方連結為準', href: 'https://ticket.example/x' })
  for (const url of [undefined, '', '  ']) {
    assert.deepEqual(hero.getTicketRow(url), { main: '連結待補', sub: '尚未取得官方售票連結', href: null })
  }
  const upcomingOnly = [
    sale({ id: 'g', stage: 'general', label: '一般購票', startsAt: '2026-12-01T10:00:00+08:00', endsAt: null }),
  ]
  assert.equal(ts.ticketSalesHeadline(upcomingOnly, NOW), null)
  assert.equal(hero.getTicketRow('https://tixcraft.com/a', upcomingOnly, NOW).main, '官方售票中')
  const endedPresaleOnly = [
    sale({ id: 'p', stage: 'presale', label: '預購', startsAt: '2026-09-01T10:00:00+08:00', endsAt: '2026-09-01T18:00:00+08:00' }),
  ]
  // 預購都結束、沒有進行中一般購票時，有官方連結仍不得把整場寫成已結束
  assert.equal(ts.ticketSalesHeadline(endedPresaleOnly, NOW), null)
  assert.deepEqual(hero.getTicketRow('https://kham.com.tw/x', endedPresaleOnly, NOW), {
    main: '官方售票中', sub: '以官方連結為準', href: 'https://kham.com.tw/x',
  })
})

test('M087 只有未開賣、沒有已結束列：排列與文案不被改壞', () => {
  const upcoming = [
    sale({ id: 'late', stage: 'general', label: '一般購票', startsAt: '2026-12-10T12:00:00+08:00' }),
    sale({ id: 'early', stage: 'presale', label: '會員預購', startsAt: '2026-12-01T12:00:00+08:00', endsAt: '2026-12-01T18:00:00+08:00' }),
    sale({ id: 'no-time', stage: 'other', label: '加場（時間未公布）', startsAt: null }),
  ]
  assert.deepEqual(ts.sortTicketSales(upcoming).map((s) => s.id), ['early', 'late', 'no-time'])
  assert.deepEqual(ts.sortTicketSalesForDisplay(upcoming, NOW).map((s) => s.id), ['early', 'late', 'no-time'])
  const { active, ended } = ts.partitionTicketSalesForDisplay(upcoming, NOW)
  assert.deepEqual(active.map((s) => s.id), ['early', 'late', 'no-time'])
  assert.deepEqual(ended, [])
  assert.equal(ts.endedTicketSalesToggleLabel(ended), null)
  assert.equal(ts.ticketSalesHeadline(upcoming, NOW), null)
  assert.equal(hero.getTicketRow('https://tixcraft.com/a', upcoming, NOW).main, '官方售票中')
})

test('M087 同一狀態內仍依開賣時間；已結束若含非預購則用「售票階段」', () => {
  const mixed = [
    sale({ id: 'g2', stage: 'general', label: '一般（較晚開）', startsAt: '2026-10-02T10:00:00+08:00' }),
    sale({ id: 'g1', stage: 'general', label: '一般（較早開）', startsAt: '2026-10-01T10:00:00+08:00' }),
    sale({ id: 'p', stage: 'presale', label: '預購', startsAt: '2026-09-01T10:00:00+08:00', endsAt: '2026-09-01T18:00:00+08:00' }),
    sale({ id: 'a', stage: 'added', label: '加場加售', startsAt: '2026-09-15T10:00:00+08:00', endsAt: '2026-09-15T18:00:00+08:00' }),
  ]
  assert.deepEqual(ts.sortTicketSalesForDisplay(mixed, NOW).map((s) => s.id), ['g1', 'g2', 'p', 'a'])
  const { ended } = ts.partitionTicketSalesForDisplay(mixed, NOW)
  assert.equal(ts.endedTicketSalesToggleLabel(ended), '已結束的售票階段（2）')
  assert.equal(ts.ticketSalesHeadline(mixed, NOW), '一般購票進行中')
})

test('M087 一般購票有未來截止時間、或全部已結束、狀態排序邊界', () => {
  // 一般購票已開始且 ends_at 仍在未來 → 仍是進行中
  const openWithEnd = [
    sale({ id: 'p', stage: 'presale', label: '預購', startsAt: '2026-09-01T10:00:00+08:00', endsAt: '2026-09-01T18:00:00+08:00' }),
    sale({ id: 'g', stage: 'general', label: '一般購票', startsAt: '2026-09-22T10:00:00+08:00', endsAt: '2026-12-31T23:59:00+08:00' }),
  ]
  assert.equal(ts.ticketSaleStatus(openWithEnd[1], NOW).status, 'open')
  assert.equal(ts.ticketSalesHeadline(openWithEnd, NOW), '一般購票進行中')
  assert.equal(hero.getTicketRow('https://kham.com.tw/x', openWithEnd, NOW).main, '一般購票進行中')

  // 全部已結束：摘要不是「一般購票進行中」；有官方連結時整場仍不得寫成已結束
  const allEnded = [
    sale({ id: 'p', stage: 'presale', label: '預購', startsAt: '2026-09-01T10:00:00+08:00', endsAt: '2026-09-01T18:00:00+08:00' }),
    sale({ id: 'g', stage: 'general', label: '一般購票', startsAt: '2026-09-22T10:00:00+08:00', endsAt: '2026-10-01T18:00:00+08:00' }),
  ]
  const partedAllEnded = ts.partitionTicketSalesForDisplay(allEnded, NOW)
  assert.deepEqual(partedAllEnded.active, [])
  assert.deepEqual(partedAllEnded.ended.map((s) => s.id), ['p', 'g'])
  assert.equal(ts.ticketSalesHeadline(allEnded, NOW), null)
  assert.equal(hero.getTicketRow('https://kham.com.tw/x', allEnded, NOW).main, '官方售票中')
  assert.notEqual(hero.getTicketRow('https://kham.com.tw/x', allEnded, NOW).main, '已結束')

  // 狀態順序：進行中 → 未開賣 → 已開始 → 未公布 → 已結束；同一狀態內依開賣時間
  const mixedStatus = [
    sale({ id: 'unknown', stage: 'other', label: '未公布', startsAt: null }),
    sale({ id: 'ended', stage: 'presale', label: '已結束預購', startsAt: '2026-09-01T10:00:00+08:00', endsAt: '2026-09-01T18:00:00+08:00' }),
    sale({ id: 'started', stage: 'presale', label: '已開始預購', startsAt: '2026-09-01T10:00:00+08:00', endsAt: null }),
    sale({ id: 'upcoming', stage: 'general', label: '未開賣一般', startsAt: '2026-12-01T10:00:00+08:00' }),
    sale({ id: 'open', stage: 'general', label: '進行中一般', startsAt: '2026-09-22T10:00:00+08:00' }),
  ]
  assert.deepEqual(ts.sortTicketSalesForDisplay(mixedStatus, NOW).map((s) => s.id), ['open', 'upcoming', 'started', 'unknown', 'ended'])
})

test('M087 前台元件把進行中列在收合的已結束之前；後台排序函式未被改去前台路徑', () => {
  const ui = readFileSync(new URL('../src/components/EventTicketSales.tsx', import.meta.url), 'utf8')
  assert.match(ui, /partitionTicketSalesForDisplay/)
  assert.match(ui, /endedTicketSalesToggleLabel/)
  const details = ui.match(/<details[\s\S]*?<\/details>/)
  assert.ok(details, 'missing details block')
  assert.doesNotMatch(details[0], /<details[^>]*\sopen\b/)
  assert.match(details[0], /endedLabel/)
  const activeList = ui.indexOf('{activeViews.map')
  const detailsAt = ui.indexOf('<details')
  const endedOnlyList = ui.indexOf('{endedViews.length > 0 && !collapseEnded')
  assert.ok(activeList !== -1 && detailsAt !== -1 && endedOnlyList !== -1)
  assert.ok(activeList < detailsAt, 'active list should come before collapsed ended details')
  assert.ok(detailsAt < endedOnlyList, 'collapsed details should come before the all-ended list')
  assert.match(ui, /collapseEnded = activeViews\.length > 0 && endedViews\.length > 0/)
  const rows = readFileSync(new URL('../src/components/EventDetailInfoRows.tsx', import.meta.url), 'utf8')
  assert.match(rows, /getTicketRow\(event\.ticketUrl, sales/)
  assert.match(rows, /aria-label=\{\`\$\{ticket\.main\}：\$\{ticket\.sub\}（另開新分頁）\`\}/)
  const page = readFileSync(new URL('../src/app/events/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /<EventDetailInfoRows event=\{event\} sales=\{ticketSales\}/)
  const events = readFileSync(new URL('../src/lib/supabase/events.ts', import.meta.url), 'utf8')
  // 資料層／後台仍依開賣時間排序，不用前台顯示排序
  assert.match(events, /return sortTicketSales\(/)
  assert.doesNotMatch(events, /sortTicketSalesForDisplay/)
})
