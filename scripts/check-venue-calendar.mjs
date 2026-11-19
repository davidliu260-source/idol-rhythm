import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { test } from 'node:test'

// Cheerio's CommonJS entry avoids the css-select/css-what ESM export mismatch.
const cheerioPath = createRequire(import.meta.url).resolve('cheerio')
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cheerio') return nextResolve(cheerioPath, context)
    const path = context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)
      ? `${specifier}.ts` : specifier
    return nextResolve(path, context)
  },
})

const {
  isKaoarenaLocation, KAOARENA_LIST_URL, KAOARENA_SOURCE_KEY, parseVenueCalendarList,
  selectVenueEntries, venueCandidateFromDetail,
} = await import('../src/lib/crawlers/venueCalendar.ts')
const { runVenueCalendarFetcher } = await import('../src/lib/crawlers/runVenueCalendarFetcher.ts')
const { runActiveCrawlerSources, runCrawlerSource } = await import('../src/lib/crawlers/runActiveCrawlerSources.ts')
const smtown = await import('../src/lib/crawlers/smtownNotice.ts')
const fixture = (name) => readFileSync(new URL(`./fixtures/kaoarena/${name}.html`, import.meta.url), 'utf8')

// Local subset of seeded idols whose names can match the fixture titles.
const idols = [
  ['nct', 'NCT', ['NCT WISH']], ['nct-wish', 'NCT WISH'], ['super-junior', 'Super Junior'],
  ['tws', 'TWS'], ['plave', 'PLAVE'], ['treasure', 'TREASURE'], ['itzy', 'ITZY'],
  ['mamamoo', 'MAMAMOO'], ['nmixx', 'NMIXX'], ['exo', 'EXO'],
].map(([slug, name, alt_names = []]) => ({ id: slug, slug, name, alt_names }))
const listUrl = (year) => `${KAOARENA_LIST_URL}?year=${year}`
const lists = [2026, 2027].map((year) => parseVenueCalendarList(fixture(`CalendarList-${year}`), listUrl(year)))
const entries = lists.flatMap((list) => list.entries)
const { eligible, ...counts } = selectVenueEntries(entries, idols, '2026-11-18')
const source = {
  id: 'fixture', source_key: KAOARENA_SOURCE_KEY, name: '高雄巨蛋官方行事曆',
  parser_type: 'venue_calendar', source_url: KAOARENA_LIST_URL, source_type: 'official_website',
  config: { venueKey: 'kaoarena' }, is_active: true,
}
const detail = fixture('CalendarDetail-281')

function statusUpdate(table, patch, writes) {
  assert.equal(table, 'crawler_sources')
  return {
    eq: async (column, id) => {
      assert.equal(column, 'id')
      assert.ok(Number.isFinite(Date.parse(patch.last_run_at)))
      writes.push({ id, status: patch.last_status, error: patch.last_error })
      return { error: null }
    },
  }
}

if (process.argv.includes('--dry-run')) {
  const wouldInsertList = eligible.map(({ entry, idol }) => {
    const candidate = venueCandidateFromDetail(fixture(`CalendarDetail-${entry.detailId}`), entry, idol.id, source)
    return { title: candidate.raw_title, date: candidate.detected_date, sourceUrl: candidate.source_url }
  })
  console.log(JSON.stringify({
    fetched: lists.reduce((sum, list) => sum + list.fetched, 0),
    ...counts,
    skipped_existing_event: null,
    wouldInsert: wouldInsertList.length,
    wouldInsertList,
  }, null, 2))
} else {
  test('matches NCT WISH and extracts official schedule, location and ticket sales', () => {
    assert.equal(eligible.length, 1)
    const [{ entry, idol }] = eligible
    assert.equal(entry.detailId, '281')
    assert.equal(idol.slug, 'nct-wish')
    assert.equal(entry.dateStart, '2027-01-23')
    const payload = venueCandidateFromDetail(detail, entry, idol.id, source)
    assert.match(payload.raw_title, /^NCT WISH 2nd CONCERT TOUR/)
    assert.equal(payload.detected_date, '2027-01-23')
    assert.equal(payload.raw_data.date_end, '2027-01-23')
    assert.equal(payload.detected_city, '高雄')
    assert.equal(payload.detected_venue_name, '高雄巨蛋')
    assert.equal(payload.detected_address, '高雄市左營區博愛二路757號')
    assert.equal(payload.raw_data.show_time, '17:00')
    assert.equal(payload.raw_data.ticket_url, 'https://ibontw.com/27NCTWISH')
    assert.equal(payload.raw_data.organizer, '希林國際、VIBE MAKER 希波企劃')
    assert.match(payload.raw_data.price_text, /^TWD 6,980/)
    assert.deepEqual(payload.raw_data.on_sale.map(({ starts_at, ends_at }) => [starts_at, ends_at]), [
      ['2026-11-14T11:00:00+08:00', '2026-11-14T23:59:59+08:00'],
      ['2026-11-15T11:00:00+08:00', null],
    ])
    const fallback = venueCandidateFromDetail(detail.replace('23 日（六）5PM', '23 日（六）')
      .replace('11AM - 11:59:59PM', '另行公告'), entry, idol.id, source)
    assert.match(fallback.raw_data.on_sale_text, /另行公告/)
    assert.equal(fallback.raw_data.show_time, undefined)
  })

  test('skips past and unmatched cards and recognizes year and Super Junior prefixes', () => {
    assert.equal(counts.skipped_past, 37)
    assert.equal(counts.skipped_unmatched, 11)
    const tws = entries.find((entry) => entry.title.startsWith('2026 TWS'))
    const list = [
      tws,
      { ...tws, detailId: 'sj-1', title: '【演唱會】2026 SUPER JUNIOR-D&E TOUR' },
      { ...tws, detailId: 'sj-2', title: 'Yesung TOUR' },
    ]
    const matches = selectVenueEntries(list, idols, tws.dateStart).eligible
    assert.deepEqual(matches.map(({ idol }) => idol.slug), ['tws', 'super-junior', 'super-junior'])
    assert.equal(matches[1].entry.title, list[1].title)
  })

  test('recognizes event location aliases and equivalent addresses', () => {
    assert.ok(isKaoarenaLocation('Kaohsiung Arena'))
    assert.ok(isKaoarenaLocation(null, '高雄市左營區博愛２路 ７５７ 號'))
    assert.equal(isKaoarenaLocation('高雄國家體育場'), false)
  })

  test('fetcher dry-run records status and skips candidates with an existing event', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-18T12:00:00+08:00') })
    const urls = []
    t.mock.method(globalThis, 'fetch', async (url) => {
      urls.push(url)
      if (url === listUrl(2026)) return new Response(fixture('CalendarList-2026'))
      if (url === listUrl(2027)) return new Response(fixture('CalendarList-2027'))
      assert.equal(url, eligible[0].entry.sourceUrl)
      return new Response(detail)
    })
    const writes = []
    let existingCandidate = null
    let events = [{ venue_name: null, address: '博愛二路 757 號' }]
    const rows = {
      crawler_sources: () => source,
      idols: () => idols,
      event_candidates: () => existingCandidate,
      events: () => events,
    }
    const supabase = {
      from(table) {
        const query = {
          select: () => query, eq: () => query, order: () => query, limit: () => query,
          update: (patch) => statusUpdate(table, patch, writes),
          maybeSingle: async () => ({ data: rows[table]() }),
          then: (resolve) => resolve({ data: rows[table]() }),
        }
        return query
      },
    }
    const options = { sourceKey: KAOARENA_SOURCE_KEY, dryRun: true }
    const skipped = await runVenueCalendarFetcher(supabase, options)
    assert.deepEqual(skipped.errors, [])
    assert.equal(skipped.skipped_existing_event, 1)
    assert.equal(skipped.wouldInsert, 0)
    assert.deepEqual(urls, [listUrl(2026), listUrl(2027), eligible[0].entry.sourceUrl])

    events = []
    const wouldInsert = await runVenueCalendarFetcher(supabase, options)
    assert.deepEqual(wouldInsert.errors, [])
    assert.equal(wouldInsert.wouldInsert, 1)
    assert.equal(wouldInsert.wouldInsertList[0].date, '2027-01-23')
    existingCandidate = { id: 'candidate', content_hash: 'old-hash' }
    const drift = await runVenueCalendarFetcher(supabase, options)
    assert.deepEqual(drift.errors, [])
    assert.equal(drift.recheck, 1)
    assert.deepEqual(drift.touched, [])
    assert.deepEqual(writes, [
      { id: source.id, status: 'success', error: null },
      { id: source.id, status: 'success', error: null },
      { id: source.id, status: 'success', error: null },
    ])
  })

  test('venue dispatch records errors for bad config, failed lookup and unexpected exceptions', async (t) => {
    const scenarios = [
      { lookup: { data: { ...source, config: 'kaoarena' } }, status: 400, message: /來源設定不符合/ },
      { lookup: { error: { message: 'lookup failed' } }, status: 500, message: /lookup failed/ },
      { lookup: { data: source }, status: 500, message: /idols query threw/, throwOnIdols: true },
    ]
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
      throw new Error('unexpected fetch')
    })
    for (const scenario of scenarios) {
      const writes = []
      const supabase = {
        from(table) {
          if (table === 'idols' && scenario.throwOnIdols) throw new Error('idols query threw')
          assert.equal(table, 'crawler_sources')
          const query = {
            select: () => query, eq: () => query,
            maybeSingle: async () => scenario.lookup,
            update: (patch) => statusUpdate(table, patch, writes),
          }
          return query
        },
      }
      const result = await runCrawlerSource(supabase, source, false)
      assert.equal(result.status, scenario.status)
      assert.match(result.errors[0], scenario.message)
      assert.deepEqual(writes, [{ id: source.id, status: 'error', error: result.errors[0] }])
    }
    assert.equal(fetchMock.mock.callCount(), 0)
  })

  test('dispatch records skips and errors and continues after a fetcher throws', async () => {
    const rows = [
      ['a', 'youtube_official_channel'],
      ['b', 'jyp_schedule'],
      ['c', 'generic_webpage'],
      ['d', 'unknown_parser'],
    ].map(([id, parser_type]) => ({ id, source_key: id, name: id, parser_type }))
    const writes = []
    const supabase = {
      from(table) {
        assert.equal(table, 'crawler_sources')
        const query = {
          select: () => query, eq: () => query,
          order: async () => ({ data: rows }),
          maybeSingle: async () => { throw new Error('JYP fetcher lookup threw') },
          update: (patch) => statusUpdate(table, patch, writes),
        }
        return query
      },
    }
    const { result, error } = await runActiveCrawlerSources(supabase, { dryRun: true, trigger: 'vercel-cron' })
    assert.equal(error, null)
    assert.deepEqual(result.results.map(({ sourceKey, status }) => [sourceKey, status]), [
      ['a', 200], ['b', 500], ['c', 200], ['d', 200],
    ])
    assert.match(result.results[1].errors[0], /JYP fetcher lookup threw/)
    assert.deepEqual(writes, ['skipped', 'error', 'skipped', 'error'].map((status, index) => ({
      id: rows[index].id, status, error: result.results[index].errors[0],
    })))
  })

  test('SMTOWN ignores posting and ticket dates and accepts explicit performance dates', () => {
    const notice = (title, body) => smtown.parseSmtownNoticeHtml(
      `<div class="noticeTop"><span class="number">42</span>${title}<span class="day">2026/11/10</span></div>
       <div class="noticeBox">${body}</div>`, 'https://www.smtown.com/',
    )[0]
    assert.equal(notice('NCT WISH Concert', 'Ticket sales: 2026/11/15').detectedDate, null)
    assert.equal(notice('NCT WISH Concert', 'Ticket sales: 2026/11/15<br>공연 일시: 2027.01.23 (토)').detectedDate, '2027-01-23')
    assert.equal(notice('[2027.01.23] NCT WISH Concert', '').detectedDate, '2027-01-23')
    assert.equal(smtown.isEventNotice('SM AUDITION concert'), false)
  })
}
