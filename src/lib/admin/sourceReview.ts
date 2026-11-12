export interface ReviewSourceInput {
  sourceName?: string | null
  sourceType?: string | null
  sourceUrl?: string | null
}

export type ReviewSourceRisk = 'official' | 'media' | 'aggregator' | 'unknown'

export interface ReviewSourceInfo {
  risk: ReviewSourceRisk
  trustLevel: 'official' | 'media' | 'pending'
  label: string
  shortLabel: string
  needsOriginalSource: boolean
  hint: string | null
}

const AGGREGATOR_PATTERNS = [
  'kpopofficial',
  'kpop official',
  'concerts',
]

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern))
}

export function getReviewSourceInfo(input: ReviewSourceInput): ReviewSourceInfo {
  const sourceType = (input.sourceType ?? '').toLowerCase()
  const sourceName = (input.sourceName ?? '').toLowerCase()
  const sourceUrl = (input.sourceUrl ?? '').toLowerCase()
  const haystack = `${sourceName} ${sourceUrl}`

  if (sourceType === 'official_sns' || sourceType === 'official_website') {
    return {
      risk: 'official',
      trustLevel: 'official',
      label: sourceType === 'official_sns' ? '官方 SNS' : '官方網站',
      shortLabel: '官方來源',
      needsOriginalSource: false,
      hint: null,
    }
  }

  if (sourceType === 'media_outlet') {
    return {
      risk: 'media',
      trustLevel: 'media',
      label: '媒體來源',
      shortLabel: '媒體來源',
      needsOriginalSource: false,
      hint: null,
    }
  }

  if (sourceType === 'community' || includesAny(haystack, AGGREGATOR_PATTERNS)) {
    return {
      risk: 'aggregator',
      trustLevel: 'pending',
      label: '聚合 / 社群來源',
      shortLabel: '聚合來源',
      needsOriginalSource: true,
      hint: '此候選來自第三方整理站，請先找到官方、售票、主辦、場館或可靠媒體來源，再建立可發布活動。',
    }
  }

  if (sourceType === 'fan_account') {
    return {
      risk: 'aggregator',
      trustLevel: 'pending',
      label: '粉絲 / 社群來源',
      shortLabel: '社群來源',
      needsOriginalSource: true,
      hint: '此候選來自非官方社群來源，請先找到官方或可靠媒體佐證，再建立可發布活動。',
    }
  }

  return {
    risk: 'unknown',
    trustLevel: 'pending',
    label: sourceType || '未知來源',
    shortLabel: '未知來源',
    needsOriginalSource: true,
    hint: '來源類型不明，請先確認原始來源可信度，再建立可發布活動。',
  }
}

export function inferTrustLevelFromSource(
  input: ReviewSourceInput,
): 'official' | 'media' | 'pending' {
  return getReviewSourceInfo(input).trustLevel
}

const TRUST_LEVEL_RANK: Record<'official' | 'media' | 'pending', number> = {
  official: 2,
  media: 1,
  pending: 0,
}

/**
 * 看全部來源，取最高信任等級（official > media > pending）。
 * 結果與陣列順序無關；沒有來源時回 'pending'。
 */
export function inferTrustLevelFromSources(
  inputs: ReadonlyArray<ReviewSourceInput> | null | undefined,
): 'official' | 'media' | 'pending' {
  let highest: 'official' | 'media' | 'pending' = 'pending'
  for (const input of inputs ?? []) {
    const trustLevel = inferTrustLevelFromSource(input)
    if (TRUST_LEVEL_RANK[trustLevel] > TRUST_LEVEL_RANK[highest]) {
      highest = trustLevel
    }
  }
  return highest
}

const PUBLISH_BLOCK_NO_SOURCE_REASON =
  '此活動尚無來源紀錄，請先在編輯頁新增官方、售票或媒體來源。'
const PUBLISH_BLOCK_PENDING_REASON =
  '來源為聚合 / 社群 / 未知類型，請先補充官方、售票、主辦、場館或媒體來源後再發布。'

/**
 * 詳情頁「發布會被擋下」原因。擋／不擋完全由 inferTrustLevelFromSources 決定
 * （與 publishEvent、bulk-publish 一致）；只有判成 pending 之後才挑提示文字。
 * 回 null 表示可以發布。
 */
export function getPublishBlockReason(
  inputs: ReadonlyArray<ReviewSourceInput> | null | undefined,
): string | null {
  if (inferTrustLevelFromSources(inputs) !== 'pending') return null
  const list = inputs ?? []
  if (list.length === 0) return PUBLISH_BLOCK_NO_SOURCE_REASON
  if (list.length === 1) {
    return getReviewSourceInfo(list[0]).hint ?? PUBLISH_BLOCK_PENDING_REASON
  }
  return PUBLISH_BLOCK_PENDING_REASON
}
