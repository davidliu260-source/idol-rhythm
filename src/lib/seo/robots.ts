import { SITE_URL } from './metadata'

export const robotsPolicy = {
  rules: {
    userAgent: '*',
    allow: '/',
    // 前綴會擋住查詢字串和子路徑，也會連帶擋住像 /media 這樣以 /me 開頭的路徑。
    // 新增公開路由時請避開這些前綴，check-must6-seo 會掃描頁面路由檢查。
    disallow: [
      '/admin', '/api', '/me', '/notifications', '/account', '/login',
      '/forgot-password', '/reset-password', '/auth', '/atlas', '/favorites',
    ],
  },
  sitemap: `${SITE_URL}/sitemap.xml`,
  host: SITE_URL,
}
