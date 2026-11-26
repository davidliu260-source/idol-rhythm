// 執行方式：node scripts/check-notifications-hide-unpublished.mjs
// 不連網、不連庫。驗證通知中心在讀取端隱藏「已下架／活動列不存在」的通知，
// 且未讀數與全部已讀只作用在可見列；不刪 notifications 列。
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { registerHooks } from 'node:module'

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context)
} })

const n = await import('../src/lib/supabase/notifications.ts')
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(ROOT + '/' + p, 'utf8')
const check = (name, fn) => {
  const result = fn()
  if (result && typeof result.then === 'function') {
    return result.then(() => console.log(`PASS ${name}`))
  }
  console.log(`PASS ${name}`)
}

function row({
  id,
  event_id = null,
  read_at = null,
  created_at = '2026-11-21T00:00:00.000Z',
  type = 'event_reminder',
} = {}) {
  return {
    id,
    type,
    event_id,
    idol_id: event_id ? 'idol-1' : null,
    title: `title-${id}`,
    body: `body-${id}`,
    payload: {},
    dedupe_key: `${type}:${event_id ?? id}`,
    read_at,
    delivered_at: created_at,
    created_at,
  }
}

/**
 * In-memory Supabase stand-in. Simulates events RLS:
 *   - role=user（預設）：join 看不到 is_published=false、cancelled、或非信任來源
 *   - role=admin：join 看得到所有還存在的活動列
 * 已刪除的活動（不在 events 表）join 一律為 null。
 */
function createMockSupabase({ notifications, events, role = 'user' } = {}) {
  const store = {
    notifications: notifications.map((item) => ({ ...item })),
    events: events.map((item) => ({ ...item })),
  }
  const ops = []

  const canSeeEvent = (event) => {
    if (!event) return false
    if (role === 'admin') return true
    return (
      event.is_published === true &&
      event.status !== 'cancelled' &&
      ['official', 'media', 'aggregator'].includes(event.trust_level ?? 'official')
    )
  }

  const embedFor = (eventId) => {
    if (eventId == null) return null
    const event = store.events.find((item) => item.id === eventId)
    if (!canSeeEvent(event)) return null
    return { id: event.id, is_published: event.is_published === true, status: event.status, trust_level: event.trust_level }
  }

  function from(table) {
    return new Query(table)
  }

  class Query {
    constructor(table) {
      this.table = table
      this._select = '*'
      this._filters = []
      this._order = null
      this._limit = null
      this._update = null
      this._head = false
      this._inner = false
    }
    select(cols, opts = {}) {
      this._select = cols
      this._head = opts.head === true
      this._inner = typeof cols === 'string' && cols.includes('events!inner')
      return this
    }
    is(col, val) {
      this._filters.push({ type: 'is', col, val })
      return this
    }
    eq(col, val) {
      this._filters.push({ type: 'eq', col, val })
      return this
    }
    in(col, vals) {
      this._filters.push({ type: 'in', col, vals: [...vals] })
      return this
    }
    order(col, opts = {}) {
      this._order = { col, ascending: opts.ascending !== false }
      return this
    }
    limit(value) {
      this._limit = value
      return this
    }
    update(patch) {
      this._update = { ...patch }
      return this
    }
    delete() {
      this._delete = true
      return this
    }
    then(resolve, reject) {
      return Promise.resolve().then(() => this._execute()).then(resolve, reject)
    }
    _execute() {
      ops.push({
        table: this.table,
        select: this._select,
        filters: this._filters,
        update: this._update,
        delete: this._delete === true,
        head: this._head,
        inner: this._inner,
        limit: this._limit,
      })
      if (this.table !== 'notifications') {
        return { data: null, error: { message: `unexpected table ${this.table}` }, count: null }
      }
      if (this._delete) {
        return { data: null, error: { message: 'delete is not allowed in this test mock unless expected' }, count: null }
      }

      let rows = store.notifications.map((item) => ({
        ...item,
        events: embedFor(item.event_id),
      }))

      for (const filter of this._filters) {
        if (filter.type === 'is' && filter.col === 'read_at' && filter.val === null) {
          rows = rows.filter((item) => item.read_at == null)
        } else if (filter.type === 'is' && filter.col === 'event_id' && filter.val === null) {
          rows = rows.filter((item) => item.event_id == null)
        } else if (filter.type === 'eq' && filter.col === 'events.is_published') {
          rows = rows.filter((item) => item.events != null && item.events.is_published === filter.val)
        } else if (filter.type === 'eq' && filter.col === 'id') {
          rows = rows.filter((item) => item.id === filter.val)
        } else if (filter.type === 'in' && filter.col === 'id') {
          rows = rows.filter((item) => filter.vals.includes(item.id))
        }
      }

      if (this._inner) rows = rows.filter((item) => item.events != null)

      if (this._order) {
        const { col, ascending } = this._order
        rows = [...rows].sort((a, b) => {
          const cmp = a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0
          return ascending ? cmp : -cmp
        })
      }
      if (this._limit != null) rows = rows.slice(0, this._limit)

      if (this._update) {
        const updated = []
        for (const item of rows) {
          const orig = store.notifications.find((row) => row.id === item.id)
          if (!orig) continue
          Object.assign(orig, this._update)
          updated.push({ id: orig.id })
        }
        return { data: updated, error: null, count: updated.length }
      }

      if (this._head) return { data: null, error: null, count: rows.length }

      const includeEvents = String(this._select).includes('events')
      const data = rows.map((item) => {
        const out = { ...item }
        if (!includeEvents) delete out.events
        return out
      })
      return { data, error: null, count: data.length }
    }
  }

  return { from, ops, store }
}

const vancouver = 'evt-vancouver'
const santaClara = 'evt-santa-clara'
const sanDiego = 'evt-san-diego'
const losAngeles = 'evt-los-angeles'
const stillUp = 'evt-still-up'
const gone = 'evt-deleted'

const fixtures = {
  notifications: [
    row({ id: 'n-van', event_id: vancouver, created_at: '2026-11-22T09:00:00.000Z' }),
    row({ id: 'n-sc', event_id: santaClara, created_at: '2026-11-22T08:00:00.000Z' }),
    row({ id: 'n-sd', event_id: sanDiego, created_at: '2026-11-22T07:00:00.000Z' }),
    row({ id: 'n-la', event_id: losAngeles, created_at: '2026-11-22T06:00:00.000Z' }),
    row({ id: 'n-live', event_id: stillUp, created_at: '2026-11-20T12:00:00.000Z' }),
    row({ id: 'n-gone', event_id: gone, created_at: '2026-11-19T12:00:00.000Z' }),
    row({ id: 'n-system', event_id: null, type: 'followed_idol_new_event', created_at: '2026-11-18T12:00:00.000Z' }),
    row({ id: 'n-live-read', event_id: stillUp, read_at: '2026-11-20T13:00:00.000Z', created_at: '2026-11-17T12:00:00.000Z' }),
  ],
  events: [
    { id: vancouver, is_published: false, status: 'published', trust_level: 'official' },
    { id: santaClara, is_published: false, status: 'published', trust_level: 'official' },
    { id: sanDiego, is_published: false, status: 'published', trust_level: 'official' },
    { id: losAngeles, is_published: false, status: 'published', trust_level: 'official' },
    { id: stillUp, is_published: true, status: 'published', trust_level: 'official' },
  ],
}

await check('純函式：沒綁活動的通知一律可見', () => {
  assert.equal(n.isNotificationVisible(null, null), true)
  assert.equal(n.isNotificationVisible(undefined, undefined), true)
  assert.equal(n.isNotificationVisible('', { id: 'x', is_published: false }), true)
})

await check('純函式：已上架可見；下架、join 為 null、缺 id 都隱藏', () => {
  assert.equal(n.isNotificationVisible('e1', { id: 'e1', is_published: true }), true)
  assert.equal(n.isNotificationVisible('e1', { id: 'e1', is_published: false }), false)
  assert.equal(n.isNotificationVisible('e1', null), false)
  assert.equal(n.isNotificationVisible('e1', []), false)
  assert.equal(n.isNotificationVisible('e1', [{ id: 'e1', is_published: true }]), true)
  assert.equal(n.isNotificationVisible('e1', { id: 'e1', is_published: 'true' }), false)
  assert.equal(n.normalizeLinkedEvent(null), null)
  assert.deepEqual(n.normalizeLinkedEvent({ id: 'e1', is_published: true }), { id: 'e1', is_published: true })
})

await check('合併分頁：先合併再套 limit，較新的隱藏列不會把較舊的可見列擠掉', () => {
  const withoutEvent = [row({ id: 'sys', event_id: null, created_at: '2026-11-20T00:00:00.000Z' })]
  const published = [
    row({ id: 'p-new', event_id: 'e', created_at: '2026-11-21T00:00:00.000Z' }),
    row({ id: 'p-old', event_id: 'e', created_at: '2026-11-19T00:00:00.000Z' }),
  ]
  const merged = n.mergeNotificationPages(withoutEvent, published, 2)
  assert.deepEqual(merged.map((item) => item.id), ['p-new', 'sys'])
  assert.equal(merged.every((item) => !('events' in item)), true)
})

await check('列表：Stray Kids 四場下架＋已刪除場次不出現，未綁活動與仍上架的保留', async () => {
  const db = createMockSupabase({ ...fixtures, role: 'user' })
  const listed = await n.listNotifications(db, 50)
  assert.deepEqual(listed.map((item) => item.id), ['n-live', 'n-system', 'n-live-read'])
  assert.equal(listed.every((item) => !('events' in item)), true)
  assert.equal(db.ops.some((op) => op.delete), false)
  assert.equal(db.store.notifications.length, fixtures.notifications.length)
})

await check('列表：一般使用者 join 不到下架列時仍隱藏（視為已刪或不可見）', async () => {
  const db = createMockSupabase({ ...fixtures, role: 'user' })
  const listed = await n.listNotifications(db, 50)
  assert.equal(listed.some((item) => ['n-van', 'n-sc', 'n-sd', 'n-la', 'n-gone'].includes(item.id)), false)
})

await check('列表：管理員看得到下架活動列，仍依 is_published 隱藏', async () => {
  const db = createMockSupabase({ ...fixtures, role: 'admin' })
  const listed = await n.listNotifications(db, 50)
  assert.deepEqual(listed.map((item) => item.id), ['n-live', 'n-system', 'n-live-read'])
})

await check('未讀數：排除下架／刪除，包含未綁活動與仍上架的未讀', async () => {
  const db = createMockSupabase({ ...fixtures, role: 'user' })
  const count = await n.getUnreadNotificationCount(db)
  assert.equal(count, 2) // n-live, n-system（n-live-read 已讀；四場下架與已刪除不算）
})

await check('limit：較新的下架通知不會讓較舊的可見通知從這一頁消失', async () => {
  const db = createMockSupabase({ ...fixtures, role: 'user' })
  const listed = await n.listNotifications(db, 2)
  assert.deepEqual(listed.map((item) => item.id), ['n-live', 'n-system'])
})

await check('全部已讀只改可見列；下架／刪除列保持未讀，重新上架後會再出現且仍是未讀', async () => {
  const db = createMockSupabase({ ...fixtures, role: 'user' })
  const updated = await n.markAllNotificationsAsRead(db)
  assert.equal(updated, 2)

  const after = db.store.notifications
  const readAt = (id) => after.find((item) => item.id === id).read_at
  assert.ok(readAt('n-live'))
  assert.ok(readAt('n-system'))
  assert.equal(readAt('n-van'), null)
  assert.equal(readAt('n-sc'), null)
  assert.equal(readAt('n-sd'), null)
  assert.equal(readAt('n-la'), null)
  assert.equal(readAt('n-gone'), null)
  assert.ok(readAt('n-live-read'))

  const markOps = db.ops.filter((op) => op.update)
  assert.equal(markOps.length, 1)
  const idFilter = markOps[0].filters.find((filter) => filter.type === 'in' && filter.col === 'id')
  assert.deepEqual([...idFilter.vals].sort(), ['n-live', 'n-system'])
  assert.equal(db.ops.some((op) => op.delete), false)
  assert.equal(after.length, fixtures.notifications.length)

  // 重新上架溫哥華場：通知應回到列表，且仍是未讀
  const van = db.store.events.find((item) => item.id === vancouver)
  van.is_published = true
  const listed = await n.listNotifications(db, 50)
  assert.deepEqual(listed.map((item) => item.id), ['n-van', 'n-live', 'n-system', 'n-live-read'])
  assert.equal(await n.getUnreadNotificationCount(db), 1)
  assert.equal(listed.find((item) => item.id === 'n-van').read_at, null)
})

await check('全部已讀：沒有可見未讀時不發 UPDATE', async () => {
  const db = createMockSupabase({
    notifications: [
      row({ id: 'hidden', event_id: vancouver }),
      row({ id: 'already', event_id: stillUp, read_at: '2026-11-20T13:00:00.000Z' }),
    ],
    events: fixtures.events,
  })
  assert.equal(await n.markAllNotificationsAsRead(db), 0)
  assert.equal(db.ops.some((op) => op.update), false)
  assert.equal(db.store.notifications.find((item) => item.id === 'hidden').read_at, null)
})

await check('查詢錯誤時列表為空、未讀為 0，不丟例外', async () => {
  const broken = {
    from() {
      return {
        select() { return this },
        is() { return this },
        eq() { return this },
        order() { return this },
        limit() { return this },
        then(resolve) {
          return Promise.resolve({ data: null, error: { message: 'boom' }, count: null }).then(resolve)
        },
      }
    },
  }
  assert.deepEqual(await n.listNotifications(broken, 20), [])
  assert.equal(await n.getUnreadNotificationCount(broken), 0)
  assert.equal(await n.markAllNotificationsAsRead(broken), 0)
})

await check('讀取端都走 helpers：列表、鈴鐺、我的頁未讀數；BottomNav 本身沒有未讀查詢', () => {
  const helper = read('src/lib/supabase/notifications.ts')
  const listPage = read('src/app/notifications/NotificationsClient.tsx')
  const me = read('src/app/me/MeClient.tsx')
  const bell = read('src/components/HomeNotificationBell.tsx')
  const nav = read('src/components/BottomNav.tsx')

  assert.match(helper, /events!inner\(id, is_published\)/)
  assert.match(helper, /eq\('events\.is_published', true\)/)
  assert.match(helper, /\.is\('event_id', null\)/)
  assert.match(helper, /isNotificationVisible/)
  assert.match(helper, /count:\s*'exact'/)
  assert.match(helper, /head:\s*true/)
  assert.match(helper, /MARK_ALL_READ_CHUNK_SIZE/)
  assert.doesNotMatch(helper, /\.delete\(/)

  assert.match(listPage, /listNotifications/)
  assert.match(listPage, /markAllNotificationsAsRead/)
  assert.doesNotMatch(listPage, /from\(['"]notifications['"]\)/)

  assert.match(me, /getUnreadNotificationCount/)
  assert.doesNotMatch(me, /from\(['"]notifications['"]\)/)

  assert.match(bell, /getUnreadNotificationCount/)
  assert.doesNotMatch(bell, /from\(['"]notifications['"]\)/)

  assert.doesNotMatch(nav, /getUnreadNotificationCount|from\(['"]notifications['"]\)|unread/)
})

await check('沒有新增 migration，也沒有獨立的未讀 RPC／count API', () => {
  const base = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  const changed = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  const names = `${changed}\n${untracked}`
  assert.doesNotMatch(names, /supabase\/migrations\//)

  for (const file of readdirSync(ROOT + '/supabase/migrations', { withFileTypes: true })) {
    if (!file.isFile()) continue
    const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', `supabase/migrations/${file.name}`], { cwd: ROOT, encoding: 'utf8' })
    assert.equal(added, '', `出現未追蹤 migration：${file.name}`)
  }

  const srcFiles = execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
  const unexpectedCount = []
  for (const file of srcFiles) {
    if (file === 'src/lib/supabase/notifications.ts') continue
    const source = read(file)
    if (/getUnreadNotificationCount|from\(['"]notifications['"]\)/.test(source) === false) continue
    if (file.endsWith('HomeNotificationBell.tsx') || file.endsWith('MeClient.tsx') || file.endsWith('NotificationsClient.tsx')) continue
    // cron 派送與刪帳是寫入路徑，不是未讀數
    if (
      file.endsWith('dispatch-new-event-notifications/route.ts') ||
      file.endsWith('dispatch-reminders/route.ts') ||
      file.endsWith('account/delete/route.ts')
    ) {
      assert.doesNotMatch(source, /getUnreadNotificationCount|count:\s*['"]exact['"]/)
      continue
    }
    unexpectedCount.push(file)
  }
  assert.deepEqual(unexpectedCount, [])
  assert.doesNotMatch(read('src/lib/supabase/notifications.ts'), /\.rpc\(/)
})

console.log('ALL PASSED')
