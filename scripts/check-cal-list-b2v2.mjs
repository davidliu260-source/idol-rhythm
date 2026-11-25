// 步驟 A 驗證：TZ=America/Los_Angeles node scripts/check-cal-list-b2v2.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relativeWithoutExtension = specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)
    return nextResolve(relativeWithoutExtension ? `${specifier}.ts` : specifier, context)
  },
})

const { B2V2_IDOL_COLORS, B2V2_IDOL_MARK_SLUGS } = await import('../src/lib/idolMarksData.ts')
const { getIdolMarkSrc, resolveIdolColor } = await import('../src/lib/idolMarks.ts')
const { pickFallbackColor } = await import('../src/lib/idolRingColor.ts')
const { groupScheduleEvents } = await import('../src/lib/scheduleGroups.ts')
const { hasAnyEventLocation } = await import('../src/lib/eventLocation.ts')
const { MOCK_EVENTS } = await import('../src/lib/mockEvents.ts')
const { contrastRatio } = await import('../src/lib/eventCategory.ts')
const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const check = (name, fn) => {
  fn()
  console.log(`PASS ${name}`)
}

check('98 組定案 SVG 與 slug 一致，並核對前四組定案色', () => {
  const slugs = Object.keys(B2V2_IDOL_COLORS).sort()
  assert.equal(slugs.length, 98)
  assert.deepEqual([...B2V2_IDOL_MARK_SLUGS].sort(), slugs)
  assert.deepEqual(readdirSync(new URL('public/idol-marks/', root)).sort(), slugs.map(slug => `${slug}.svg`).sort())
  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.match(B2V2_IDOL_COLORS[slug], /^#[0-9a-f]{6}$/)
    assert.equal(getIdolMarkSrc(slug), `/idol-marks/${slug}.svg`)
    const svg = read(`public${getIdolMarkSrc(slug)}`)
    assert.match(svg, /^<svg(?:\s|>)/, slug)
    assert.doesNotMatch(svg, /<\s*script\b|\son[\w:-]+\s*=/i, slug)
    for (const [, doubleQuoted, singleQuoted] of svg.matchAll(/\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|[^\s>]+)/gi)) {
      // Fragment references stay within the SVG.
      assert.match(doubleQuoted ?? singleQuoted ?? '', /^#/, slug)
    }
  }
  for (const slug of ['babymonster', 'day6', 'itzy', 'triples']) {
    assert.ok(read(`public/idol-marks/${slug}.svg`).toLowerCase().includes(B2V2_IDOL_COLORS[slug]), slug)
  }
})

check('團色優先順序與未知 slug 回退色', () => {
  const resolve = (slug, color) => resolveIdolColor({ slug, color, name: '測試偶像' })
  assert.equal(resolve('itzy', ' #AaBbCc '), '#aabbcc')
  assert.equal(resolve('unknown', '#010203'), '#010203')
  for (const color of ['#6366f1', '#6366F1', '#gggggg', '#123', '', null, undefined]) {
    assert.equal(resolve('itzy', color), B2V2_IDOL_COLORS.itzy)
  }
  assert.equal(resolve('le-sserafim'), '#a3f47a')
  assert.equal(resolve('xdinary-heroes'), '#7c3aed')
  for (const slug of ['unknown', 'constructor', '__proto__']) {
    assert.equal(getIdolMarkSrc(slug), null)
    assert.equal(resolve(slug), pickFallbackColor('測試偶像'))
    assert.notEqual(resolve(slug), '#7c3aed')
  }
})

check('同團同台北日分組，保留獨立活動及 UTC 跨日活動', () => {
  const events = [
    { id: 'a', idolId: 'itzy', date: '2026-11-21' },
    { id: 'b', idolId: 'itzy', date: '2026-11-21' },
    { id: 'c', idolId: 'day6', date: '2026-11-21' },
    { id: 'd', idolId: 'itzy', date: '2026-11-21T23:30:00Z' },
    { id: 'e', idolId: 'itzy', date: '2026-11-22' },
    { id: 'f', idolId: 'itzy', date: '2026-11-22T00:30:00+09:00' },
  ]
  const grouped = groupScheduleEvents(events)
  assert.deepEqual(grouped.map(({ date, groups }) => [date, groups.map(group => group.events.map(e => e.id))]), [
    ['2026-11-21', [['a', 'b', 'f'], ['c']]],
    ['2026-11-22', [['d', 'e']]],
  ])
  assert.equal(grouped[1].groups[0].events[0].date, '2026-11-21T23:30:00Z')
  assert.equal(groupScheduleEvents(MOCK_EVENTS).reduce((total, day) => total + day.count, 0), MOCK_EVENTS.length)
})

check('同組內依時間排序，沒時間的排最後', () => {
  const [day] = groupScheduleEvents([
    { id: 'c', idolId: 'itzy', date: '2026-12-01', time: null },
    { id: 'b', idolId: 'itzy', date: '2026-12-01', time: '19:00' },
    { id: 'a', idolId: 'itzy', date: '2026-12-01', time: '09:30' },
  ])
  assert.deepEqual(day.groups[0].events.map(e => e.id), ['a', 'b', 'c'])
})

check('行程只在有地點時渲染地點列', () => {
  assert.equal(hasAnyEventLocation({ venueName: ' ', location: '', city: null }), false)
  assert.equal(hasAnyEventLocation({ venueName: '台北小巨蛋' }), true)
  const card = read('src/app/schedule/ScheduleTrackCard.tsx')
  assert.match(card, /const place = hasAnyEventLocation\(event\) \? getEventLocationLabel\(event\) : null/)
  assert.match(card, /\{place && \([\s\S]+?<MapPin[\s\S]+?\{place\}/)
  for (const file of ['ScheduleClient.tsx', 'ScheduleTrackCard.tsx']) {
    assert.doesNotMatch(read(`src/app/schedule/${file}`), /地點待公布|idolAvatarUrl/)
  }
})

check('活動按鈕點擊範圍、分開的連結及時間軸選項對比', () => {
  const card = read('src/app/schedule/ScheduleTrackCard.tsx')
  assert.match(card, /href=\{\`\/idols\/[\s\S]*?min-h-11 min-w-11/)
  assert.match(card, /href=\{\`\/events\/[\s\S]*?min-h-11[\s\S]*?<\/Link>\s*<div[\s\S]*?<button/)
  assert.equal([...card.matchAll(/grid h-11 w-11/g)].length, 2)
  const selected = read('src/app/schedule/ScheduleClient.tsx').match(/bg-\[(#[0-9a-f]{6})\] text-\[(#[0-9a-f]{6})\] shadow-/i)
  assert.ok(selected)
  assert.ok(contrastRatio(selected[1], selected[2]) >= 4.5)
})

check('行程查詢帶入原始團色，前台原始碼無舊取色函式或固定紫色回退', () => {
  const query = read('src/lib/supabase/events.ts')
  const joins = [...query.matchAll(/idols(?:!inner)?\(([^)]*)\)/g)]
  assert.equal(joins.length, 2)
  for (const [, select] of joins) {
    assert.deepEqual(select.split(',').map(s => s.trim()), ['slug', 'avatar_url', 'color'])
  }
  assert.match(query, /idolColor: row\.idols\?\.color \?\? null/)
  for (const path of git('ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'src').split('\0')) {
    if (!/\.[jt]sx?$/.test(path) || path === 'src/lib/idolMarksData.ts') continue
    const src = read(path)
    assert.doesNotMatch(src, /\bfunction\s+idolPrimaryColor\b/, path)
    assert.doesNotMatch(src, /(?:\?\?|\|\||\breturn|\bfallback\s*[:=])\s*['"`]#7c3aed['"`]/i, path)
  }
})

check('爬蟲、ICS、API、提醒排程、Supabase 與 Vercel 路徑維持分支起點', () => {
  const protectedPaths = ['supabase', 'src/lib/crawlers', 'src/lib/ics', 'src/app/api', 'src/lib/reminderDispatch.ts', 'vercel.json', ':(exclude)supabase/migrations/069_auto_publish_blocked_reason.sql', ':(exclude)supabase/migrations/070_event_translation_attempts.sql', ':(exclude)supabase/migrations/071_event_error_reports.sql', ':(exclude)supabase/migrations/072_crawler_source_alerts.sql', ':(exclude)src/app/api/cron/sync-candidates/route.ts', ':(exclude)src/app/api/admin/event-candidates/bulk-review/route.ts', ':(exclude)src/app/api/admin/event-candidates/bulk-resolve-recheck/route.ts',
    // MUST #10（JYP 改用公告頁）只放行這幾支檔案
    ':(exclude)src/lib/crawlers/jypNotice.ts', ':(exclude)src/lib/crawlers/runActiveCrawlerSources.ts', ':(exclude)src/lib/crawlers/runJypNoticeFetcher.ts', ':(exclude)src/lib/crawlers/runJypScheduleFetcher.ts', ':(exclude)src/app/api/admin/crawlers/jyp-notice/run/route.ts', ':(exclude)src/app/api/admin/crawlers/jyp-schedule/run/route.ts',
    // T35 只放行 migration 073 與林口→桃園
    ':(exclude)supabase/migrations/073_t35_ticket_sales_country_time_status.sql', ':(exclude)src/lib/crawlers/taiwanEventCleanup.ts']
  const base = git('merge-base', 'origin/main', 'HEAD').trim()
  assert.equal(git('diff', '--name-only', base, '--', ...protectedPaths), '')
  assert.equal(git('ls-files', '--others', '--', ...protectedPaths), '')
})
