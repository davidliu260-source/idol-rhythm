// 檢查 F2 純函式、migration 065、前端護欄與白名單：node scripts/check-wishes.mjs
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { registerHooks } from 'node:module'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })
const f = await import('../src/lib/fanWishes.ts')
const w = await import('../src/lib/eventWants.ts')
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = path => readFileSync(join(ROOT, path), 'utf8')
const check = (name, fn) => { fn(); console.log(`PASS ${name}`) }
const assertIncludes = (source, snippet) => assert(source.includes(snippet), `缺少：${snippet}`)
const assertAbsent = (source, snippet) => assert(!source.includes(snippet), `不應出現：${snippet}`)
const assertCount = (source, snippet, count) => assert.equal(source.split(snippet).length - 1, count, snippet)

const copy = {
  title: '許願池',
  intro: '找不到你的團或城市？告訴我們，我們會優先補資料。',
  kindGroup: '加一個團',
  kindCity: '加一個城市',
  placeholderGroup: '團名或藝人名，例如 aespa',
  placeholderCity: '城市名，例如 台中',
  submit: '送出',
  received: '已收到，謝謝你！',
  duplicate: '你已許過這個願',
  rateLimited: '送出太頻繁，請稍後再試',
  invalid: '請輸入 1–40 字的名稱，不能有網址或換行',
  storageBlocked: '這個瀏覽器無法記住你的選擇，登入後再試',
  privacy: '只收名稱，不收留言；不會公開你是誰',
}
const names = [
  ['  BLACK　PINK  ', 'black pink'], ['ＡＥＳＰＡ', 'aespa'], ['에스파', '에스파'],
  ['(G)I-DLE', '(g)i-dle'], ['&TEAM', '&team'], ['台中', '台中'], ['Mr.Children', 'mr.children'],
  ['a'.repeat(40), 'a'.repeat(40)], ['가'.repeat(40), '가'.repeat(40)],
  ...[
    'a\nb', 'a\tb', 'a\u200Bb', 'a\u202Eb', 'https://x.com', 'www.abc', 'abc.com', 'abc.com/x',
    'me@x', '<b>', 'a'.repeat(41), 'x'.repeat(201), '', '   ', null, 123,
  ].map(raw => [raw, null]),
]

check('K1 常數', () => {
  assert.deepEqual(f.WISH_KINDS, ['add_group', 'add_city'])
  for (const kind of f.WISH_KINDS) assert.equal(f.isWishKind(kind), true)
  for (const kind of ['add_idol', '', null]) assert.equal(f.isWishKind(kind), false)
  assert.equal(f.WISH_NAME_MAX_CHARS, 40)
  assert.equal(f.WISH_RAW_MAX_CHARS, 200)
  assert.deepEqual(f.WISH_LIMITS, { perMinute: 5, perDay: 20, anonPer10MinSitewide: 100 })
  assert.deepEqual(f.WISH_COPY, copy)
})

check('N1 正規化', () => {
  for (const [raw, expected] of names) assert.equal(f.normalizeWishName(raw), expected, JSON.stringify(raw))
})

check('N2 冪等', () => {
  for (const [, name] of names) {
    if (name !== null) assert.equal(f.normalizeWishName(name), name)
  }
})

check('D1 裝置 id 共用', () => {
  assert.equal(f.ensureDeviceId, w.ensureDeviceId)
  assert.equal(f.getStoredDeviceId, w.getStoredDeviceId)
  assert.equal(f.classifyWishRpcError, w.classifyWantRpcError)
})

check('E1 錯誤分類降級', () => {
  for (const code of ['PGRST202', '42883', '42501']) assert.equal(f.classifyWishRpcError({ code }), 'missing')
  assert.equal(f.classifyWishRpcError({ message: 'Could not find the function public.submit_fan_wish' }), 'missing')
  assert.equal(f.classifyWishRpcError({ code: '23505' }), 'other')
  assert.equal(f.classifyWishRpcError({ message: 'Failed to fetch' }), 'other')
  for (const error of [null, undefined]) assert.equal(f.classifyWishRpcError(error), null)
})

check('R1 結果映射', () => {
  for (const kind of ['ok', 'duplicate']) {
    assert.deepEqual(f.resolveWishResult({ status_code: kind, wish_name: 'aespa' }), { kind, name: 'aespa' })
  }
  assert.deepEqual(f.resolveWishResult({ status_code: 'ok', wish_name: 3 }), { kind: 'ok', name: '' })
  for (const kind of ['rate_limited', 'invalid']) assert.deepEqual(f.resolveWishResult({ status_code: kind }), { kind })
  for (const row of [{ status_code: 'not_found' }, { status_code: 'weird' }, null, undefined, {}]) {
    assert.deepEqual(f.resolveWishResult(row), { kind: 'gone' })
  }
})

check('M1 提示文案', () => {
  for (const [kind, notice] of Object.entries({
    ok: copy.received, duplicate: copy.duplicate, rate_limited: copy.rateLimited, invalid: copy.invalid, gone: '',
  })) assert.equal(f.wishNotice(kind), notice)
})

const filename = '065_fan_wishes.sql'
const migration = `supabase/migrations/${filename}`
const pure = 'src/lib/fanWishes.ts'
const rpc = 'src/lib/supabase/fanWishes.ts'
const form = 'src/components/FanWishForm.tsx'
const idols = 'src/app/idols/IdolsClient.tsx'
const cities = 'src/app/cities/page.tsx'
const functions = ['submit_fan_wish(text, text, uuid)', 'fan_wishes_enabled()', 'fan_wish_normalize_name(text)']
const tables = ['fan_wishes', 'fan_wish_actions']

check('S1 migration 護欄', () => {
  assert.equal(readdirSync(join(ROOT, 'supabase/migrations')).sort().at(-1), filename)
  const lines = read(migration).split('\n')
  const comments = lines.filter(line => /^\s*--/.test(line)).join('\n')
  const sql = lines.filter(line => !/^\s*--/.test(line)).join('\n')
  for (const [snippet, count] of [
    ['SECURITY DEFINER', 1], ["SET search_path = ''", 3], ['ENABLE ROW LEVEL SECURITY', 2],
    ['CREATE UNIQUE INDEX', 2], ["'idol-rhythm:f2:device:'", 1], ["'idol-rhythm:f2:user:'", 1],
  ]) assertCount(sql, snippet, count)

  const roles = 'FROM PUBLIC, anon, authenticated, service_role;'
  for (const table of tables) {
    assertIncludes(sql, `REVOKE ALL ON TABLE public.${table} ${roles}`)
    assertIncludes(sql, `REVOKE ALL ON SEQUENCE public.${table}_id_seq ${roles}`)
    assertIncludes(comments, `DROP TABLE IF EXISTS public.${table};`)
  }
  for (const signature of functions) {
    assertIncludes(sql, `REVOKE ALL ON FUNCTION public.${signature} ${roles}`)
    assertIncludes(comments, `DROP FUNCTION IF EXISTS public.${signature};`)
  }
  for (const signature of functions.slice(0, 2)) {
    assertIncludes(sql, `GRANT EXECUTE ON FUNCTION public.${signature} TO anon, authenticated;`)
  }
  const { perMinute, perDay, anonPer10MinSitewide } = f.WISH_LIMITS
  for (const snippet of [
    `interval '1 minute') >= ${perMinute}`, `interval '1 day') >= ${perDay}`,
    `interval '10 minutes') >= ${anonPer10MinSitewide}`,
    `char_length(p_raw) > ${f.WISH_RAW_MAX_CHARS}`, `char_length(v) > ${f.WISH_NAME_MAX_CHARS}`,
    `BETWEEN 1 AND ${f.WISH_NAME_MAX_CHARS}`, `(${f.WISH_TLDS})`,
    "pg_catalog.normalize(p_raw, 'NFKC')", "kind IN ('add_group', 'add_city')",
    "p_kind NOT IN ('add_group', 'add_city')",
  ]) assertIncludes(sql, snippet)
  for (const snippet of [
    'GRANT EXECUTE ON FUNCTION public.fan_wish_normalize_name', 'CREATE POLICY',
    'ALTER TABLE public.idols', 'ALTER TABLE public.events', 'GRANT SELECT', 'GRANT INSERT',
    'GRANT UPDATE', 'GRANT DELETE', 'request.headers', 'x-forwarded-for', 'json_agg', 'pgcrypto',
    'extensions.', 'event_wants', 'set_event_want', 'get_event_wants',
  ]) assertAbsent(sql.toLowerCase(), snippet.toLowerCase())
})

check('S2 前端護欄', () => {
  const files = readdirSync(join(ROOT, 'src'), { recursive: true, withFileTypes: true })
  for (const file of files) {
    if (!file.isFile() || !/\.tsx?$/.test(file.name)) continue
    const path = join(file.parentPath, file.name)
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /\.from\(\s*['"]fan_wish/, path)
    assertAbsent(source, 'fan_wish_normalize_name')
  }
  for (const path of [pure, rpc, form]) {
    const source = read(path)
    for (const snippet of ['console.error', 'throw ', 'textarea']) assertAbsent(source, snippet)
    assert.doesNotMatch(source, /\.\.\.\s*new (Set|Map)\b/, path)
    assert.doesNotMatch(source, /\.\.\.[\w.]*\.(values|keys|entries)\(\)/, path)
  }
  for (const snippet of ["from 'react'", '@supabase', "'@/", 'enum ', 'namespace ']) assertAbsent(read(pure), snippet)
  for (const snippet of ["rpc('fan_wishes_enabled'", "rpc('submit_fan_wish'", 'p_device_id']) assertIncludes(read(rpc), snippet)
  for (const snippet of ['event_wants', 'get_event_wants', 'set_event_want']) assertAbsent(read(rpc), snippet)
  const ui = read(form)
  assert.equal(ui.split('\n')[0], "'use client'")
  for (const snippet of ['aria-pressed', 'aria-live="polite"', 'min-h-[44px]', 'maxLength={WISH_NAME_MAX_CHARS}']) assertIncludes(ui, snippet)
  assertCount(ui, '<input', 1)
  assertCount(read(idols), '<FanWishForm defaultKind="add_group" />', 1)
  assertCount(read(cities), '<FanWishForm defaultKind="add_city" className="mt-4" />', 1)
  assertIncludes(read(cities), '尚未開放')
})

check('S3 禁止字面隱藏字元', () => {
  const hiddenCharacters = /[\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]/
  for (const path of [migration, pure, rpc, form]) {
    assert.doesNotMatch(read(path), hiddenCharacters, `含字面隱藏字元：${path}`)
  }
})

check('G1 白名單', () => {
  const allowed = new Set([
    migration, pure, rpc, form, idols, cities, 'scripts/check-wishes.mjs', 'scripts/check-event-wants.mjs', 'WORKING.md',
  ])
  const git = args => execFileSync('git', [...args, '-z'], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  }).split('\0').filter(Boolean)
  const touched = new Set([...git(['diff', '--name-only', 'd80967c']), ...git(['ls-files', '--others', '--exclude-standard'])])
  for (const path of touched) assert(allowed.has(path), `白名單外的檔案：${path}`)
})

console.log('OK F2 fan wishes 檢查全部通過')
