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

const { buildIdolMatchIndex } = await import('../src/lib/crawlers/idolMatcher.ts')
const {
  matchYgNotice, parseYgNoticeDetail, parseYgNoticeList, YG_NOTICE_SOURCE_KEY,
  YG_NOTICE_URL, ygNoticeCandidates,
} = await import('../src/lib/crawlers/ygNotice.ts')
const { crawlYgNotices, isSameYgEventLocation, runYgNoticeFetcher, ygNoticePreviewItem } =
  await import('../src/lib/crawlers/runYgNoticeFetcher.ts')

const today = '2026-11-19'
const fixture = (name) => readFileSync(new URL(`./fixtures/yg-notice/notice-ko-${name}.html`, import.meta.url), 'utf8')
const idols = [
  ['bigbang', 'BIGBANG', ['Big Bang', '빅뱅']],
  ['g-dragon', 'G-DRAGON', ['G Dragon', 'GDragon', 'GD', '지드래곤', 'Kwon Ji-yong', 'Kwon Jiyong', '권지용']],
  ['taeyang', 'TAEYANG', ['SOL', '태양', 'YB', 'Dong Young-bae']],
  ['daesung', 'DAESUNG', ['D-LITE', '대성', 'Kang Dae-sung', '강대성']],
].map(([slug, name, alt_names]) => ({ id: slug, slug, name, alt_names }))
const source = {
  id: 'fixture', source_key: YG_NOTICE_SOURCE_KEY, name: 'YG 官方公告',
  parser_type: 'yg_notice', source_url: YG_NOTICE_URL, source_type: 'official_website',
  idol_id: 'bigbang', config: { locale: 'ko', maxPages: 5, memberSlugs: [] }, is_active: true,
}

if (process.argv.includes('--dry-run')) {
  const { candidates, listFailed, ...counts } = await crawlYgNotices(source, idols, today, 5)
  console.log(JSON.stringify({
    today, ...counts, skipped_existing_event: null, wouldInsert: candidates.length,
    wouldInsertList: candidates.map(ygNoticePreviewItem),
  }, null, 2))
  if (listFailed || counts.errors.length) process.exitCode = 1
} else {
  const lists = [1, 2, 3].map((page) => parseYgNoticeList(fixture(`p${page}`)))
  const entries = lists.flatMap(({ entries }) => entries)
  const entry = (id) => entries.find((item) => item.id === id)
  const detail = (id, html = fixture(id)) => parseYgNoticeDetail(html, entry(id))
  const candidates = (id) => ygNoticeCandidates(detail(id), entry(id), 'bigbang', source)

  test('parses notice list fields and SSR pagination', () => {
    assert.deepEqual(lists.map(({ currentPage, nextPage }) => [currentPage, nextPage]), [[1, 2], [2, 3], [3, 4]])
    assert.equal(lists[0].entries.length, 9)
    const first = lists[0].entries[0]
    assert.equal(first.id, '5898')
    assert.equal(first.category, 'ARTIST')
    assert.equal(first.postedDate, '2026-11-04')
    assert.equal(first.href, '/ko/news/notice/5898')
    assert.match(first.title, /^\[LOS ANGELES\] BIGBANG /)
  })

  test('matches roster prefixes after city and year and skips unrelated titles', () => {
    const index = buildIdolMatchIndex(idols)
    for (const id of ['5898', '5890', '5891']) assert.equal(matchYgNotice(entry(id).title, index)?.idol.id, 'bigbang')
    assert.equal(matchYgNotice('2027 [TAIPEI] G-DRAGON Concert', index)?.idol.id, 'g-dragon')
    assert.equal(matchYgNotice('[SEOUL] 2027 대성 Concert', index)?.idol.id, 'daesung')
    assert.equal(matchYgNotice('2026-27 BIGBANG Tour', index)?.idol.id, 'bigbang')
    for (const item of lists[2].entries.filter(({ title }) => /BABYMONSTER|BLACKPINK/.test(title))) {
      assert.equal(matchYgNotice(item.title, index), null)
    }
    for (const title of ['BABYMONSTER WORLD TOUR', 'BLACKPINK 2027 Tour', 'AKMU Concert',
      'Venue etiquette for BIGBANG', 'NotBIGBANG concert', 'BIGBANGERS concert']) {
      assert.equal(matchYgNotice(title, index), null)
    }
  })

  test('uses labeled dates, never the posted date or an introductory date', () => {
    const html = '<div class="view_tit"><span class="date">2026.11.04</span></div>' +
      '<section class="view_body"><div class="ql-editor"><p>Concert is on 2027년 3월 13일</p></div></section>'
    const parsed = detail('5898', html)
    assert.equal(parsed.postedDate, '2026-11-04')
    assert.deepEqual(parsed.performances, [])
    assert.deepEqual(ygNoticeCandidates(parsed, entry('5898'), 'bigbang', source), [])
  })

  test('5898 captures Los Angeles performance, sale schedules and ticket URL', () => {
    const [row] = candidates('5898')
    assert.equal(row.detected_date, '2027-03-13')
    assert.equal(row.detected_event_type, 'concert')
    assert.equal(row.source_type, 'official_website')
    assert.equal(row.detected_city, 'Los Angeles')
    assert.equal(row.detected_venue_name, 'SoFi Stadium')
    assert.equal(row.raw_data.posted_date, '2026-11-04')
    assert.equal(row.raw_data.show_time, '19:00')
    assert.match(row.raw_data.ticket_url, /ticketmaster\.com\/event\//)
    assert.deepEqual(row.raw_data.on_sale.map(({ starts_at, ends_at }) => [starts_at, ends_at]), [
      ['2026-11-11T10:00:00', '2026-11-12T21:59:00'],
      ['2026-11-13T10:00:00', null],
    ])
  })

  test('5890 prefers the labeled 2027 dates and produces two independent candidates', () => {
    const rows = candidates('5890')
    assert.deepEqual(rows.map((row) => row.detected_date), ['2027-02-27', '2027-02-28'])
    assert.deepEqual(rows.map((row) => row.source_url), [
      `${YG_NOTICE_URL}/5890#2027-02-27`, `${YG_NOTICE_URL}/5890#2027-02-28`,
    ])
    assert.equal(new Set(rows.map((row) => row.source_hash)).size, 2)
    assert.ok(rows.every((row) => row.detected_venue_name === 'Kaohsiung National Stadium'))
    assert.notEqual(rows[0].raw_data.ticket_url, rows[1].raw_data.ticket_url)
    const event = { city: '高雄', venue_name: null, address: null, location_name_zh: '世運主場館', location: null }
    assert.equal(isSameYgEventLocation(rows[0], event), true)
    assert.equal(isSameYgEventLocation(rows[0], { ...event, location_name_zh: '高雄巨蛋' }), false)
  })

  test('only splits explicitly listed days when the date field uses an ampersand', () => {
    const html = '<section class="view_body"><div class="ql-editor">' +
      '<p>Performance Dates: 2/25 &amp; 2/28, 2027 | 6PM</p>' +
      '<p>Tickets: <a href="https://tickets.example/show">Buy tickets</a></p></div></section>'
    const rows = ygNoticeCandidates(detail('5890', html), entry('5890'), 'bigbang', source)
    assert.deepEqual(rows.map((row) => row.detected_date), ['2027-02-25', '2027-02-28'])
    assert.equal(rows[0].raw_data.ticket_url, 'https://tickets.example/show')
  })

  test('5877 assigns each labeled date to its own venue across bilingual tour sections', () => {
    assert.deepEqual(candidates('5877').map((row) => [row.detected_date, row.detected_venue_name]), [
      ['2026-09-05', 'Oakland-Alameda County Coliseum'],
      ['2026-09-11', 'MetLife Stadium'],
      ['2026-09-19', 'Stade de France'],
      ['2026-09-26', 'Tottenham Hotspur Stadium'],
    ])
  })

  test('5891 parses the Taipei performance and counts it as skipped_past', async () => {
    assert.equal(candidates('5891')[0].detected_date, '2026-10-09')
    const requests = []
    const list = fixture('p1').replace(/<li>\s*<a href="\/ko\/news\/notice\/(?!5891\b)\d+"[\s\S]*?<\/li>/g, '')
    const result = await crawlYgNotices(source, idols, today, 1, async (url) => {
      requests.push(url)
      return url.endsWith('page=1') ? list : fixture('5891')
    })
    assert.deepEqual(requests, [`${YG_NOTICE_URL}?page=1`, `${YG_NOTICE_URL}/5891`])
    assert.equal(result.matched, 1)
    assert.equal(result.skipped_past, 1)
    assert.deepEqual(result.candidates, [])
    assert.deepEqual(result.errors, [])
  })

  test('omitted dryRun previews with no writes and checks candidates and draft events', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-19T04:00:00Z') })
    const list = fixture('p1')
      .replace(/<li>\s*<a href="\/ko\/news\/notice\/(?!5890\b)\d+"[\s\S]*?<\/li>/g, '')
      .replace(/<a class="next page-numbers"[^>]*><\/a>/, '')
    t.mock.method(globalThis, 'fetch', async (url) => new Response(url.endsWith('page=1') ? list : fixture('5890')))
    const queried = []
    const supabase = {
      from(table) {
        let field
        const query = {
          select() { return query },
          eq(column) { field = column; return query },
          in() { return query },
          limit() { return query },
          order() {
            return table === 'idols' ? Promise.resolve({ data: idols }) : query
          },
          async maybeSingle() {
            queried.push([table, field])
            return { data: table === 'crawler_sources' ? source : null }
          },
          then(resolve) {
            assert.equal(table, 'events')
            queried.push([table, field])
            resolve({ data: [{ venue_name: '高雄國家體育場', is_published: false }] })
          },
        }
        return query
      },
    }
    const result = await runYgNoticeFetcher(supabase, { sourceKey: YG_NOTICE_SOURCE_KEY })
    assert.equal(result.mode, 'dry-run')
    assert.equal(result.skipped_existing_event, 2)
    assert.equal(result.wouldInsert, 0)
    assert.deepEqual(result.errors, [])
    assert.ok(queried.some(([table, field]) => table === 'event_candidates' && field === 'source_hash'))
    assert.ok(queried.some(([table, field]) => table === 'event_candidates' && field === 'source_url'))
  })
}
