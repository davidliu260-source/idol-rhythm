// 執行方式：node scripts/check-canonical-domain.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })

const { buildCityMeta, buildEventMeta, buildIdolMeta, DEFAULT_SITE_URL, getSiteUrl, SITE_URL } = await import('../src/lib/seo/metadata.ts')
const { robotsPolicy } = await import('../src/lib/seo/robots.ts')
const { buildSitemapEntries } = await import('../src/lib/seo/sitemap.ts')
const root = new URL('../', import.meta.url)
const rootDir = fileURLToPath(root)
const read = path => readFileSync(new URL(path, root), 'utf8')

const SEO_PATHS = [
  'src/lib/seo/metadata.ts',
  'src/lib/seo/robots.ts',
  'src/lib/seo/sitemap.ts',
  'src/app/layout.tsx',
  'src/app/sitemap.ts',
  'src/app/robots.ts',
  'scripts/check-must6-seo.mjs',
]

function importSiteUrlWithEnv(env) {
  const script = `
    import { registerHooks } from 'node:module'
    registerHooks({ resolve(specifier, context, nextResolve) {
      return nextResolve(specifier.startsWith('.') && !/\\.[a-z]+$/i.test(specifier) ? \`\${specifier}.ts\` : specifier, context)
    } })
    const { SITE_URL, getSiteUrl } = await import(${JSON.stringify(new URL('../src/lib/seo/metadata.ts', import.meta.url).href)})
    process.stdout.write(JSON.stringify({ SITE_URL, viaHelper: getSiteUrl() }))
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: rootDir,
    encoding: 'utf8',
    env,
  })
  if (result.status !== 0) {
    throw new Error(`env import failed (${result.status}): ${result.stderr || result.stdout}`)
  }
  return JSON.parse(result.stdout)
}

test('預設正式網域是 https://idolrhythm.com，可用 NEXT_PUBLIC_SITE_URL 覆寫', () => {
  assert.equal(DEFAULT_SITE_URL, 'https://idolrhythm.com')
  assert.equal(getSiteUrl(''), 'https://idolrhythm.com')
  assert.equal(getSiteUrl('   '), 'https://idolrhythm.com')
  assert.equal(getSiteUrl(undefined), 'https://idolrhythm.com')
  assert.equal(getSiteUrl('https://example.com/'), 'https://example.com')
  assert.equal(getSiteUrl('https://example.com/path?q=1'), 'https://example.com')
  assert.equal(getSiteUrl('example.com'), 'https://example.com')
  assert.equal(getSiteUrl('http://localhost:3000'), 'http://localhost:3000')
  assert.equal(getSiteUrl('not a url'), DEFAULT_SITE_URL)
  assert.equal(getSiteUrl('ftp://example.com'), DEFAULT_SITE_URL)
  assert.equal(getSiteUrl('javascript:alert(1)'), DEFAULT_SITE_URL)
  for (const invalid of ['undefined', 'null', '$VERCEL_URL', 'http:/example.com', 'https//example.com', 'mailto:a@b.com']) {
    assert.equal(getSiteUrl(invalid), DEFAULT_SITE_URL, invalid)
  }
})

test('未設定或覆寫 NEXT_PUBLIC_SITE_URL 時，模組層 SITE_URL 跟著變', () => {
  const baseEnv = { ...process.env }
  delete baseEnv.NEXT_PUBLIC_SITE_URL
  assert.deepEqual(importSiteUrlWithEnv(baseEnv), {
    SITE_URL: 'https://idolrhythm.com',
    viaHelper: 'https://idolrhythm.com',
  })
  assert.deepEqual(importSiteUrlWithEnv({ ...baseEnv, NEXT_PUBLIC_SITE_URL: 'https://override.example/' }), {
    SITE_URL: 'https://override.example',
    viaHelper: 'https://override.example',
  })
})

test('robots、sitemap、metadata 與 layout 都走同一個 SITE_URL', () => {
  assert.equal(robotsPolicy.host, SITE_URL)
  assert.equal(robotsPolicy.sitemap, `${SITE_URL}/sitemap.xml`)
  const entries = buildSitemapEntries({ idols: [], events: [], now: new Date('2026-11-26T00:00:00+08:00') })
  assert.ok(entries.length >= 4)
  for (const entry of entries) {
    assert.equal(new URL(entry.url).origin, SITE_URL)
    assert.ok(entry.url.startsWith(`${SITE_URL}/`))
  }
  const layout = read('src/app/layout.tsx')
  assert.match(layout, /metadataBase:\s*new URL\(SITE_URL\)/)
  assert.match(layout, /from '@\/lib\/seo\/metadata'/)
  const idolMeta = buildIdolMeta({ id: 'test-group', name: 'Test Group', koreanName: '테스트' }, 1)
  const eventMeta = buildEventMeta({
    id: 'live', title: '測試演唱會', idolName: 'Test Group', date: '2026-11-21',
    city: '台北', description: '摘要',
  })
  const cityMeta = buildCityMeta('台北', 1)
  for (const metadata of [idolMeta, eventMeta, cityMeta]) {
    assert.equal(new URL(metadata.alternates.canonical, SITE_URL).origin, SITE_URL)
    assert.equal(new URL(metadata.openGraph.url, SITE_URL).origin, SITE_URL)
    assert.equal(new URL(metadata.openGraph.images[0].url, SITE_URL).origin, SITE_URL)
    assert.equal(new URL(metadata.twitter.images[0].url, SITE_URL).origin, SITE_URL)
  }
})

test('SEO 相關檔案不再寫死 vercel.app，也不用 VERCEL_URL', () => {
  for (const path of SEO_PATHS) {
    const source = read(path)
    assert.doesNotMatch(source, /idol-rhythm\.vercel\.app/)
    assert.doesNotMatch(source, /process\.env\.VERCEL_URL/)
  }
  const metadata = read('src/lib/seo/metadata.ts')
  assert.match(metadata, /export function getSiteUrl/)
  assert.match(metadata, /NEXT_PUBLIC_SITE_URL/)
  assert.match(metadata, /export const SITE_URL = getSiteUrl\(\)/)
})

test('app 與 lib 的 SEO 路徑沒有寫死正式舊網域，JSON-LD 若存在也要走 SITE_URL', () => {
  const forbidden = /idol-rhythm\.vercel\.app|process\.env\.VERCEL_URL/
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name)
      if (name.isDirectory()) {
        walk(path)
        continue
      }
      if (!/\.(ts|tsx|js|mjs)$/.test(name.name)) continue
      const source = readFileSync(path, 'utf8')
      const rel = path.slice(rootDir.length)
      if (rel.startsWith('src/lib/seo/') || rel === 'src/app/layout.tsx' || rel === 'src/app/sitemap.ts' || rel === 'src/app/robots.ts') {
        assert.doesNotMatch(source, forbidden, rel)
      }
      if (/application\/ld\+json|schema\.org|jsonLd|JsonLd/.test(source) && !rel.startsWith('scripts/fixtures/')) {
        assert.match(source, /SITE_URL|getSiteUrl/, `${rel} 的 JSON-LD 應使用 SITE_URL`)
        assert.doesNotMatch(source, forbidden, rel)
      }
    }
  }
  walk(join(rootDir, 'src'))
})
