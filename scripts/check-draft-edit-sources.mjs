// 檢查編輯草稿的來源增刪改規劃、可信度與失敗回復：node scripts/check-draft-edit-sources.mjs
import assert from 'node:assert/strict'
import { planDraftSourceChanges, applyDraftSourcePlan, inferTrustLevelFromSource, inferTrustLevelFromSources } from '../src/lib/admin/sourceReview.ts'

const P_AGG = { id: 'agg', label: 'kpopofficial', type: 'community', url: null, level: 'pending' }
const P_FAN = { id: 'fan', label: 'Fan', type: 'fan_account', url: null, level: 'pending' }
const M = { id: 'media', label: 'Soompi', type: 'media_outlet', url: null, level: 'media' }
const O_WEB = { id: null, label: 'HYBE Notice', type: 'official_website', url: '' }
const original = [P_AGG, M, P_FAN]
const form = (rows) => rows.map(({ id, label, type, url }) => ({ id, label: label ?? '', type: type ?? 'unknown', url: url ?? '' }))
const input = (row) => ({ sourceName: row.label, sourceType: row.type, sourceUrl: row.url })
function makeStore(rows, fail = {}) {
  let nextId = 0
  let deletes = 0
  const store = { rows: structuredClone(rows), calls: [] }
  store.ops = {
    async insertSources(rows) {
      store.calls.push('insert')
      if (fail.insert) return { error: 'boom-insert' }
      if (fail.insertThrow) throw new Error('boom-insert')
      const inserted = (fail.insertShort ? rows.slice(0, 1) : rows).map((r) => ({ ...r, id: `new-${++nextId}` }))
      store.rows.push(...inserted)
      return { ids: inserted.map((r) => r.id) }
    },
    async deleteSources(ids) {
      store.calls.push(`delete:${ids.join(',')}`)
      deletes++
      if (deletes === 1 && fail.deleteThrow) throw new Error('boom-delete')
      if ((deletes === 1 && fail.delete) || (deletes === 2 && fail.compensate)) return { error: 'boom-delete' }
      const allowed = deletes === 1 && fail.deleteSilent ? ids.slice(0, 1) : ids
      const deletedIds = store.rows.filter((r) => allowed.includes(r.id)).map((r) => r.id)
      store.rows = store.rows.filter((r) => !allowed.includes(r.id))
      return { deletedIds }
    },
  }
  return store
}
async function save(store, rows) {
  const planned = planDraftSourceChanges(store.rows, rows)
  if (!planned.ok) return planned
  return { ...await applyDraftSourcePlan(planned.plan, store.ops), plan: planned.plan }
}
let count = 0
async function test(name, run) {
  await run()
  console.log(`PASS ${name}`)
  count++
}
const s2 = [...form(original), O_WEB]
const s3 = form([P_AGG, P_FAN])
const s5 = [{ ...form([P_FAN])[0], type: 'official_sns' }]
const changed = [...form([P_AGG]), { ...form([P_FAN])[0], type: 'official_sns' }]
const changedPlus = [...form(original).map((r) => r.id === P_FAN.id ? { ...r, type: 'official_sns' } : r), O_WEB]
await test('S1 keep all IDs', async () => {
  const store = makeStore(original), r = await save(store, form(original))
  assert.equal(r.ok, true)
  assert.deepEqual(r.plan.inserts, [])
  assert.deepEqual(r.plan.deleteIds, [])
  assert.deepEqual(r.plan.keepIds, original.map((r) => r.id))
  assert.deepEqual(store.calls, [])
  assert.deepEqual(store.rows, original)
  assert.equal(r.plan.trustLevel, 'media')
})
await test('S2 append official', async () => {
  const store = makeStore(original), r = await save(store, s2)
  assert.equal(r.ok, true)
  assert.equal(r.plan.inserts.length, 1)
  assert.equal(r.plan.inserts[0].level, 'official')
  assert.deepEqual(r.plan.deleteIds, [])
  assert.equal(store.rows.length, 4)
  assert.deepEqual(store.rows.slice(0, 3), original)
  assert.equal(r.plan.trustLevel, 'official')
})
await test('S3 remove media', async () => {
  const store = makeStore(original), r = await save(store, s3)
  assert.equal(r.ok, true)
  assert.deepEqual(r.plan.deleteIds, [M.id])
  assert.deepEqual(store.rows, [P_AGG, P_FAN])
  assert.equal(r.plan.trustLevel, 'pending')
})
for (const [name, fail] of [['S4a', { insert: true }], ['S4b', { insertThrow: true }], ['S4c', { insertShort: true }]]) {
  await test(`${name} insert failure`, async () => {
    const store = makeStore(original, fail), r = await save(store, changedPlus)
    assert.equal(r.ok, false)
    assert.match(r.error, /原有來源未變動/)
    assert.deepEqual(store.rows, original)
    if (fail.insertShort) assert.equal(r.error, '新增來源筆數不符（原有來源未變動）')
    else assert.deepEqual(store.calls, ['insert'])
  })
}
for (const [name, fail] of [['S4d', { delete: true }], ['S4e', { deleteThrow: true }]]) {
  await test(`${name} compensate`, async () => {
    const store = makeStore(original, fail), r = await save(store, changed)
    assert.equal(r.ok, false)
    assert.match(r.error, /已撤回新增/)
    assert.deepEqual(store.rows, original)
    assert.deepEqual(store.calls, ['insert', 'delete:media,fan', 'delete:new-1'])
  })
}
await test('S4f compensation failure', async () => {
  const failed = makeStore(original, { delete: true, compensate: true })
  const result = await save(failed, changed)
  assert.equal(result.ok, false)
  assert.match(result.error, /可能有重複來源/)
  assert.ok(failed.rows.length >= 3)
  for (const row of original) assert.ok(failed.rows.some((r) => r.id === row.id))
})
await test('S4g silent partial delete', async () => {
  const store = makeStore(original, { deleteSilent: true }), r = await save(store, form([P_AGG]))
  assert.equal(r.ok, false)
  assert.equal(r.error, '部分舊來源未刪除，目前可能有重複來源，請重新整理頁面確認')
  assert.ok(store.rows.length >= 1)
  assert.deepEqual(store.calls, ['delete:media,fan'])
})
await test('S5 replace only source', async () => {
  const store = makeStore([P_FAN]), r = await save(store, s5)
  assert.equal(r.ok, true)
  assert.deepEqual(store.calls, ['insert', 'delete:fan'])
  assert.equal(store.rows.length, 1)
  assert.equal(store.rows[0].level, 'official')
  assert.notEqual(store.rows[0].id, P_FAN.id)
  assert.deepEqual(r.plan.deleteIds, [P_FAN.id])
  assert.equal(r.plan.trustLevel, 'official')
})
for (const [name, rows, error] of [
  ['empty', [], '至少需要一筆來源'],
  ['label', [form(original)[0], { ...form(original)[1], label: ' ' }], '第 2 筆來源名稱不可空白'],
  ['type', [{ ...form(original)[0], type: 'bogus' }], '第 1 筆來源類型不正確'],
  ['stale', [{ ...form(original)[0], id: 'not-exist' }], '來源資料已變動，請重新整理頁面後再編輯'],
  ['duplicate', [form(original)[0], form(original)[0]], '來源資料已變動，請重新整理頁面後再編輯'],
]) await test(`S6 ${name}`, async () => {
  const store = makeStore(original), r = await save(store, rows)
  assert.deepEqual(r, { ok: false, error })
  assert.deepEqual(store.calls, [])
  assert.deepEqual(store.rows, original)
})
await test('S7 normalization', async () => {
  const rows = [{ ...P_FAN, label: ' Fan ', type: null, url: null }]
  const r = planDraftSourceChanges(rows, [{ id: 'fan', label: 'Fan  ', type: 'unknown', url: '' }])
  assert.equal(r.ok, true)
  assert.deepEqual(r.plan.keepIds, ['fan'])
  assert.deepEqual(r.plan.inserts, [])
  assert.deepEqual(r.plan.deleteIds, [])
})
await test('S8 trust consistency', async () => {
  for (const [rows, submitted] of [[original, form(original)], [original, s2], [original, s3], [original, changedPlus], [original, changed], [original, form([P_AGG])], [[P_FAN], s5]]) {
    const store = makeStore(rows), r = await save(store, submitted)
    assert.equal(r.ok, true)
    assert.equal(r.plan.trustLevel, inferTrustLevelFromSources(store.rows.map(input)))
    for (const row of r.plan.inserts) assert.equal(row.level, inferTrustLevelFromSource(input(row)))
  }
})
function permutations(rows) {
  return rows.length === 0 ? [[]] : rows.flatMap((r, i) => permutations(rows.filter((_, j) => j !== i)).map((rest) => [r, ...rest]))
}
await test('S9 all 24 permutations', () => {
  for (const rows of permutations(s2)) {
    const r = planDraftSourceChanges(original, rows)
    assert.equal(r.ok, true)
    assert.equal(r.plan.trustLevel, 'official')
  }
})
await test('S10 immutable inputs', () => {
  const before = JSON.stringify([original, changedPlus])
  planDraftSourceChanges(original, changedPlus)
  assert.equal(JSON.stringify([original, changedPlus]), before)
})
for (const [scenario, rows, submitted] of [['S2', original, s2], ['S3', original, s3], ['S5', [P_FAN], s5]]) {
  for (const [failure, fail] of [['none', {}], ['insert', { insert: true }], ['insertThrow', { insertThrow: true }], ['insertShort', { insertShort: true }], ['delete', { delete: true }], ['deleteThrow', { deleteThrow: true }], ['delete+compensate', { delete: true, compensate: true }], ['deleteSilent', { deleteSilent: true }]]) {
    await test(`S11 ${scenario}/${failure}`, async () => {
      const store = makeStore(rows, fail)
      await save(store, submitted)
      assert.ok(store.rows.length >= 1)
    })
  }
}
console.log(`OK: ${count} cases`)
