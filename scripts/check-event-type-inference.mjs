import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
registerHooks({resolve(s,c,n){return n(s.startsWith('.') && !c.parentURL?.includes('/node_modules/') && !/\.[a-z]+$/i.test(s) ? s+'.ts':s,c)}})
const { inferEventType, EVENT_TYPE_VALUES, EVENT_SUB_TYPE_VALUES } = await import('../src/lib/autoPublish/inferEventType.ts')
const { getEventCategory } = await import('../src/lib/eventCategory.ts')
const run=(title,type=null,sub=null,parser='kpopofficial_concerts')=>inferEventType({raw_title:title,detected_event_type:type,detected_event_sub_type:sub},parser)
for(const title of ['TWICE Fanmeeting in Macau','ATEEZ Fan Meeting 2027','fan   meeting','FANMEETING','FanMeeting','Fan Meeting at Summer Festival']) assert.deepEqual(run(title),{type:'concert',subType:'fanmeet',rule:'kpop_fanmeeting'})
for(const title of ['Waterbomb Festival Seoul','FESTIVAL','festival']) assert.deepEqual(run(title),{type:'concert',subType:null,rule:'kpop_festival'})
for(const title of ['World Tour in Bangkok',null]) assert.deepEqual(run(title),{type:'concert',subType:null,rule:'kpop_default'})
assert.deepEqual(run('Fan Meeting','livestream'),{type:'livestream',subType:null,rule:'kept'})
assert.equal(run('Fan Meeting',null,null,'jyp_schedule').rule,'missing_type')
assert.deepEqual(run('', 'concert','fanmeet','jyp_schedule'),{type:'concert',subType:'fanmeet',rule:'kept'})
for(const parser of ['jyp_schedule','kpopofficial_concerts',null]) assert.equal(run('', 'fanmeeting',null,parser).rule,'invalid_type')
assert.equal(run('', 'concert','festival').rule,'invalid_type')
assert.equal(run('', null,'festival').rule,'invalid_type')
const source=readFileSync('src/lib/types.ts','utf8')
for(const [name,values] of [['EventType',EVENT_TYPE_VALUES],['EventSubType',EVENT_SUB_TYPE_VALUES]]) {
 const union=source.split('export type '+name+' =')[1].split('\n\n')[0]
 assert.deepEqual([...union.matchAll(/'([^']+)'/g)].map(m=>m[1]),values)
 assert.ok(!values.includes('festival'))
}
assert.equal(getEventCategory({type:'concert',subType:'fanmeet'}),'fanmeet')
assert.equal(getEventCategory({type:'concert',subType:null}),'concert')
console.log('PASS T1–T14 event type inference')
