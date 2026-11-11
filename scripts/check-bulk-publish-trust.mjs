// 檢查批量發布的多來源信任等級與順序無關：node scripts/check-bulk-publish-trust.mjs
import assert from 'node:assert/strict'
import { inferTrustLevelFromSource, inferTrustLevelFromSources } from '../src/lib/admin/sourceReview.ts'

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

function check(inputs, expected, label) {
  const before = JSON.stringify(inputs)
  assert.equal(inferTrustLevelFromSources(inputs), expected, label)
  assert.equal(JSON.stringify(inputs), before, `${label}: input unchanged`)
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
}
console.log(`PASS single-source compatibility: ${sources.length} sources`)
console.log(`OK: ${cases.length} cases, ${permutationCount} permutations checked`)
