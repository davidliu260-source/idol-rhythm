// 執行方式：node scripts/check-must8-empty-states.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { registerHooks } from 'node:module'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })

const { TAIWAN_CITIES, normalizeCityName, buildCityDirectory, getCityEvents, resolveCityParam, cityHref } = await import('../src/lib/cities.ts')
const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const check = (name, run) => {
  run()
  console.log(`PASS ${name}`)
}

const now = new Date('2026-11-20T16:01:00Z') // 台北 11/21 00:01
const events = [
  { id: 'later', city: '台北', date: '2026-11-30' },
  { id: 'today', city: ' 臺北　', date: '2026-11-21' },
  { id: 'ended', city: '台北', date: '2026-11-20' },
  { id: 'ongoing', city: '台北', date: '2026-11-19', endDate: '2026-11-22' },
  { city: '東京', date: '2026-11-23' },
  { city: '首爾', date: '2026-11-25' },
  { city: ' 首爾 ', date: '2026-11-24' },
  { city: '大阪', date: '2026-11-20' },
  { city: '　 ', date: '2026-11-21' },
  { date: '2026-11-21' },
  { city: '', date: '2026-11-21' },
  { city: '', date: '2026-11-20' },
]
events.forEach(Object.freeze)
Object.freeze(events)

check('城市目錄統計未結束場次、合併「臺」字、排序並計算未標註場次', () => {
  const { taiwanCities, otherCities, unlabeledCount } = buildCityDirectory(events, now)
  assert.deepEqual(TAIWAN_CITIES, ['台北', '新北', '桃園', '台中', '台南', '高雄', '新竹', '基隆'])
  assert.deepEqual(taiwanCities.map(city => city.name), TAIWAN_CITIES)
  assert.deepEqual(taiwanCities[0], { name: '台北', count: 3, nextDate: '2026-11-21' })
  assert.deepEqual(otherCities, [
    { name: '首爾', count: 2, nextDate: '2026-11-24' },
    { name: '東京', count: 1, nextDate: '2026-11-23' },
  ])
  assert.equal(unlabeledCount, 3)
  assert.equal(normalizeCityName('　臺中 '), '台中')
  assert.deepEqual(getCityEvents(events, ' 臺北 ', now).map(event => event.id), ['ongoing', 'today', 'later'])
  assert.deepEqual(getCityEvents(events, '大阪', now), [])
  assert.deepEqual(getCityEvents(events, ' ', now), [])
})

check('只有進行中的跨天活動時，「最近」顯示台北今天而非已過的開始日', () => {
  const onlyOngoing = Object.freeze([Object.freeze({ id: 'tc', city: '台中', date: '2026-11-19', endDate: '2026-11-22' })])
  const taichung = buildCityDirectory(onlyOngoing, now).taiwanCities.find(city => city.name === '台中')
  assert.deepEqual(taichung, { name: '台中', count: 1, nextDate: '2026-11-21' })
})

check('全空時仍列固定城市，各城市零場', () => {
  assert.deepEqual(buildCityDirectory([], now), {
    taiwanCities: TAIWAN_CITIES.map(name => ({ name, count: 0, nextDate: null })),
    otherCities: [],
    unlabeledCount: 0,
  })
})

check('同日城市場次依時間與 ID 排序，未公布時間排最後', () => {
  const sameDay = [
    { id: 'no-time' },
    { id: 'late', time: '19:00' },
    { id: 'early-b', time: '10:00' },
    { id: 'early-a', time: '10:00' },
  ].map(event => ({ ...event, city: '台北', date: '2026-11-21' }))
  assert.deepEqual(getCityEvents(sameDay, '台北', now).map(event => event.id), ['early-a', 'early-b', 'late', 'no-time'])
})

check('城市網址接受已知城市，拒絕壞編碼、未知城市與空白', () => {
  assert.equal(resolveCityParam('%E0%A4', events), null)
  assert.equal(resolveCityParam('不存在', events), null)
  assert.equal(resolveCityParam('%20', events), null)
  assert.equal(resolveCityParam('臺北', events), '台北')
  assert.equal(resolveCityParam(encodeURIComponent('臺北'), events), '台北')
  assert.equal(resolveCityParam(encodeURIComponent(encodeURIComponent('台北')), events), null)
  assert.equal(resolveCityParam('高雄', []), '高雄')
  assert.equal(resolveCityParam(encodeURIComponent(' 首爾 '), events), '首爾')
  assert.equal(resolveCityParam('大阪', events), '大阪')
  assert.equal(cityHref('台北'), `/cities/${encodeURIComponent('台北')}`)
})

check('台灣城市清單與 TAIWAN_PLACES 一致', () => {
  const cleanup = read('src/lib/crawlers/taiwanEventCleanup.ts')
  const places = cleanup.match(/const TAIWAN_PLACES = \[\s*([\s\S]*?)^\]/m)
  assert.ok(places, '找不到 TAIWAN_PLACES')
  const names = [...places[1].matchAll(/^\s*\['([^']+)',/gm)].map(match => match[1])
  assert.deepEqual(new Set(names), new Set(TAIWAN_CITIES))
})

check('城市與偶像空狀態提供下一步，底部導覽保留城市', () => {
  const directory = read('src/app/cities/page.tsx')
  assert.doesNotMatch(directory, /尚未開放/)
  assert.match(directory, /目前還沒有標註城市的公開場次/)
  assert.match(directory, /href="\/schedule"[^>]*>[\s\S]*?看行事曆/)
  assert.match(directory, /href="\/idols"[^>]*>\s*追蹤偶像/)

  const detail = read('src/app/cities/[city]/page.tsx').split('目前沒有公開場次')[1]
  assert.ok(detail)
  assert.match(detail, /href="\/schedule"[^>]*>\s*看全部行事曆/)
  assert.match(detail, /href="\/idols"[^>]*>\s*追蹤偶像/)
  assert.match(detail, /href="\/cities"[^>]*>\s*回城市列表/)

  const idol = read('src/app/idols/[slug]/page.tsx')
  assert.match(idol, /title="還沒有公開行程"/)
  assert.match(idol, /href="\/schedule"\s+label="看全部行事曆"/)
  assert.match(idol, /href: '\/idols', label: '逛逛其他偶像'/)
  assert.match(idol, /href=\{secondary\.href\}/)
  assert.match(read('src/components/BottomNav.tsx'), /['"]\/cities['"]/)
})

check('核對受保護路徑與分支起點，以及 migration 編號（067 之後只允許 068、069、070 與 071）', () => {
  const cwd = root
  const base = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  const protectedPaths = [
    'src/lib/crawlers', 'supabase', 'src/lib/ics', 'src/app/api', 'src/app/atlas',
    'src/lib/reminderTypes.ts', 'src/lib/reminderDispatch.ts', 'src/lib/appState.tsx',
    'src/components/BottomNav.tsx', 'vercel.json',
  ]
  // MUST3（F4）在 MUST8 之後合併：只放行它自己的 migration 與 feed 檔案，其餘保護不變
  const must3Allowed = [
    'supabase/migrations/068_calendar_feed_tokens.sql',
    'src/lib/ics/buildIcs.ts', 'src/lib/ics/followsFeed.ts',
    'src/lib/ics/supabaseFeedStore.ts', 'src/lib/ics/sameOriginRequest.ts',
    'src/app/api/ics/me', 'src/app/api/calendar-feed',
  ].map(path => `:(exclude)${path}`)
  // B2v2 只更新 AtlasClient 的取色，其他 atlas 檔案仍受保護。
  const b2v2Allowed = ':(exclude)src/app/atlas/AtlasClient.tsx'
  const emptyShellAllowed = ':(exclude)supabase/migrations/069_auto_publish_blocked_reason.sql'
  const autoTranslateAllowed = [':(exclude)supabase/migrations/070_event_translation_attempts.sql', ':(exclude)supabase/migrations/071_event_error_reports.sql', ':(exclude)src/app/api/cron/sync-candidates/route.ts']
  // MUST #10（YG／SMTOWN 公告只留事實）只放行批次核准 route
  autoTranslateAllowed.push(':(exclude)src/app/api/admin/event-candidates/bulk-review/route.ts')
  execFileSync('git', ['diff', '--quiet', base, '--', ...protectedPaths, ...must3Allowed, b2v2Allowed, emptyShellAllowed, ...autoTranslateAllowed], { cwd })
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...protectedPaths, ...must3Allowed, emptyShellAllowed, ...autoTranslateAllowed], { cwd, encoding: 'utf8' })
  assert.equal(untracked, '', '受保護路徑出現未追蹤檔案')
  for (const file of readdirSync(new URL('supabase/migrations/', root), { withFileTypes: true })) {
    const number = file.name.match(/^\d+/)?.[0]
    assert.ok(!file.isFile() || !number || Number(number) < 68 || ['068_calendar_feed_tokens.sql', '069_auto_publish_blocked_reason.sql', '070_event_translation_attempts.sql', '071_event_error_reports.sql'].includes(file.name), `出現新 migration：${file.name}`)
  }
})
