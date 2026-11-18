// 檢查 F1「我想去」純函式、migration 064 護欄與白名單：node scripts/check-event-wants.mjs
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { registerHooks } from 'node:module'
import { getRandomValues } from 'node:crypto'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })
const w = await import('../src/lib/eventWants.ts')
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(ROOT + p, 'utf8')
const check = (name, fn) => { fn(); console.log(`PASS ${name}`) }
const upper = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'
const crypto = { getRandomValues }

check('D1 裝置 id 產生', () => {
  const id = w.createDeviceId({ randomUUID: () => upper, getRandomValues })
  assert.equal(id, upper.toLowerCase())
  assert(w.isDeviceId(id))
  const ids = Array.from({ length: 200 }, () => w.createDeviceId(crypto))
  for (const id of ids) {
    assert(w.isDeviceId(id))
    const hex = id.replaceAll('-', '')
    assert.equal(hex[12], '4')
    assert.match(hex[16], /^[89ab]$/)
  }
  assert.equal(new Set(ids).size, 200)
})

check('D2 v4 格式', () => {
  for (const id of ['', null, 123, upper.replace('4CCC', '11ef'), upper.slice(1), ' ' + upper]) {
    assert.equal(w.isDeviceId(id), false)
  }
  assert(w.isDeviceId(upper))
})

check('D3 儲存', () => {
  const values = new Map([[w.WANT_DEVICE_STORAGE_KEY, 'invalid']])
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(w.getStoredDeviceId(storage), null)
  assert.equal(w.getStoredDeviceId({ getItem() { throw new Error('blocked') } }), null)
  const id = w.ensureDeviceId(storage, crypto)
  assert(w.isDeviceId(id))
  assert.equal(values.get(w.WANT_DEVICE_STORAGE_KEY), id)
  assert.equal(w.ensureDeviceId(storage, crypto), id)
  assert.equal(w.ensureDeviceId({ getItem: () => null, setItem() { throw new Error('blocked') } }, crypto), null)
  assert.equal(w.ensureDeviceId({ getItem: () => null, setItem() {} }, crypto), null)
  assert.equal(w.ensureDeviceId(null, crypto), null)
})

check('E1 錯誤分類', () => {
  for (const code of ['PGRST202', '42883', '42501']) assert.equal(w.classifyWantRpcError({ code }), 'missing')
  assert.equal(w.classifyWantRpcError({ message: 'Could not find the function public.get_event_wants' }), 'missing')
  assert.equal(w.classifyWantRpcError({ message: 'function public.get_event_wants does not exist' }), 'missing')
  for (const err of [{ code: '23505' }, { message: 'Failed to fetch' }, { code: 'PGRST301' }]) {
    assert.equal(w.classifyWantRpcError(err), 'other')
  }
  for (const empty of [null, undefined]) assert.equal(w.classifyWantRpcError(empty), null)
})

check('T1 樂觀 toggle', () => {
  const before = { count: 0, wanted: false }
  const active = { count: 1, wanted: true }
  assert.deepEqual(w.optimisticWant(before, true), active)
  assert.deepEqual(w.optimisticWant(active, false), before)
  assert.deepEqual(w.optimisticWant({ count: 0, wanted: true }, false), before)
  assert.equal(w.optimisticWant(before, false), before)
})

check('T2 結果解讀', () => {
  const before = { count: 0, wanted: false }
  for (const kind of ['ok', 'rate_limited']) {
    assert.deepEqual(w.resolveWantResult(before, { status_code: kind, is_wanted: true, want_count: 3 }), {
      kind, state: { count: 3, wanted: true },
    })
    for (const count of [-1, '3', 1.5]) {
      assert.equal(w.resolveWantResult(before, { status_code: kind, is_wanted: true, want_count: count }).state, before)
    }
    assert.equal(w.resolveWantResult(before, { status_code: kind, is_wanted: 'true', want_count: 3 }).state, before)
  }
  for (const row of [{ status_code: 'not_found' }, { status_code: 'invalid' }, { status_code: 'weird' }, null]) {
    assert.deepEqual(w.resolveWantResult(before, row), { kind: 'gone' })
  }
})

check('N1 id 正規化與批次', () => {
  const v1 = upper.replace('4CCC', '11EF')
  assert.deepEqual(w.normalizeEventIds([upper, 'mock-1', v1, upper.toLowerCase()]), [upper.toLowerCase(), v1.toLowerCase()])
  const ids = Array.from({ length: 250 }, () => w.createDeviceId(crypto))
  assert.deepEqual(w.chunkIds(ids).map(chunk => chunk.length), [100, 100, 50])
  assert.deepEqual(w.chunkIds(ids).flat(), ids)
  assert.equal(w.WANT_LIMITS.maxIdsPerRequest, 100)
})

check('F1 文案', () => {
  for (const count of [0, -1, 1.5]) assert.equal(w.formatWantCount(count), '')
  assert.equal(w.formatWantCount(1), '1 人想去')
  assert.equal(w.formatWantCount(999), '999 人想去')
  assert.equal(w.formatWantCount(1000), '999+ 人想去')
  assert.deepEqual(w.WANT_COPY, {
    idle: '我想去',
    active: '已標記想去',
    zero: '匿名計數，不會顯示你是誰',
    rateLimited: '操作太頻繁，請稍後再試',
    storageBlocked: '這個瀏覽器無法記住你的選擇，登入後再試',
  })
})

const assertIncludes = (source, snippet) => assert(source.includes(snippet), `缺少 ${snippet}`)
const assertAbsent = (source, snippet) => assert(!source.includes(snippet), `發現禁用字串 ${snippet}`)
const assertCount = (source, snippet, times) => assert.equal(source.split(snippet).length - 1, times, snippet)

check('S1 migration 護欄', () => {
  const filename = '064_event_wants.sql'
  assert(readdirSync(ROOT + 'supabase/migrations').includes(filename), filename)
  const lines = read('supabase/migrations/' + filename).split('\n')
  const comments = lines.filter(line => line.trimStart().startsWith('--')).join('\n')
  const sql = lines.filter(line => !line.trimStart().startsWith('--')).join('\n')
  for (const snippet of [
    'SECURITY DEFINER', "SET search_path = ''", 'ENABLE ROW LEVEL SECURITY',
    'CREATE UNIQUE INDEX', "e.trust_level IN ('official', 'media', 'aggregator')",
    "e.status <> 'cancelled'", 'e.is_published = true', "'idol-rhythm:f1:device:'",
  ]) assertCount(sql, snippet, 2)

  for (const table of ['event_wants', 'event_want_actions']) {
    assertIncludes(sql, `REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated, service_role;`)
    assertIncludes(sql, `REVOKE ALL ON SEQUENCE public.${table}_id_seq FROM PUBLIC, anon, authenticated, service_role;`)
    assertIncludes(comments, `DROP TABLE IF EXISTS public.${table};`)
  }
  for (const signature of ['set_event_want(uuid, boolean, uuid)', 'get_event_wants(uuid[], uuid)']) {
    assertIncludes(sql, `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`)
    assertIncludes(sql, `GRANT EXECUTE ON FUNCTION public.${signature} TO anon, authenticated;`)
    assertIncludes(comments, `DROP FUNCTION IF EXISTS public.${signature};`)
  }
  for (const snippet of [
    `interval '1 minute') >= ${w.WANT_LIMITS.perMinute}`,
    `interval '1 hour') >= ${w.WANT_LIMITS.perHour}`,
    `interval '10 minutes') >= ${w.WANT_LIMITS.anonAddsPerEventPer10Min}`,
    `cardinality(p_event_ids) <= ${w.WANT_LIMITS.maxIdsPerRequest}`,
  ]) assertIncludes(sql, snippet)
  for (const snippet of [
    'CREATE POLICY', 'ALTER TABLE public.events', 'GRANT SELECT', 'GRANT INSERT',
    'GRANT UPDATE', 'GRANT DELETE', 'request.headers', 'x-forwarded-for', 'json_agg', 'pgcrypto', 'extensions.',
  ]) assertAbsent(sql, snippet)
})

const pure = 'src/lib/eventWants.ts'
const rpc = 'src/lib/supabase/eventWants.ts'
const ui = 'src/components/EventWant.tsx'
const detail = 'src/app/events/[id]/page.tsx'
const cards = ['src/components/UpcomingEventCard.tsx', 'src/components/EventCard.tsx']

check('S2 前端護欄', () => {
  const sources = readdirSync(ROOT + 'src', { recursive: true }).filter(p => /\.tsx?$/.test(p))
  for (const path of sources) {
    assert.doesNotMatch(read('src/' + path), /\.from\(\s*['"]event_wants?(?:_actions)?['"]/, path)
  }
  for (const path of [pure, rpc, ui]) {
    for (const snippet of ['console.error', 'throw ']) assertAbsent(read(path), snippet)
  }
  for (const snippet of ["from 'react'", '@supabase', "'@/", 'enum ', 'namespace ']) assertAbsent(read(pure), snippet)
  for (const snippet of ["rpc('get_event_wants'", "rpc('set_event_want'", 'p_device_id']) assertIncludes(read(rpc), snippet)
  assert.equal(read(ui).split('\n')[0], "'use client'")
  for (const snippet of ['aria-pressed', 'aria-live="polite"', 'min-h-[44px]']) assertIncludes(read(ui), snippet)
  assertAbsent(read(ui), 'Heart')
  assertIncludes(read(detail), '{!isDemoEvent && <EventWantButton eventId={event.id} />}')
  for (const path of cards) assertCount(read(path), '<EventWantCount eventId={event.id}', 1)
})

check('G1 F1 檔案在合併後未被改動', () => {
  execFileSync('git', [
    'diff', '--quiet', 'd80967c', '--',
    'supabase/migrations/064_event_wants.sql', pure, rpc, ui, ...cards, detail,
  ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] })
})

console.log('OK F1 event wants 檢查全部通過')
