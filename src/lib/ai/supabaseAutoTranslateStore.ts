import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { taipeiToday } from '../taipeiDate'
import {
  AUTO_TRANSLATE_MAX_ATTEMPTS, TRANSLATION_CLAIM_MS,
  isTranslatable, isUnfinished, type PublishedTranslationStore, type TranslationEvent,
} from './autoTranslate'

function beforeClaimWindow(now: Date): string {
  return new Date(now.getTime() - TRANSLATION_CLAIM_MS).toISOString()
}

function checkError(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

export function createSupabaseAutoTranslateStore(supabase: SupabaseClient): PublishedTranslationStore {
  type Updates = Parameters<PublishedTranslationStore['writeSuccess']>[2] |
    Partial<Pick<TranslationEvent, 'translation_attempted_at' | 'translation_last_error' | 'translation_attempts'>>

  function guardedUpdate(patch: Updates) {
    return supabase.from('events').update(patch)
      .in('translation_status', ['none', 'machine'])
      .is('display_title_zh', null).is('display_summary_zh', null).is('location_name_zh', null)
  }

  function claimedUpdate(id: string, at: string, patch: Updates) {
    return guardedUpdate(patch).eq('id', id).eq('translation_attempted_at', at)
  }

  async function updated(query: ReturnType<typeof guardedUpdate>): Promise<boolean> {
    const { data, error } = await query.select('id')
    checkError(error)
    return Boolean(data?.length)
  }

  function publishedTranslationCandidates() {
    // Lists match the write guard's SQL NULL checks. isTranslatable still trims for single-event eligibility.
    return supabase.from('events')
      .select('id, title, display_title_zh, display_summary_zh, location_name_zh, translation_status, translation_attempts, translation_attempted_at, end_date, start_date, date')
      .eq('is_published', true).in('translation_status', ['none', 'machine'])
      .is('display_title_zh', null).is('display_summary_zh', null).is('location_name_zh', null)
  }

  async function* publishedCandidates(now: Date) {
    const today = taipeiToday(now)
    const pageSize = 250
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await publishedTranslationCandidates()
        .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today}),and(end_date.is.null,start_date.is.null,date.gte.${today})`)
        .order('start_date', { ascending: true, nullsFirst: false }).order('date', { ascending: true })
        .order('id').range(offset, offset + pageSize - 1)
      checkError(error)
      for (const row of data ?? []) {
        if (isTranslatable(row) && isUnfinished(row, now)) yield row
      }
      if (!data || data.length < pageSize) return
    }
  }

  return {
    async getEvent(id) {
      const { data, error } = await supabase.from('events')
        .select('title, description, idol_name, type, sub_type, date, date_label, start_date, end_date, location, city, venue_name, address, is_published, translation_status, display_title_zh, display_summary_zh, location_name_zh, translation_attempts, translation_attempted_at, translation_last_error, event_sources(label, type, url)')
        .eq('id', id).maybeSingle()
      checkError(error)
      return data
    },

    claim(id, at, requirePublished, attempts) {
      const query = guardedUpdate({ translation_attempted_at: at, translation_last_error: null }).eq('id', id)
        .eq('translation_attempts', attempts)
        .or(`translation_attempted_at.is.null,translation_attempted_at.lt.${beforeClaimWindow(new Date(at))}`)
      return updated(requirePublished ? query.eq('is_published', true) : query)
    },

    writeSuccess(id, at, patch) {
      return updated(claimedUpdate(id, at, patch))
    },

    writeFailure(id, at, translation_attempts, translation_last_error) {
      return updated(claimedUpdate(id, at, { translation_attempts, translation_last_error, translation_attempted_at: null }))
    },

    resetAttempts(id, at) {
      return updated(claimedUpdate(id, at, { translation_attempts: 0 }))
    },

    async restoreClaim(id, at, event) {
      await updated(claimedUpdate(id, at, {
        translation_attempted_at: event.translation_attempted_at,
        translation_last_error: event.translation_last_error,
        translation_attempts: event.translation_attempts,
      }))
    },

    async markDeferred(ids, reason) {
      const { error } = await guardedUpdate({ translation_last_error: `deferred:${reason}` })
        .in('id', [...ids]).eq('is_published', true)
      checkError(error)
    },

    async listPendingForCron(now, limit, excluded) {
      if (limit <= 0) return []
      const { data, error } = await publishedTranslationCandidates()
        .lt('translation_attempts', AUTO_TRANSLATE_MAX_ATTEMPTS)
        .or('translation_attempts.gte.1,translation_last_error.not.is.null')
        .order('published_at', { ascending: true }).order('id').limit(500)
      checkError(error)
      const cutoff = Date.parse(beforeClaimWindow(now))
      return (data ?? []).filter(row => !excluded.has(row.id) &&
        (row.translation_attempted_at === null || Date.parse(row.translation_attempted_at) < cutoff) &&
        isTranslatable(row) && isUnfinished(row, now))
        .slice(0, limit).map(row => row.id)
    },

    async listBackfillCandidates(now, limit) {
      const ids: string[] = []
      for await (const row of publishedCandidates(now)) {
        if (row.translation_attempts >= AUTO_TRANSLATE_MAX_ATTEMPTS) continue
        ids.push(row.id)
        if (ids.length >= limit) break
      }
      return ids
    },

    async countBackfill(now) {
      let eligible = 0
      let exhausted = 0
      for await (const row of publishedCandidates(now)) {
        if (row.translation_attempts >= AUTO_TRANSLATE_MAX_ATTEMPTS) exhausted++
        else eligible++
      }
      return { eligible, exhausted }
    },

    async hasBatchInProgress(now) {
      const { data, error } = await supabase.from('events').select('id')
        .eq('is_published', true).eq('translation_status', 'none')
        .is('display_title_zh', null).is('display_summary_zh', null).is('location_name_zh', null)
        .is('translation_last_error', null).gte('translation_attempted_at', beforeClaimWindow(now))
        .limit(1)
      checkError(error)
      return Boolean(data?.length)
    },
  }
}
