// 檢查批量／單筆發布與詳情頁橫幅的多來源判斷與順序無關：node scripts/check-bulk-publish-trust.mjs
import assert from 'node:assert/strict'
import { getPublishBlockReason, getReviewSourceInfo, inferTrustLevelFromSource, inferTrustLevelFromSources } from '../src/lib/admin/sourceReview.ts'

const P_AGG = { sourceName: 'kpopofficial', sourceType: 'community', sourceUrl: 'https://kpopofficial.com/x' }
const P_FAN = { sourceName: 'fan account', sourceType: 'fan_account', sourceUrl: 'https://x.com/fan' }
const P_UNKNOWN = { sourceName: null, sourceType: 'unknown', sourceUrl: null }
const M = { sourceName: 'Soompi', sourceType: 'media_outlet', sourceUrl: 'https://www.soompi.com/article/1' }
const M2 = { sourceName: 'Yonhap', sourceType: 'media_outlet', sourceUrl: 'https://www.yna.co.kr/view/1' }
const O_WEB = { sourceName: 'HYBE Notice', sourceType: 'official_website', sourceUrl: 'https://example-official.com/notice/1' }
const O_SNS = { sourceName: 'Official X', sourceType: 'official_sns', sourceUrl: 'https://x.com/official' }
const O_AGG_URL = { sourceName: 'Official', sourceType: 'official_website', sourceUrl: 'https://kpopofficial.com/x' }
const M_UPPER = { sourceName: 'Media', sourceType: 'MEDIA_OUTLET', sourceUrl: null }
const ALL_NULL = { sourceName: null, sourceType: null, sourceUrl: null }

const cases = [
  ['#1 empty', [], 'pending'],
  ['#2 null/undefined', null, 'pending'],
  ['#3 P', [P_AGG], 'pending'],
  ['#4 M', [M], 'media'],
  ['#5 O', [O_WEB], 'official'],
  ['#6 P+P+P', [P_AGG, P_FAN, P_UNKNOWN], 'pending'],
  ['#7 P+M', [P_AGG, M], 'media'],
  ['#8 P+O', [P_AGG, O_WEB], 'official'],
  ['#9 M+O', [M, O_WEB], 'official'],
  ['#10 P+M+O', [P_AGG, M, O_WEB], 'official'],
  ['#11 M+M', [M, M2], 'media'],
  ['#12 O+O', [O_SNS, O_WEB], 'official'],
  ['#13 official with aggregator URL', [O_AGG_URL], 'official'],
  ['#14 uppercase media', [M_UPPER], 'media'],
  ['#15 all null fields', [ALL_NULL], 'pending'],
]

function permutations(inputs) {
  if (inputs.length === 0) return [[]]
  return inputs.flatMap((input, index) =>
    permutations(inputs.filter((_, other) => other !== index))
      .map((rest) => [input, ...rest]),
  )
}

const NO_SOURCE_REASON = '此活動尚無來源紀錄，請先在編輯頁新增官方、售票或媒體來源。'
const PENDING_REASON = '來源為聚合 / 社群 / 未知類型，請先補充官方、售票、主辦、場館或媒體來源後再發布。'

function check(inputs, expected, label) {
  const before = JSON.stringify(inputs)
  assert.equal(inferTrustLevelFromSources(inputs), expected, label)
  assert.equal(JSON.stringify(inputs), before, `${label}: input unchanged`)
  const reason = getPublishBlockReason(inputs)
  assert.equal(reason === null, inferTrustLevelFromSources(inputs) !== 'pending', `${label}: banner agrees with trust`)
  assert.equal(JSON.stringify(inputs), before, `${label}: banner input unchanged`)
  if (!inputs?.length) {
    assert.equal(reason, NO_SOURCE_REASON, `${label}: no-source banner`)
  } else if (inputs.length > 1 && expected === 'pending') {
    assert.equal(reason, PENDING_REASON, `${label}: order-independent pending banner`)
  }
}

let permutationCount = 0
for (const [label, inputs, expected] of cases) {
  check(inputs, expected, label)
  if (inputs === null) check(undefined, expected, `${label}: undefined`)
  if (inputs?.length > 1) {
    for (const permutation of permutations(inputs)) {
      check(permutation, expected, `${label}: permutation ${permutationCount + 1}`)
      permutationCount++
    }
  }
  console.log(`PASS ${label} -> ${expected}`)
}

const sources = [P_AGG, P_FAN, P_UNKNOWN, M, M2, O_WEB, O_SNS, O_AGG_URL, M_UPPER, ALL_NULL]
for (const source of sources) {
  check([source], inferTrustLevelFromSource(source), 'single-source compatibility')
  const before = JSON.stringify(source)
  const expectedReason = inferTrustLevelFromSource(source) === 'pending'
    ? (getReviewSourceInfo(source).hint ?? PENDING_REASON)
    : null
  assert.equal(getPublishBlockReason([source]), expectedReason, 'single-source banner compatibility')
  assert.equal(JSON.stringify(source), before, 'single-source banner input unchanged')
}
console.log(`PASS single-source compatibility: ${sources.length} sources`)
for (const source of [P_AGG, P_FAN, P_UNKNOWN, ALL_NULL]) {
  assert.equal(getPublishBlockReason([source]), getReviewSourceInfo(source).hint, 'single pending source hint')
}
console.log('PASS publishEvent/bulk share inferTrustLevelFromSources')
console.log('PASS publish banner consistency, copy, compatibility and input unchanged')
console.log(`OK: ${cases.length} cases, ${permutationCount} permutations checked (trust + publish banner)`)
