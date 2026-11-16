// 檢查 T33 圖例白字、＋加入虛線、空狀態點擊範圍、本週條斷點：node scripts/check-contrast-and-hit-areas.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })
const { contrastRatio, mixHex, EVENT_CATEGORIES, EVENT_CATEGORY_ORDER, ALL_CATEGORY } = await import('../src/lib/eventCategory.ts')
const check = (name, fn) => { fn(); console.log(`PASS ${name}`) }
const WHITE = '#ffffff'
const SCRIM_ALPHA = 0.45
const overBlack = (hex, alpha) => mixHex(hex, '#000000', 1 - alpha)   // 黑色 alpha 叠在 hex 上的合成色
const whiteOver = (bg, alpha) => mixHex(WHITE, bg, alpha)              // 白色 alpha 叠在 bg 上的合成色
const r2 = n => Math.round(n * 100) / 100
const COLOR_MIX = 'color' + '-mix'   // 避免本檔自己含這個字串
check('L1 三格名稱與場次', () => {
  for (const [id, sample, before, composite, after] of [['popup', '#ef7413', 2.93, '#83400a', 7.77], ['cafe', '#0e9777', 3.68, '#085341', 9.04], ['fanmeet', '#e73984', 3.95, '#7f1f49', 9.57]]) {
    assert.equal(overBlack(sample, SCRIM_ALPHA), composite)
    assert.equal(r2(contrastRatio(WHITE, sample)), before)
    assert.ok(before < 4.5)
    const ratio = contrastRatio(WHITE, composite)
    assert.ok(Math.abs(ratio - after) <= 0.02 && ratio >= 4.5)
    for (const label of ['名稱', '場次']) console.log(`  ${id} ${label} ${sample} ${before.toFixed(2)}:1 → ${composite} ${ratio.toFixed(2)}:1`)
  }
})
check('L2 快閃店最亮起始色', () => {
  const bg = overBlack('#f59e0b', SCRIM_ALPHA), ratio = contrastRatio(WHITE, bg)
  assert.equal(bg, '#875706'); assert.equal(r2(ratio), 6.18); assert.ok(ratio >= 4.5)
  console.log(`  #f59e0b → ${bg} ${ratio.toFixed(2)}:1；80% 白 ${contrastRatio(whiteOver(bg, 0.8), bg).toFixed(2)}:1`)
})
const minima = {}
check('L3 七類全部 heroStops', () => {
  for (const id of EVENT_CATEGORY_ORDER) {
    minima[id] = Infinity
    for (const { color } of EVENT_CATEGORIES[id].heroStops) {
      const bg = overBlack(color, SCRIM_ALPHA), ratio = contrastRatio(WHITE, bg)
      assert.ok(ratio >= 4.5); minima[id] = Math.min(minima[id], ratio)
      console.log(`  ${id} ${color} → ${bg} ${ratio.toFixed(2)}:1`)
    }
    console.log(`  ${id} 最低 ${minima[id].toFixed(2)}:1`)
  }
  assert.equal(r2(Math.min(...Object.values(minima))), 6.18)
})
check('L4 已達標格與全部', () => {
  for (const id of ['concert', 'exhibition', 'ticket', 'other']) { assert.ok(minima[id] >= 4.5); console.log(`  ${id} 最低 ${minima[id].toFixed(2)}:1`) }
  assert.equal(ALL_CATEGORY.legendBackground, '#1c1b27')
  const ratio = contrastRatio(WHITE, ALL_CATEGORY.legendBackground)
  assert.equal(r2(ratio), 17); assert.ok(ratio >= 4.5); console.log(`  全部 #1c1b27 ${ratio.toFixed(2)}:1（無遮罩）`)
})
check('D1 加入虛線', () => {
  for (const [bg, before, after, expected] of [['#0b0a11', '#48474d', '#606064', 3.15], ['#09070d', '#47454a', '#5f5e62', 3.12]]) {
    assert.equal(whiteOver(bg, 0.25), before); assert.equal(whiteOver(bg, 0.35), after)
    const oldRatio = contrastRatio(before, bg), ratio = contrastRatio(after, bg)
    assert.ok(oldRatio < 3); assert.equal(r2(ratio), expected); assert.ok(ratio >= 3)
    console.log(`  ${bg} ${before} ${oldRatio.toFixed(2)}:1 → ${after} ${ratio.toFixed(2)}:1`)
  }
})
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const has = (src, values) => { for (const value of values) assert.ok(src.includes(value), `缺少 ${value}`) }
const lacks = (src, values) => { for (const value of values) assert.ok(!src.includes(value), `不應含 ${value}`) }
check('S1 HomeCategoryLegend', () => {
  const src = read('src/components/HomeCategoryFilter.tsx'), index = src.indexOf('export function HomeCategoryLegend')
  assert.ok(index >= 0)
  const legend = src.slice(index)
  has(src, ["const LEGEND_SCRIM = 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.45) 100%)'"])
  has(legend, ['style={{ background: LEGEND_SCRIM }}', `{id !== 'all' && <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: LEGEND_SCRIM }} />}`, 'getCategoryTokens(id).heroBackground', 'ALL_CATEGORY.legendBackground', 'radial-gradient(90% 70% at 0% 0%, rgba(255,255,255,.22), transparent 65%)', 'aria-label={`${label}，${n} 場，套用篩選`}', '{n} 場'])
  lacks(legend, ['opacity-80', 'textShadow', "id === 'popup'"]); lacks(src, [COLOR_MIX])
})
check('S2 HomeFollowedIdols', () => {
  const src = read('src/components/HomeFollowedIdols.tsx')
  has(src, ['border-[1.5px] border-dashed border-white/35', 'h-[58px] w-[58px]', 'text-[#a09db4]">+</div>', '加入</span>', 'aria-label="加入追蹤偶像"', 'className="block min-h-[44px] py-3 text-[13px] leading-5 text-[#a09db4]">追蹤偶像後，這裡會優先顯示你的專屬行程</Link>', 'mounted && !following.isLoading && followed.length === 0'])
  lacks(src, ['border-white/25', 'mt-3 block text-[13px] leading-5', '-mt-', COLOR_MIX])
  assert.equal(src.match(/href="\/idols"/g).length, 3)
})
check('S3 HomeWeekStrip', () => {
  const src = read('src/components/HomeWeekStrip.tsx')
  has(src, ['className="w-11 text-center max-[339px]:w-auto max-[339px]:min-w-0 max-[339px]:flex-1"', 'h-[42px] w-[42px]', 'text-[17px]', 'max-[339px]:h-[36px] max-[339px]:w-[36px] max-[339px]:text-[15px]', 'mt-4 flex justify-between', 'mb-[6px] block text-xs font-semibold', 'h-[6px] w-[6px] rounded-full'])
  lacks(src, ['flex-wrap', 'overflow-x', 'onClick', '<button', 'max-[340px]', COLOR_MIX])
})
check('S4 check 自身', () => lacks(read('scripts/check-contrast-and-hit-areas.mjs'), [COLOR_MIX]))
check('G1 共用色未改', () => {
  const head = execFileSync('git', ['show', 'HEAD:src/lib/eventCategory.ts'], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' })
  const now = read('src/lib/eventCategory.ts')
  const block = src => { const start = src.indexOf('export const EVENT_CATEGORIES'), end = src.indexOf('\n}\n', start); assert.ok(start >= 0 && end > start); return src.slice(start, end + 3) }
  assert.equal(block(now), block(head))
  for (const [id, first, last, accent] of [['popup', '#f59e0b', '#e8481c', '#ff9a3d'], ['cafe', '#12bd88', '#0a6f66', '#2fcf9b'], ['fanmeet', '#ff5fae', '#cf1259', '#f45da8']]) {
    assert.deepEqual(EVENT_CATEGORIES[id].heroStops, [{ color: first, at: 0 }, { color: last, at: 100 }]); assert.equal(EVENT_CATEGORIES[id].accent, accent)
  }
})
console.log('OK T33 contrast and hit areas 檢查全部通過')
