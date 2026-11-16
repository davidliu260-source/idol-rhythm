// 唯讀：箱子、CI、check 只准使用 /tmp 自造假資料；正式匯出僅 Dave 本機執行。
// 僅讀指定輸入；不讀環境檔、不連網、不連庫；只寫 stdout 或指定 Markdown 報告。
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { registerHooks } from 'node:module'
registerHooks({ resolve(s,c,n) { return n(s.startsWith('.') && !c.parentURL?.includes('/node_modules/') && !/\.[a-z]+$/i.test(s) ? s+'.ts' : s,c) } })
const { evaluateCandidate, evaluateCandidates, AUTO_PUBLISH_RULE_VERSION, PARK_REASONS, SKIP_REASONS } = await import('../src/lib/autoPublish/evaluateCandidate.ts')
const { toDetectedLocation, hasAnyLocation, locationFromRawData, locationFromRawContent } = await import('../src/lib/crawlers/candidateLocation.ts')
const { taipeiToday } = await import('../src/lib/taipeiDate.ts')
const clean = v => typeof v === 'string' ? v.trim() : ''
const lexical = (a,b) => a < b ? -1 : a > b ? 1 : 0
const cell = v => String(v ?? '—').replaceAll('|','\\|').replace(/[\r\n]+/g,' ')
const table = (heads, rows) => ['| '+heads.join(' | ')+' |','| '+heads.map(()=> '---').join(' | ')+' |',...rows.map(r=>'| '+r.map(cell).join(' | ')+' |')].join('\n')
const count = (rows, fn) => rows.filter(fn).length
const tally = (rows, fn) => { const m=new Map(); for(const r of rows){const k=fn(r);m.set(k,(m.get(k)??0)+1)} return [...m].sort(([a],[b])=>lexical(a,b)) }
try {
  const args = process.argv.slice(2), opts = {}
  for(let i=0;i<args.length;i+=2) {
    const key=args[i]
    if(!['--input','--mode','--now','--out'].includes(key) || !args[i+1] || args[i+1].startsWith('--') || key in opts) throw new Error('參數格式錯誤：--input <json> [--mode candidates|event-location] [--now <ISO>] [--out <report.md>]')
    opts[key]=args[i+1]
  }
  if(!opts['--input']) throw new Error('缺少 --input')
  // 拒絕路徑任何部分含環境檔前綴（包括額外副檔名）。
  const forbidden = p => p.toLowerCase().includes('.'+'env')
  if(forbidden(opts['--input'])) throw new Error('拒絕環境檔路徑')
  const mode=opts['--mode']??'candidates'
  if(!['candidates','event-location'].includes(mode)) throw new Error('未知 mode')
  if(opts['--out'] && (!opts['--out'].endsWith('.md') || forbidden(opts['--out']) || resolve(opts['--out'])===resolve(opts['--input']))) throw new Error('輸出必須為獨立 .md 報告檔')
  let data=JSON.parse(readFileSync(opts['--input'],'utf8'))
  if(Array.isArray(data)) {
    if(data.length!==1 || !('payload' in data[0])) throw new Error('SQL 匯出應為單列 payload')
    data=typeof data[0].payload==='string'?JSON.parse(data[0].payload):data[0].payload
  }
  if(!data || data.export_version!=='t34-pr2-export-v1') throw new Error('export_version 不符')
  for(const k of ['candidates','crawler_sources','idols','events','event_sources']) if(!Array.isArray(data[k])) throw new Error('缺少陣列 '+k)
  const nowValue=opts['--now']??data.queried_at
  if(typeof nowValue!=='string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(nowValue)) throw new Error('需要含時區的 --now 或 queried_at ISO 時間')
  const now=new Date(nowValue)
  if(!Number.isFinite(now.getTime())) throw new Error('無效 now')
  const { candidates,events,idols,event_sources }=data
  const ctx={now,idols,crawlerSources:data.crawler_sources,events,eventSources:event_sources}
  const eventById=new Map(events.map(e=>[e.id,e]))
  const lines=[`# T34 PR-2 ${mode} 唯讀報告`,`規則版本：${AUTO_PUBLISH_RULE_VERSION}`,`queried_at：${cell(data.queried_at)}；評估 now：${now.toISOString()}；台北今天：${taipeiToday(now)}；匯出台北日期：${cell(data.taipei_today)}`,`輸入檔名：${cell(basename(opts['--input']))}`,'不寫庫；正式資料僅 Dave 本機使用，箱子／CI／check 只能用 /tmp 自造假資料。']
  const section=(title,content)=>lines.push('\n## '+title+'\n',content)
  if(mode==='candidates') {
    const decisions=evaluateCandidates(candidates,ctx)
    const rows=candidates.map((c,i)=>({c,d:decisions[i]}))
    const pub=rows.filter(r=>r.d.action.startsWith('publish')),park=rows.filter(r=>r.d.action==='park'),skip=rows.filter(r=>r.d.action==='skip')
    const pending=count(candidates,c=>c.review_status==='pending')
    const approved=candidates.filter(c=>c.review_status==='approved')
    section('庫存（以當下查詢為準）',table(['項目','筆數'],[
      ['pending 總數',pending],['Dave 2026-11-16 所稱',262],['差異',pending-262],['自 2026-07-15（台北）建立 pending',count(candidates,c=>c.review_status==='pending' && Number.isFinite(Date.parse(c.created_at)) && Date.parse(c.created_at)>=Date.parse('2026-07-15T00:00:00+08:00'))],['approved 總數',approved.length],['approved 連結活動未發布',count(approved,c=>eventById.get(c.approved_event_id)?.is_published===false)],['approved 已發布但 trust 不可見',count(approved,c=>{const e=eventById.get(c.approved_event_id);return e?.is_published===true&&!['official','media','aggregator'].includes(e.trust_level)})],['approved 無 approved_event_id',count(approved,c=>!clean(c.approved_event_id))],['pending／approved 範圍內',count(candidates,c=>['pending','approved'].includes(c.review_status))],['範圍外（僅供地點模式）',count(candidates,c=>!['pending','approved'].includes(c.review_status))]
    ]))
    section('將上架：官方／媒體／非官方整理 × 地點 × target',table(['trustLevel','地點狀態','target','筆數'],['official','media','aggregator'].flatMap(t=>['has_location','location_pending'].flatMap(l=>['create_event','publish_existing_event'].map(target=>[t,l,target,count(pub,({d})=>d.trustLevel===t&&d.locationStatus===l&&d.target===target)])))))
    const raw=pub.filter(({d})=>d.locationStatus==='location_pending'&&d.rawLocation)
    section('地點待公布但 raw 已有地點',`總數：${raw.length}\n\n`+table(['來源','parserType','筆數'],tally(raw,({d})=>`${d.rawLocationOrigin}\t${d.parserType??'(none)'}`).map(([k,n])=>[...k.split('\t'),n])))
    section('將擱置','缺地點不是擱置原因\n\n'+table(['parkReason','筆數'],PARK_REASONS.map(r=>[r,count(park,({d})=>d.parkReason===r)]))+'\n\n'+table(['allReasons','次數'],PARK_REASONS.map(r=>[r,count(park,({d})=>d.allReasons.includes(r))])))
    section('將跳過',table(['skipReason','筆數'],SKIP_REASONS.map(r=>[r,count(skip,({d})=>d.skipReason===r)])))
    section('parserType × action',table(['parserType','publish_official','publish_aggregator','park','skip'],[...new Set(rows.map(({d})=>d.parserType??'(none)'))].sort(lexical).map(p=>[p,...['publish_official','publish_aggregator','park','skip'].map(a=>count(rows,({d})=>(d.parserType??'(none)')===p&&d.action===a))])))
    section('eventType 為 null 的將上架筆數',`${count(pub,({d})=>d.eventType===null)}；預設值由 PR-3 決定。`)
    const samples=[...pub.sort((a,b)=>lexical(a.c.id,b.c.id)).slice(0,10),...park.sort((a,b)=>lexical(a.c.id,b.c.id)).slice(0,10)]
    section('抽樣：上架 10／擱置 10',table(['candidate id','偶像名','日期','標題（60 字）','來源名','parserType','決策','trust／原因','地點狀態','rawLocation'],samples.map(({c,d})=>[c.id,idols.find(i=>i.id===c.detected_idol_id)?.name,c.detected_start_date??c.detected_date,Array.from(c.raw_title??'').slice(0,60).join(''),c.source_name??data.crawler_sources.find(s=>s.id===d.crawlerSourceId)?.name,d.parserType,d.action,d.trustLevel??d.parkReason,d.locationStatus,JSON.stringify(d.rawLocation??null)])))
    if(pub.length+park.length+skip.length!==candidates.length) throw new Error('加總核對失敗')
    section('加總核對',`${pub.length} 上架 + ${park.length} 擱置 + ${skip.length} 跳過 = ${candidates.length} 匯出候選總數：PASS`)
  } else {
    section('地點回填邊界','只填空欄、不覆寫；此為獨立 dry-run，與候選上架回填分開同意（PR-4）。不寫 events。')
    const empty=e=>![e.city,e.venue_name,e.address].some(clean)
    const rows=events.filter(e=>e.is_published===true&&empty(e)).map(e=>{
      const linked=candidates.filter(c=>c.approved_event_id===e.id)
      const urls=event_sources.filter(s=>s.event_id===e.id&&clean(s.url)).map(s=>clean(s.url))
      const matches=linked.length?linked:candidates.filter(c=>clean(c.source_url)&&urls.includes(clean(c.source_url)))
      const detected=matches.map(c=>({c,loc:toDetectedLocation({city:c.detected_city,venueName:c.detected_venue_name,address:c.detected_address}),origin:'detected'})).filter(r=>hasAnyLocation(r.loc))
      const raw=matches.map(c=>{const loc=locationFromRawData(c.raw_data);return {c,loc:loc??locationFromRawContent(c.raw_content),origin:loc?'raw_data':'raw_content'}}).filter(r=>hasAnyLocation(r.loc))
      const bucket=detected.length?'fillable_from_detected':raw.length?'fillable_from_raw':clean(e.location)?'legacy_location_only':matches.length?'candidate_no_location':'no_candidate'
      return {e,bucket,matches,proposals:detected.length?detected:raw}
    })
    section('範圍',`已發布且三欄全空：${rows.length}（對照盤點 193，以當下查詢為準）；已建成未發布且三欄皆空：${count(events,e=>e.is_published===false&&empty(e))}`)
    section('互斥分類',table(['分類','活動筆數'],['fillable_from_detected','fillable_from_raw','legacy_location_only','candidate_no_location','no_candidate'].map(b=>[b,count(rows,r=>r.bucket===b)])))
    const groups=new Map()
    for(const r of rows) for(const p of r.proposals) {
      const parser=evaluateCandidate(p.c,ctx).parserType??'(none)'
      for(const key of ['city','venue_name','address']) if(clean(p.loc['detected_'+key])) {
        const g=`${r.bucket}\t${parser}\t${key}`
        if(!groups.has(g)) groups.set(g,new Set())
        groups.get(g).add(r.e.id)
      }
    }
    section('fillable 按 parserType／將寫入欄位', '每格計不同活動數；同活動可有多候選／欄位，因此跨列不應加總。\n\n'+table(['分類','parserType','欄位','活動筆數'],[...groups].sort(([a],[b])=>lexical(a,b)).map(([k,v])=>[...k.split('\t'),v.size])))
    const sample=[...rows].sort((a,b)=>Number(!a.bucket.startsWith('fillable'))-Number(!b.bucket.startsWith('fillable'))||lexical(a.e.id,b.e.id)).slice(0,20)
    section('抽樣 20 筆（fillable 優先，event id 字典序）',table(['event id','標題','分類','所有匹配 candidate id','將寫入的值（多候選衝突留待人工審查）'],sample.map(r=>[r.e.id,r.e.title,r.bucket,r.matches.map(c=>c.id).sort(lexical).join(', '),JSON.stringify(r.proposals.map(p=>({candidateId:p.c.id,parserType:evaluateCandidate(p.c,ctx).parserType,origin:p.origin,city:p.loc.detected_city,venue_name:p.loc.detected_venue_name,address:p.loc.detected_address})))])))
  }
  const report=lines.join('\n')+'\n'
  if(opts['--out']) writeFileSync(opts['--out'],report)
  else process.stdout.write(report)
} catch(err) {
  console.error('dry-run 失敗：'+err.message)
  process.exitCode=1
}
