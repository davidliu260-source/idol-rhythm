// 執行方式：node scripts/check-hotfix-events-idols-embed.mjs
// 不連網、不連庫。確認 events↔idols 的 PostgREST 內嵌都有指名
// events_idol_id_fkey（073 新增 event_artists 後，不指名會回 PGRST201）。
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const FK = 'events_idol_id_fkey'

const check = (name, fn) => {
  fn()
  console.log(`PASS ${name}`)
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(p)
  }
  return out
}

// 抓 .from('table').select('...') / .select(`...`)，中間允許空白換行。
const FROM_SELECT = /\.from\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)\s*\.select\(\s*([`'"])([\s\S]*?)\2/g
const IDOLS_EMBED = /\bidols((?:![A-Za-z0-9_]+)*)\s*\(/g
const EVENTS_EMBED = /\bevents((?:![A-Za-z0-9_]+)*)\s*\(/g

function rel(p) {
  return relative(ROOT, p)
}

function collect() {
  const files = walk(SRC)
  const findings = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(FROM_SELECT)) {
      findings.push({
        file: rel(file),
        table: m[1],
        select: m[3],
        index: m.index,
      })
    }
  }
  return { files: files.map(rel), findings }
}

const { files, findings } = collect()

check('events→idols 內嵌都指名 events_idol_id_fkey', () => {
  const unhinted = []
  const hinted = []
  for (const f of findings) {
    if (f.table !== 'events') continue
    for (const em of f.select.matchAll(IDOLS_EMBED)) {
      const hint = em[1] ?? ''
      const rec = { file: f.file, hint: hint || '(none)', snippet: `idols${hint}(...)` }
      if (hint.includes(FK)) hinted.push(rec)
      else unhinted.push(rec)
    }
  }
  assert.equal(
    unhinted.length,
    0,
    `unhinted events→idols embeds:\n${unhinted.map((u) => `  ${u.file}: ${u.snippet}`).join('\n')}`,
  )
  assert.ok(hinted.length >= 4, `expected at least 4 hinted events→idols embeds, found ${hinted.length}`)
  const byFile = Object.fromEntries(
    ['src/lib/supabase/events.ts', 'src/app/admin/events/[id]/edit/page.tsx', 'src/app/admin/events/[id]/page.tsx']
      .map((path) => [path, hinted.filter((h) => h.file === path).length]),
  )
  assert.equal(byFile['src/lib/supabase/events.ts'], 2, 'events.ts should have 2 hinted embeds')
  assert.equal(byFile['src/app/admin/events/[id]/edit/page.tsx'], 1, 'admin edit should have 1 hinted embed')
  assert.equal(byFile['src/app/admin/events/[id]/page.tsx'], 1, 'admin detail should have 1 hinted embed')
})

check('idols→events 反向內嵌若存在也必須指名 events_idol_id_fkey', () => {
  const unhinted = []
  for (const f of findings) {
    if (f.table !== 'idols') continue
    for (const em of f.select.matchAll(EVENTS_EMBED)) {
      const hint = em[1] ?? ''
      if (!hint.includes(FK)) {
        unhinted.push({ file: f.file, snippet: `events${hint || ''}(...)` })
      }
    }
  }
  assert.equal(
    unhinted.length,
    0,
    `unhinted idols→events embeds:\n${unhinted.map((u) => `  ${u.file}: ${u.snippet}`).join('\n')}`,
  )
})

check('event_candidates / sources 的 idols 內嵌維持原樣（不受 event_artists 影響）', () => {
  const allowed = new Set(['event_candidates', 'sources', 'crawler_sources'])
  const kept = findings.filter((f) => allowed.has(f.table) && /idols\s*\(/.test(f.select) && !f.select.includes(`idols!${FK}`))
  assert.ok(kept.length >= 1, 'expected event_candidates/sources idols(...) embeds to remain unhinted')
})

check('查詢失敗會 console.error 錯誤碼／訊息／details（不含秘密）', () => {
  const eventsTs = readFileSync(join(ROOT, 'src/lib/supabase/events.ts'), 'utf8')
  const edit = readFileSync(join(ROOT, 'src/app/admin/events/[id]/edit/page.tsx'), 'utf8')
  const detail = readFileSync(join(ROOT, 'src/app/admin/events/[id]/page.tsx'), 'utf8')
  for (const [name, src] of [
    ['getPublishedEvents', eventsTs],
    ['getEventById', eventsTs],
    ['admin/events/edit', edit],
    ['admin/events/detail', detail],
  ]) {
    assert.match(src, /console\.error\(/, `${name} missing console.error`)
    assert.match(src, /code:\s*error\.code/, `${name} should log error.code`)
    assert.match(src, /message:\s*error\.message/, `${name} should log error.message`)
    assert.match(src, /details:\s*error\.details/, `${name} should log error.details`)
    assert.doesNotMatch(src, /service_role|SUPABASE_SERVICE|process\.env/, `${name} must not log secrets`)
  }
})

check('掃描範圍涵蓋 src 且沒有漏掉含 from().select() 的檔案語法', () => {
  assert.ok(files.some((f) => f.endsWith('src/lib/supabase/events.ts')))
  assert.ok(findings.length > 10, `too few from+select findings: ${findings.length}`)
})
