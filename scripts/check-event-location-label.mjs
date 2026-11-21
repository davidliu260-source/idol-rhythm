import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { registerHooks } from 'node:module'
registerHooks({resolve(s,c,n){return n(s.startsWith('.') && !c.parentURL?.includes('/node_modules/') && !/\.[a-z]+$/i.test(s) ? s+'.ts':s,c)}})
const { getEventLocationLabel: label, hasAnyEventLocation: has, LOCATION_PENDING_LABEL }=await import('../src/lib/eventLocation.ts')
for(const e of [{},{venueName:' ',location:'\t',city:' ',address:''},{country:'Korea'}]){assert.equal(label(e),LOCATION_PENDING_LABEL);assert.equal(has(e),false)}
for(const key of ['venueName','location','city','address']){const e={[key]:' Value '};assert.equal(label(e),'Value');assert.equal(has(e),true)}
assert.equal(label({venueName:'V',location:'L',city:'C',address:'A'}),'V')
assert.equal(label({location:'L',city:'C',address:'A'}),'L')
assert.equal(label({city:'C',address:'A'}),'C')
const query=readFileSync('src/lib/supabase/events.ts','utf8');assert.match(query,/displayLocation\s*=\s*row\.location_name_zh\?\.trim\(\)\s*\|\|\s*row\.location/)
const files=['src/app/schedule/ScheduleTrackCard.tsx','src/app/atlas/AtlasClient.tsx','src/components/EventCard.tsx','src/components/EventDetailInfoRows.tsx','src/components/HomeNextEventHero.tsx','src/components/UpcomingEventCard.tsx','src/components/HomeTimeline.tsx','src/app/me/MeClient.tsx']
for(const f of files)assert.match(readFileSync(f,'utf8'),/import.*(?:getEventLocationLabel|hasAnyEventLocation).*eventLocation/)
assert.ok(!readFileSync('src/components/EventCard.tsx','utf8').includes('{event.location}'))
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name])}
for(const f of walk('src').filter(f=>f!=='src/lib/eventLocation.ts'))assert.ok(!readFileSync(f,'utf8').includes(LOCATION_PENDING_LABEL),f)
console.log('PASS event location labels and frontend coverage')
