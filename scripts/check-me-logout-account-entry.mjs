// 執行方式：node scripts/check-me-logout-account-entry.mjs
// 檢查：/me 頂部帳號區塊有登出、底部登出仍在、首頁右上角帳號圖示、不改「追蹤」文案。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const check = (name, run) => {
  run()
  console.log(`PASS ${name}`)
}

const me = read('src/app/me/MeClient.tsx')
const home = read('src/app/page.tsx')
const accountBtn = read('src/components/HomeAccountButton.tsx')
const bell = read('src/components/HomeNotificationBell.tsx')
const bottomNav = read('src/components/BottomNav.tsx')
const idolPage = read('src/app/idols/[slug]/page.tsx')

check('/me 共用同一個 SignOutButton：先 await signOut，再硬跳轉到 /me', () => {
  const start = me.indexOf('function SignOutButton')
  assert.ok(start >= 0, '找不到 SignOutButton')
  const fn = me.slice(start)
  assert.match(fn, /await supabase\.auth\.signOut\(\)/)
  assert.match(fn, /window\.location\.href = '\/me'/)
  assert.equal([...fn.matchAll(/function SignOutButton/g)].length, 1)
  // 頂部 compact、底部維持原本全寬用法
  assert.equal((me.match(/<SignOutButton compact \/>/g) || []).length, 1)
  assert.equal((me.match(/<SignOutButton \/>/g) || []).length, 1)
})

check('/me 頂部帳號區塊：email 旁邊有 compact 登出按鈕', () => {
  const email = me.indexOf('{user.email ?? \'—\'}')
  assert.ok(email >= 0)
  const compact = me.indexOf('<SignOutButton compact />')
  assert.ok(compact > email, 'compact 登出應在 email 之後、同一帳號區塊')
  const block = me.slice(me.lastIndexOf('rounded-[22px]', email), me.indexOf('</div>', compact) + 6)
  assert.match(block, /min-w-0 flex-1/)
  assert.match(block, /\{user\.email \?\? '—'\}/)
  assert.match(block, /<SignOutButton compact \/>/)
  assert.match(me, /compact\s*\?\s*'inline-flex min-h-11 flex-shrink-0/)
  assert.match(me, /: 'inline-flex w-full items-center justify-center gap-2/)
})

check('首頁右上角鈴鐺旁有帳號圖示，已登入去 /me、未登入去 /login，不顯示 email', () => {
  assert.match(home, /import HomeAccountButton from '@\/components\/HomeAccountButton'/)
  const headerStart = home.indexOf('<header>')
  const header = home.slice(headerStart, home.indexOf('</header>', headerStart))
  assert.match(header, /<HomeNotificationBell \/>/)
  assert.match(header, /<HomeAccountButton \/>/)
  const bellIdx = header.indexOf('<HomeNotificationBell />')
  const accIdx = header.indexOf('<HomeAccountButton />')
  assert.ok(accIdx > bellIdx, '帳號按鈕應在鈴鐺旁邊、且在其後')
  assert.match(header, /flex flex-shrink-0 items-center gap-2/)
  assert.match(accountBtn, /const href = user \? '\/me' : '\/login'/)
  assert.match(accountBtn, /aria-label=\{label\}/)
  assert.match(accountBtn, /user \? '前往我的控制台' : '登入'/)
  assert.match(accountBtn, /className="relative flex h-12 w-12 flex-shrink-0 items-center/)
  assert.doesNotMatch(accountBtn, /user\.email/)
  assert.doesNotMatch(accountBtn, /\{user\.email/)
  // 與鈴鐺同樣 48px 點擊範圍
  assert.match(bell, /flex h-12 w-12 flex-shrink-0 items-center/)
})

check('不改「追蹤」文案：底欄與偶像頁維持原樣', () => {
  assert.match(bottomNav, /\{ href: '\/me', icon: Star, label: '追蹤' \}/)
  assert.match(idolPage, /想一次訂閱所有追蹤的偶像？到「追蹤」頁/)
  const navItems = bottomNav.slice(bottomNav.indexOf('const NAV_ITEMS'), bottomNav.indexOf('export default'))
  assert.match(navItems, /label: '追蹤'/)
  assert.doesNotMatch(navItems, /label: '我的'/)
  assert.doesNotMatch(navItems, /label: '帳號'/)
})

check('登出功能沒有對應的 migration 或環境檔', () => {
  // 這個檢查原本限制「本 PR 只能改登出相關檔案」。#252 合併後，後續 PR 會改其他檔案，
  // 若繼續用 merge-base 檔名清單會誤判。登出行為已由上面幾項鎖定，這裡只擋不該出現的檔。
  const migrations = readdirSync(new URL('supabase/migrations', root))
  assert.ok(!migrations.some((name) => name.toLowerCase().includes('logout') || name.toLowerCase().includes('account-entry')))
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: fileURLToPath(root), encoding: 'utf8' })
  for (const file of untracked.trim().split('\n').filter(Boolean)) {
    assert.ok(!file.includes('.env'), `不應出現環境檔：${file}`)
  }
})

console.log('全部通過')
