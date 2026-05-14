// ── Idol ──────────────────────────────────────────────────────────────────────

export type GroupOrSolo = 'group' | 'solo'
export type GenderType = 'male' | 'female' | 'mixed' | 'unknown'
export type IdolCategory = 'kpop' | 'cpop' | 'jpop' | 'idol' | 'other'

export interface Idol {
  id: string
  name: string
  koreanName: string
  type: GroupOrSolo
  gender?: GenderType
  category?: IdolCategory
  agency: string
  debut: string
  color: string
  gradient: string
  genres: string[]
  memberCount?: number
  following: boolean
  description: string
}

// ── Event ─────────────────────────────────────────────────────────────────────

/**
 * 7 frontend-visible event categories.
 * Used for filtering tabs and badge colour.
 */
export type EventType =
  | 'concert'    // 演唱會、見面會、簽名會、頒獎典禮
  | 'ticketing'  // 開票售票
  | 'livestream' // 直播
  | 'streaming'  // 串流平台（Netflix、Disney+ 等）
  | 'media'      // 雜誌、採訪、音樂節目、綜藝
  | 'brand'      // 代言、品牌合作、快閃
  | 'official'   // 官方公告、專輯發行

/**
 * Fine-grained sub-classification within a main EventType.
 * Used to display a more specific badge label when present.
 */
export type EventSubType =
  | 'fanmeet'
  | 'fansign'
  | 'musicshow'
  | 'variety'
  | 'interview'
  | 'award'
  | 'release'
  | 'announcement'
  | 'magazine'

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled' | 'postponed'

// ── Trust & Source ────────────────────────────────────────────────────────────

/**
 * Three-tier trust system:
 *  official — direct from artist / agency SNS or official website
 *  media    — confirmed by known media outlet or reputable fan account
 *  pending  — unverified; MUST NOT be rendered in any public-facing page
 */
export type TrustLevel = 'official' | 'media' | 'pending'

export type SourceType =
  | 'official_sns'
  | 'official_website'
  | 'media_outlet'
  | 'fan_account'
  | 'community'
  | 'unknown'

export interface EventSource {
  level: TrustLevel
  label: string
  url?: string
  type?: SourceType
}

// ── Event (main entity) ───────────────────────────────────────────────────────

export interface Event {
  id: string
  idolId: string
  idolName: string
  title: string
  type: EventType
  subType?: EventSubType
  status: EventStatus
  date: string
  time?: string
  location?: string
  country: string
  countryFlag: string
  source: EventSource
  description: string
  isFavorited: boolean
  ticketUrl?: string
  streamUrl?: string
  tags: string[]
}

// ── Candidate pool (future admin / AI review pipeline) ────────────────────────

/**
 * Raw candidate data collected from sources before human/AI review.
 * Maps to the `event_candidates` table in the future Supabase schema.
 */
export interface EventCandidate {
  id: string
  rawTitle: string
  rawContent: string
  detectedIdolId?: string
  detectedEventType?: EventType
  detectedDatetime?: string
  sourceUrl?: string
  sourceName?: string
  sourceType?: SourceType
  /** Confidence score from AI classification (0.0–1.0) */
  aiConfidence?: number
  reviewStatus: 'pending' | 'approved' | 'rejected'
  reviewerNote?: string
  /** References Event.id after the candidate is approved and published */
  approvedEventId?: string
  createdAt: string
  updatedAt: string
}
