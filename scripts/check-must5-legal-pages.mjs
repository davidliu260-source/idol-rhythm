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
  LEGAL_FIELD_VALUES,
  LEGAL_NAV,
  LEGAL_PAGE_PATHS,
  listUnfilledLegalFields,
} = await import('../src/lib/legal.ts')
const { getSiteUrl, SITE_URL, pageMetadata } = await import('../src/lib/seo/metadata.ts')
const { buildSitemapEntries } = await import('../src/lib/seo/sitemap.ts')
const { renderLegalMarkdown } = await import('../src/lib/legalMarkdown.ts')

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

const PLACEHOLDER_MARK = /待填|【待 Dave|TODO\(must5\)|data-legal-placeholder/

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

test('Dave 已填齊 legal.ts，沒有待填佔位，其他聯絡方式留空並隱藏', () => {
  assert.equal(Object.keys(LEGAL_FIELD_VALUES).length, 8)
  assert.equal(listUnfilledLegalFields().length, 0)
  assert.equal(LEGAL_FIELD_VALUES.OPERATOR_NAME, 'idol rhythm（個人經營）')
  assert.equal(LEGAL_FIELD_VALUES.CONTACT_EMAIL, 'support@idolrhythm.com')
  assert.equal(LEGAL_FIELD_VALUES.OTHER_CONTACT, '')
  assert.equal(LEGAL_FIELD_VALUES.EFFECTIVE_DATE, '2026 年 11 月 27 日')
  assert.equal(LEGAL_FIELD_VALUES.LAST_UPDATED, '2026 年 11 月 27 日')
  assert.match(LEGAL_FIELD_VALUES.MINORS_POLICY, /未滿 18 歲/)
  assert.match(LEGAL_FIELD_VALUES.MINORS_POLICY, /法定代理人同意/)
  assert.equal(LEGAL_FIELD_VALUES.JURISDICTION, '並以臺灣臺北地方法院為第一審管轄法院。')
  assert.equal(LEGAL_FIELD_VALUES.LIABILITY_SCOPE, '僅限於法律所允許的最低限度')

  const legal = read('src/lib/legal.ts')
  assert.doesNotMatch(legal, /TODO\(must5\)/)
  assert.doesNotMatch(legal, /export const LEGAL_TODO/)
  for (const [key, value] of Object.entries(LEGAL_FIELD_VALUES)) {
    assert.doesNotMatch(value, /待填|【待 Dave/, `${key} 不可再含佔位文字`)
  }
})

test('三頁正文依草稿渲染，已填欄位會顯示，且沒有待填標記', () => {
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
    assert.doesNotMatch(html, PLACEHOLDER_MARK, `${path} 不應再出現待填標記`)
    if (path !== '/disclaimer') {
      assert.ok(html.includes(siteUrl), `${path} 應顯示 getSiteUrl()`)
      assert.ok(!html.includes('idol-rhythm.vercel.app') || siteUrl.includes('idol-rhythm.vercel.app'))
    }
  }

  const privacy = renderLegalMarkdown(getLegalDocument('/privacy', siteUrl).markdown)
  assert.match(privacy, /個人資料保護法/)
  assert.match(privacy, /行事曆訂閱連結請當成密碼保管/)
  assert.match(privacy, /使用 Google 登入/)
  assert.match(privacy, /預設授權（email 與 profile）/)
  assert.match(privacy, /姓名與頭像網址/)
  assert.doesNotMatch(privacy, /通常可能包含/)
  assert.match(privacy, /我們目前不會蒐集的資料/)
  assert.match(privacy, /沒有使用 Google Analytics/)
  assert.doesNotMatch(privacy, /本網站目前沒有年齡驗證或法定代理人同意流程/)
  assert.match(privacy, /未滿 18 歲/)
  assert.match(privacy, /法定代理人同意/)
  assert.match(privacy, /idol rhythm（個人經營）/)
  assert.match(privacy, /support@idolrhythm.com/)
  assert.doesNotMatch(privacy, /其他聯絡方式/)
  assert.match(privacy, /<li>必要的服務供應商：<ul><li>Supabase：/)
  assert.match(privacy, /<li>Vercel：/)
  assert.match(privacy, /<li>Anthropic：/)
  assert.match(privacy, /<li>Google：/)
  assert.doesNotMatch(privacy, /<p>\s*-\s/)
  assert.match(privacy, /<p><strong>生效日：2026 年 11 月 27 日/)
  assert.match(privacy, /<p><strong>最後更新日期：2026 年 11 月 27 日/)
  assert.doesNotMatch(privacy, /生效日：[\s\S]*<\/strong>\s*\n\s*最後更新日期/)
  assert.match(privacy, /臺灣臺北地方法院為第一審管轄法院/)

  const terms = renderLegalMarkdown(getLegalDocument('/terms', siteUrl).markdown)
  assert.match(terms, /不是售票平台，也不是活動主辦單位/)
  assert.match(terms, /其範圍僅限於法律所允許的最低限度/)
  assert.doesNotMatch(terms, /新臺幣|NT\$|元整/)
  assert.match(terms, /臺灣臺北地方法院為第一審管轄法院/)
  assert.match(terms, /<p>經營者：idol rhythm（個人經營）/)
  assert.match(terms, /<p>聯絡信箱：support@idolrhythm.com/)
  assert.doesNotMatch(terms, PLACEHOLDER_MARK)

  const disclaimer = renderLegalMarkdown(getLegalDocument('/disclaimer', siteUrl).markdown)
  assert.match(disclaimer, /一律以主辦單位、官方或售票通路當時的公告為準/)
  assert.match(disclaimer, /href="\/privacy"/)
  assert.match(disclaimer, /href="\/terms"/)
})

test('三頁可被索引：沒有 noindex，走 pageMetadata，canonical 來自 getSiteUrl()', () => {
  for (const document of getAllLegalDocuments()) {
    const metadata = pageMetadata(document.path, document.title, document.description)
    assert.equal(metadata.alternates.canonical, document.path)
    assert.equal(metadata.title, document.title)
    assert.ok(document.description)
    assert.equal(metadata.robots, undefined)
    const page = read(`src/app${document.path}/page.tsx`)
    assert.match(page, /pageMetadata\(document\.path, document\.title, document\.description\)/)
    assert.doesNotMatch(page, /noindex|robots:/)
  }
  assert.match(read('src/app/layout.tsx'), /metadataBase: new URL\(SITE_URL\)/)
  assert.match(read('src/lib/seo/metadata.ts'), /export function getSiteUrl/)
  assert.match(read('src/lib/seo/sitemap.ts'), /LEGAL_PAGE_PATHS/)
  assert.doesNotMatch(read('src/app/layout.tsx'), /noindex/)
})

test('頁尾與登入頁有三條連結；登入頁有同意句、沒有勾選，且 320px 可換行', () => {
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
  assert.doesNotMatch(loginForm, /type="checkbox"|checkbox/)
  assert.doesNotMatch(loginPage, /type="checkbox"|checkbox/)
  assert.match(loginForm, /<LoginConsentNote \/>/)
  assert.match(
    loginForm,
    /繼續即表示同意\s*<Link href="\/terms"[^>]*>\s*服務條款\s*<\/Link>\s*與\s*<Link href="\/privacy"[^>]*>\s*隱私權政策\s*<\/Link>/,
  )
  // Shared line sits above Google and email/magic methods on the main view.
  const mainView = loginForm.slice(loginForm.indexOf('// ── Main view'))
  assert.match(mainView, /<LoginConsentNote \/>/)
  assert.match(mainView, /使用 Google 登入/)
  assert.match(mainView, /Magic Link/)
  const consentFn = loginForm.slice(loginForm.indexOf('function LoginConsentNote'))
  const consentClass = consentFn.match(/className="([^"]+)"/)
  assert.ok(consentClass, '同意句必須有 className')
  assert.doesNotMatch(consentClass[1], /whitespace-nowrap|truncate|text-nowrap/)
  assert.match(consentClass[1], /max-w-full|leading-/)
})
