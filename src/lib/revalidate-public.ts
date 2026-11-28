/**
 * 立刻刷新公開頁快取（Next.js revalidatePath）。
 *
 * 給後台寫入活動、以及 cron 自動上架／補地點／補翻譯之後呼叫。
 * 首頁與行事曆已是 ISR 5 分鐘（#253）；城市／圖鑑的 ISR 在平行分支，
 * 現在對那些路徑呼叫 revalidatePath 無害，合併後就會立刻生效。
 *
 * 公開 ICS（/api/ics/idols/[slug]）的真正快取在 Vercel CDN
 * （s-maxage=3600，stale-while-revalidate=86400，#251）。
 * revalidatePath 只能清 Next 自己的快取，清不掉 CDN 那一層。
 * 訂閱者至少還會看到約 1 小時前的內容；冷門偶像第一次過期請求
 * 可能再拿到舊檔。日曆 App 自己的抓取週期也常是數小時到一天。
 * 這裡仍對具體 slug 路徑呼叫一次，但不另外做 Vercel Purge。
 *
 * 刷新失敗只記 log，不可讓後台存檔或 cron 寫入失敗。
 */
import { revalidatePath } from 'next/cache'
import { cityHref, normalizeCityName } from '@/lib/cities'

/** #248 之後 events→idols 內嵌必須指名這條 FK，否則會 PGRST201。 */
export const EVENTS_IDOLS_FK = 'events_idol_id_fkey'

const LOG_PREFIX = '[revalidate-public]'
const EVENT_PATH_BATCH = 100

export type PublicEventRevalidateInput = {
  eventId?: string | null
  idolSlug?: string | null
  /** 城市顯示名稱（例如「台北」）；會正規化並去重。舊城、新城都可傳入。 */
  cities?: Array<string | null | undefined>
}

type EventPathRow = {
  id: string
  city: string | null
  idols: { slug: string } | { slug: string }[] | null
}

/**
 * 只要求有 from()。不把完整 SupabaseClient 對到精簡介面，
 * 否則部分呼叫端會觸發 TS2589（型別展開過深）。
 */
export type EventPublicPathClient = {
  from: (table: string) => unknown
}

type EventPathQuery = {
  select: (columns: string) => {
    in: (
      column: string,
      values: string[],
    ) => PromiseLike<{ data: EventPathRow[] | null; error: { message: string } | null }>
  }
}

function eventsTable(client: EventPublicPathClient): EventPathQuery {
  return client.from('events') as EventPathQuery
}

function uniqueIds(ids: Iterable<string | null | undefined>): string[] {
  return [...new Set([...ids].filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

function idolSlugFromEmbed(idols: EventPathRow['idols']): string | null {
  if (!idols) return null
  const row = Array.isArray(idols) ? idols[0] : idols
  return row?.slug ? row.slug : null
}

function logFailure(error: unknown): void {
  console.error(LOG_PREFIX, error instanceof Error ? error.message : error)
}

/**
 * 依已解析的活動／偶像／城市，刷新對應公開頁。
 * 永遠會刷新首頁、行事曆、圖鑑列表、城市列表。
 * 不會 throw。
 */
export function revalidatePublicEventPages(
  input: PublicEventRevalidateInput | PublicEventRevalidateInput[],
): void {
  try {
    const items = Array.isArray(input) ? input : [input]
    const eventIds = new Set<string>()
    const idolSlugs = new Set<string>()
    const cities = new Set<string>()

    for (const item of items) {
      if (item.eventId) eventIds.add(item.eventId)
      if (item.idolSlug) idolSlugs.add(item.idolSlug)
      for (const city of item.cities ?? []) {
        const name = normalizeCityName(city)
        if (name) cities.add(name)
      }
    }

    revalidatePath('/')
    revalidatePath('/schedule')
    revalidatePath('/idols')
    revalidatePath('/cities')

    for (const eventId of eventIds) {
      revalidatePath(`/events/${eventId}`)
    }
    for (const slug of idolSlugs) {
      revalidatePath(`/idols/${slug}`)
      // 盡力清 Next 資料快取；CDN 上的 ICS 至少還要再待約 1 小時，見檔頭說明。
      revalidatePath(`/api/ics/idols/${slug}`)
    }
    for (const name of cities) {
      revalidatePath(cityHref(name))
      const raw = `/cities/${name}`
      if (raw !== cityHref(name)) revalidatePath(raw)
    }
  } catch (error) {
    logFailure(error)
  }
}

export async function loadEventPublicPaths(
  client: EventPublicPathClient,
  eventIds: string[],
): Promise<{ paths: PublicEventRevalidateInput[]; lookupFailed: boolean }> {
  const ids = uniqueIds(eventIds)
  if (ids.length === 0) return { paths: [], lookupFailed: false }

  const paths: PublicEventRevalidateInput[] = []
  let lookupFailed = false

  try {
    for (let i = 0; i < ids.length; i += EVENT_PATH_BATCH) {
      const batch = ids.slice(i, i + EVENT_PATH_BATCH)
      const { data, error } = await eventsTable(client)
        .select(`id, city, idols!${EVENTS_IDOLS_FK}(slug)`)
        .in('id', batch)

      if (error) {
        logFailure(error.message)
        lookupFailed = true
        continue
      }

      for (const row of data ?? []) {
        paths.push({
          eventId: row.id,
          idolSlug: idolSlugFromEmbed(row.idols),
          cities: row.city ? [row.city] : [],
        })
      }
    }
  } catch (error) {
    logFailure(error)
    lookupFailed = true
  }

  if (paths.length === 0 && ids.length > 0) lookupFailed = true
  return { paths, lookupFailed }
}

/**
 * 依活動 UUID 查出偶像 slug、城市後刷新公開頁。
 * 整批查詢失敗、分批查詢中任一批失敗、或所有 id 都查不到時，
 * 才退回刷全部偶像／城市詳情頁。部分 id 查得到、某筆沒有 slug 或城市時，
 * 只刷查到的路徑，不會退回全刷。
 * 不會 throw。
 */
export async function revalidatePublicPagesForEventIds(
  client: EventPublicPathClient,
  eventIds: string[],
  extra?: PublicEventRevalidateInput,
): Promise<void> {
  try {
    const ids = uniqueIds(eventIds)
    const { paths, lookupFailed } = await loadEventPublicPaths(client, ids)

    const combined: PublicEventRevalidateInput[] = [
      ...paths,
      ...ids.filter((id) => !paths.some((path) => path.eventId === id)).map((eventId) => ({ eventId })),
    ]
    if (extra) combined.push(extra)

    revalidatePublicEventPages(combined)

    if (lookupFailed && ids.length > 0) {
      try {
        revalidatePath('/idols/[slug]', 'page')
        revalidatePath('/cities/[city]', 'page')
      } catch (error) {
        logFailure(error)
      }
    }
  } catch (error) {
    logFailure(error)
  }
}
