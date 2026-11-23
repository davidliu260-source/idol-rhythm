import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import test from 'node:test'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })

const { formatTaipeiDateTime } = await import('../src/lib/taipeiDate.ts')
const {
  ERROR_REPORT_REASONS, NOTE_MAX, validateNoteClient, resolveReportResult, classifyReportRpcError,
} = await import('../src/lib/eventErrorReports.ts')
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const sql = read('supabase/migrations/071_event_error_reports.sql')

test('時間轉成台北時間，跨日採用 00 時，與執行環境時區無關', () => {
  const original = process.env.TZ
  try {
    for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = zone
      assert.equal(formatTaipeiDateTime('2026-11-23T08:05:00Z'), '2026/11/23 16:05')
      assert.equal(formatTaipeiDateTime('2026-11-23T08:05:00.123456+00:00'), '2026/11/23 16:05')
      assert.equal(formatTaipeiDateTime('2026-11-23T16:30:00Z'), '2026/11/24 00:30')
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
  for (const invalid of [null, undefined, '', '無效']) assert.equal(formatTaipeiDateTime(invalid), null)
})

test('活動詳情只在正式活動資訊來源中顯示時間與回報', () => {
  const page = read('src/app/events/[id]/page.tsx')
  const sourceSection = page.split('資訊來源')[1]?.split('</section>')[0]
  assert.match(sourceSection, /查看來源[\s\S]+資料最後更新：\{updatedAt\}（台北時間）[\s\S]+!isDemoEvent && <EventErrorReport/)
  assert.match(page, /updatedAt = isDemoEvent \? null : formatTaipeiDateTime\(event.updatedAt\)/)
  assert.doesNotMatch(page, /最後確認|mailto:/)
  assert.match(read('src/lib/supabase/events.ts'), /updatedAt: row\.updated_at \?\? undefined/)
})

test('前台理由與資料庫限制一致，備註驗證含 NFKC、長度與禁用字元', () => {
  const reasons = sql.match(/CHECK \(reason IN \(([^)]+)\)\)/)?.[1]
  assert.deepEqual(Object.keys(ERROR_REPORT_REASONS), [...reasons.matchAll(/'([^']+)'/g)].map(match => match[1]))
  assert.equal(NOTE_MAX, 200)
  for (const blank of [null, undefined, '', ' 　 ', '\u1680']) {
    assert.deepEqual(validateNoteClient(blank), { ok: true, note: null })
  }
  assert.deepEqual(validateNoteClient('  Ａ　場館 '), { ok: true, note: 'A 場館' })
  assert.deepEqual(validateNoteClient('a\nb'), { ok: true, note: 'a b' })
  assert.deepEqual(validateNoteClient('a\r\n\tb'), { ok: true, note: 'a b' })
  assert.deepEqual(validateNoteClient('🎵'.repeat(200)), { ok: true, note: '🎵'.repeat(200) })
  for (const invalid of ['ＨＴＴＰＳ：//example.com', 'EXAMPLE.COM', '@帳號', '<b>', 'a'.repeat(201),
    ' '.repeat(401), 'a\u000Bb', 'a\u200Bb', 'a\u202Eb', 'a\u2066b', 'ﬃ'.repeat(67)]) {
    assert.deepEqual(validateNoteClient(invalid), { ok: false }, invalid)
  }
})

test('前台識別 RPC 結果與未套用 migration', () => {
  for (const status of ['ok', 'duplicate', 'rate_limited', 'invalid']) {
    assert.deepEqual(resolveReportResult({ status_code: status }), { kind: status })
  }
  for (const row of [null, undefined, { status_code: 'unknown' }]) {
    assert.deepEqual(resolveReportResult(row), { kind: 'gone' })
  }
  for (const code of ['PGRST202', '42883', '42501']) {
    assert.equal(classifyReportRpcError({ code }), 'missing')
  }
  assert.equal(classifyReportRpcError({ message: 'Could not find the function' }), 'missing')
  assert.equal(classifyReportRpcError({ code: 'unexpected' }), 'other')
  assert.equal(classifyReportRpcError(null), null)
})

test('071 限制讀寫權限，RPC 實作可見性、限速與回滾護欄', () => {
  for (const table of ['event_error_reports', 'event_error_report_actions']) {
    assert.ok(sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`))
    for (const target of [`TABLE public.${table}`, `SEQUENCE public.${table}_id_seq`]) {
      assert.ok(sql.includes(`REVOKE ALL ON ${target} FROM PUBLIC, anon, authenticated, service_role;`))
    }
  }
  assert.deepEqual(sql.match(/^GRANT .*;/gm), [
    'GRANT SELECT (id, event_id, reason, note, created_at) ON public.event_error_reports TO authenticated;',
    'GRANT EXECUTE ON FUNCTION public.submit_event_error_report(uuid, text, text, uuid) TO anon, authenticated;',
    'GRANT EXECUTE ON FUNCTION public.event_error_reports_enabled() TO anon, authenticated;',
  ])
  assert.match(sql, /CREATE POLICY "event_error_reports: admin_users select"\s+ON public\.event_error_reports\s+FOR SELECT TO authenticated\s+USING \(\s*EXISTS \(\s*SELECT 1\s+FROM public\.admin_users\s+WHERE admin_users\.user_id = \(SELECT auth\.uid\(\)\)\s+AND admin_users\.is_active = true\s*\)\s*\)/)
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/)
  assert.match(sql, /e\.is_published = true\s+AND e\.trust_level IN \('official', 'media', 'aggregator'\)\s+AND e\.status <> 'cancelled'/)
  assert.match(sql, /pg_advisory_xact_lock\(65078, 0\)/)
  for (const [window, limit] of [['1 minute', 3], ['1 day', 20], ['10 minutes', 100]]) {
    assert.ok(sql.includes(`interval '${window}') >= ${limit}`))
  }
  assert.doesNotMatch(sql, /^\s+\w*(?:ip|email|user_agent)\w*\s+(?:inet|text|varchar|bytea|uuid)\b/im)
  assert.match(sql, /-- ROLLBACK[\s\S]+--   DROP FUNCTION[\s\S]+--   DROP TABLE[\s\S]+--   NOTIFY pgrst/)
  assert.match(sql, /COMMIT;\s+NOTIFY pgrst, 'reload schema';\s*$/)
})

test('後台授權後才掛載回報清單，查詢排除識別欄位', () => {
  const page = read('src/app/admin/reports/page.tsx')
  assert.match(page, /await getCurrentAdmin\(\)[\s\S]+\{isAdmin \? <ReportsList \/>/)
  assert.match(page, /\.from\('event_error_reports'\)\s+\.select\('id, event_id, reason, note, created_at'\)/)
  assert.doesNotMatch(page, /user_id|device_hash|dangerouslySetInnerHTML/)
  assert.match(page, /尚未套用 migration 071（貼上單 M078）/)
})

test('網站程式沒有 mailto，新回報路徑沒有寄信 API', () => {
  for (const entry of readdirSync(new URL('../src/', import.meta.url), { recursive: true })) {
    if (!/\.[cm]?[jt]sx?$/.test(entry)) continue
    assert.doesNotMatch(read(`src/${entry}`), /mailto:/i, entry)
  }
  for (const path of [
    'src/components/EventErrorReport.tsx', 'src/lib/eventErrorReports.ts',
    'src/lib/supabase/eventErrorReports.ts', 'src/app/admin/reports/page.tsx',
    'src/app/events/[id]/page.tsx', 'src/app/admin/page.tsx',
  ]) {
    assert.doesNotMatch(read(path), /sendMail|sendEmail|nodemailer|resend|sendgrid|mailgun|fetch\(/i, path)
  }
})
