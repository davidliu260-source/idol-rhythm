/**
 * YouTube Official Channel parser + payload builder.
 *
 * Pure module — no Supabase, no fetch. Only:
 *   - YouTube Data API v3 response type aliases
 *   - URL builders for channels.list / playlistItems.list / videos.list
 *   - ISO 8601 duration parser
 *   - Video classification into A / B / C / unknown tiers (per P2-A work order v3)
 *   - event_candidates payload builder
 *
 * Classification tiers (product decision recorded in P2-A work order):
 *   A — high priority, candidate gets content_priority = "high"
 *       (official MV, premieres, livestreams, comeback/showcase/anniversary
 *        live, concert film / documentary / streaming release trailers,
 *        comeback / album trailer)
 *   B — low priority, candidate gets content_priority = "low"
 *       (mv teaser, album teaser, visualizer, lyric video, performance clip)
 *   C — excluded, no candidate row
 *       (Shorts, vlog, reaction, challenge, fancam, fan edit, dance cover,
 *        behind / making, Topic auto-upload, audio-only / loop, unofficial)
 *   unknown — v1 also excluded (per task instruction: "v1 先略過")
 *
 * Never writes events. Never approves. Never publishes.
 *
 * parser_type:    youtube_official_channel
 * parser_version: 1
 */

import { computeSourceHash } from './sourceHash'
import { computeContentHash } from './contentHash'
import type { SourceTypeEnum } from './crawlerSource'

export const YOUTUBE_OFFICIAL_CHANNEL_PARSER_TYPE = 'youtube_official_channel'
export const YOUTUBE_OFFICIAL_CHANNEL_PARSER_VERSION = 1

/** Default per-channel pull size when config.maxVideosPerRun is missing. */
export const DEFAULT_MAX_VIDEOS_PER_RUN = 10
/** Default lookback hours when config.publishedAfterHours is missing. */
export const DEFAULT_PUBLISHED_AFTER_HOURS = 25
/** Hard ceiling — refuse to pull more than this per run regardless of config. */
export const MAX_VIDEOS_PER_RUN_CEILING = 50
/** YouTube Shorts threshold (inclusive: <60s considered short). */
export const SHORTS_DURATION_SECONDS = 60

// ── crawler_sources.config shape ─────────────────────────────────────────────

export interface YoutubeChannelConfig {
  /** YouTube Channel ID (UC… 22 chars). Required. */
  channelId: string
  /** Pre-resolved uploads playlist ID (UU…). Optional but recommended. */
  uploadsPlaylistId?: string | null
  /** Per-channel override of pull size. Defaults to 10. */
  maxVideosPerRun?: number
  /** Hours of look-back for publishedAfter filter. Defaults to 25. */
  publishedAfterHours?: number
}

export function parseYoutubeChannelConfig(
  raw: Record<string, unknown>,
): { config: YoutubeChannelConfig | null; error: string | null } {
  const channelId = typeof raw.channelId === 'string' ? raw.channelId.trim() : ''
  if (!channelId) {
    return { config: null, error: 'config.channelId 缺失或型別錯誤' }
  }
  if (!/^UC[\w-]{20,40}$/.test(channelId)) {
    return {
      config: null,
      error: `config.channelId 格式不像 YouTube Channel ID（應以 UC 開頭）：${channelId}`,
    }
  }

  let uploadsPlaylistId: string | null = null
  if (typeof raw.uploadsPlaylistId === 'string' && raw.uploadsPlaylistId.trim()) {
    const upl = raw.uploadsPlaylistId.trim()
    if (!/^UU[\w-]{20,40}$/.test(upl)) {
      return {
        config: null,
        error: `config.uploadsPlaylistId 格式不像 YouTube Uploads Playlist ID（應以 UU 開頭）：${upl}`,
      }
    }
    uploadsPlaylistId = upl
  }

  const maxVideosPerRun =
    typeof raw.maxVideosPerRun === 'number' && raw.maxVideosPerRun > 0
      ? Math.min(Math.floor(raw.maxVideosPerRun), MAX_VIDEOS_PER_RUN_CEILING)
      : DEFAULT_MAX_VIDEOS_PER_RUN

  const publishedAfterHours =
    typeof raw.publishedAfterHours === 'number' && raw.publishedAfterHours > 0
      ? Math.floor(raw.publishedAfterHours)
      : DEFAULT_PUBLISHED_AFTER_HOURS

  return {
    config: { channelId, uploadsPlaylistId, maxVideosPerRun, publishedAfterHours },
    error: null,
  }
}

// ── YouTube Data API v3 response shapes (subset we use) ──────────────────────

export interface YoutubeApiError {
  code: number
  message: string
  errors?: Array<{ reason?: string; domain?: string; message?: string }>
}

export interface ChannelsListResponse {
  items?: Array<{
    id?: string
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string
      }
    }
  }>
  error?: YoutubeApiError
}

export interface PlaylistItemsResponse {
  items?: Array<{
    snippet?: {
      publishedAt?: string
      title?: string
      channelTitle?: string
      resourceId?: {
        kind?: string
        videoId?: string
      }
      thumbnails?: {
        default?: { url?: string }
        medium?: { url?: string }
        high?: { url?: string }
      }
    }
  }>
  nextPageToken?: string
  error?: YoutubeApiError
}

export interface VideosListResponse {
  items?: Array<{
    id?: string
    snippet?: {
      title?: string
      description?: string
      publishedAt?: string
      channelId?: string
      channelTitle?: string
      thumbnails?: {
        default?: { url?: string }
        medium?: { url?: string }
        high?: { url?: string }
      }
    }
    contentDetails?: {
      duration?: string
    }
    liveStreamingDetails?: {
      scheduledStartTime?: string
      actualStartTime?: string
      actualEndTime?: string
      concurrentViewers?: string
    }
    statistics?: {
      viewCount?: string
    }
  }>
  error?: YoutubeApiError
}

// ── API URL builders ─────────────────────────────────────────────────────────

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3'

export function buildChannelsListUrl(channelId: string, apiKey: string): string {
  const u = new URL(`${YT_API_BASE}/channels`)
  u.searchParams.set('part', 'contentDetails')
  u.searchParams.set('id', channelId)
  u.searchParams.set('key', apiKey)
  return u.toString()
}

export function buildPlaylistItemsUrl(
  playlistId: string,
  apiKey: string,
  maxResults: number,
): string {
  const u = new URL(`${YT_API_BASE}/playlistItems`)
  u.searchParams.set('part', 'snippet')
  u.searchParams.set('playlistId', playlistId)
  u.searchParams.set('maxResults', String(Math.min(Math.max(maxResults, 1), 50)))
  u.searchParams.set('key', apiKey)
  return u.toString()
}

export function buildVideosListUrl(videoIds: string[], apiKey: string): string {
  const u = new URL(`${YT_API_BASE}/videos`)
  u.searchParams.set(
    'part',
    'snippet,contentDetails,liveStreamingDetails',
  )
  u.searchParams.set('id', videoIds.slice(0, 50).join(','))
  u.searchParams.set('key', apiKey)
  return u.toString()
}

// ── ISO 8601 duration parser ─────────────────────────────────────────────────

/**
 * Parse YouTube's ISO 8601 duration ("PT4M33S", "PT1H2M3S", "PT0S") to seconds.
 * Returns null on unparseable / empty input.
 */
export function parseIso8601DurationSeconds(d: string | null | undefined): number | null {
  if (!d) return null
  const m = d.trim().match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
  if (!m) return null
  const h = m[1] ? Number(m[1]) : 0
  const min = m[2] ? Number(m[2]) : 0
  const s = m[3] ? Number(m[3]) : 0
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(s)) return null
  return h * 3600 + min * 60 + s
}

// ── Classification ───────────────────────────────────────────────────────────

export type YoutubeTier = 'A' | 'B' | 'C' | 'unknown'

export type YoutubeContentType =
  // A — high priority
  | 'official_mv'
  | 'mv_premiere'
  | 'official_livestream'
  | 'comeback_live'
  | 'showcase_live'
  | 'anniversary_live'
  | 'concert_film_trailer'
  | 'documentary_trailer'
  | 'streaming_release_trailer'
  | 'comeback_trailer'
  | 'album_trailer'
  // B — low priority
  | 'mv_teaser'
  | 'album_teaser'
  | 'visualizer'
  | 'lyric_video'
  | 'performance_clip'
  // C — excluded
  | 'shorts'
  | 'vlog'
  | 'reaction'
  | 'challenge'
  | 'fancam'
  | 'fan_edit'
  | 'unofficial_reupload'
  | 'dance_cover'
  | 'behind_making'
  | 'topic_audio'
  | 'audio_loop'
  // fallthrough
  | 'unknown'

export type ContentPriority = 'high' | 'low'

/** event_type values that YouTube classifier emits — subset of schema enum. */
export type YoutubeEventType = 'official' | 'streaming' | 'livestream' | null
/** event_sub_type values used by YouTube classifier — subset of schema enum. */
export type YoutubeEventSubType = 'release' | 'announcement' | null

export interface ClassifyResult {
  tier: YoutubeTier
  youtubeContentType: YoutubeContentType
  contentPriority: ContentPriority
  eventType: YoutubeEventType
  eventSubType: YoutubeEventSubType
}

export interface ClassifyInput {
  title: string
  channelTitle: string | null
  durationSeconds: number | null
  liveBroadcastContent: 'none' | 'live' | 'upcoming' | null
  scheduledStartTime: string | null
}

function containsAny(haystack: string, patterns: RegExp[]): boolean {
  for (const p of patterns) if (p.test(haystack)) return true
  return false
}

const MV_RE = /(\bm\s?\/?\s?v\b|music\s?video|뮤직비디오)/i
const TRAILER_RE = /(trailer|트레일러)/i
const TEASER_RE = /(teaser|티저)/i
const ALBUM_RE = /(\balbum\b|앨범)/i
const COMEBACK_RE = /(comeback|컴백)/i

export function classifyYoutubeVideo(opts: ClassifyInput): ClassifyResult {
  const title = (opts.title ?? '').trim()
  const lower = title.toLowerCase()
  const ch = (opts.channelTitle ?? '').trim()

  // ── C 級 (hard exclusions) ─────────────────────────────────────────────────

  // Shorts by duration
  if (
    opts.durationSeconds !== null &&
    opts.durationSeconds > 0 &&
    opts.durationSeconds < SHORTS_DURATION_SECONDS
  ) {
    return {
      tier: 'C',
      youtubeContentType: 'shorts',
      contentPriority: 'low',
      eventType: null,
      eventSubType: null,
    }
  }

  // Topic auto-uploaded audio channels (YouTube auto-generated)
  if (/\s-\sTopic$/.test(ch)) {
    return {
      tier: 'C',
      youtubeContentType: 'topic_audio',
      contentPriority: 'low',
      eventType: null,
      eventSubType: null,
    }
  }

  // Keyword exclusions
  const C_TABLE: Array<[RegExp, YoutubeContentType]> = [
    [/(\bvlog\b|브이로그)/i, 'vlog'],
    [/(\breaction\b|리액션)/i, 'reaction'],
    [/(\bchallenge\b|챌린지)/i, 'challenge'],
    [/(\bfan\s?cam\b|직캠)/i, 'fancam'],
    [/(\bfan\s?made\b|\bfan\s?edit\b)/i, 'fan_edit'],
    [/(\bdance\s?cover\b|cover\s?dance)/i, 'dance_cover'],
    [/(\bbehind\b|\bmaking\b|\bmaking\s?film\b|비하인드|메이킹)/i, 'behind_making'],
    [/(\bunofficial\b|비공식|re\s?upload|reupload)/i, 'unofficial_reupload'],
    [/(\baudio\s?only\b|\bloop\b|\b1\s?hour\b|\bextended\b)/i, 'audio_loop'],
  ]
  for (const [re, kind] of C_TABLE) {
    if (re.test(title)) {
      return {
        tier: 'C',
        youtubeContentType: kind,
        contentPriority: 'low',
        eventType: null,
        eventSubType: null,
      }
    }
  }

  // ── A 級 (livestream-derived, highest signal) ──────────────────────────────

  if (opts.liveBroadcastContent === 'live') {
    return {
      tier: 'A',
      youtubeContentType: 'official_livestream',
      contentPriority: 'high',
      eventType: 'livestream',
      eventSubType: null,
    }
  }

  if (opts.liveBroadcastContent === 'upcoming' && opts.scheduledStartTime) {
    if (MV_RE.test(title)) {
      return {
        tier: 'A',
        youtubeContentType: 'mv_premiere',
        contentPriority: 'high',
        eventType: 'official',
        eventSubType: 'announcement',
      }
    }
    return {
      tier: 'A',
      youtubeContentType: 'official_livestream',
      contentPriority: 'high',
      eventType: 'livestream',
      eventSubType: null,
    }
  }

  // ── A 級 (title-based specific patterns first) ─────────────────────────────

  // Concert film trailer (must have BOTH concert film AND trailer/teaser word)
  if (/(concert\s?film|콘서트\s?필름)/i.test(title) && (TRAILER_RE.test(title) || TEASER_RE.test(title))) {
    return {
      tier: 'A',
      youtubeContentType: 'concert_film_trailer',
      contentPriority: 'high',
      eventType: 'streaming',
      eventSubType: 'announcement',
    }
  }

  // Documentary trailer
  if (/(documentary|다큐멘터리)/i.test(title)) {
    return {
      tier: 'A',
      youtubeContentType: 'documentary_trailer',
      contentPriority: 'high',
      eventType: 'streaming',
      eventSubType: 'announcement',
    }
  }

  // Streaming release trailer (Netflix / Disney+ / Apple TV+ / Prime Video)
  if (/(netflix|disney\s?\+?|apple\s?tv\s?\+?|prime\s?video)/i.test(title)) {
    return {
      tier: 'A',
      youtubeContentType: 'streaming_release_trailer',
      contentPriority: 'high',
      eventType: 'streaming',
      eventSubType: 'announcement',
    }
  }

  // Comeback live / Showcase live / Anniversary live (recorded broadcasts even
  // when liveBroadcastContent === 'none' — common for archived livestream uploads)
  if (/(comeback\s?live|컴백\s?라이브)/i.test(title)) {
    return {
      tier: 'A',
      youtubeContentType: 'comeback_live',
      contentPriority: 'high',
      eventType: 'livestream',
      eventSubType: 'release',
    }
  }
  if (/(showcase|쇼케이스)/i.test(title)) {
    return {
      tier: 'A',
      youtubeContentType: 'showcase_live',
      contentPriority: 'high',
      eventType: 'livestream',
      eventSubType: 'release',
    }
  }
  if (/(anniversary|주년|기념\s?콘서트|기념\s?라이브)/i.test(title)) {
    return {
      tier: 'A',
      youtubeContentType: 'anniversary_live',
      contentPriority: 'high',
      eventType: 'livestream',
      eventSubType: 'release',
    }
  }

  // Album / Comeback Trailer (A — distinct from teaser which is B)
  if (TRAILER_RE.test(title) && (COMEBACK_RE.test(title) || ALBUM_RE.test(title))) {
    const kind: YoutubeContentType = ALBUM_RE.test(title) ? 'album_trailer' : 'comeback_trailer'
    return {
      tier: 'A',
      youtubeContentType: kind,
      contentPriority: 'high',
      eventType: 'official',
      eventSubType: 'announcement',
    }
  }

  // ── B 級 (teaser / visualizer / lyric / clip — must run BEFORE MV check
  //        so "MV Teaser" is classified as B not A) ───────────────────────────

  if (TEASER_RE.test(title)) {
    if (MV_RE.test(title)) {
      return {
        tier: 'B',
        youtubeContentType: 'mv_teaser',
        contentPriority: 'low',
        eventType: 'official',
        eventSubType: 'announcement',
      }
    }
    if (ALBUM_RE.test(title)) {
      return {
        tier: 'B',
        youtubeContentType: 'album_teaser',
        contentPriority: 'low',
        eventType: 'official',
        eventSubType: 'announcement',
      }
    }
    // Generic teaser (no MV/album qualifier) → low priority bucket
    return {
      tier: 'B',
      youtubeContentType: 'mv_teaser',
      contentPriority: 'low',
      eventType: 'official',
      eventSubType: 'announcement',
    }
  }

  if (/(visualizer|비주얼라이저)/i.test(title)) {
    return {
      tier: 'B',
      youtubeContentType: 'visualizer',
      contentPriority: 'low',
      eventType: 'official',
      eventSubType: 'release',
    }
  }

  if (/(lyric\s?video|\blyrics?\b|\b가사\b)/i.test(title)) {
    return {
      tier: 'B',
      youtubeContentType: 'lyric_video',
      contentPriority: 'low',
      eventType: 'official',
      eventSubType: 'release',
    }
  }

  if (/(dance\s?practice|\b안무\b|performance\s?(clip|practice)|stage\s?practice)/i.test(title)) {
    return {
      tier: 'B',
      youtubeContentType: 'performance_clip',
      contentPriority: 'low',
      eventType: 'official',
      eventSubType: 'release',
    }
  }

  // ── A 級 (general MV — last among A because more specific patterns ran first) ──

  if (MV_RE.test(title)) {
    return {
      tier: 'A',
      youtubeContentType: 'official_mv',
      contentPriority: 'high',
      eventType: 'official',
      eventSubType: 'release',
    }
  }

  // Avoid unused-variable warning on `lower` (kept for future fine-tuned matchers)
  void lower

  // ── Unknown — v1 skip (do not insert) ─────────────────────────────────────
  return {
    tier: 'unknown',
    youtubeContentType: 'unknown',
    contentPriority: 'low',
    eventType: null,
    eventSubType: null,
  }
}

// ── Payload builder ──────────────────────────────────────────────────────────

export interface YoutubeSourceContext {
  crawlerSourceId: string
  sourceKey: string
  sourceName: string
  sourceType: SourceTypeEnum
  parserType: string
  pageUrl: string
  idolId: string
  idolSlug: string
  channelId: string
  uploadsPlaylistId: string | null
}

export interface YoutubeVideoEntry {
  videoId: string
  title: string
  description: string | null
  publishedAt: string
  channelId: string
  channelTitle: string | null
  thumbnailUrl: string | null
  duration: string | null
  durationSeconds: number | null
  liveBroadcastContent: 'none' | 'live' | 'upcoming' | null
  scheduledStartTime: string | null
  actualStartTime: string | null
  actualEndTime: string | null
}

export interface YoutubeCandidatePayload {
  raw_title: string
  raw_content: string
  detected_idol_id: string
  detected_event_type: YoutubeEventType
  detected_event_sub_type: YoutubeEventSubType
  detected_date: string | null
  source_url: string
  source_name: string
  source_type: SourceTypeEnum
  ai_confidence: null
  reviewer_note: string
  source_hash: string
  content_hash: string
  raw_data: {
    source: 'youtube-official-channel'
    crawler_source_id: string
    source_key: string
    parser_type: string
    parser_version: number
    platform: 'youtube'
    video_id: string
    channel_id: string
    uploads_playlist_id: string | null
    youtube_content_type: YoutubeContentType
    content_priority: ContentPriority
    tier: YoutubeTier
    published_at: string
    duration: string | null
    duration_seconds: number | null
    is_live: boolean
    is_premiere: boolean
    live_broadcast_content: 'none' | 'live' | 'upcoming' | null
    scheduled_start_time: string | null
    actual_start_time: string | null
    actual_end_time: string | null
    channel_title: string | null
    thumbnail_url: string | null
    idol_slug: string
    page_url: string
  }
}

export function entryToCandidatePayload(
  entry: YoutubeVideoEntry,
  classification: ClassifyResult,
  source: YoutubeSourceContext,
): YoutubeCandidatePayload {
  const raw_title = entry.title
  const description = entry.description ?? ''
  const summary =
    description.length > 600 ? `${description.slice(0, 600)}…` : description

  // detected_date: use publishedAt date (YYYY-MM-DD) by default; for scheduled
  // premieres / upcoming livestreams, prefer scheduledStartTime so the candidate
  // sits at the right point on the schedule timeline.
  const dateAnchor =
    entry.liveBroadcastContent === 'upcoming' && entry.scheduledStartTime
      ? entry.scheduledStartTime
      : entry.publishedAt
  const detected_date = dateAnchor ? dateAnchor.slice(0, 10) : null

  const is_live = entry.liveBroadcastContent === 'live'
  const is_premiere =
    classification.youtubeContentType === 'mv_premiere' ||
    (entry.liveBroadcastContent === 'upcoming' && !!entry.scheduledStartTime)

  const lines: string[] = [
    `Title: ${entry.title}`,
    `Channel: ${entry.channelTitle ?? '(unknown)'}  (${source.channelId})`,
    `Artist: ${source.idolSlug}`,
    `Published: ${entry.publishedAt}`,
    entry.scheduledStartTime ? `Scheduled: ${entry.scheduledStartTime}` : null,
    entry.duration ? `Duration: ${entry.duration}` : null,
    `YouTube content type: ${classification.youtubeContentType} (tier ${classification.tier}, priority ${classification.contentPriority})`,
    `Video URL: ${buildVideoUrl(entry.videoId)}`,
    summary ? `\n${summary}` : null,
  ].filter((x): x is string => x !== null)

  const raw_content = lines.join('\n')

  const source_url = buildVideoUrl(entry.videoId)
  const source_hash = computeSourceHash({ sourceUrl: source_url })!

  const content_hash = computeContentHash({
    rawTitle: raw_title,
    rawContent: raw_content,
    detectedDate: detected_date,
    detectedEventType: classification.eventType,
    detectedIdolId: source.idolId,
    sourceUrl: source_url,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
  })

  return {
    raw_title,
    raw_content,
    detected_idol_id: source.idolId,
    detected_event_type: classification.eventType,
    detected_event_sub_type: classification.eventSubType,
    detected_date,
    source_url,
    source_name: source.sourceName,
    source_type: source.sourceType,
    ai_confidence: null,
    reviewer_note: `auto-crawled from YouTube channel: ${source.sourceName}`,
    source_hash,
    content_hash,
    raw_data: {
      source: 'youtube-official-channel',
      crawler_source_id: source.crawlerSourceId,
      source_key: source.sourceKey,
      parser_type: source.parserType,
      parser_version: YOUTUBE_OFFICIAL_CHANNEL_PARSER_VERSION,
      platform: 'youtube',
      video_id: entry.videoId,
      channel_id: source.channelId,
      uploads_playlist_id: source.uploadsPlaylistId,
      youtube_content_type: classification.youtubeContentType,
      content_priority: classification.contentPriority,
      tier: classification.tier,
      published_at: entry.publishedAt,
      duration: entry.duration,
      duration_seconds: entry.durationSeconds,
      is_live,
      is_premiere,
      live_broadcast_content: entry.liveBroadcastContent,
      scheduled_start_time: entry.scheduledStartTime,
      actual_start_time: entry.actualStartTime,
      actual_end_time: entry.actualEndTime,
      channel_title: entry.channelTitle,
      thumbnail_url: entry.thumbnailUrl,
      idol_slug: source.idolSlug,
      page_url: source.pageUrl,
    },
  }
}

export function buildVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/** Pick best thumbnail URL from a YouTube snippet thumbnails dict. */
export function pickThumbnailUrl(
  thumbnails: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } } | undefined,
): string | null {
  if (!thumbnails) return null
  return (
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    null
  )
}
