// 執行方式：node scripts/check-revalidate-on-event-edit.mjs
// 不連網、不連庫。核對「編輯／發布／下架／自動上架後立刻刷新公開頁」：
// 1. 共用 helper 會刷首頁、行事曆、圖鑑、城市列表、活動頁、偶像頁、城市頁；
//    失敗只記 log，不會 throw。
// 2. 後台單筆／批量發布與下架、補翻譯、重審同步、cron 自動上架都會呼叫 helper。
// 3. 草稿編輯、刪草稿、自動上架引擎本身不引入 next/cache。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

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

const HELPER = 'src/lib/revalidate-public.ts'
const helper = read(HELPER)

check('helper 用 try/catch 包住 revalidatePath，失敗只記 log、不 throw', () => {
  assert.match(helper, /import \{ revalidatePath \} from 'next\/cache'/)
  assert.match(helper, /export function revalidatePublicEventPages\(/)
  assert.match(helper, /export async function revalidatePublicPagesForEventIds\(/)
  assert.match(helper, /catch \(error\)/)
  assert.match(helper, /console\.error/)
  assert.equal(
    [...helper.matchAll(/export (?:async )?function /g)].length,
    3,
    'helper 應只匯出查路徑與兩種刷新函式',
  )
  // 函式本體都有 catch，且沒有把錯誤再 throw 出去
  assert.doesNotMatch(withoutComments(helper), /\bthrow\b/)
})

check('helper 固定刷新首頁、行事曆、圖鑑與城市列表，並依活動／偶像／城市補路徑', () => {
  const fn = helper.split('export function revalidatePublicEventPages')[1].split('export async function')[0]
  for (const path of ["'/'", "'/schedule'", "'/idols'", "'/cities'"]) {
    assert.match(fn, new RegExp(`revalidatePath\\(${path}\\)`))
  }
  assert.match(fn, /revalidatePath\(`\/events\/\$\{eventId\}`\)/)
  assert.match(fn, /revalidatePath\(`\/idols\/\$\{slug\}`\)/)
  assert.match(fn, /revalidatePath\(`\/api\/ics\/idols\/\$\{slug\}`\)/)
  assert.match(fn, /cityHref\(/)
  assert.match(fn, /normalizeCityName\(/)
})

check('查活動路徑時指名 events_idol_id_fkey，並在查詢失敗時改刷動態路徑', () => {
  assert.match(helper, /EVENTS_IDOLS_FK = 'events_idol_id_fkey'/)
  assert.match(helper, /idols!\$\{EVENTS_IDOLS_FK\}\(slug\)/)
  assert.match(helper, /revalidatePath\('\/idols\/\[slug\]', 'page'\)/)
  assert.match(helper, /revalidatePath\('\/cities\/\[city\]', 'page'\)/)
})

check('單筆發布／下架／產生或審閱中文，都經 revalidateEventPaths 呼叫公開刷新', () => {
  const actions = read('src/app/admin/events/[id]/actions.ts')
  assert.match(actions, /revalidatePublicPagesForEventIds/)
  assert.match(actions, /async function revalidateEventPaths/)
  for (const name of ['publishEvent', 'unpublishEvent', 'generateEventChineseDisplay', 'markEventChineseReviewed']) {
    const part = actions.split(`export async function ${name}`)[1]
    assert.ok(part, `缺少 ${name}`)
    assert.match(part.split('export async function')[0], /await revalidateEventPaths\(id\)/)
  }
})

check('批量發布與下架會刷新公開頁；刪草稿只刷後台', () => {
  const route = read('src/app/api/admin/events/bulk-publish/route.ts')
  const publish = route.split("if (action === 'publish_auto')")[1].split('// ── Build update payload')[0]
  const unpublish = route.split('// unpublish:')[1]
  const del = route.split("if (action === 'delete_drafts')")[1].split("if (action === 'publish_auto')")[0]
  assert.equal(
    [...publish.matchAll(/await revalidatePublicPagesForEventIds\(supabase, publishedIds\)/g)].length,
    2,
    '成功路徑與中途失敗回 500 前都要刷新已發布的活動',
  )
  assert.match(unpublish, /await revalidatePublicPagesForEventIds\(supabase/)
  assert.doesNotMatch(del, /revalidatePublicPagesForEventIds/)
  assert.match(del, /revalidatePath\('\/admin\/events'\)/)
})

check('已發布活動補翻譯、候選重審同步，都會刷新公開頁', () => {
  const backfill = read('src/app/admin/events/backfillActions.ts')
  assert.match(backfill, /if \(summary\.translated\)/)
  assert.match(backfill, /await revalidatePublicPagesForEventIds\(supabase, eventIds\)/)
  const resolve = read('src/app/admin/event-candidates/[id]/actions.ts')
  const fn = resolve.split('export async function resolveRecheck')[1]
  assert.match(fn, /await revalidatePublicPagesForEventIds\(supabase, \[approvedEventId\]\)/)
  const bulk = read('src/app/api/admin/event-candidates/bulk-resolve-recheck/route.ts')
  assert.match(bulk, /await revalidatePublicPagesForEventIds\(supabase, \[\.\.\.affectedEventIds\]\)/)
})

check('cron 在自動上架與翻譯之後才刷新；引擎本身不引入 next/cache', () => {
  const route = read('src/app/api/cron/sync-candidates/route.ts')
  assert.ok(route.indexOf('await translateAfterAutoPublish(') < route.indexOf('await revalidatePublicPagesForEventIds('))
  assert.match(route, /autoPublish\.created/)
  assert.match(route, /autoPublish\.publishedExisting/)
  assert.match(route, /autoPublish\.locationFilled/)
  assert.match(route, /autoPublish\.merged\.filter\(\(row\) => row\.sourceAdded\)/)
  assert.match(route, /autoTranslate\?\.translatedIds/)
  assert.match(route, /if \(!dryRun\)/)
  const engine = read('src/lib/autoPublish/runAutoPublish.ts')
  assert.doesNotMatch(engine, /revalidate-public|next\/cache/)
})

check('草稿編輯頁只編未發布活動，不呼叫公開刷新', () => {
  const edit = read('src/app/admin/events/[id]/edit/actions.ts')
  assert.match(edit, /已發布活動不支援透過此頁編輯，請先下架再編輯/)
  assert.doesNotMatch(edit, /revalidatePublicPagesForEventIds|revalidatePublicEventPages/)
  assert.match(edit, /revalidatePath\('\/admin\/events'\)/)
})

check('helper 行為：路徑正確、查詢失敗時不 throw、會退回刷動態頁', async () => {
  const calls = []
  globalThis.__revalidateCalls = calls
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'next/cache') {
        return {
          shortCircuit: true,
          url: 'data:text/javascript,export function revalidatePath(path, type) { (globalThis.__revalidateCalls ??= []).push({ path, type }) }',
        }
      }
      if (specifier.startsWith('@/')) {
        return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context)
      }
      const parent = context.parentURL?.split('?')[0] ?? ''
      const path = parent.endsWith('.ts') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)
        ? `${specifier}.ts`
        : specifier
      return nextResolve(path, context)
    },
  })
  try {
    const mod = await import('../src/lib/revalidate-public.ts')
    calls.length = 0
    mod.revalidatePublicEventPages({
      eventId: 'evt-1',
      idolSlug: 'twice',
      cities: ['台北', ' 臺北 ', null, ''],
    })
    const paths = calls.map((c) => c.path)
    for (const expected of ['/', '/schedule', '/idols', '/cities', '/events/evt-1', '/idols/twice', '/api/ics/idols/twice', '/cities/%E5%8F%B0%E5%8C%97', '/cities/台北']) {
      assert.ok(paths.includes(expected), `缺少路徑 ${expected}，實際：${paths.join(', ')}`)
    }
    // 台北正規化後與 臺北 是同一座城市，不應重複兩次（encode 與 raw 各一次是允許的）
    assert.equal(paths.filter((p) => p === '/cities/%E5%8F%B0%E5%8C%97').length, 1)

    calls.length = 0
    let logs = 0
    const original = console.error
    console.error = () => { logs += 1 }
    try {
      const client = {
        from() {
          return {
            select() {
              return {
                in: async () => ({ data: null, error: { message: 'fixture lookup failed' } }),
              }
            },
          }
        },
      }
      await mod.revalidatePublicPagesForEventIds(client, ['evt-2'])
    } finally {
      console.error = original
    }
    assert.ok(logs >= 1, '查詢失敗應記 log')
    const failedPaths = calls.map((c) => c.path)
    for (const expected of ['/', '/schedule', '/idols', '/cities', '/events/evt-2', '/idols/[slug]', '/cities/[city]']) {
      assert.ok(failedPaths.includes(expected), `查詢失敗時缺少 ${expected}`)
    }
    assert.ok(!failedPaths.includes('/api/ics/idols/[slug]'), '動態 ICS 路徑不帶 type 時 Next 15 不會生效，不應假裝有刷')
  } finally {
    hook.deregister()
    delete globalThis.__revalidateCalls
  }
})

await pending
console.log('PASS check-revalidate-on-event-edit')
