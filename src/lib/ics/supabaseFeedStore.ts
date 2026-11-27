import type { SupabaseClient } from '@supabase/supabase-js'
import { isFeedAlarm, type FeedStore } from './followsFeed'
import { ICS_FEED_LOOKBACK_DAYS } from './feedLookback'

export function createSupabaseFeedStore({
  client, now, token, getPublishedEvents,
}: {
  client: SupabaseClient
  now: Date
  token: string
  getPublishedEvents: (options: { throwOnError: boolean; lookbackDays: number | null }) => ReturnType<FeedStore['publishedEvents']>
}): FeedStore {
  return {
    async findByToken(token) {
      const { data, error } = await client
        .from('calendar_feed_tokens')
        .select('user_id, alarm')
        .eq('token', token)
        .maybeSingle()
      if (error) throw new Error('Feed lookup failed')
      if (!data) return null
      const { user_id: userId, alarm } = data
      if (typeof userId !== 'string' || !isFeedAlarm(alarm)) throw new Error('Invalid feed settings')
      return { userId, alarm }
    },
    async followedIdolSlugs(userId) {
      const { data: follows, error: followError } = await client
        .from('user_follows')
        .select('idol_id')
        .eq('user_id', userId)
      if (followError || !follows) throw new Error('Follows lookup failed')
      if (!follows.length) return []

      const { data: idols, error: idolError } = await client
        .from('idols')
        .select('slug')
        .in('id', follows.map(({ idol_id }) => idol_id))
        .eq('is_active', true)
      if (idolError || !idols) throw new Error('Idols lookup failed')
      return idols.map(({ slug }) => slug)
    },
    publishedEvents: () => getPublishedEvents({ throwOnError: true, lookbackDays: ICS_FEED_LOOKBACK_DAYS }),
    async touch(userId) {
      const { error } = await client
        .from('calendar_feed_tokens')
        .update({ last_accessed_at: now.toISOString() })
        .eq('user_id', userId)
        .eq('token', token)
      if (error) throw new Error('Feed access update failed')
    },
  }
}
