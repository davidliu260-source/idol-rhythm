#!/usr/bin/env node
/**
 * Locks the approved Vercel function region change (iad1 → syd1)
 * and asserts existing crons were not modified.
 *
 * Does not touch the network or the database.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))

const EXPECTED_CRONS = [
  { path: '/api/cron/sync-candidates', schedule: '0 1 * * *' },
  { path: '/api/cron/dispatch-reminders', schedule: '30 1 * * *' },
  { path: '/api/cron/dispatch-new-event-notifications', schedule: '0 2 * * *' },
]

assert.deepEqual(vercel.regions, ['syd1'], 'vercel.json 必須把函式區域設成 syd1')
assert.deepEqual(vercel.crons, EXPECTED_CRONS, '既有 crons 的 path 與 schedule 不可改')
assert.deepEqual(
  Object.keys(vercel).sort(),
  ['crons', 'regions'],
  'vercel.json 只能有 regions 與 crons，不要加其他設定',
)

function gitGrep(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  } catch (err) {
    // git grep exits 1 when there are no matches
    if (err.status === 1) return (err.stdout ?? '').trim()
    throw err
  }
}

const preferred = gitGrep(
  'grep',
  '-l',
  '-I',
  '--full-name',
  'preferredRegion',
  '--',
  'src',
  'middleware.ts',
  'vercel.json',
  'next.config.mjs',
)
assert.equal(preferred, '', `不應出現 preferredRegion（會蓋過專案 regions）：\n${preferred}`)

const edgeHits = gitGrep(
  'grep',
  '-n',
  '-I',
  '--full-name',
  '-E',
  "export const runtime = ['\"]edge['\"]",
  '--',
  'src',
)
assert.equal(edgeHits, '', `不應出現 edge runtime route（本次未核准改 runtime）：\n${edgeHits}`)

console.log('OK 函式區域 syd1：regions 正確、crons 未改、沒有 preferredRegion 或 edge runtime')
