import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
registerHooks({resolve(s,c,n){return n(s.startsWith('.') && !c.parentURL?.includes('/node_modules/') && !/\.[a-z]+$/i.test(s) ? s+'.ts':s,c)}})
const { evaluateCandidate, evaluateCandidates, PARK_REASONS, AUTO_PUBLISH_RULE_VERSION } = await import('../src/lib/autoPublish/evaluateCandidate.ts')
const { toDetectedLocation, locationFromRawData, locationFromRawContent } = await import('../src/lib/crawlers/candidateLocation.ts')
const NOW = new Date('2026-11-16T02:00:00.000Z')   // 台北 2026-11-16 10:00
const I1 = { id: 'idol-1', name: 'TWICE', is_active: true }
const I2 = { id: 'idol-2', name: 'DORMANT', is_active: false }
const CS_JYP  = { id: 'cs-jyp',  source_key: 'twice-jyp-schedule', name: 'TWICE JYP Schedule', parser_type: 'jyp_schedule', source_type: 'official_website', source_url: 'https://twice.jype.com/schedule' }
const CS_BP   = { id: 'cs-bp',   source_key: 'blackpink-tour', name: 'BLACKPINK Official Tour', parser_type: 'blackpink_official_tour', source_type: 'official_website', source_url: 'https://www.blackpinkmusic.com/tour' }
const CS_KPOP = { id: 'cs-kpop', source_key: 'kpopofficial-concerts', name: 'kpopofficial.com – Concerts', parser_type: 'kpopofficial_concerts', source_type: 'community', source_url: 'https://kpopofficial.com/kpop-concerts/' }
const CS_COMM = { id: 'cs-comm', source_key: 'random-wiki', name: 'Random Fan Wiki', parser_type: 'generic_webpage', source_type: 'community', source_url: 'https://wiki.example.com/' }
const CS_KC   = { id: 'cs-kc',   source_key: 'generic-kpopconcerts-aggregator', name: 'kpopconcerts.com — K-Pop Concerts category', parser_type: 'generic_webpage', source_type: 'media_outlet', source_url: 'https://kpopconcerts.com/category/k-pop-concerts/' }
const CS_MEDIA= { id: 'cs-media',source_key: 'soompi', name: 'Soompi', parser_type: 'generic_webpage', source_type: 'media_outlet', source_url: 'https://www.soompi.com/' }

// 基準官方候選（JYP、未來、有偶像、無地點、ai_confidence null）
const base = (over = {}) => ({
  id: 'c-base', review_status: 'pending', raw_title: 'TWICE - Fan Meeting', raw_content: 'Title: Fan Meeting\nDate: 2026-12-01',
  raw_data: { source: 'jyp-schedule', crawler_source_id: 'cs-jyp', parser_type: 'jyp_schedule', title: 'Fan Meeting', location: null },
  detected_idol_id: 'idol-1', detected_event_type: 'fanmeeting', detected_date: '2026-12-01',
  detected_city: null, detected_venue_name: null, detected_address: null, location_name_zh: null,
  source_url: 'https://twice.jype.com/schedule#a1', source_name: 'TWICE JYP Schedule', source_type: 'official_website',
  ai_confidence: null, approved_event_id: null, created_at: '2026-11-10T00:00:00Z', ...over,
})

// 既有活動
const E_VISIBLE   = { id: 'e-vis',   idol_id: 'idol-1', title: 'TWICE World Tour Seoul', date: '2026-12-20', is_published: true,  trust_level: 'official', status: 'confirmed', auto_publish_blocked: false }
const E_DRAFT     = { id: 'e-draft', idol_id: 'idol-1', title: 'Draft Showcase',         date: '2026-12-05', is_published: false, trust_level: 'pending',  status: 'confirmed', auto_publish_blocked: false, venue_name: 'KSPO DOME' }
const E_HIDDEN    = { id: 'e-hid',   idol_id: 'idol-1', title: 'Hidden Trust',           date: '2026-12-06', is_published: true,  trust_level: 'pending',  status: 'confirmed', auto_publish_blocked: false }
const E_BLOCKED   = { id: 'e-blk',   idol_id: 'idol-1', title: 'Blocked One',            date: '2026-12-07', is_published: false, trust_level: 'official', status: 'confirmed', auto_publish_blocked: true }
const E_CANCELLED = { id: 'e-can',   idol_id: 'idol-1', title: 'Cancelled One',          date: '2026-12-08', is_published: true,  trust_level: 'official', status: 'cancelled', auto_publish_blocked: false }
const E_SRC       = { id: 'e-src',   idol_id: 'idol-1', title: 'Some Other Title',       date: '2026-12-09', is_published: true,  trust_level: 'media',    status: 'confirmed', auto_publish_blocked: false }
const E_SRC_DRAFT = { id: 'e-srcd',  idol_id: 'idol-1', title: 'Unrelated Draft',        date: '2026-12-10', is_published: false, trust_level: 'pending',  status: 'confirmed', auto_publish_blocked: false }
const EVENT_SOURCES = [
  { event_id: 'e-src',  url: 'https://twice.jype.com/schedule#src' },
  { event_id: 'e-srcd', url: 'https://twice.jype.com/schedule#srcd' },
  { event_id: 'e-blk',  url: 'https://twice.jype.com/schedule#blk' },
]
const ctx = { now: NOW, idols: [I1, I2], crawlerSources: [CS_JYP, CS_BP, CS_KPOP, CS_COMM, CS_KC, CS_MEDIA],
  events: [E_VISIBLE, E_DRAFT, E_HIDDEN, E_BLOCKED, E_CANCELLED, E_SRC, E_SRC_DRAFT], eventSources: EVENT_SOURCES }
let cases = 0
const check = (id,fn) => { fn(); cases++; console.log('PASS '+id) }
const run = (over={}, expected={}) => { const d=evaluateCandidate(base(over),ctx); for(const [k,v] of Object.entries(expected)) assert.deepEqual(d[k],v); return d }
const kp={source_type:'community',source_name:CS_KPOP.name,source_url:'https://kpopofficial.com/ive-macao',raw_data:{crawler_source_id:'cs-kpop',parser_type:'kpopofficial_concerts',title:'IVE Macao',location:'Galaxy Arena, Macao'},raw_title:'IVE Macao',detected_event_type:null}
const bp={raw_data:{crawler_source_id:'cs-bp',parser_type:'blackpink_official_tour',city:'GOYANG',venue:'GOYANG STADIUM'},source_name:CS_BP.name,source_url:CS_BP.source_url}
const publish={action:'publish_official',trustLevel:'official'}
check('R1',()=>run({}, {...publish,target:'create_event',locationStatus:'location_pending',rawLocation:null,ruleVersion:'t34-v1'}))
check('R2',()=>run({detected_venue_name:'KSPO DOME'},{...publish,locationStatus:'has_location',rawLocation:null}))
check('R3',()=>run({source_type:'media_outlet',source_name:'Soompi',source_url:'https://www.soompi.com/a/1',raw_data:{provider:'generic_webpage',crawlerSourceId:'cs-media'},ai_confidence:0.9},{action:'publish_official',trustLevel:'media'}))
check('R4',()=>run(kp,{action:'publish_aggregator',trustLevel:'aggregator',locationStatus:'location_pending',rawLocation:{detected_city:null,detected_venue_name:'Galaxy Arena, Macao',detected_address:null},rawLocationOrigin:'raw_data',eventType:null}))
check('R5',()=>run({...kp,detected_venue_name:'Galaxy Arena, Macao'},{action:'publish_aggregator',trustLevel:'aggregator',locationStatus:'has_location',rawLocation:null}))
check('R6',()=>assert.equal(run({raw_data:{...base().raw_data,location:'Seoul Olympic Hall'}},{...publish,locationStatus:'location_pending',rawLocationOrigin:'raw_data'}).rawLocation.detected_venue_name,'Seoul Olympic Hall'))
check('R7',()=>assert.equal(run({raw_data:{crawler_source_id:'cs-jyp'},raw_content:'Title: X\nLocation: Busan BEXCO'},{locationStatus:'location_pending',rawLocationOrigin:'raw_content'}).rawLocation.detected_venue_name,'Busan BEXCO'))
check('R8',()=>run(bp,{...publish,locationStatus:'location_pending',rawLocation:{detected_city:'GOYANG',detected_venue_name:'GOYANG STADIUM',detected_address:null}}))
const parks=[
[9,{raw_title:'   '},'missing_title'],[10,{detected_idol_id:null},'missing_idol'],[11,{detected_idol_id:'idol-x'},'unmatched_idol'],[12,{detected_idol_id:'idol-2'},'inactive_idol'],[13,{detected_date:null},'missing_date'],[14,{detected_date:'2026-11-15'},'expired'],[17,{ai_confidence:0.4},'low_confidence'],[18,{ai_confidence:'0.40'},'low_confidence'],[20,{raw_data:{},source_name:'Manual',source_type:'official_website',source_url:'https://example.com/n/1'},'unknown_parser'],[21,{source_type:'fan_account',source_name:'concerts fan'},'fan_account'],[22,{source_type:'unknown',source_name:null,source_url:'https://x.example.com/1',raw_data:{}},'unknown_source'],[23,{source_type:null,source_name:null,source_url:null,raw_data:{}},'unknown_source'],[24,{source_type:'community',source_name:CS_COMM.name,source_url:CS_COMM.source_url,raw_data:{provider:'generic_webpage',crawlerSourceId:'cs-comm'},ai_confidence:0.9},'aggregator_not_allowlisted'],[25,{source_type:'media_outlet',source_name:CS_KC.name,source_url:'https://kpopconcerts.com/x',raw_data:{provider:'generic_webpage',crawlerSourceId:'cs-kc'},ai_confidence:0.9},'aggregator_not_allowlisted'],[26,{raw_title:'TWICE World Tour Seoul',detected_date:'2026-12-20'},'duplicate'],[27,{raw_title:'draft   showcase',detected_date:'2026-12-05'},'duplicate'],[29,{source_url:'https://twice.jype.com/schedule#srcd'},'duplicate']]
for (const [n,over,parkReason] of parks) check('R'+n,()=>run(over,{action:'park',parkReason}))
check('R15',()=>run({detected_date:'2026-11-14',detected_end_date:'2026-11-17'},publish))
check('R16',()=>run({detected_date:'2026-11-16'},publish))
check('R19',()=>run({ai_confidence:0.65},publish))
for(const [n,over,skipReason] of [[28,{source_url:'https://twice.jype.com/schedule#src'},'source_url_matches_published_event'],[30,{source_url:'https://twice.jype.com/schedule#blk'},'auto_publish_blocked'],[31,{review_status:'approved',approved_event_id:'e-vis'},'already_published'],[34,{review_status:'approved',approved_event_id:'e-blk'},'auto_publish_blocked'],[35,{review_status:'approved',approved_event_id:'e-can'},'linked_event_cancelled']]) check('R'+n,()=>run(over,{action:'skip',skipReason,...(n===31?{existingEventId:'e-vis'}:{})}))
check('R32',()=>run({review_status:'approved',approved_event_id:'e-draft',raw_title:'Draft Showcase',detected_date:'2026-12-05'},{...publish,target:'publish_existing_event',existingEventId:'e-draft',locationStatus:'has_location'}))
check('R33',()=>run({review_status:'approved',approved_event_id:'e-hid',raw_title:'Hidden Trust',detected_date:'2026-12-06'},{...publish,target:'publish_existing_event'}))
check('R36',()=>run({review_status:'approved',approved_event_id:'e-gone'},{...publish,target:'create_event'}))
check('R37',()=>['rejected','parked'].forEach(review_status=>run({review_status},{action:'skip',skipReason:'not_in_scope'})))
check('R38',()=>run({detected_idol_id:null,detected_date:null,source_type:'fan_account'},{parkReason:'fan_account',allReasons:['fan_account','missing_idol','missing_date']}))
check('R39',()=>{const a=base({id:'c-a',created_at:'2026-11-01T00:00:00Z',source_url:'u#a'}), b=base({id:'c-b',created_at:'2026-11-02T00:00:00Z',source_url:'u#b'});const d=evaluateCandidates([b,a],ctx);assert.equal(d[0].candidateId,'c-b');assert.equal(d[0].parkReason,'duplicate');assert.equal(d[1].action,'publish_official')})
check('R40',()=>{assert.equal(AUTO_PUBLISH_RULE_VERSION,'t34-v1');assert.ok(PARK_REASONS.every(r=>!/location|city|venue|address/.test(r))); for(const c of [base(),base(kp),base({ai_confidence:0.9})]) assert.ok(['official','media','aggregator'].includes(evaluateCandidate(c,ctx).trustLevel))})
check('R41',()=>{for(const c of [base(),base(kp),base({review_status:'approved',approved_event_id:'e-draft'})]) {const before=JSON.stringify([c,ctx]);assert.deepEqual(evaluateCandidate(c,ctx),evaluateCandidate(c,ctx));assert.equal(JSON.stringify([c,ctx]),before)}})
check('R42',()=>[{},kp,{raw_data:{...base().raw_data,location:'Hall'}},bp].forEach(c=>{const d=run(c,{locationStatus:'location_pending'});assert.ok(d.action.startsWith('publish'))}))
const loc=(city,venue,address=null)=>({detected_city:city,detected_venue_name:venue,detected_address:address})
check('L1',()=>assert.deepEqual(toDetectedLocation({freeText:'  Seoul Olympic Hall '}),loc(null,'Seoul Olympic Hall')))
check('L2',()=>assert.deepEqual(toDetectedLocation({city:'GOYANG',venueName:'GOYANG STADIUM'}),loc('GOYANG','GOYANG STADIUM')))
check('L3',()=>assert.deepEqual(toDetectedLocation({freeText:'   '}),loc(null,null)))
check('L4',()=>assert.equal(toDetectedLocation({venueName:'A',freeText:'B'}).detected_venue_name,'A'))
check('L5',()=>{assert.equal(locationFromRawData({place:'YG Hall'}).detected_venue_name,'YG Hall');assert.equal(locationFromRawData({locationHint:'Tokyo Dome'}).detected_venue_name,'Tokyo Dome');assert.equal(locationFromRawData(null),null);assert.equal(locationFromRawData({location:123}),null)})
check('L6',()=>{assert.deepEqual(locationFromRawContent('City: GOYANG\nVenue: GOYANG STADIUM'),loc('GOYANG','GOYANG STADIUM'));assert.equal(locationFromRawContent('Place: X\nLocation: Y').detected_venue_name,'X');assert.equal(locationFromRawContent(null),null)})
console.log(`OK check-auto-publish-rules: ${cases} cases`)
