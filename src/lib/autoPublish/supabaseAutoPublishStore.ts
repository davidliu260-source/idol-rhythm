// 需要 M063 權限；權限不足時各步回 error，順序保證不留公開半套列。
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AutoPublishStore, CandidateRow, EventRow } from './runAutoPublish'
import type { CrawlerSourceInput, IdolInput, EventSourceInput } from './evaluateCandidate'

const CANDIDATE_COLUMNS = 'id,review_status,raw_title,raw_content,raw_data,detected_idol_id,detected_event_type,detected_event_sub_type,detected_date,detected_start_date,detected_end_date,detected_city,detected_venue_name,detected_address,location_name_zh,display_title_zh,display_summary_zh,translation_status,translation_source,translation_updated_at,detected_date_label,detected_map_url,source_url,source_name,source_type,source_hash,ai_confidence,approved_event_id,created_at'
const EVENT_COLUMNS = 'id,idol_id,title,display_title_zh,date,start_date,end_date,is_published,trust_level,status,auto_publish_blocked,city,venue_name,address,location_name_zh,location,location_autofill_meta'
const chunks = <T>(items: T[]): T[][] => Array.from({ length: Math.ceil(items.length / 100) }, (_, i) => items.slice(i * 100, i * 100 + 100))
const distinct = (values: (string | null | undefined)[]) => Array.from(new Set(values.filter((v): v is string => !!v)))
export function createSupabaseAutoPublishStore(supabase: SupabaseClient): AutoPublishStore {
  const updated = (r: { data: unknown[] | null; error: { message: string } | null }) => r.error ? { error: r.error.message } : { updated: r.data?.length ?? 0 }
  return {
    async readAutoPublishEnabled() {
      const { data, error } = await supabase.from('app_settings').select('value_boolean').eq('key', 'auto_publish_enabled').maybeSingle()
      return error ? { error: error.message } : { enabled: data?.value_boolean === true }
    },
    async loadContext(candidateIds) {
      const candidates: CandidateRow[] = []
      for (const ids of chunks(distinct(candidateIds))) {
        const { data, error } = await supabase.from('event_candidates').select(CANDIDATE_COLUMNS).in('id', ids)
        if (error) return { error: error.message }
        candidates.push(...(data ?? []) as unknown as CandidateRow[])
      }
      // Keep touched order even though SQL IN has no ordering guarantee.
      const byId = new Map(candidates.map(c => [c.id, c]))
      const ordered = candidateIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : [])
      const sources = await supabase.from('crawler_sources').select('id,source_key,name,parser_type,source_type,source_url,is_active')
      if (sources.error) return { error: sources.error.message }
      const idols = await supabase.from('idols').select('id,name,is_active')
      if (idols.error) return { error: idols.error.message }
      const eventSources: EventSourceInput[] = []
      for (const urls of chunks(distinct(candidates.map(c => c.source_url)))) {
        const { data, error } = await supabase.from('event_sources').select('event_id,url').in('url', urls)
        if (error) return { error: error.message }
        eventSources.push(...(data ?? []) as EventSourceInput[])
      }
      const events = new Map<string, EventRow>()
      const filters = [
        { col: 'idol_id', values: distinct(candidates.map(c => c.detected_idol_id)) },
        { col: 'id', values: distinct([...candidates.map(c => c.approved_event_id), ...eventSources.map(s => s.event_id)]) },
      ]
      for (const { col, values } of filters) for (const batch of chunks(values)) {
        const { data, error } = await supabase.from('events').select(EVENT_COLUMNS).in(col, batch)
        if (error) return { error: error.message }
        for (const e of (data ?? []) as unknown as EventRow[]) events.set(e.id, e)
      }
      return { candidates: ordered, ctx: { now: new Date(), crawlerSources: (sources.data ?? []) as CrawlerSourceInput[], idols: (idols.data ?? []) as IdolInput[], events: Array.from(events.values()), eventSources }, idolNames: new Map((idols.data ?? []).map(i => [i.id as string, i.name as string])) }
    },
    async getEvent(id) {
      const { data, error } = await supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle()
      return error ? { error: error.message } : data as unknown as EventRow | null
    },
    async insertDraftEvent(row) {
      const { data, error } = await supabase.from('events').insert(row).select('id').single()
      return error ? { error: error.message } : data ? { id: data.id as string } : { error: 'draft insert returned no id' }
    },
    async linkCandidate(id, eventId) {
      return updated(await supabase.from('event_candidates').update({ review_status: 'approved', approved_event_id: eventId, park_reason: null }).eq('id', id).is('approved_event_id', null).in('review_status', ['pending','approved']).select('id'))
    },
    async hasEventSourceUrl(id, url) {
      const { data, error } = await supabase.from('event_sources').select('event_id').eq('event_id', id).eq('url', url).limit(1)
      return error ? { error: error.message } : !!data?.length
    },
    async insertEventSource(row) {
      const { error } = await supabase.from('event_sources').insert(row)
      return error ? { error: error.message } : { ok: true }
    },
    async publishEvent(id, patch, guards) {
      let query = supabase.from('events').update(patch).eq('id', id).eq('is_published', false).eq('auto_publish_blocked', false)
      for (const [col, value] of Object.entries(guards)) query = value === null ? query.is(col, null) : query.eq(col, value)
      return updated(await query.select('id'))
    },
    async fillEventLocation(id, patch, guards) {
      let query = supabase.from('events').update(patch).eq('id', id).eq('is_published', true)
      for (const [col, value] of Object.entries(guards)) query = value === null ? query.is(col, null) : query.eq(col, value)
      return updated(await query.select('id'))
    },
    async markCandidateApproved(id) {
      return updated(await supabase.from('event_candidates').update({ review_status: 'approved', park_reason: null }).eq('id', id).eq('review_status', 'pending').select('id'))
    },
    async parkCandidate(id, reason) {
      return updated(await supabase.from('event_candidates').update({ review_status: 'parked', park_reason: reason }).eq('id', id).eq('review_status', 'pending').select('id'))
    },
  }
}
