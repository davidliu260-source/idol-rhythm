// 檢查 T30e 追蹤頭像團色規則：node scripts/check-followed-avatars.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })
const r = await import('../src/lib/idolRingColor.ts')
const { contrastRatio, mixHex } = await import('../src/lib/eventCategory.ts')
const check = (name, fn) => { fn(); console.log(`PASS ${name}`) }
const palette = ['#e91e8c', '#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6', '#a855f7', '#f97316', '#06b6d4', '#84cc16']
const names = Array.from({ length: 64 }, (_, i) => `Idol ${i}`)
const dark = ['#000000', '#1a1a2e', '#4b0082', '#2b2b2b', '#7f1d1d']
check('C1 合法 HEX', () => {
  assert.equal(r.resolveGroupColor('#FF4D6D', 'X'), '#ff4d6d')
  assert.equal(r.resolveGroupColor(' #38d0f0 ', 'X'), '#38d0f0')
})
check('C2 哨兵', () => { for (const c of ['#6366f1', '#6366F1']) assert.equal(r.resolveGroupColor(c, 'BTS'), r.pickFallbackColor('BTS')) })
check('C3 非法／空值', () => { for (const c of [null, undefined, '', '#fff', '#12345', '#1234567', 'rgb(1,2,3)', '6366f1', '#gggggg']) assert.equal(r.resolveGroupColor(c, 'X'), r.pickFallbackColor('X')) })
check('C4 同名同色', () => {
  for (const name of names) assert.equal(r.pickFallbackColor(name), r.pickFallbackColor(name))
  assert.equal(r.resolveGroupColor(null, 'BTS'), r.resolveGroupColor('#6366f1', 'BTS'))
})
check('C5 原 12 色盤與 64 名字', () => {
  assert.equal(r.FALLBACK_PALETTE.length, 12)
  assert.deepEqual(r.FALLBACK_PALETTE, palette)
  for (const name of names) assert.ok(palette.includes(r.pickFallbackColor(name)))
})
check('C6 搬移前雜湊固定值', () => { for (const [name, color] of [['BTS', '#a855f7'], ['aespa', '#a855f7'], ['NewJeans', '#3b82f6']]) assert.equal(r.pickFallbackColor(name), color) })
check('C7 深色混白', () => { for (const c of dark) {
  assert.ok(contrastRatio(c, r.RING_BG) < 3)
  assert.match(r.ensureRingContrast(c), /^#[0-9a-f]{6}$/)
  assert.ok(contrastRatio(r.ensureRingContrast(c), r.RING_BG) >= 3)
} })
check('C8 第一個達標步長', () => { for (const c of dark) {
  let step = 1
  while (contrastRatio(mixHex('#ffffff', c, Math.round(step * 5) / 100), r.RING_BG) < 3) step++
  assert.equal(r.ensureRingContrast(c), mixHex('#ffffff', c, step * 5 / 100))
  assert.ok(contrastRatio(mixHex('#ffffff', c, (step - 1) * 5 / 100), r.RING_BG) < 3)
} })
check('C9 已達標不變淺', () => { for (const c of [...palette, '#ff4d6d', '#a78bfa', '#38d0f0']) {
  assert.equal(r.ensureRingContrast(c.toUpperCase()), c)
  console.log(`  ${c}: ${contrastRatio(c, r.RING_BG).toFixed(2)}:1`)
} })
check('C10 所有圈色達標', () => {
  for (const name of names) assert.ok(contrastRatio(r.getRingColor(null, name), r.RING_BG) >= 3)
  for (const c of ['#FF4D6D', ' #38d0f0 ', ...dark]) assert.ok(contrastRatio(r.getRingColor(c, 'X'), r.RING_BG) >= 3)
})
check('C11 不 mutate', () => {
  const idol = Object.freeze({ name: 'BTS', color: '#1a1a2e' }); Object.freeze(r.FALLBACK_PALETTE)
  const before = JSON.stringify([idol, r.FALLBACK_PALETTE]); r.getRingColor(idol.color, idol.name)
  assert.equal(JSON.stringify([idol, r.FALLBACK_PALETTE]), before)
})
check('C12 後備底', () => {
  const bg = r.avatarFallbackBackground('#ff4d6d')
  assert.ok(bg.startsWith('linear-gradient(145deg, #')); assert.ok(bg.endsWith('#1c1b27)')); assert.ok(!bg.includes('color-mix'))
})
check('C13 原始碼護欄', () => {
  const read = name => readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), 'utf8')
  const avatar = read('IdolAvatar'), followed = read('HomeFollowedIdols'), personalized = read('HomePersonalized')
  assert.ok(avatar.includes("from '@/lib/idolRingColor'")); assert.ok(avatar.includes('export { pickFallbackColor }')); assert.ok(!avatar.includes('const FALLBACK_PALETTE'))
  for (const text of ['color-mix', 'MAX_FOLLOWING', 'ring-[#ff6cb7]']) assert.ok(!followed.includes(text))
  assert.ok(followed.includes('追蹤偶像後，這裡會優先顯示你的專屬行程'))
  for (const text of ['已追蹤偶像', 'MAX_FOLLOWING']) assert.ok(!personalized.includes(text))
})
console.log('OK T30e followed avatars 檢查全部通過')
