// 檢查 MUST3 追蹤全部 ICS：node scripts/check-must3-all-follows-ics.mjs
// 全天活動的提醒以行事曆當地時區的 DTSTART（當天 00:00）為基準。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildIcs } from '../src/lib/ics/buildIcs.ts'
import { isSameOriginRequest } from '../src/lib/ics/sameOriginRequest.ts'

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
  },
})
const { alarmsFromSetting, buildFollowsFeedResponse, isFeedAlarm, parseFeedTokenParam } =
  await import('../src/lib/ics/followsFeed.ts')
const { createSupabaseFeedStore } = await import('../src/lib/ics/supabaseFeedStore.ts')
hooks.deregister()

const root = new URL('../', import.meta.url)
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const read = (path) => readFileSync(new URL(path, root), 'utf8')

async function check(name, run) {
  await run()
  console.log(`PASS ${name}`)
}

const origin = 'https://idol.example'
const now = new Date('2026-11-20T16:30:00Z') // 台北已是 11/21，截止日為 10/22。
const event = (id, overrides = {}) => ({
  id,
  idolId: 'followed',
  title: '台北, 週末;特別活動',
  date: '2026-12-03',
  status: 'confirmed',
  source: { level: 'official', label: '官方' },
  ...overrides,
})
const fixtures = [
  event('concert', {
    title: '星動時刻，跨年特別公演🎵'.repeat(12),
    time: '18:00',
    venueName: 'Live House; Taipei',
    location: '台北市',
  }),
  event('exhibit', { startDate: '2026-12-04', endDate: '2026-12-06', status: 'tentative' }),
  event('media', { source: { level: 'media', label: '音樂新聞' } }),
]
const unfold = (ics) => ics.replace(/\r\n /g, '')
const withoutStamp = (ics) => ics.replace(/^DTSTAMP:[^\r\n]+\r\n/gm, '')

await check('單一偶像 ICS 與 merge-base 逐字相同（忽略 DTSTAMP）', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'must3-ics-'))
  try {
    const baseline = join(temp, 'buildIcs.ts')
    const base = git('merge-base', 'origin/main', 'HEAD').trim()
    writeFileSync(baseline, git('show', `${base}:src/lib/ics/buildIcs.ts`))
    const { buildIcs: oldBuildIcs } = await import(pathToFileURL(baseline).href)
    for (const events of [[], fixtures, ...fixtures.map((fixture) => [fixture])]) {
      assert.equal(withoutStamp(buildIcs('星動偶像', events, origin)), withoutStamp(oldBuildIcs('星動偶像', events, origin)))
    }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

await check('全天事件 VALARM 設定、位置、順序、去重、折行及 CRLF', () => {
  const triggers = {
    none: [],
    day_before: ['-P1D'],
    week_before: ['-P7D'],
    both: ['-P1D', '-P7D'],
  }
  for (const [alarm, expected] of Object.entries(triggers)) {
    assert.ok(isFeedAlarm(alarm))
    const options = { calendarName: '自訂,行事曆;追蹤', alarms: alarmsFromSetting(alarm) }
    const ics = buildIcs('', fixtures, origin, options)
    assert.ok(ics.endsWith('\r\n'))
    assert.doesNotMatch(ics.replaceAll('\r\n', ''), /[\r\n]/)
    assert.ok(ics.split('\r\n').every((line) => Buffer.byteLength(line) <= 75))
    assert.ok(ics.includes('\r\n '))

    const unfolded = unfold(ics)
    assert.ok(unfolded.includes('X-WR-CALNAME:自訂\\,行事曆\\;追蹤\r\n'))
    const blocks = [...unfolded.matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)END:VEVENT\r\n/g)]
    assert.equal(blocks.length, fixtures.length)
    for (const [, block] of blocks) {
      assert.match(block, /DTSTART;VALUE=DATE:\d{8}/)
      const alarms = [...block.matchAll(/BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:(-P[17]D)\r\nDESCRIPTION:([^\r\n]+)\r\nEND:VALARM\r\n/g)]
      assert.deepEqual(alarms.map(([, trigger]) => trigger), expected)
      for (const [, trigger, description] of alarms) {
        assert.ok(description.startsWith(trigger === '-P1D' ? '明天：' : '一週後：'))
        if (block.includes('UID:exhibit@')) assert.ok(description.includes('台北\\, 週末\\;特別活動'))
      }
    }
    assert.doesNotMatch(unfolded.replace(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g, ''), /VALARM/)
    assert.equal((unfolded.match(/BEGIN:VALARM/g) ?? []).length, fixtures.length * expected.length)
  }
  assert.equal(isFeedAlarm('constructor'), false)
  assert.equal(isFeedAlarm(null), false)
  const redundant = buildIcs('', fixtures, origin, { alarms: ['week_before', 'day_before', 'week_before'] })
  const ordered = buildIcs('', fixtures, origin, { alarms: alarmsFromSetting('both') })
  assert.equal(withoutStamp(redundant), withoutStamp(ordered))
})

const token = 'Ab0_-'.repeat(8) + 'XYZ'
await check('訂閱 token 格式與 .ics 後綴', () => {
  assert.equal(parseFeedTokenParam(token), token)
  assert.equal(parseFeedTokenParam(`${token}.ics`), token)
  for (const invalid of ['', token.slice(1), `${token}A`, `${token.slice(1)}/`, `${token}\n`, `${token}.ics.ics`]) {
    assert.equal(parseFeedTokenParam(invalid), null)
  }
})

const store = {
  async findByToken(value) {
    assert.equal(value, token)
    return { userId: 'user', alarm: 'both' }
  },
  async followedIdolSlugs(userId) {
    assert.equal(userId, 'user')
    return ['followed']
  },
  async publishedEvents() {
    return [
      ...fixtures,
      event('other-idol', { idolId: 'unfollowed' }),
      event('aggregator', { source: { level: 'aggregator', label: '非官方整理' } }),
      event('old', { date: '2026-10-20', startDate: '2026-10-20', endDate: '2026-10-21' }),
      event('cutoff', { date: '2026-10-20', endDate: '2026-10-22' }),
      event('recent', { date: '2026-11-08' }),
    ]
  },
  async touch(userId) {
    assert.equal(userId, 'user')
  },
}
const respond = (param, overrides = {}) => buildFollowsFeedResponse({ param, store: { ...store, ...overrides }, origin, now })
const notFound = { status: 404, body: 'Not Found', headers: { 'Cache-Control': 'no-store' } }

await check('設定 POST 驗證 Fetch Metadata 與 Origin host', () => {
  const cases = [
    [{}, true],
    [{ 'sec-fetch-site': 'same-origin', origin }, true],
    [{ 'sec-fetch-site': 'none' }, true],
    [{ origin }, true],
    [{ origin: 'http://idol.example' }, true],
    [{ 'sec-fetch-site': 'cross-site', origin }, false],
    [{ 'sec-fetch-site': 'same-site' }, false],
    [{ 'sec-fetch-site': '' }, false],
    [{ 'sec-fetch-site': 'same-origin', origin: 'https://other.example' }, false],
    [{ origin: 'https://idol.example:8443' }, false],
    [{ origin: 'null' }, false],
  ]
  for (const [headers, expected] of cases) {
    assert.equal(isSameOriginRequest(new Headers(headers), `${origin}/api/calendar-feed`), expected, JSON.stringify(headers))
  }
})

const followedId = '00000000-0000-4000-8000-000000000001'
const inactiveId = '00000000-0000-4000-8000-000000000002'

function fakeSupabase(failingTable) {
  const rows = {
    calendar_feed_tokens: [{ token, user_id: 'user', alarm: 'both' }],
    user_follows: [followedId, inactiveId].map((idol_id) => ({ user_id: 'user', idol_id })),
    idols: [
      { id: followedId, slug: 'followed', is_active: true },
      { id: inactiveId, slug: 'inactive', is_active: false },
    ],
  }
  const calls = []
  return {
    calls,
    client: {
      from(table) {
        let matching = rows[table]
        const result = (data) => table === failingTable ? { error: new Error(table) } : { data }
        return {
          select(columns) {
            calls.push([table, 'select', columns])
            return this
          },
          eq(key, value) {
            calls.push([table, 'eq', key, value])
            matching = matching.filter((row) => row[key] === value)
            return this
          },
          in(key, values) {
            calls.push([table, 'in', key, values])
            matching = matching.filter((row) => values.includes(row[key]))
            return this
          },
          maybeSingle() { return Promise.resolve(result(matching[0] ?? null)) },
          update(values) {
            calls.push([table, 'update', values])
            return this
          },
          then(resolve) { resolve(result(matching)) },
        }
      },
    },
  }
}

await check('Supabase store 以 token 查詢、對應啟用偶像 UUID 並更新存取時間', async () => {
  const { client, calls } = fakeSupabase()
  const feedStore = createSupabaseFeedStore({
    client, now, token,
    async getPublishedEvents(options) {
      assert.deepEqual(options, { throwOnError: true })
      return [event('active-event'), event('inactive-event', { idolId: 'inactive' })]
    },
  })
  assert.deepEqual(await feedStore.findByToken(token), { userId: 'user', alarm: 'both' })
  assert.equal(await feedStore.findByToken('unknown'), null)
  assert.deepEqual(await feedStore.followedIdolSlugs('user'), ['followed'])

  calls.length = 0
  const response = await buildFollowsFeedResponse({ param: `${token}.ics`, store: feedStore, origin, now })
  assert.equal(response.status, 200)
  assert.match(response.body, /UID:active-event@/)
  assert.doesNotMatch(response.body, /UID:inactive-event@/)
  assert.deepEqual(calls, [
    ['calendar_feed_tokens', 'select', 'user_id, alarm'],
    ['calendar_feed_tokens', 'eq', 'token', token],
    ['user_follows', 'select', 'idol_id'],
    ['user_follows', 'eq', 'user_id', 'user'],
    ['idols', 'select', 'slug'],
    ['idols', 'in', 'id', [followedId, inactiveId]],
    ['idols', 'eq', 'is_active', true],
    ['calendar_feed_tokens', 'update', { last_accessed_at: now.toISOString() }],
    ['calendar_feed_tokens', 'eq', 'user_id', 'user'],
    ['calendar_feed_tokens', 'eq', 'token', token],
  ])
})

await check('Supabase store 查詢錯誤回 404 且不快取', async () => {
  const log = console.error
  console.error = (...args) => assert.deepEqual(args, ['Calendar feed failed', token.slice(0, 4)])
  try {
    for (const table of ['calendar_feed_tokens', 'user_follows', 'idols']) {
      const { client, calls } = fakeSupabase(table)
      const feedStore = createSupabaseFeedStore({
        client, now, token,
        async getPublishedEvents() { assert.fail('Published events queried after a lookup failure') },
      })
      assert.deepEqual(await buildFollowsFeedResponse({ param: token, store: feedStore, origin, now }), notFound)
      assert.ok(!calls.some(([, method]) => method === 'update'))
    }
  } finally {
    console.error = log
  }
})

await check('無效或未知 token 與主要查詢失敗皆回 404 且不快取', async () => {
  let queried = false
  assert.deepEqual(await respond('bad', { async findByToken() { queried = true } }), notFound)
  assert.equal(queried, false)
  assert.deepEqual(await respond(token, { async findByToken() { return null } }), notFound)
  const logs = []
  const log = console.error
  console.error = (...args) => logs.push(args)
  try {
    for (const operation of ['findByToken', 'followedIdolSlugs', 'publishedEvents']) {
      assert.deepEqual(await respond(token, { async [operation]() { throw new Error(token) } }), notFound)
    }
  } finally {
    console.error = log
  }
  assert.equal(logs.length, 3)
  assert.ok(logs.every(([, prefix]) => prefix === token.slice(0, 4)))
  assert.ok(!JSON.stringify(logs).includes(token))
})

await check('只收錄追蹤的官方／媒體活動、保留台北日期 30 天、套用提醒及私有快取', async () => {
  let touched = false
  const response = await respond(`${token}.ics`, { async touch(userId) {
    assert.equal(userId, 'user')
    touched = true
  } })
  assert.equal(response.status, 200)
  assert.equal(touched, true)
  assert.deepEqual(response.headers, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="idol-rhythm-following.ics"',
    'Cache-Control': 'private, max-age=900',
  })
  const body = unfold(response.body)
  assert.ok(body.includes('X-WR-CALNAME:我追蹤的行程｜星動時刻\r\n'))
  assert.deepEqual([...body.matchAll(/^UID:(.+)@idol-rhythm\r$/gm)].map(([, id]) => id),
    ['concert', 'exhibit', 'media', 'cutoff', 'recent'])
  assert.equal((body.match(/TRIGGER:-P1D\r\n/g) ?? []).length, 5)
  assert.equal((body.match(/TRIGGER:-P7D\r\n/g) ?? []).length, 5)
})

await check('空追蹤及 last_accessed_at 寫入失敗仍回 200', async () => {
  let queried = false
  const empty = await respond(token, {
    async followedIdolSlugs() { return [] },
    async publishedEvents() { queried = true; return [] },
  })
  assert.equal(empty.status, 200)
  assert.equal(queried, false)
  assert.match(empty.body, /^BEGIN:VCALENDAR\r\n[\s\S]*END:VCALENDAR\r\n$/)
  assert.doesNotMatch(empty.body, /VEVENT/)
  const log = console.error
  console.error = (...args) => assert.deepEqual(args, ['Calendar feed access update failed', token.slice(0, 4)])
  try {
    const response = await respond(token, { async touch() { throw new Error(token) } })
    assert.equal(response.status, 200)
    assert.match(response.body, /BEGIN:VEVENT/)
  } finally {
    console.error = log
  }
})

await check('單一偶像 ICS 篩選邏輯不變，只改 Must #12 快取標頭', () => {
  const source = read('src/app/api/ics/idols/[slug]/route.ts')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
  assert.match(source, /getIdolBySlug/)
  assert.match(source, /getPublishedEvents\(\{\s*throwOnError:\s*true\s*\}\)/)
  assert.match(source, /event\.idolId === slug/)
  assert.match(source, /CALENDAR_NOTIFY_TRUST_LEVELS/)
  assert.match(source, /addDaysToKey\(taipeiToday\(\),\s*-30\)/)
  assert.match(source, /buildIcs\(idol\.name, events, SITE_URL\)/)
  assert.match(source, /publicIdolIcsHeaders\(/)
  assert.match(source, /status: 404, headers: PUBLIC_ICS_UNCACHEABLE_HEADERS/)
  assert.match(source, /status: 503,\s*headers: PUBLIC_ICS_UNCACHEABLE_HEADERS/)
  assert.match(source, /export const revalidate = 3600\b/)
  assert.doesNotMatch(source, /force-dynamic/)
  assert.doesNotMatch(source, /request\.url/)
})

await check('migration 068 只授權 service_role 且啟用 RLS', () => {
  const sql = read('supabase/migrations/068_calendar_feed_tokens.sql')
  for (const line of [
    'CREATE TABLE IF NOT EXISTS public.calendar_feed_tokens',
    "CHECK (token ~ '^[A-Za-z0-9_-]{43}$')",
    "CHECK (alarm IN ('none', 'day_before', 'week_before', 'both'))",
    'ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;',
    'REVOKE ALL ON public.calendar_feed_tokens FROM anon, authenticated;',
    'GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_feed_tokens TO service_role;',
  ]) assert.ok(sql.includes(line), line)
  assert.doesNotMatch(sql, /\bCREATE\s+POLICY\b|\bGRANT\b[^;]*\bTO\b[^;]*\b(?:authenticated|anon)\b/i)
})

await check('route 不記錄完整 token，client 檔案不匯入 service client', () => {
  for (const path of [
    'src/app/api/ics/me/[token]/route.ts',
    'src/app/api/calendar-feed/route.ts',
    'src/lib/ics/followsFeed.ts',
  ]) {
    // Allow a four-character prefix. Flag direct use of any of the token aliases in log calls.
    const source = read(path).replace(/\btoken\.slice\(0, 4\)/g, 'prefix')
    assert.doesNotMatch(source, /console\.\w+\s*\([^\n;]*\b(?:token|feedToken|param)\b/i, path)
  }

  const src = new URL('src/', root)
  for (const path of readdirSync(src, { recursive: true })) {
    if (!/\.[cm]?[jt]sx?$/.test(path)) continue
    const source = readFileSync(new URL(path, src), 'utf8')
    if (/^\s*['"]use client['"];?/m.test(source)) {
      assert.doesNotMatch(source, /(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"][^'"]*\/serviceClient(?:\.[cm]?[jt]s)?['"]/, path)
    }
  }
})
