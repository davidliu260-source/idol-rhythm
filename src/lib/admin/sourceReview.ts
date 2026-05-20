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
