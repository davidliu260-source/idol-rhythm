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

export const DRAFT_SOURCE_TYPES = [
  'official_sns', 'official_website', 'media_outlet', 'fan_account', 'community', 'unknown',
] as const
export type DraftSourceType = (typeof DRAFT_SOURCE_TYPES)[number]

export interface DraftSourceFormRow {
  id: string | null
  label: string
  type: string
  url: string
}

export interface ExistingDraftSource {
  id: string
  label: string | null
  type: string | null
  url: string | null
}

export interface DraftSourceInsertRow {
  label: string
  type: DraftSourceType
  url: string | null
  level: 'official' | 'media' | 'pending'
}

export interface DraftSourcePlan {
  keepIds: string[]
  inserts: DraftSourceInsertRow[]
  deleteIds: string[]
  trustLevel: 'official' | 'media' | 'pending'
}

export interface DraftSourceWriteOps {
  insertSources(rows: DraftSourceInsertRow[]): Promise<{ ids: string[] } | { error: string }>
  deleteSources(ids: string[]): Promise<{ deletedIds: string[] } | { error: string }>
}

export function planDraftSourceChanges(
  existing: ReadonlyArray<ExistingDraftSource>,
  formRows: ReadonlyArray<DraftSourceFormRow>,
): { ok: true; plan: DraftSourcePlan } | { ok: false; error: string } {
  if (formRows.length === 0) return { ok: false, error: '至少需要一筆來源' }
  const byId = new Map(existing.map((row) => [row.id, row]))
  const seen = new Set<string>()
  const keepIds: string[] = []
  const inserts: DraftSourceInsertRow[] = []
  for (let index = 0; index < formRows.length; index++) {
    const row = formRows[index]
    const label = row.label.trim()
    const url = row.url.trim()
    if (!label) return { ok: false, error: `第 ${index + 1} 筆來源名稱不可空白` }
    if (!DRAFT_SOURCE_TYPES.includes(row.type as DraftSourceType)) {
      return { ok: false, error: `第 ${index + 1} 筆來源類型不正確` }
    }
    const old = row.id !== null ? byId.get(row.id) : undefined
    if (row.id !== null) {
      if (!old || seen.has(row.id)) {
        return { ok: false, error: '來源資料已變動，請重新整理頁面後再編輯' }
      }
      seen.add(row.id)
    }
    if (old && label === (old.label ?? '').trim() &&
        row.type === (old.type ?? 'unknown') && url === (old.url ?? '').trim()) {
      keepIds.push(old.id)
    } else {
      inserts.push({
        label, type: row.type as DraftSourceType, url: url || null,
        level: inferTrustLevelFromSource({ sourceName: label, sourceType: row.type, sourceUrl: url }),
      })
    }
  }
  const kept = new Set(keepIds)
  const finalRows = [...existing.filter((row) => kept.has(row.id)), ...inserts]
  return {
    ok: true,
    plan: {
      keepIds, inserts, deleteIds: existing.filter((row) => !kept.has(row.id)).map((row) => row.id),
      trustLevel: inferTrustLevelFromSources(finalRows.map((row) => ({
        sourceName: row.label, sourceType: row.type, sourceUrl: row.url,
      }))),
    },
  }
}

// All write calls, including compensation, convert thrown errors to ordinary failures.
async function draftSourceWrite<T>(op: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await op()
  } catch (err) {
    return { error: String((err as { message?: unknown } | null)?.message ?? err) }
  }
}

export async function applyDraftSourcePlan(
  plan: DraftSourcePlan,
  ops: DraftSourceWriteOps,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let newIds: string[] = []
  if (plan.inserts.length > 0) {
    const result = await draftSourceWrite(() => ops.insertSources(plan.inserts))
    if ('error' in result) {
      return { ok: false, error: `新增來源失敗：${result.error}（原有來源未變動）` }
    }
    newIds = result.ids
    if (newIds.length !== plan.inserts.length) {
      if (newIds.length > 0) await draftSourceWrite(() => ops.deleteSources(newIds))
      return { ok: false, error: '新增來源筆數不符（原有來源未變動）' }
    }
  }
  if (plan.deleteIds.length > 0) {
    const result = await draftSourceWrite(() => ops.deleteSources(plan.deleteIds))
    if ('error' in result) {
      const compensation = newIds.length > 0
        ? await draftSourceWrite(() => ops.deleteSources(newIds))
        : { deletedIds: [] }
      if ('error' in compensation || compensation.deletedIds.length < newIds.length) {
        return { ok: false, error: `刪除舊來源失敗：${result.error}；撤回新增也失敗，目前可能有重複來源，請重新整理頁面確認` }
      }
      return { ok: false, error: `刪除舊來源失敗：${result.error}（已撤回新增，來源維持原狀）` }
    }
    if (result.deletedIds.length < plan.deleteIds.length) {
      return { ok: false, error: '部分舊來源未刪除，目前可能有重複來源，請重新整理頁面確認' }
    }
  }
  return { ok: true }
}
