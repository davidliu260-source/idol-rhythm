import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { registerHooks } from 'node:module'
registerHooks({resolve(s,c,n){return n(s.startsWith('.') && !c.parentURL?.includes('/node_modules/') && !/\.[a-z]+$/i.test(s) ? s+'.ts':s,c)}})
const { runAutoPublish } = await import('../src/lib/autoPublish/runAutoPublish.ts')
const { appendAutofillMeta, planLocationFill, resolveCandidateLocation } = await import('../src/lib/autoPublish/locationFill.ts')
const { touchedFromPayload } = await import('../src/lib/crawlers/touchedCandidate.ts')
const now=new Date('2026-11-17T02:00:00Z')
const cs={id:'cs',source_key:'jyp',name:'JYP Schedule',parser_type:'jyp_schedule',source_type:'official_website'}
const kp={...cs,id:'kp',name:'kpopofficial.com',parser_type:'kpopofficial_concerts',source_type:'community'}
const candidate=(over={})=>({id:'c1',review_status:'pending',raw_title:'TWICE Tour',detected_idol_id:'i',detected_event_type:'concert',detected_date:'2027-01-01',source_url:'https://twice.jype.com/a',source_name:'JYP Schedule',source_type:'official_website',ai_confidence:null,raw_data:{crawler_source_id:'cs'},...over})
const kpop=(over={})=>candidate({raw_title:'X Fan Meeting',detected_event_type:null,source_url:'https://kpopofficial.com/x',source_name:kp.name,source_type:'community',raw_data:{crawler_source_id:'kp',location:'Galaxy Arena, Macao'},...over})
const event=(over={})=>({id:'e1',idol_id:'i',title:'Draft',date:'2027-01-01',is_published:false,auto_publish_blocked:false,status:'confirmed',trust_level:'pending',city:null,venue_name:null,address:null,...over})
function fixture(candidates=[candidate({display_summary_zh:'巡演資訊'})],events=[],over={}) {
 const calls=[]
 const ctx={now,idols:[{id:'i',name:'TWICE',is_active:true}],crawlerSources:[cs,kp],events,eventSources:[]}
 const impl={readAutoPublishEnabled:async()=>({enabled:true}),loadContext:async()=>({candidates,ctx,idolNames:new Map([['i','TWICE']])}),getEvent:async id=>events.find(e=>e.id===id)??null,insertDraftEvent:async()=>({id:'new'}),linkCandidate:async()=>({updated:1}),hasEventSourceUrl:async()=>false,insertEventSource:async()=>({ok:true}),publishEvent:async()=>({updated:1}),fillEventLocation:async()=>({updated:1}),markCandidateApproved:async()=>({updated:1}),parkCandidate:async()=>({updated:1}),...over}
 const store=Object.fromEntries(Object.entries(impl).map(([name,fn])=>[name,async(...args)=>{calls.push({name,args:structuredClone(args)});return fn(...args)}]))
 const touched=candidates.map(c=>touchedFromPayload(c.id,'cs','unchanged',{}))
 return {calls,ctx,touched,async run(){return runAutoPublish(store,{touched,now})}}
}
const names=f=>f.calls.map(c=>c.name)
const args=(f,name)=>f.calls.filter(c=>c.name===name).map(c=>c.args)
let checks=0
const check=async(id,fn)=>{await fn();checks++;console.log('PASS '+id)}
await check('W1–W2',async()=>{
 for(const response of [{enabled:false},{enabled:null},{error:'read denied'}]) {
  const f=fixture([],[],{readAutoPublishEnabled:async()=>response}),r=await f.run()
  assert.deepEqual(names(f),['readAutoPublishEnabled']);assert.equal(r.ran,false);assert.equal(r.switch,response.error?'read_error':'off')
 }
})
await check('W3',async()=>{const f=fixture([]),r=await f.run();assert.equal(r.evaluated,0);assert.deepEqual(names(f),['readAutoPublishEnabled'])})
await check('W4',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.created.length,1)
 assert.deepEqual(names(f),['readAutoPublishEnabled','loadContext','insertDraftEvent','linkCandidate','insertEventSource','publishEvent'])
 const row=args(f,'insertDraftEvent')[0][0]
 assert.equal(row.is_published,false);assert.equal(row.trust_level,'official');assert.equal(row.description,null)
 for(const k of ['city','venue_name','address','location_autofill_meta']) assert.equal(row[k],null)
 assert.equal(args(f,'insertEventSource')[0][0].level,'official')
})
await check('W5–W6',async()=>{
 const f=fixture([kpop()]);await f.run();const row=args(f,'insertDraftEvent')[0][0]
 assert.equal(row.type,'concert');assert.equal(row.sub_type,'fanmeet');assert.equal(row.city,null);assert.equal(row.venue_name,'Galaxy Arena, Macao')
 assert.equal(row.location_autofill_meta.length,1)
 assert.deepEqual(Object.keys(row.location_autofill_meta[0]).sort(),['filled_at','candidate_id','crawler_source_id','fields','rule_version'].sort())
 assert.equal(row.location_autofill_meta[0].rule_version,'t34-v2')
 for(const call of f.calls) for(const v of call.args) if(v && typeof v==='object') {
  if('trust_level'in v)assert.equal(v.trust_level,'aggregator')
  if('level'in v)assert.equal(v.level,'aggregator')
 }
 assert.ok(!JSON.stringify(f.calls).includes('official"'));assert.ok(!JSON.stringify(f.calls).includes('media"'))
})
await check('W7',async()=>{const f=fixture([kpop({raw_title:'BLACKPINK in Seoul',raw_data:{crawler_source_id:'kp'}})]);await f.run();const row=args(f,'insertDraftEvent')[0][0];for(const k of ['city','venue_name','address'])assert.equal(row[k],null)})
await check('W8',async()=>{
 const c=candidate({detected_city:'Seoul'}),f=fixture([c]);f.touched[0]=touchedFromPayload(c.id,'cs','drift',{detected_venue_name:'Fresh Arena'});await f.run()
 const row=args(f,'insertDraftEvent')[0][0];assert.equal(row.city,null);assert.equal(row.venue_name,'Fresh Arena')
 assert.equal(resolveCandidateLocation({freshLocation:f.touched[0].freshLocation,candidate:c}).origin,'fresh_payload')
})
await check('W9–W10',async()=>{
 for(const trust of ['official','media','pending']) {
  const f=fixture([kpop({approved_event_id:'e1',detected_city:'Macau'})],[event({venue_name:'Keep Arena',trust_level:trust})]);const r=await f.run()
  assert.ok(!names(f).includes('insertDraftEvent'));assert.equal(r.publishedExisting.length,1)
  const patch=args(f,'publishEvent')[0][1];assert.equal(patch.trust_level,trust==='pending'?'aggregator':trust)
  assert.equal(patch.city,'Macau');for(const k of ['title','date','type','sub_type','venue_name','status','description'])assert.ok(!(k in patch))
 }
})
await check('W11',async()=>{
 const f=fixture([candidate({id:'c1',approved_event_id:'e1'}),candidate({id:'c2',raw_title:'Different',detected_date:'2027-01-02',approved_event_id:'e1'})],[event({venue_name:'Arena'})]);const r=await f.run();assert.equal(args(f,'publishEvent').length,1);assert.equal(r.skipped.duplicate_event_in_run,1)
})
const published=(over={})=>event({is_published:true,trust_level:'official',...over})
const linked=(over={})=>candidate({approved_event_id:'e1',...over})
await check('W12',async()=>{
 const old={old:'entry'},f=fixture([linked()],[published({location_autofill_meta:[old]})]);f.touched[0].freshLocation={detected_city:null,detected_venue_name:'New Arena',detected_address:null}
 const r=await f.run();assert.equal(r.locationFilled.length,1);const patch=args(f,'fillEventLocation')[0][1]
 assert.deepEqual(Object.keys(patch).sort(),['venue_name','location_autofilled_at','location_autofill_meta'].sort());assert.deepEqual(patch.location_autofill_meta[0],old)
})
await check('W13',async()=>{const f=fixture([linked({detected_venue_name:'New'})],[published({venue_name:'Keep'})]);await f.run();assert.equal(args(f,'fillEventLocation').length,0)})
await check('W14',async()=>{const f=fixture([linked({detected_venue_name:'New'})],[published()],{fillEventLocation:async()=>({updated:0})});const r=await f.run();assert.equal(r.skipped.location_conflict,1);assert.equal(args(f,'fillEventLocation').length,1)})
await check('W15',async()=>{const c=candidate(),f=fixture([c],[published(),published({id:'e2'})]);f.ctx.eventSources=[{event_id:'e1',url:c.source_url},{event_id:'e2',url:c.source_url}];const r=await f.run();assert.equal(r.skipped.location_ambiguous,1);assert.equal(args(f,'getEvent').length,0)})
await check('W16',async()=>{for(const status of ['pending','approved']){const f=fixture([candidate({review_status:status,detected_date:'2020-01-01'})]),r=await f.run();assert.equal(args(f,'parkCandidate').length,status==='pending'?1:0);if(status==='pending')assert.deepEqual(args(f,'parkCandidate')[0],['c1','expired']);else assert.equal(r.skipped.approved_not_parked,1)}})
await check('W17',async()=>{for(const [c,events]of [[candidate({review_status:'parked'}),[]],[linked(),[event({auto_publish_blocked:true})]]]){const f=fixture([c],events);await f.run();assert.deepEqual(names(f),['readAutoPublishEnabled','loadContext'])}})
await check('W18',async()=>{const f=fixture([candidate({detected_event_type:null})]),r=await f.run();assert.equal(r.errors[0].step,'event_type');assert.equal(args(f,'insertDraftEvent').length,0)})
await check('W19',async()=>{
 let count=0;const f=fixture([candidate({detected_venue_name:'Arena'}),candidate({id:'c2',raw_title:'Second',detected_date:'2027-01-02',detected_venue_name:'Arena'})],[],{insertEventSource:async()=>++count===1?{error:'denied'}:{ok:true}}),r=await f.run()
 assert.equal(r.errors[0].step,'event_source');assert.equal(args(f,'publishEvent').length,1);assert.equal(r.created[0].candidateId,'c2')
})
await check('W20',async()=>{const f=fixture(undefined,[],{linkCandidate:async()=>({updated:0})}),r=await f.run();assert.equal(r.errors[0].step,'link');assert.ok(!names(f).includes('insertEventSource'));assert.ok(!names(f).includes('publishEvent'))})
await check('W21',async()=>{let count=0;const f=fixture([candidate({detected_venue_name:'Arena'}),candidate({id:'c2',raw_title:'Second',detected_date:'2027-01-02',detected_venue_name:'Arena'})],[],{insertDraftEvent:async()=>{if(++count===1)throw Error('throw');return{id:'new2'}}}),r=await f.run();assert.equal(r.errors.length,1);assert.equal(r.created.length,1)})
await check('W22',async()=>{const f=fixture();f.touched.push(f.touched[0]);const r=await f.run();assert.equal(r.evaluated,1);assert.deepEqual(args(f,'loadContext')[0][0],['c1'])})
await check('W23',async()=>{
 assert.deepEqual(appendAutofillMeta({},{}),{error:'meta_malformed'})
 const f=fixture([linked({detected_city:'New'})],[event({location_autofill_meta:{},venue_name:'Arena'})]),r=await f.run();assert.equal(r.errors[0].message,'meta_malformed');assert.ok(!('city'in args(f,'publishEvent')[0][1]))
 assert.deepEqual(planLocationFill({city:'   ',venue_name:'Keep'},{detected_city:'Taipei',detected_venue_name:'No',detected_address:null}),{fields:{city:'Taipei'},guards:{city:'   '}})
})
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name])}
await check('W24',async()=>{
 const engine=readFileSync('src/lib/autoPublish/runAutoPublish.ts','utf8');assert.ok(!/import[^\n]*(?:supabase|next|serviceClient)/i.test(engine))
 // Scan executable source without treating the test's own detection pattern as a write.
 for(const file of [...files('src'),...files('scripts')].filter(f=>/\.(?:ts|tsx|mjs)$/.test(f))) assert.ok(!/value_boolean\s*:\s*true|update\([^)]*value_boolean|UPDATE\s+(?:public\.)?app_settings/.test(readFileSync(file,'utf8')),file)
})
await check('W25',async()=>{
 const single=readFileSync('src/app/admin/events/[id]/actions.ts','utf8').split('export async function unpublishEvent')[1].split('export async function')[0]
 const bulk=readFileSync('src/app/api/admin/events/bulk-publish/route.ts','utf8').split('// unpublish:')[1]
 for(const s of [single,bulk])assert.match(s,/update\(\{[^}]*auto_publish_blocked:\s*true/s)
})
await check('W26',async()=>{for(const p of [{},{detected_city:'  ',detected_venue_name:'\t'}])assert.equal(touchedFromPayload('c','s','unchanged',p).freshLocation,null)})
console.log(`PASS ${checks} write checks (W1–W26)`)
