// 執行方式：node scripts/check-crawler-user-agent.mjs
// 爬蟲／抓取 User-Agent 應識別正式網域 https://idolrhythm.com。
// 只讀程式與 git；不連網、不連資料庫、不讀 .env。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const repoRoot = fileURLToPath(root)

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? ''
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && /\.tsx?$/.test(parent)) {
      for (const ext of ['.ts', '.tsx']) {
        try {
          return nextResolve(new URL(specifier + ext, parent).href, context)
        } catch {
          // try next ext
        }
      }
    }
    return nextResolve(specifier, context)
  },
})

const ua = await import('../src/lib/crawlers/userAgent.ts')

const EXPECTED = 'idolrhythm-bot/1.0 (+https://idolrhythm.com)'
const EXPECTED_TOKEN = 'idolrhythm-bot'
const EXPECTED_COMPAT = 'Mozilla/5.0 (compatible; idolrhythm-bot/1.0; +https://idolrhythm.com)'

const FETCHERS_USING_DEFAULT = [
  'src/lib/crawlers/runBlackpinkFetcher.ts',
  'src/lib/crawlers/runWakeoneNoticeFetcher.ts',
  'src/lib/crawlers/runYgArtistScheduleFetcher.ts',
  'src/lib/crawlers/runSmtownNoticeFetcher.ts',
  'src/lib/crawlers/runKpopofficialConcertsFetcher.ts',
  'src/lib/crawlers/runYgNoticeFetcher.ts',
  'src/lib/crawlers/runYoutubeOfficialChannelFetcher.ts',
  'src/lib/crawlers/runJypNoticeFetcher.ts',
  'src/lib/crawlers/genericWebpage.ts',
]

const COMPAT_FETCHERS = ['src/lib/crawlers/runVenueCalendarFetcher.ts']

const OTHER_FETCHERS = [
  'src/lib/imageSearch/wikimedia.ts',
  'src/app/admin/idols/[id]/edit/actions.ts',
]

const OLD_UA_PATTERNS = [
  'idol-rhythm.vercel.app',
  'IdolRhythm-Bot',
  'IdolRhythm-Admin-Bot',
  'IdolRhythm/0.1',
  'Mozilla/5.0 (compatible; IdolRhythm',
]

test('中央常數識別正式網域', () => {
  assert.equal(ua.CRAWLER_USER_AGENT_TOKEN, EXPECTED_TOKEN)
  assert.equal(ua.CRAWLER_USER_AGENT, EXPECTED)
  assert.equal(ua.CRAWLER_USER_AGENT_COMPAT, EXPECTED_COMPAT)
  assert.equal(read('src/lib/crawlers/jypNotice.ts').includes('export const JYP_NOTICE_USER_AGENT = CRAWLER_USER_AGENT'), true)
  assert.equal(read('src/lib/crawlers/genericWebpage.ts').includes('export const USER_AGENT = CRAWLER_USER_AGENT'), true)
  assert.match(EXPECTED, /idolrhythm-bot\/1\.0/)
  assert.match(EXPECTED, /\+https:\/\/idolrhythm\.com\)/)
  assert.doesNotMatch(EXPECTED, /vercel\.app/)
})

test('各 fetcher 從中央常數取值，場館沿用相容 UA', () => {
  for (const path of FETCHERS_USING_DEFAULT) {
    const source = read(path)
    assert.match(source, /CRAWLER_USER_AGENT|JYP_NOTICE_USER_AGENT|USER_AGENT/, path)
    if (path === 'src/lib/crawlers/runJypNoticeFetcher.ts') {
      // 經 jypNotice.JYP_NOTICE_USER_AGENT 轉中央常數，不直接 import userAgent
      assert.match(source, /JYP_NOTICE_USER_AGENT/)
      assert.match(source, /'User-Agent': JYP_NOTICE_USER_AGENT/)
      continue
    }
    assert.match(source, /from '\.\.?\/.*userAgent'|from '@\/lib\/crawlers\/userAgent'/, path)
    if (path === 'src/lib/crawlers/genericWebpage.ts') {
      assert.match(source, /'User-Agent': USER_AGENT/)
      assert.match(source, /export const USER_AGENT = CRAWLER_USER_AGENT/)
      continue
    }
    assert.match(source, /'User-Agent': CRAWLER_USER_AGENT/, path)
  }
  for (const path of COMPAT_FETCHERS) {
    const source = read(path)
    assert.match(source, /from '\.\/userAgent'/)
    assert.match(source, /'User-Agent': CRAWLER_USER_AGENT_COMPAT/)
    assert.doesNotMatch(source, /'User-Agent': CRAWLER_USER_AGENT[^_]/)
  }
  for (const path of OTHER_FETCHERS) {
    const source = read(path)
    assert.match(source, /from '\.\.\/crawlers\/userAgent'|from '@\/lib\/crawlers\/userAgent'/, path)
    assert.match(source, /'User-Agent': CRAWLER_USER_AGENT|USER_AGENT = CRAWLER_USER_AGENT/, path)
  }
})

test('爬蟲與後台抓取不再使用舊網域或未具名 UA', () => {
  const paths = [
    'src/lib/crawlers/userAgent.ts',
    'src/lib/crawlers/jypNotice.ts',
    ...FETCHERS_USING_DEFAULT,
    ...COMPAT_FETCHERS,
    ...OTHER_FETCHERS,
  ]
  for (const path of paths) {
    const source = read(path)
    for (const pattern of OLD_UA_PATTERNS) {
      assert.ok(!source.includes(pattern), `${path} 仍含舊 UA 片段：${pattern}`)
    }
  }
})

test('未改 vercel.json 與 cron 設定', () => {
  const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
  const base = git('merge-base', 'origin/main', 'HEAD').trim()
  assert.equal(git('diff', '--name-only', base, '--', 'vercel.json'), '')
  const vercel = read('vercel.json')
  assert.match(vercel, /"path": "\/api\/cron\/sync-candidates"/)
  assert.match(vercel, /"path": "\/api\/cron\/dispatch-reminders"/)
  assert.match(vercel, /"path": "\/api\/cron\/dispatch-new-event-notifications"/)
})
