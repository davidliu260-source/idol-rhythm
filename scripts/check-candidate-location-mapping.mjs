import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
registerHooks({ resolve(s,c,n) {
  if (s === 'css-what') return { url: new URL('./css-what-esm-shim.mjs', import.meta.url).href, shortCircuit: true }
  return n(s.startsWith('.') && !c.parentURL?.includes('/node_modules/') && !/\.[a-z]+$/i.test(s) ? s + '.ts' : s,c)
} })
const m0 = await import('../src/lib/crawlers/jypSchedule.ts')
const m1 = await import('../src/lib/crawlers/ygArtistSchedule.ts')
const m2 = await import('../src/lib/crawlers/kpopofficialConcerts.ts')
const m3 = await import('../src/lib/crawlers/blackpinkOfficialTour.ts')
const JYP_SRC = { crawlerSourceId: 'cs-jyp', sourceKey: 'twice-jyp-schedule', sourceName: 'TWICE JYP Schedule', sourceType: 'official_website', parserType: 'jyp_schedule', pageUrl: 'https://twice.jype.com/schedule', idolId: 'idol-1', groupId: '9', artistSlug: 'twice' }
const JYP_A = { title: 'Fan Meeting', rawDateText: '2026-12-01', detectedDate: '2026-12-01', rawTypeText: 'EVENT', sourceUrl: 'https://twice.jype.com/schedule#a1', hasOwnUrl: false, location: 'Seoul Olympic Hall', artists: ['TWICE'] }
const JYP_B = { ...JYP_A, sourceUrl: 'https://twice.jype.com/schedule#b1', location: null }

const YG_SRC = { crawlerSourceId: 'cs-yg', sourceKey: 'yg-babymonster', sourceName: 'BABYMONSTER YG Schedule', sourceType: 'official_website', parserType: 'yg_artist_schedule', pageUrl: 'https://www.ygfamily.com/artist/schedule', idolId: 'idol-3', artistId: 100, artistSlug: 'babymonster' }
const YG_A = { id: 1, title: 'Concert', rawDateText: '2026-12-02', detectedDate: '2026-12-02', time: '18:00', rawTypeText: 'CONCERT', place: 'KSPO DOME', sourceUrl: 'https://www.ygfamily.com/artist/schedule#1', hasOwnUrl: false }
const YG_B = { ...YG_A, id: 2, sourceUrl: 'https://www.ygfamily.com/artist/schedule#2', place: null }

const KP_SRC = { crawlerSourceId: 'cs-kpop', sourceKey: 'kpopofficial-concerts', sourceName: 'kpopofficial.com – Concerts', sourceType: 'community', parserType: 'kpopofficial_concerts', pageUrl: 'https://kpopofficial.com/kpop-concerts/' }
const KP_A = { entry: { title: 'IVE – Macao', rawDateText: 'May 23, 2026', detectedDate: '2026-05-23', location: 'Galaxy Arena, Macao', sourceUrl: 'https://kpopofficial.com/ive-macao' }, source: KP_SRC, matchedIdolId: 'idol-4', matchedIdolName: 'IVE', matchedVia: 'name' }
const KP_B = { ...KP_A, entry: { ...KP_A.entry, location: null, sourceUrl: 'https://kpopofficial.com/ive-other' } }

const BP_SRC = { crawlerSourceId: 'cs-bp', sourceKey: 'blackpink-tour', sourceName: 'BLACKPINK Official Tour', sourceType: 'official_website', parserType: 'blackpink_official_tour', pageUrl: 'https://www.blackpinkmusic.com/tour', idolId: 'idol-5' }
const BP_A = { cityId: 'goyang', city: 'GOYANG', place: 'GOYANG STADIUM', moreInfoUrl: null, rawDateText: '2025. 07. 05.', detectedDate: '2025-07-05', sourceUrl: 'https://www.blackpinkmusic.com/tour#goyang' }
const BP_B = { ...BP_A, cityId: 'la', city: 'LOS ANGELES', place: null, sourceUrl: 'https://www.blackpinkmusic.com/tour#la' }
const payloads = [m0.entryToCandidatePayload(JYP_A,JYP_SRC),m0.entryToCandidatePayload(JYP_B,JYP_SRC),m1.entryToCandidatePayload(YG_A,YG_SRC),m1.entryToCandidatePayload(YG_B,YG_SRC),m2.entryToCandidatePayload(KP_A),m2.entryToCandidatePayload(KP_B),m3.entryToCandidatePayload(BP_A,BP_SRC),m3.entryToCandidatePayload(BP_B,BP_SRC)]
const GOLDEN = [
  {
    "content_hash": "6b8b2cba8d48fb46917c1e441fb07811b66640b2d6c96b309ed69d611ea22c69",
    "source_hash": "89ac7755571c2cbba0d32a63aa2e90beb9b4a84de6b64c19d3a75940895d7db8",
    "raw_content": "Title: Fan Meeting\nDate: 2026-12-01\nCategory: EVENT\nLocation: Seoul Olympic Hall\nArtists: TWICE\nSource: https://twice.jype.com/schedule\nJYP groupId: 9",
    "raw_data": {
      "source": "jyp-schedule",
      "crawler_source_id": "cs-jyp",
      "source_key": "twice-jyp-schedule",
      "parser_type": "jyp_schedule",
      "parser_version": 1,
      "title": "Fan Meeting",
      "original_date_text": "2026-12-01",
      "original_type_text": "EVENT",
      "page_url": "https://twice.jype.com/schedule",
      "own_url": false,
      "location": "Seoul Olympic Hall",
      "artists": [
        "TWICE"
      ],
      "group_id": "9",
      "artist_slug": "twice"
    }
  },
  {
    "content_hash": "6391d76f2eff5f6b869849cd81b270c908e59fa42ca45d81ad837bb762b6b875",
    "source_hash": "bb0968fc9a2ec702f3848d916e7e7c2ae8159a3be563c65920aa62cbbb255475",
    "raw_content": "Title: Fan Meeting\nDate: 2026-12-01\nCategory: EVENT\nArtists: TWICE\nSource: https://twice.jype.com/schedule\nJYP groupId: 9",
    "raw_data": {
      "source": "jyp-schedule",
      "crawler_source_id": "cs-jyp",
      "source_key": "twice-jyp-schedule",
      "parser_type": "jyp_schedule",
      "parser_version": 1,
      "title": "Fan Meeting",
      "original_date_text": "2026-12-01",
      "original_type_text": "EVENT",
      "page_url": "https://twice.jype.com/schedule",
      "own_url": false,
      "location": null,
      "artists": [
        "TWICE"
      ],
      "group_id": "9",
      "artist_slug": "twice"
    }
  },
  {
    "content_hash": "44799a2b91acf4ed64584f04b41a7cd9c0cff330c08cd2ace1b12982cec17e52",
    "source_hash": "2fa91bc958e2c6580da03ca0adf1327f7ec8771c4aa70952fd6c779d3f65accb",
    "raw_content": "Title: Concert\nDate: 2026-12-02\nTime: 18:00\nCategory: CONCERT\nPlace: KSPO DOME\nSource: https://www.ygfamily.com/artist/schedule\nYG artistId: 100",
    "raw_data": {
      "source": "yg-artist-schedule",
      "crawler_source_id": "cs-yg",
      "source_key": "yg-babymonster",
      "parser_type": "yg_artist_schedule",
      "parser_version": 1,
      "schedule_id": 1,
      "title": "Concert",
      "original_date_text": "2026-12-02",
      "original_type_text": "CONCERT",
      "time": "18:00",
      "place": "KSPO DOME",
      "page_url": "https://www.ygfamily.com/artist/schedule",
      "own_url": false,
      "artist_id": 100,
      "artist_slug": "babymonster"
    }
  },
  {
    "content_hash": "ad34eead39689d2c6ac4b693864548b2e55adefd142c0fe8856cc475baae1c28",
    "source_hash": "edabd45d01e0bcbca77abfaaf9703ce73989eda11642405d1cbd25050b802a7c",
    "raw_content": "Title: Concert\nDate: 2026-12-02\nTime: 18:00\nCategory: CONCERT\nSource: https://www.ygfamily.com/artist/schedule\nYG artistId: 100",
    "raw_data": {
      "source": "yg-artist-schedule",
      "crawler_source_id": "cs-yg",
      "source_key": "yg-babymonster",
      "parser_type": "yg_artist_schedule",
      "parser_version": 1,
      "schedule_id": 2,
      "title": "Concert",
      "original_date_text": "2026-12-02",
      "original_type_text": "CONCERT",
      "time": "18:00",
      "place": null,
      "page_url": "https://www.ygfamily.com/artist/schedule",
      "own_url": false,
      "artist_id": 100,
      "artist_slug": "babymonster"
    }
  },
  {
    "content_hash": "30b90d3b73192ba35d873cf0d17af8b6dbe4884cafe36f2e8d718cc9fb697b44",
    "source_hash": "c3ed71206f9cb61c0d761e0dde26297c5564963b9515fbb78111a5f2b40330fa",
    "raw_content": "Title: IVE – Macao\nDate (raw): May 23, 2026\nLocation: Galaxy Arena, Macao\nMatched idol: IVE (via name)\nSource: https://kpopofficial.com/ive-macao",
    "raw_data": {
      "source": "kpopofficial-concerts",
      "crawler_source_id": "cs-kpop",
      "source_key": "kpopofficial-concerts",
      "parser_type": "kpopofficial_concerts",
      "parser_version": 1,
      "title": "IVE – Macao",
      "original_date_text": "May 23, 2026",
      "location": "Galaxy Arena, Macao",
      "page_url": "https://kpopofficial.com/kpop-concerts/",
      "matched_via": "name",
      "matched_idol_name": "IVE"
    }
  },
  {
    "content_hash": "a86fb1f04326ac683d40d3f2e891882162b484eea1d6955e6331087814d6303b",
    "source_hash": "2d53e370750f2b8a8675b45999b07282e3635fa3f594aef7db5084be888a6228",
    "raw_content": "Title: IVE – Macao\nDate (raw): May 23, 2026\nMatched idol: IVE (via name)\nSource: https://kpopofficial.com/ive-other",
    "raw_data": {
      "source": "kpopofficial-concerts",
      "crawler_source_id": "cs-kpop",
      "source_key": "kpopofficial-concerts",
      "parser_type": "kpopofficial_concerts",
      "parser_version": 1,
      "title": "IVE – Macao",
      "original_date_text": "May 23, 2026",
      "location": null,
      "page_url": "https://kpopofficial.com/kpop-concerts/",
      "matched_via": "name",
      "matched_idol_name": "IVE"
    }
  },
  {
    "content_hash": "3ff5f1b1965c666055b0c0c74eb2c79899112a102623078b061532a0ef6c5797",
    "source_hash": "a67034be1979a69a2e36c64308ce0c9833788c7c9f88262093e9452188ae329d",
    "raw_content": "City: GOYANG\nVenue: GOYANG STADIUM\nDate (raw): 2025. 07. 05.\nSource: https://www.blackpinkmusic.com/tour",
    "raw_data": {
      "source": "blackpink-official-tour",
      "crawler_source_id": "cs-bp",
      "source_key": "blackpink-tour",
      "parser_type": "blackpink_official_tour",
      "parser_version": 2,
      "city": "GOYANG",
      "city_id": "goyang",
      "venue": "GOYANG STADIUM",
      "original_date_text": "2025. 07. 05.",
      "more_info_url": null,
      "page_url": "https://www.blackpinkmusic.com/tour"
    }
  },
  {
    "content_hash": "38d7b833e0cf6aea870753fe9699ef0e6aa0da534f116baa9c70fd58f03fc89f",
    "source_hash": "72db9cbf976b5ccd84a073517f4d7b37287a3c6504e9390bf3e40cc15bfeaa35",
    "raw_content": "City: LOS ANGELES\nDate (raw): 2025. 07. 05.\nSource: https://www.blackpinkmusic.com/tour",
    "raw_data": {
      "source": "blackpink-official-tour",
      "crawler_source_id": "cs-bp",
      "source_key": "blackpink-tour",
      "parser_type": "blackpink_official_tour",
      "parser_version": 2,
      "city": "LOS ANGELES",
      "city_id": "la",
      "venue": null,
      "original_date_text": "2025. 07. 05.",
      "more_info_url": null,
      "page_url": "https://www.blackpinkmusic.com/tour"
    }
  }
]
let cases = 0
function check(id, fn) { fn(); cases++; console.log('PASS ' + id) }
const loc = p => [p.detected_city,p.detected_venue_name,p.detected_address]
check('P1',()=>assert.deepEqual(loc(payloads[0]),[null,'Seoul Olympic Hall',null]))
check('P2',()=>assert.deepEqual(loc(payloads[1]),[null,null,null]))
check('P3',()=>{assert.deepEqual(loc(payloads[2]),[null,'KSPO DOME',null]);assert.deepEqual(loc(payloads[3]),[null,null,null])})
check('P4',()=>{assert.deepEqual(loc(payloads[4]),[null,'Galaxy Arena, Macao',null]);assert.deepEqual(loc(payloads[5]),[null,null,null])})
check('P5',()=>{assert.deepEqual(loc(payloads[6]),['GOYANG','GOYANG STADIUM',null]);assert.deepEqual(loc(payloads[7]),['LOS ANGELES',null,null])})
check('P6',()=>payloads.forEach((p,i)=>['content_hash','source_hash','raw_content'].forEach(k=>assert.deepEqual(p[k],GOLDEN[i][k]))))
check('P7',()=>payloads.forEach((p,i)=>assert.deepEqual(p.raw_data,GOLDEN[i].raw_data)))
const source = n => readFileSync(new URL('../src/lib/crawlers/'+n+'.ts',import.meta.url),'utf8')
check('P8',()=>assert.ok(source('runGenericWebpageFetcher').split('function buildCandidatePayload')[1].includes('toDetectedLocation({ freeText: event.locationHint })')))
check('P9',()=>['smtownNotice','wakeoneNotice','youtubeOfficialChannel'].forEach(n=>assert.doesNotMatch(source(n),/detected_city|detected_venue_name|detected_address/)))
check('P10',()=>assert.doesNotMatch(source('contentHash'),/detected_city|venue/))
console.log(`OK check-candidate-location-mapping: ${cases} cases`)
