// 執行方式：node scripts/check-city-idols-isr.mjs
// 不連網、不連庫。核對城市頁與圖鑑／偶像詳情的 ISR（revalidate = 300）：
// 1. 四類頁面是 ISR，沒有 force-dynamic；整條 import 鏈沒有 cookies()／headers()／
//    伺服器端登入 client，不會把某人的資料烤進共用快取頁。
// 2. 動態路徑有 generateStaticParams，且 dynamicParams 為 true。
// 3. 日期下限與 #253 一致：城市列表、偶像詳情用預設下限；城市詳情 lookbackDays: null。
// 4. 讀庫失敗用 throwOnQueryError，避免把空頁或 404 快取起來。
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    const inProject = !String(context.parentURL ?? '').includes('/node_modules/')
    return nextResolve(
      inProject && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier,
      context,
    )
  },
})

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(ROOT, path), 'utf8')

let pending = Promise.resolve()
function check(name, fn) {
  pending = pending.then(async () => {
    await fn()
    console.log(`PASS ${name}`)
  })
}

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-for-check-only'
const requests = []
let idolsStatus = 200
let idolsBody = []
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString())
  requests.push(url)
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  if (url.pathname.endsWith('/rest/v1/idols')) {
    return idolsStatus === 200 ? json(200, idolsBody) : json(idolsStatus, { code: 'XX000', message: 'boom', details: null, hint: null })
  }
  if (url.pathname.endsWith('/rest/v1/events')) return json(200, [])
  return json(200, [])
}
const originalConsoleError = console.error
const events = await import('../src/lib/supabase/events.ts')

const FORBIDDEN_IN_GRAPH = [
  [/from\s+['"]next\/headers['"]/, 'next/headers'],
  [/\bcookies\s*\(/, 'cookies()'],
  [/\bheaders\s*\(\s*\)/, 'headers()'],
  [/serverClient/, 'serverClient（會讀 cookies）'],
  [/supabase\/auth['"]/, 'lib/supabase/auth（讀登入者）'],
  [/adminAuth/, 'adminAuth'],
  [/serviceClient/, 'serviceClient（service role）'],
  [/unstable_noStore|noStore\s*\(/, 'noStore'],
  [/cache:\s*['"]no-store['"]/, "cache: 'no-store'"],
  [/export const dynamic\s*=\s*['"]force-dynamic['"]/, 'force-dynamic'],
]

function resolveImport(fromFile, specifier) {
  let base
  if (specifier.startsWith('@/')) base = join(ROOT, 'src', specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && /\.(tsx?|mjs)$/.test(candidate)) return candidate
  }
  return null
}

function importGraph(entry) {
  const seen = new Set()
  const stack = [join(ROOT, entry)]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const source = withoutComments(readFileSync(file, 'utf8'))
    for (const m of source.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
      const next = resolveImport(file, m[1] ?? m[2])
      if (next) stack.push(next)
    }
  }
  return [...seen]
}

const PAGES = [
  ['城市列表', 'src/app/cities/page.tsx'],
  ['城市詳情', 'src/app/cities/[city]/page.tsx'],
  ['圖鑑', 'src/app/idols/page.tsx'],
  ['偶像詳情', 'src/app/idols/[slug]/page.tsx'],
]

for (const [route, entry] of PAGES) {
  check(`${route}：revalidate = 300、沒有 force-dynamic、不讀 searchParams`, () => {
    const code = withoutComments(read(entry))
    assert.match(code, /export const revalidate = 300\b/)
    assert.doesNotMatch(code, /force-dynamic|force-static/)
    assert.doesNotMatch(code, /searchParams/)
  })
  check(`${route}：整條 import 鏈沒有登入／cookies／no-store／service role`, () => {
    const files = importGraph(entry)
    assert.ok(files.length > 8, `import 鏈只解析到 ${files.length} 個檔案，解析器可能壞了`)
    for (const file of files) {
      const source = withoutComments(readFileSync(file, 'utf8'))
      for (const [pattern, label] of FORBIDDEN_IN_GRAPH) {
        assert.doesNotMatch(source, pattern, `${file.slice(ROOT.length + 1)} 含有 ${label}`)
      }
    }
  })
}

check('城市列表：預設日期下限＋throwOnQueryError，並掛 StaleDayGuard', () => {
  const code = withoutComments(read('src/app/cities/page.tsx'))
  assert.match(code, /getPublishedEvents\(\{\s*throwOnQueryError:\s*true\s*\}\)/)
  assert.doesNotMatch(code, /lookbackDays/)
  assert.match(code, /<StaleDayGuard generatedDayKey=\{taipeiToday\(\)\} \/>/)
})

check('城市詳情：lookbackDays: null、throwOnQueryError、generateStaticParams、dynamicParams', () => {
  const code = withoutComments(read('src/app/cities/[city]/page.tsx'))
  assert.match(code, /getPublishedEvents\(\{\s*lookbackDays:\s*null,\s*throwOnQueryError:\s*true\s*\}\)/)
  assert.match(code, /export const dynamicParams = true/)
  assert.match(code, /export async function generateStaticParams/)
  assert.match(code, /new Set<string>\(TAIWAN_CITIES\)/)
  assert.match(code, /lookbackDays:\s*null/)
  assert.match(code, /<StaleDayGuard generatedDayKey=\{taipeiToday\(\)\} \/>/)
})

check('圖鑑：getActiveIdols throwOnQueryError；追蹤狀態只在 client', () => {
  const page = withoutComments(read('src/app/idols/page.tsx'))
  assert.match(page, /getActiveIdols\(\{\s*throwOnQueryError:\s*true\s*\}\)/)
  const client = read('src/app/idols/IdolsClient.tsx')
  assert.match(client, /^'use client'/)
  assert.match(withoutComments(client), /useAppState\(\)/)
})

check('偶像詳情：throwOnQueryError、generateStaticParams、dynamicParams、StaleDayGuard；個人化只在 client', () => {
  const code = withoutComments(read('src/app/idols/[slug]/page.tsx'))
  assert.match(code, /getIdolDetail\(slug,\s*\{\s*throwOnQueryError:\s*true\s*\}\)/)
  assert.match(code, /export const dynamicParams = true/)
  assert.match(code, /export async function generateStaticParams/)
  assert.match(code, /getActiveIdols\(\)/)
  assert.match(code, /<StaleDayGuard generatedDayKey=\{taipeiToday\(\)\} \/>/)
  assert.match(read('src/app/idols/[slug]/FollowIdolButton.tsx'), /^'use client'/)
  assert.match(read('src/app/idols/[slug]/SubscribeCalendarButton.tsx'), /^'use client'/)
  assert.doesNotMatch(withoutComments(read('src/app/idols/[slug]/data.ts')), /lookbackDays/)
})

check('getIdolBySlug：查詢失敗在 throwOnQueryError 時丟錯；沒有 client 預設回 null', async () => {
  idolsStatus = 500
  console.error = () => {}
  try {
    assert.equal(await events.getIdolBySlug('aespa'), null, '預設行為不變：失敗回 null')
    await assert.rejects(events.getIdolBySlug('aespa', { throwOnQueryError: true }), /query failed/)
    await assert.rejects(events.getIdolBySlug('aespa', { throwOnError: true }), /query failed/)
  } finally {
    idolsStatus = 200
    console.error = originalConsoleError
  }
  const source = withoutComments(read('src/lib/supabase/events.ts'))
  assert.match(source, /if \(!supabase\) \{\s*if \(throwOnError\) throw new Error\('Idol client is unavailable'\)\s*return null/)
})

await pending
console.log('ALL PASS')
