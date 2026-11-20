import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })

const { listCurrentEvents } = await import('../src/lib/upcomingEvents.ts')
const { isEventOnDay } = await import('../src/lib/taipeiDate.ts')
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const now = new Date('2026-11-19T16:00:00Z')
const today = '2026-11-20'
const samples = Object.freeze([
  { id: 'ended-single', date: '2026-11-19' },
  { id: 'ended-range', date: '2026-11-17', endDate: '2026-11-19' },
  { id: 'today', date: today, endDate: null },
  { id: 'ends-today', date: '2026-11-18', endDate: today },
  { id: 'ongoing', date: '2026-10-30', endDate: '2026-11-21' },
  { id: 'future', date: '2026-11-22' },
  { id: 'invalid-start', date: '2026-11-31', endDate: '2026-12-01' },
  { id: 'invalid-end', date: today, endDate: 'invalid' },
].map(event => Object.freeze(event)))

test('公開列表以台北午夜判定結束，排除無效日期並保留原順序', () => {
  assert.deepEqual(listCurrentEvents(samples, now).map(event => event.id),
    ['today', 'ends-today', 'ongoing', 'future'])
  const beforeMidnight = new Date(now.getTime() - 1)
  assert.deepEqual(listCurrentEvents(samples, beforeMidnight).slice(0, 2).map(event => event.id),
    ['ended-single', 'ended-range'])
})

test('行程頁的計數、搜尋、時間軸與月曆皆使用公開篩選後的資料', () => {
  const page = read('src/app/schedule/page.tsx')
  assert.match(page, /const events = listCurrentEvents\(await getPublishedEvents\(\)\)/)
  assert.match(page, /共 \{events\.length\}/)
  assert.match(page, /<ScheduleClient events=\{events\}/)

  const client = read('src/app/schedule/ScheduleClient.tsx')
  assert.match(client, /const events = useMemo\(\(\) => listCurrentEvents\(publishedEvents\)/)
  assert.match(client, /const filtered = useMemo\([\s\S]*?return events\.filter\(/)
  assert.match(client, /counts\.set\(category\.id, events\.filter\(/)
  assert.match(client, /categoryCounts=\{categoryCounts\}/)
  assert.match(client, /resultCount=\{filtered\.length\}/)
  assert.match(client, /totalCount=\{events\.length\}/)
  assert.match(client, /<TimelineView events=\{filtered\}/)
  assert.match(client, /buildMonthGroups\(events\)/)
  assert.match(client, /<CalendarView events=\{filtered\}/)
  assert.match(client, /events\.filter\(event => isEventOnDay\(event, key\)\)/)
  const events = listCurrentEvents(samples, now)
  assert.deepEqual(events.filter(event => isEventOnDay(event, today)).map(event => event.id),
    ['today', 'ends-today', 'ongoing'])
})

test('偶像頁保留兩格統計，圖鑑和活動詳情保留已結束活動入口', () => {
  const idol = read('src/app/idols/[slug]/page.tsx')
  assert.match(idol, /listCurrentEvents\(idolEvents\)/)
  assert.match(idol, /grid-cols-2 gap-2/)
  assert.match(idol, /<StatTile label="即將到來"/)
  assert.match(idol, /<StatTile\s+label="成員"/)
  assert.doesNotMatch(idol, /已結束|最近 10 筆|\bpast\b/)
  assert.match(read('src/app/atlas/page.tsx'), /const events = await getPublishedEvents\(\)/)
  assert.match(read('src/app/atlas/AtlasClient.tsx'), /title="已結束"/)
  assert.match(read('src/app/events/[id]/page.tsx'), /await getSupabaseEventById\(/)
})
