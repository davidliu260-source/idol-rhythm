// 執行方式：node scripts/check-must5-legal-pages.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })

const {
  getAllLegalDocuments,
  getLegalDocument,
  isLegalPlaceholder,
  LEGAL_FIELD_VALUES,
  LEGAL_NAV,
  LEGAL_PAGE_PATHS,
  LEGAL_TODO,
  listUnfilledLegalFields,
} = await import('../src/lib/legal.ts')
const { getSiteUrl, SITE_URL, pageMetadata } = await import('../src/lib/seo/metadata.ts')
const { buildSitemapEntries } = await import('../src/lib/seo/sitemap.ts')
const { renderLegalMarkdown } = await import('../src/lib/legalMarkdown.ts')

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('三條法律路徑都在 sitemap，而且用 getSiteUrl() 組成絕對網址', () => {
  assert.deepEqual([...LEGAL_PAGE_PATHS], ['/privacy', '/terms', '/disclaimer'])
  const entries = buildSitemapEntries({ idols: [], events: [], now: new Date('2026-11-27T00:00:00+08:00') })
  const urls = entries.map((entry) => entry.url)
  for (const path of LEGAL_PAGE_PATHS) {
    assert.equal(new URL(path, getSiteUrl()).href, new URL(path, SITE_URL).href)
    assert.ok(urls.includes(new URL(path, SITE_URL).href), `${path} 不在 sitemap`)
  }
  assert.equal(entries.length, 7)
  assert.equal(new Set(urls).size, urls.length)
})

test('未填欄位集中在 legal.ts；有值就用、沒填就顯示待填標記', () => {
  assert.match(LEGAL_TODO, /TODO\(must5\): fill before merge/)
  const legal = read('src/lib/legal.ts')
  assert.match(legal, /TODO\(must5\): replace every UNFILLED legal field below before merge/)
  const keys = Object.keys(LEGAL_FIELD_VALUES)
  assert.equal(keys.length, 8)
  for (const key of keys) {
    const value = LEGAL_FIELD_VALUES[key]
    if (key === 'OTHER_CONTACT' && value.trim() === '') continue
    assert.ok(value.trim().length > 0, `${key} 不可留空`)
    if (isLegalPlaceholder(value)) {
      assert.match(value, /【待 Dave/, `${key} 佔位必須標明待 Dave 填`)
    }
  }
  for (const field of listUnfilledLegalFields()) {
    assert.match(field.value, /【待 Dave/, `${field.key} 未填時必須是可見佔位，不能自行編造`)
  }
})

test('三頁正文依草稿渲染，含 getSiteUrl() 與待填標記', () => {
  const siteUrl = getSiteUrl()
  const titles = {
    '/privacy': '星動時刻隱私權政策',
    '/terms': '星動時刻服務條款',
    '/disclaimer': '資料來源與免責',
  }
  for (const path of LEGAL_PAGE_PATHS) {
    const document = getLegalDocument(path, siteUrl)
    const html = renderLegalMarkdown(document.markdown)
    assert.match(html, /<h1[^>]*>/)
    assert.ok(html.includes(titles[path]), `${path} 缺少標題 ${titles[path]}`)
    if (listUnfilledLegalFields().length > 0) {
      assert.match(html, /data-legal-placeholder="true"/)
      assert.ok(html.includes('【待 Dave'), `${path} 應清楚顯示未填欄位`)
    }
    if (path !== '/disclaimer') {
      assert.ok(html.includes(siteUrl), `${path} 應顯示 getSiteUrl()`)
      assert.ok(!html.includes('idol-rhythm.vercel.app') || siteUrl.includes('idol-rhythm.vercel.app'))
    }
  }

  const privacy = renderLegalMarkdown(getLegalDocument('/privacy', siteUrl).markdown)
  assert.match(privacy, /個人資料保護法/)
  assert.match(privacy, /行事曆訂閱連結請當成密碼保管/)
  assert.match(privacy, /使用 Google 登入/)
  assert.match(privacy, /我們目前不會蒐集的資料/)
  assert.match(privacy, /沒有使用 Google Analytics/)
  assert.doesNotMatch(privacy, /本網站目前沒有年齡驗證或法定代理人同意流程/)
  assert.match(privacy, /<li>必要的服務供應商：<ul><li>Supabase：/)
  assert.match(privacy, /<li>Vercel：/)
  assert.match(privacy, /<li>Anthropic：/)
  assert.match(privacy, /<li>Google：/)
  assert.doesNotMatch(privacy, /<p>\s*-\s/)
  assert.match(privacy, /<p><strong>生效日：/)
  assert.match(privacy, /<p><strong>最後更新日期：/)
  assert.doesNotMatch(privacy, /生效日：[\s\S]*<\/strong>\s*\n\s*最後更新日期/)

  const terms = renderLegalMarkdown(getLegalDocument('/terms', siteUrl).markdown)
  assert.match(terms, /不是售票平台，也不是活動主辦單位/)
  if (isLegalPlaceholder(LEGAL_FIELD_VALUES.LIABILITY_SCOPE)) {
    assert.match(terms, /待 Dave 確認損害賠償範圍/)
  }
  assert.match(terms, /<p>經營者：/)
  assert.match(terms, /<p>聯絡信箱：/)

  const disclaimer = renderLegalMarkdown(getLegalDocument('/disclaimer', siteUrl).markdown)
  assert.match(disclaimer, /一律以主辦單位、官方或售票通路當時的公告為準/)
  assert.match(disclaimer, /href="\/privacy"/)
  assert.match(disclaimer, /href="\/terms"/)
})

test('三頁走 pageMetadata，canonical 是相對路徑、metadataBase 來自 getSiteUrl()', () => {
  for (const document of getAllLegalDocuments()) {
    const metadata = pageMetadata(document.path, document.title, document.description)
    assert.equal(metadata.alternates.canonical, document.path)
    assert.equal(metadata.title, document.title)
    assert.ok(document.description)
    const page = read(`src/app${document.path}/page.tsx`)
    assert.match(page, /pageMetadata\(document\.path, document\.title, document\.description\)/)
  }
  assert.match(read('src/app/layout.tsx'), /metadataBase: new URL\(SITE_URL\)/)
  assert.match(read('src/lib/seo/metadata.ts'), /export function getSiteUrl/)
  assert.match(read('src/lib/seo/sitemap.ts'), /LEGAL_PAGE_PATHS/)
})

test('頁尾與登入頁有三條連結，沒有同意勾選', () => {
  const layout = read('src/app/layout.tsx')
  assert.match(layout, /<SiteFooter \/>/)
  assert.doesNotMatch(layout, /checkbox|同意本/)

  const footer = read('src/components/SiteFooter.tsx')
  assert.match(footer, /usePathname/)
  assert.match(footer, /pathname\.startsWith\('\/admin'\)/)
  assert.match(footer, /<LegalLinks \/>/)

  const links = read('src/components/LegalLinks.tsx')
  for (const item of LEGAL_NAV) {
    assert.ok(links.includes(`href: '${item.href}'`) || links.includes(`href={item.href}`))
    assert.ok(links.includes(item.label) || links.includes('item.label'))
  }
  assert.deepEqual(LEGAL_NAV.map((item) => item.label), ['隱私權政策', '服務條款', '資料來源與免責'])

  const loginForm = read('src/app/login/LoginForm.tsx')
  const loginPage = read('src/app/login/page.tsx')
  assert.equal((loginForm.match(/<LegalLinks/g) || []).length, 3)
  const consentPattern = /type="checkbox"|checkbox|即表示你|我同意|繼續即表示/
  assert.doesNotMatch(loginForm, consentPattern)
  assert.doesNotMatch(loginPage, consentPattern)
})
