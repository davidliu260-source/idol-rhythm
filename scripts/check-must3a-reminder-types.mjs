// 檢查 MUST3a 提醒類型：node scripts/check-must3a-reminder-types.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import {
  choiceToTypes,
  isReminderType,
  normalizeReminderTypes,
  parseLocalReminderTypes,
  planReminderTypeChange,
  reminderTypesLabel,
  typesToChoice,
} from '../src/lib/reminderTypes.ts'

function check(name, run) {
  run()
  console.log(`PASS ${name}`)
}

const day = 'day_before'
const week = 'week_before'
const both = [day, week]
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

check('提醒選項與類型互轉', () => {
  for (const [choice, types] of [[day, [day]], [week, [week]], ['both', both]]) {
    assert.deepEqual(choiceToTypes(choice), types)
    assert.equal(typesToChoice(types), choice)
  }
  assert.equal(typesToChoice([]), null)
  assert.equal(typesToChoice(['hour_before']), null)
  assert.equal(typesToChoice([week, week, 'hour_before']), week)
  assert.equal(isReminderType(day), true)
  assert.equal(isReminderType('hour_before'), false)
})

check('過濾未知類型、去重與排序', () => {
  assert.deepEqual(normalizeReminderTypes([week, 'hour_before', day, week, 7]), both)
  assert.deepEqual(normalizeReminderTypes(day), [])
})

check('提醒類型切換', () => {
  for (const [current, next, toInsert, toDelete] of [
    [[], [day], [day], []],
    [[day], [week], [week], [day]],
    [both, [day], [], [week]],
    [[week, day, week, 'hour_before'], both, [], []],
    [both, [], [], both],
  ]) {
    assert.deepEqual(planReminderTypeChange(current, next), { toInsert, toDelete })
  }
})

check('提醒標籤', () => {
  assert.equal(reminderTypesLabel([day]), '前一天')
  assert.equal(reminderTypesLabel([week]), '前一週')
  assert.equal(reminderTypesLabel(both), '前一天＋前一週')
  assert.equal(reminderTypesLabel([]), null)
})

check('本機提醒類型解析', () => {
  for (const raw of [null, '{', '[]', '42', 'null', '["legacy-id"]']) {
    assert.deepEqual(parseLocalReminderTypes(raw), {})
  }
  const raw = JSON.stringify({
    a: [week, 'hour_before', day, week],
    b: [week],
    c: ['hour_before'],
    d: 42,
    e: day,
    f: [],
  })
  assert.deepEqual(parseLocalReminderTypes(raw), { a: both, b: [week] })
})

check('提醒寫入與快速開關', () => {
  const appState = read('src/lib/appState.tsx')
  assert.doesNotMatch(appState, /from\('reminders'\)[\s\S]{0,200}\.update\(/)
  assert.match(appState, /from\('reminders'\)\s*\.insert\(\{ user_id: userId, event_id: id, type: 'day_before' \}\)/)
  assert.match(read('src/components/EventCard.tsx'), /reminders\.toggle\(/)
  // B2v2 版型改寫了 ScheduleTrackCard，但提醒仍只顯示狀態（沒有快速開關），維持原行為。
  const schedule = read('src/app/schedule/ScheduleTrackCard.tsx')
  assert.match(schedule, /reminders\.has\(event\.id\)/)
  assert.doesNotMatch(schedule, /reminders\.toggle\(/)
})

check('cron 支援前一週，067 之後只允許 068、069 與 070', () => {
  assert.match(read('src/app/api/cron/dispatch-reminders/route.ts'), /'week_before'/)
  const migrations = readdirSync(new URL('../supabase/migrations/', import.meta.url))
  for (const path of migrations) {
    const number = path.match(/^\d+/)
    assert.ok(!number || Number(number[0]) < 68 || ['068_calendar_feed_tokens.sql', '069_auto_publish_blocked_reason.sql', '070_event_translation_attempts.sql'].includes(path), path)
  }
})

check('提醒、單一偶像 ICS 與既有 migrations 維持 merge-base 版本', () => {
  const repoRoot = new URL('../', import.meta.url)
  // Compare against the branch point so later commits on origin/main don't cause false failures.
  const base = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { cwd: repoRoot }).toString().trim()
  assert.doesNotThrow(
    () => execFileSync('git', [
      'diff', '--quiet', base, '--',
      'src/app/api/cron',
      'src/app/api/ics/idols',
      'src/lib/reminderDispatch.ts',
      'supabase/migrations',
      ':(exclude)supabase/migrations/068_calendar_feed_tokens.sql',
      ':(exclude)supabase/migrations/069_auto_publish_blocked_reason.sql',
      ':(exclude)supabase/migrations/070_event_translation_attempts.sql', ':(exclude)src/app/api/cron/sync-candidates/route.ts',
    ], { cwd: repoRoot }),
    'Protected paths differ from the merge-base with origin/main, or git diff failed',
  )
})
