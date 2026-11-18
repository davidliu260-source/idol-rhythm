// 檢查 F3 純函式、migration 066、前端護欄與白名單。
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { registerHooks } from 'node:module'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })
const f = await import('../src/lib/eventStamps.ts')
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = path => readFileSync(join(ROOT, path), 'utf8')
const check = (name, fn) => { fn(); console.log(`PASS ${name}`) }
const assertIncludes = (source, snippet) => assert(source.includes(snippet), `缺少：${snippet}`)
const assertAbsent = (source, snippet) => assert(!source.includes(snippet), `不應出現：${snippet}`)
const assertCount = (source, snippet, count) => assert.equal(source.split(snippet).length - 1, count, snippet)

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

check('K1 常數', () => {
  assert.equal(f.STAMP_STORAGE_KEY, 'idol-rhythm:stamps:v1')
  assert.equal(f.STAMP_LOCAL_MAX, 500)
  assert.deepEqual(f.STAMP_COPY, {
    title: '去過蓋章',
    stamp: '蓋章',
    stamped: '已蓋章',
    ariaStamp: '標記我去過',
    ariaUnstamp: '取消去過蓋章',
    hintEmpty: '在已開始或已結束的收藏活動按「蓋章」，記下你去過的場次',
    hint: '蓋章只有你自己看得到',
  })
})

check('I1 UUID', () => {
  for (const id of [A, A.toUpperCase()]) assert.equal(f.isStampableId(id), true)
  for (const id of ['bts-1', '', null, 123, ` ${A}`, `${A} `, `${A}\n`]) {
    assert.equal(f.isStampableId(id), false)
  }
})

check('L1 本機讀寫', () => {
  const items = {}
  const storage = {
    getItem: key => items[key] ?? null,
    setItem: (key, value) => { items[key] = value },
  }
  assert.equal(f.writeStampIds(storage, [A, B]), true)
  assert.deepEqual(f.readStampIds(storage), [A, B])
  for (const raw of [null, 'not json', '{}', '"x"']) {
    items[f.STAMP_STORAGE_KEY] = raw
    assert.deepEqual(f.readStampIds(storage), [])
  }
  const mixed = [A.toUpperCase(), 'demo', A, 123, B]
  items[f.STAMP_STORAGE_KEY] = JSON.stringify(mixed)
  assert.deepEqual(f.readStampIds(storage), [A, B])
  assert.equal(f.writeStampIds(storage, mixed), true)
  assert.equal(items[f.STAMP_STORAGE_KEY], JSON.stringify([A, B]))
  const many = Array.from({ length: 501 }, (_, index) => `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString(16).padStart(12, '0')}`)
  items[f.STAMP_STORAGE_KEY] = JSON.stringify(many)
  assert.deepEqual(f.readStampIds(storage), many.slice(0, 500))
  assert.deepEqual(f.readStampIds({ getItem() { throw new Error('blocked') } }), [])
  assert.equal(f.writeStampIds({ setItem() { throw new Error('blocked') } }, [A]), false)
  assert.deepEqual(f.readStampIds(null), [])
  assert.equal(f.writeStampIds(null, [A]), false)
})

check('T1 切換', () => {
  const ids = Object.freeze([A, B])
  assert.deepEqual(f.toggleStampId([], A), [A])
  assert.deepEqual(f.toggleStampId(ids, A), [B])
  assert.deepEqual(f.toggleStampId(ids, A.toUpperCase()), [B])
  assert.deepEqual(f.toggleStampId(ids, 'demo'), [A, B])
  assert.deepEqual(ids, [A, B])
})

check('E1 錯誤分類', () => {
  const cases = [
    [{ code: '42P01' }, 'missing'],
    [{ code: 'PGRST205' }, 'missing'],
    [{ message: "Could not find the table 'public.event_stamps' in the schema cache" }, 'missing'],
    [{ message: 'relation "public.event_stamps" does not exist' }, 'missing'],
    [{ code: '42501', message: 'permission denied for table event_stamps' }, 'missing'],
    [{ code: '42501', message: 'new row violates row-level security policy for table "event_stamps"' }, 'rejected'],
    [{ code: '23503' }, 'rejected'],
    [{ code: '23505' }, 'duplicate'],
    [{ code: '22P02' }, 'other'],
    [{ message: 'Failed to fetch' }, 'other'],
    [null, null],
    [undefined, null],
  ]
  for (const [error, kind] of cases) assert.equal(f.classifyStampError(error), kind)
})

check('V1 台北日期資格', () => {
  const now = new Date('2026-11-18T04:00:00Z')
  for (const date of ['2026-11-17', '2026-11-18', '2026-11-18T00:00:00']) {
    assert.equal(f.isStampEligible({ id: A, date }, now), true)
  }
  for (const date of ['2026-11-19', '', 'bad']) {
    assert.equal(f.isStampEligible({ id: A, date }, now), false)
  }
  assert.equal(f.isStampEligible({ id: A, date: '2026-11-19' }, new Date('2026-11-18T16:30:00Z')), true)
  assert.equal(f.isStampEligible({ id: 'demo', date: '2026-11-18' }, now), false)
})

check('C1 計數與文案', () => {
  assert.equal(f.countStamps([A, B], [{ id: A }, { id: C }]), 1)
  assert.equal(f.countStamps([A.toUpperCase(), B], [{ id: A }, { id: B.toUpperCase() }, { id: B }]), 2)
  assert.equal(f.countStamps([], [{ id: A }]), 0)
  assert.equal(f.countStamps([A], []), 0)
  assert.equal(f.formatStampCount(3), '已蓋 3 章')
  for (const n of [0, -1, 1.5]) assert.equal(f.formatStampCount(n), '已蓋 0 章')
})

const migration = 'supabase/migrations/066_event_stamps.sql'
const pure = 'src/lib/eventStamps.ts'
const db = 'src/lib/supabase/eventStamps.ts'
const hook = 'src/lib/useEventStamps.ts'
const atlas = 'src/app/atlas/AtlasClient.tsx'
const script = 'scripts/check-event-stamps.mjs'

check('S1 migration 護欄', () => {
  assert.equal(readdirSync(join(ROOT, 'supabase/migrations')).sort().at(-1), '066_event_stamps.sql')
  const lines = read(migration).split('\n')
  const comment = /^\s*--/
  const sql = lines.filter(line => !comment.test(line)).join('\n')
  for (const snippet of [
    'CREATE TABLE IF NOT EXISTS public.event_stamps',
    'ENABLE ROW LEVEL SECURITY',
    'REVOKE ALL ON TABLE public.event_stamps FROM PUBLIC, anon, authenticated, service_role;',
    'GRANT SELECT, INSERT, DELETE ON TABLE public.event_stamps TO authenticated;',
    'PRIMARY KEY (user_id, event_id)', 'REFERENCES auth.users (id) ON DELETE CASCADE',
    'REFERENCES public.events (id) ON DELETE CASCADE', 'FOR SELECT', 'FOR INSERT', 'FOR DELETE',
    'WITH CHECK', 'GRANT ', 'ALTER TABLE',
  ]) assertCount(sql, snippet, 1)
  assertCount(sql, 'CREATE POLICY', 3)
  assertCount(sql, 'TO authenticated', 4)
  assertCount(sql, 'auth.uid() = user_id', 3)
  assertCount(sql.toLowerCase(), 'service_role', 1)
  for (const snippet of [
    'e.is_published = true', "e.trust_level IN ('official', 'media', 'aggregator')", "e.status <> 'cancelled'",
    "COALESCE(e.start_date, e.date) <= (now() AT TIME ZONE 'Asia/Taipei')::date",
    "NOTIFY pgrst, 'reload schema';",
  ]) assertIncludes(sql, snippet)
  for (const snippet of [
    'security definer', 'create function', 'create or replace', 'create view', 'grant update', 'grant all',
    'to anon', 'for update', 'for all', 'alter table public.events', 'alter table public.saved_events',
    'on public.events', 'json_agg', 'event_wants', 'fan_wish',
  ]) assertAbsent(sql.toLowerCase(), snippet)
  assertIncludes(lines.filter(line => comment.test(line)).join('\n'), 'DROP TABLE IF EXISTS public.event_stamps;')
})

check('S2 前端護欄', () => {
  const src = readdirSync(join(ROOT, 'src'), { recursive: true, withFileTypes: true })
  const uses = src.filter(entry => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map(entry => join(entry.parentPath, entry.name))
    .filter(path => /\.from\(\s*['"]event_stamps['"]/.test(readFileSync(path, 'utf8')))
  assert.deepEqual(uses, [join(ROOT, db)])

  for (const path of [pure, db, hook]) {
    const source = read(path)
    for (const snippet of ['console.error', 'throw ', '.rpc(', '.update(', '.upsert(', 'textarea', '<input', 'upload']) {
      assertAbsent(source, snippet)
    }
    assert.doesNotMatch(source, /\.\.\.\s*new (Set|Map)\b/)
    assert.doesNotMatch(source, /\.\.\.[\w.]*\.(values|keys|entries)\(\)/)
  }
  for (const snippet of ["from 'react'", '@supabase', "'@/", 'enum ', 'namespace ']) assertAbsent(read(pure), snippet)
  assertIncludes(read(pure), "from './taipeiDate'")
  const api = read(db)
  for (const snippet of [".from('event_stamps')", ".eq('user_id'", 'console.warn']) assertIncludes(api, snippet)
  for (const snippet of ['count:', "select('*')"]) assertAbsent(api, snippet)
  assert.equal(read(hook).split('\n')[0], "'use client'")

  const page = read(atlas)
  assertCount(page, 'useEventStamps(user, isUserLoading)', 1)
  assertCount(page, 'stamps={stamps}', 4)
  assertCount(page, 'stampCount={null}', 2)
  for (const snippet of [
    'aria-pressed={isStamped}', 'min-h-[44px]', 'onKeyDown={(keyEvent) => keyEvent.stopPropagation()}',
    'isStampEligible(event)', '尚未開放', '之後可以替去過的演唱會、快閃、生咖蓋章',
    "import { getEventLocationLabel } from '@/lib/eventLocation'",
  ]) assertIncludes(page, snippet)
  for (const snippet of ['textarea', '<input type="file"']) assertAbsent(page, snippet)
})

check('S3 禁止字面隱藏字元', () => {
  for (const path of [migration, pure, db, hook, atlas, script]) {
    assert.doesNotMatch(read(path), /[\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]/, path)
  }
})

check('G1 白名單', () => {
  const allowed = new Set([migration, pure, db, hook, atlas, script, 'scripts/check-wishes.mjs', 'WORKING.md'])
  const git = args => execFileSync('git', [...args, '-z'], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  }).split('\0').filter(Boolean)
  const touched = new Set([...git(['diff', '--name-only', 'd7f6442']), ...git(['ls-files', '--others', '--exclude-standard'])])
  for (const path of touched) assert(allowed.has(path), `白名單外的檔案：${path}`)
})

console.log('OK F3 event stamps 檢查全部通過')
