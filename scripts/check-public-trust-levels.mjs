import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { registerHooks } from 'node:module'
registerHooks({resolve(s,c,n){return n(s.startsWith('.') && !c.parentURL?.includes('/node_modules/') && !/\.[a-z]+$/i.test(s) ? s+'.ts':s,c)}})
const { PUBLIC_TRUST_LEVELS, CALENDAR_NOTIFY_TRUST_LEVELS, getPublicTrustLabel }=await import('../src/lib/trustLevels.ts')
const { getTrustLabel }=await import('../src/lib/nextEventHero.ts')
const { getTrustBadgeLabel }=await import('../src/lib/eventDetailHero.ts')
const { SOURCE_CONFIG }=await import('../src/lib/mockEvents.ts')
assert.deepEqual(PUBLIC_TRUST_LEVELS,['official','media','aggregator']);assert.deepEqual(CALENDAR_NOTIFY_TRUST_LEVELS,['official','media'])
for(const fn of [getPublicTrustLabel,getTrustLabel,getTrustBadgeLabel]){assert.equal(fn('aggregator'),'非官方整理');assert.equal(fn('pending'),null)}
assert.equal(SOURCE_CONFIG.aggregator.label,'非官方整理');assert.equal(SOURCE_CONFIG.pending.label,'待確認')
const source=f=>readFileSync(f,'utf8')
assert.equal([...source('src/lib/supabase/events.ts').matchAll(/\.in\('trust_level', \[\.\.\.PUBLIC_TRUST_LEVELS\]\)/g)].length,2)
assert.match(source('src/app/api/ics/idols/[slug]/route.ts'),/CALENDAR_NOTIFY_TRUST_LEVELS\.(?:includes|some)/)
for(const f of ['src/app/api/cron/dispatch-new-event-notifications/route.ts','src/lib/reminderDispatch.ts']){assert.match(source(f),/\['official', 'media'\]/);assert.ok(!source(f).includes("'aggregator'"))}
assert.ok(!source('src/app/events/[id]/page.tsx').includes("=== 'official' ? '官方確認' : '媒體確認'"))
assert.match(source('src/lib/types.ts'),/export type TrustLevel[^\n]*'aggregator'/)
const cs=[{id:'kp',source_key:'kp',name:'kpopofficial.com',parser_type:'kpopofficial_concerts',source_type:'community'},{id:'jyp',source_key:'jyp',name:'JYP Schedule',parser_type:'jyp_schedule',source_type:'official_website'}]
const candidates=['Fan Meeting','Summer Festival','World Tour','Official type','Official missing'].map((title,i)=>({id:'c'+i,review_status:'pending',raw_title:title,detected_idol_id:'idol',detected_date:`2027-01-0${i+1}`,detected_event_type:i===3?'concert':null,source_url:i<3?'https://kpopofficial.com/'+i:'https://twice.jype.com/'+i,source_name:i<3?'kpopofficial.com':'JYP Schedule',source_type:i<3?'community':'official_website',ai_confidence:null,raw_data:{crawler_source_id:i<3?'kp':'jyp'}}))
mkdirSync('/tmp/t34-pr3',{recursive:true})
writeFileSync('/tmp/t34-pr3/fixture.json',JSON.stringify({export_version:'t34-pr2-export-v1',queried_at:'2026-11-17T02:00:00Z',candidates,crawler_sources:cs,idols:[{id:'idol',name:'TWICE',is_active:true}],events:[],event_sources:[]}))
const run=spawnSync(process.execPath,['scripts/dry-run-auto-publish.mjs','--input','/tmp/t34-pr3/fixture.json','--now','2026-11-17T02:00:00Z'],{encoding:'utf8'})
assert.equal(run.status,0,run.stderr)
assert.match(run.stdout,/類型推導（將上架、create_event）/)
for(const rule of ['kpop_fanmeeting','kpop_festival','kpop_default'])assert.match(run.stdout,new RegExp('\\| '+rule+' \\| concert \\| (?:fanmeet|\\(null\\)) \\| 1 \\|'))
assert.match(run.stdout,/\| missing_type \| 1 \|/);assert.match(run.stdout,/⚠️ 這些候選不會被建立/);assert.ok(!run.stdout.includes('預設值由 PR-3 決定'))
console.log('PASS public trust levels, labels, ICS boundary and dry-run inference')
