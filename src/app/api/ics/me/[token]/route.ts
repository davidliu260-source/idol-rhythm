import { buildFollowsFeedResponse, feedNotFound, parseFeedTokenParam } from '@/lib/ics/followsFeed'
import { createSupabaseFeedStore } from '@/lib/ics/supabaseFeedStore'
import { getPublishedEvents } from '@/lib/supabase/events'
import { getSupabaseServiceClient } from '@/lib/supabase/serviceClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  let prefix: string | undefined
  try {
    const { token: param } = await params
    const feedToken = parseFeedTokenParam(param)
    if (!feedToken) {
      const { body, ...init } = feedNotFound()
      return new Response(body, init)
    }

    prefix = feedToken.slice(0, 4)
    const supabase = getSupabaseServiceClient()
    const now = new Date()
    const store = createSupabaseFeedStore({ client: supabase, now, token: feedToken, getPublishedEvents })

    const { body, ...init } = await buildFollowsFeedResponse({
      param, store, origin: new URL(request.url).origin, now,
    })
    return new Response(body, init)
  } catch {
    console.error('Calendar feed handler failed', prefix)
    const { body, ...init } = feedNotFound()
    return new Response(body, init)
  }
}
