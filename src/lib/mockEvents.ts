import type {
  Event,
  EventType,
  EventSubType,
  EventStatus,
  TrustLevel,
  EventSource,
  SourceType,
} from './types'

// Re-export types for consumers that import from this module
export type { Event, EventType, EventSubType, EventStatus, TrustLevel, EventSource } from './types'

// ── Visibility rule ───────────────────────────────────────────────────────────

/** Only official and media events are rendered in the public frontend */
export const VISIBLE_TRUST_LEVELS: TrustLevel[] = ['official', 'media']

// ── Display config ────────────────────────────────────────────────────────────

/** Labels for the 7 main frontend categories */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  concert: '演唱會',
  ticketing: '開票售票',
  livestream: '直播',
  streaming: '串流',
  media: '媒體',
  brand: '代言品牌',
  official: '官方發布',
}

/** Labels for fine-grained sub-types (shown instead of main label when present) */
export const EVENT_SUBTYPE_LABELS: Record<EventSubType, string> = {
  fanmeet: '粉絲見面',
  fansign: '簽名會',
  musicshow: '音樂節目',
  variety: '綜藝節目',
  interview: '採訪宣傳',
  award: '頒獎典禮',
  release: '專輯發行',
  announcement: '官方公告',
  magazine: '雜誌媒體',
}

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  concert: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  ticketing: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  livestream: 'bg-red-500/20 text-red-300 border-red-500/30',
  streaming: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  media: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  brand: 'bg-lime-500/20 text-lime-300 border-lime-500/30',
  official: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
}

export const SOURCE_CONFIG: Record<
  TrustLevel,
  { label: string; color: string; dot: string; desc: string }
> = {
  official: {
    label: '官方確認',
    color: 'text-emerald-400',
    dot: 'bg-emerald-400',
    desc: '來自官方 SNS 或官網公告',
  },
  media: {
    label: '媒體確認',
    color: 'text-blue-400',
    dot: 'bg-blue-400',
    desc: '由知名媒體或粉絲帳號確認',
  },
  pending: {
    label: '待確認',
    color: 'text-gray-400',
    dot: 'bg-gray-400',
    desc: '尚未經官方或可靠來源確認',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = new Date()
const d = (offset: number, hour = 19, min = 0) => {
  const dt = new Date(today)
  dt.setDate(dt.getDate() + offset)
  dt.setHours(hour, min, 0, 0)
  return dt.toISOString()
}

const src = (
  level: TrustLevel,
  label: string,
  type?: SourceType,
  url?: string,
): EventSource => ({ level, label, type, url })

// ── Mock data (24 events) ─────────────────────────────────────────────────────

export const MOCK_EVENTS: Event[] = [
  // ── 演唱會 / 見面會 ──────────────────────────────────────────────────────────
  {
    id: 'ev-001',
    idolId: 'bts',
    idolName: 'BTS',
    title: 'BTS PERMISSION TO DANCE ON STAGE – 台北',
    type: 'concert',
    status: 'confirmed',
    date: d(3),
    time: '19:00',
    location: '台北小巨蛋',
    country: '台灣',
    countryFlag: '🇹🇼',
    source: src('official', '@BTS_official', 'official_sns'),
    description: 'BTS 台北場演唱會，七人完整陣容重磅回歸亞洲巡演首站。',
    isFavorited: true,
    ticketUrl: '#',
    tags: ['台北', '演唱會', '七人完整陣容'],
  },
  {
    id: 'ev-003',
    idolId: 'aespa',
    idolName: 'aespa',
    title: 'aespa SYNK: PARALLEL LINE 世界巡演 – 首爾',
    type: 'concert',
    status: 'confirmed',
    date: d(10),
    time: '18:30',
    location: '首爾 KSPO DOME',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: src('official', 'SM Entertainment', 'official_website'),
    description: 'aespa 首次世界巡演首爾場，融合 AR 技術與 ae 世界觀打造沉浸式演出。',
    isFavorited: true,
    ticketUrl: '#',
    tags: ['世界巡演', '首爾', 'AR舞台'],
  },
  {
    id: 'ev-004',
    idolId: 'ive',
    idolName: 'IVE',
    title: 'IVE 台灣粉絲見面會',
    type: 'concert',
    subType: 'fanmeet',
    status: 'confirmed',
    date: d(14),
    time: '14:00',
    location: '台北流行音樂中心',
    country: '台灣',
    countryFlag: '🇹🇼',
    source: src('official', 'Starship Entertainment', 'official_website'),
    description: 'IVE 六位成員親赴台北，與台灣粉絲近距離互動，現場遊戲環節特別豐富。',
    isFavorited: true,
    ticketUrl: '#',
    tags: ['台北', '粉絲見面', '六人'],
  },
  {
    id: 'ev-006',
    idolId: 'bts',
    idolName: 'BTS',
    title: 'BTS j-hope《HOPE ON THE STAGE》Weverse Con',
    type: 'concert',
    status: 'confirmed',
    date: d(5),
    time: '20:00',
    location: 'Weverse Live',
    country: '線上',
    countryFlag: '💻',
    source: src('official', 'HYBE', 'official_website'),
    description: 'j-hope 個人線上演唱會，延續《HOPE ON THE STAGE》世界巡演能量。',
    isFavorited: true,
    ticketUrl: '#',
    tags: ['線上', 'j-hope', '個人場'],
  },
  {
    id: 'ev-007',
    idolId: 'stray-kids',
    idolName: 'Stray Kids',
    title: 'Stray Kids MANIAC WORLD TOUR – 新加坡',
    type: 'concert',
    status: 'confirmed',
    date: d(18),
    time: '19:30',
    location: 'Singapore Indoor Stadium',
    country: '新加坡',
    countryFlag: '🇸🇬',
    source: src('official', 'JYP Entertainment', 'official_website'),
    description: 'MANIAC WORLD TOUR 東南亞巡演新加坡場，八人強勢登台。',
    isFavorited: false,
    ticketUrl: '#',
    tags: ['新加坡', '世界巡演', '東南亞'],
  },
  {
    id: 'ev-011',
    idolId: 'exo',
    idolName: 'EXO',
    title: 'EXO 十週年特別展覽 – 首爾',
    type: 'concert',
    subType: 'fanmeet',
    status: 'confirmed',
    date: d(25),
    time: '10:00',
    location: 'SM TOWN COEX Artium',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: src('official', 'SM Entertainment', 'official_website'),
    description: 'EXO 十週年紀念展覽，展出出道十年珍貴舞台照、手稿與親筆簽名。',
    isFavorited: false,
    tags: ['十週年', '展覽', '首爾'],
  },
  {
    id: 'ev-015',
    idolId: 'newjeans',
    idolName: 'NewJeans',
    title: 'NewJeans 馬來西亞粉絲見面會 – 吉隆坡',
    type: 'concert',
    subType: 'fanmeet',
    status: 'confirmed',
    date: d(30),
    time: '15:00',
    location: 'Axiata Arena 吉隆坡',
    country: '馬來西亞',
    countryFlag: '🇲🇾',
    source: src('official', 'ADOR', 'official_website'),
    description: 'NewJeans 東南亞巡演吉隆坡站，為本次亞洲粉絲見面會最終場。',
    isFavorited: false,
    ticketUrl: '#',
    tags: ['吉隆坡', '東南亞', '巡演最終場'],
  },

  // ── 開票售票 ──────────────────────────────────────────────────────────────────
  {
    id: 'ev-016',
    idolId: 'bts',
    idolName: 'BTS',
    title: 'BTS 台北演唱會正式開票 · PERMISSION TO DANCE',
    type: 'ticketing',
    status: 'confirmed',
    date: d(1),
    time: '12:00',
    location: '台北小巨蛋',
    country: '台灣',
    countryFlag: '🇹🇼',
    source: src('official', 'HYBE 官方', 'official_website'),
    description: 'BTS 台北小巨蛋演唱會今日 12:00 正式開票，一般席與 ARMY 預購票同步開搶，請備妥購票帳號。',
    isFavorited: true,
    ticketUrl: '#',
    tags: ['開票', '台北', 'PERMISSION TO DANCE'],
  },
  {
    id: 'ev-022',
    idolId: 'twice',
    idolName: 'TWICE',
    title: 'TWICE READY TO BE 台北場正式開票',
    type: 'ticketing',
    status: 'confirmed',
    date: d(11),
    time: '12:00',
    location: '台北小巨蛋',
    country: '台灣',
    countryFlag: '🇹🇼',
    source: src('official', 'JYP Entertainment', 'official_website'),
    description: 'TWICE 台北演唱會全區開票，熱門場次預計秒殺，建議提前備妥購票帳號與信用卡。',
    isFavorited: false,
    ticketUrl: '#',
    tags: ['開票', '台北', 'READY TO BE'],
  },

  // ── 直播 ──────────────────────────────────────────────────────────────────────
  {
    id: 'ev-017',
    idolId: 'blackpink',
    idolName: 'BLACKPINK',
    title: 'BLACKPINK《REBIRTH》回歸直播 · Weverse',
    type: 'livestream',
    status: 'confirmed',
    date: d(6),
    time: '21:00',
    country: '線上',
    countryFlag: '💻',
    source: src('official', '@BLACKPINK', 'official_sns'),
    description: '《REBIRTH》專輯發行週，四人齊聚 Weverse 進行回歸直播，與全球 BLINK 同慶新專輯。',
    isFavorited: false,
    streamUrl: '#',
    tags: ['Weverse直播', 'REBIRTH', '回歸'],
  },
  {
    id: 'ev-023',
    idolId: 'txt',
    idolName: 'TXT',
    title: 'TXT《Chasing》發行特別直播 Q&A',
    type: 'livestream',
    status: 'confirmed',
    date: d(1),
    time: '20:00',
    country: '線上',
    countryFlag: '💻',
    source: src('official', '@TXT_bighit', 'official_sns'),
    description: 'TXT 新曲《Chasing》發行隔日，五人齊聚 YouTube 官方頻道進行直播，現場即時回答粉絲提問。',
    isFavorited: false,
    streamUrl: '#',
    tags: ['YouTube直播', 'Q&A', 'Chasing'],
  },

  // ── 串流 ──────────────────────────────────────────────────────────────────────
  {
    id: 'ev-018',
    idolId: 'aespa',
    idolName: 'aespa',
    title: 'aespa《Into the æ-WORLD》紀錄片 Netflix 上線',
    type: 'streaming',
    status: 'confirmed',
    date: d(12),
    time: '08:00',
    country: '全球',
    countryFlag: '🌍',
    source: src('media', 'Netflix Korea', 'media_outlet'),
    description: 'aespa 首部幕後紀錄片《Into the æ-WORLD》於 Netflix 全球同步上線，揭露世界巡演籌備幕後。',
    isFavorited: false,
    streamUrl: '#',
    tags: ['Netflix', '紀錄片', '幕後特輯'],
  },

  // ── 媒體 ──────────────────────────────────────────────────────────────────────
  {
    id: 'ev-008',
    idolId: 'twice',
    idolName: 'TWICE',
    title: 'TWICE 出演《人氣歌謠》特別舞台',
    type: 'media',
    subType: 'musicshow',
    status: 'confirmed',
    date: d(2),
    time: '17:00',
    location: 'SBS 公開錄影',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: src('media', '@twiceupdates_', 'fan_account'),
    description: 'TWICE 確認出演本週《人氣歌謠》，預計演唱新回歸主打歌。',
    isFavorited: false,
    tags: ['音樂節目', '人氣歌謠', '回歸宣傳'],
  },
  {
    id: 'ev-010',
    idolId: 'aespa',
    idolName: 'aespa',
    title: 'aespa 出演《Running Man》特別企劃',
    type: 'media',
    subType: 'variety',
    status: 'confirmed',
    date: d(9),
    time: '21:00',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: src('media', 'SBS 官方預告', 'media_outlet'),
    description: 'aespa 確認出演 Running Man 特別企劃，播出時間暫定週日晚間。',
    isFavorited: false,
    tags: ['Running Man', '綜藝', '四人'],
  },
  {
    id: 'ev-019',
    idolId: 'ive',
    idolName: 'IVE',
    title: 'IVE × VOGUE KOREA 六月號封面特輯',
    type: 'media',
    subType: 'magazine',
    status: 'confirmed',
    date: d(8),
    time: '10:00',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: src('official', 'VOGUE KOREA', 'media_outlet'),
    description: 'IVE 六人全員登上《VOGUE Korea》六月號封面，主題「In Full Bloom」，收錄獨家採訪。',
    isFavorited: false,
    tags: ['VOGUE', '雜誌封面', '六月號'],
  },
  {
    id: 'ev-024',
    idolId: 'stray-kids',
    idolName: 'Stray Kids',
    title: "Stray Kids × Harper's Bazaar Korea 七月號封面",
    type: 'media',
    subType: 'magazine',
    status: 'confirmed',
    date: d(15),
    time: '10:00',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: src('media', "Harper's Bazaar Korea", 'media_outlet'),
    description: "Stray Kids 登上《Harper's Bazaar Korea》七月號封面，主題「Untamed」，收錄獨家採訪。",
    isFavorited: false,
    tags: ['時尚雜誌', '封面', "Harper's Bazaar"],
  },

  // ── 代言品牌 ──────────────────────────────────────────────────────────────────
  {
    id: 'ev-020',
    idolId: 'le-sserafim',
    idolName: 'LE SSERAFIM',
    title: 'LE SSERAFIM × PUMA 台北快閃店',
    type: 'brand',
    status: 'confirmed',
    date: d(16),
    time: '11:00',
    location: '台北信義區 PUMA 旗艦店',
    country: '台灣',
    countryFlag: '🇹🇼',
    source: src('official', 'PUMA Taiwan', 'official_sns'),
    description: 'LE SSERAFIM 與 PUMA 合作快閃店於台北信義區盛大開幕，展出聯名系列並設互動打卡區，限量周邊現場贈送。',
    isFavorited: false,
    tags: ['PUMA', '品牌合作', '快閃', '台北'],
  },

  // ── 官方發布 ──────────────────────────────────────────────────────────────────
  {
    id: 'ev-002',
    idolId: 'blackpink',
    idolName: 'BLACKPINK',
    title: 'BLACKPINK 新專輯《REBIRTH》全球發行',
    type: 'official',
    subType: 'release',
    status: 'confirmed',
    date: d(7),
    time: '00:00',
    country: '全球',
    countryFlag: '🌍',
    source: src('official', '@BLACKPINK', 'official_sns'),
    description: '睽違兩年的全新正規專輯《REBIRTH》正式發行，主打歌 MV 同步上線。',
    isFavorited: false,
    tags: ['新專輯', '全球', '回歸'],
  },
  {
    id: 'ev-005',
    idolId: 'newjeans',
    idolName: 'NewJeans',
    title: 'NewJeans《Supernatural》日版 MV 發行',
    type: 'official',
    subType: 'release',
    status: 'confirmed',
    date: d(1),
    time: '12:00',
    country: '日本',
    countryFlag: '🇯🇵',
    source: src('official', '@NewJeans_ADOR', 'official_sns'),
    description: '《Supernatural》日本語版 MV 全平台同步上線，附加幕後拍攝特輯。',
    isFavorited: false,
    tags: ['日語版', 'MV', 'Supernatural'],
  },
  {
    id: 'ev-012',
    idolId: 'txt',
    idolName: 'TXT',
    title: 'TXT 新曲《Chasing》MV 首播直播',
    type: 'official',
    subType: 'release',
    status: 'confirmed',
    date: d(0),
    time: '18:00',
    country: '全球',
    countryFlag: '🌍',
    source: src('official', '@TXT_bighit', 'official_sns'),
    description: '今日 18:00 全球同步在 YouTube 首播新曲《Chasing》MV，官方直播互動。',
    isFavorited: true,
    tags: ['新曲', 'MV首播', '今日'],
  },
  {
    id: 'ev-021',
    idolId: 'newjeans',
    idolName: 'NewJeans',
    title: 'NewJeans 正規二輯《NJWMN》發行計畫公告',
    type: 'official',
    subType: 'announcement',
    status: 'confirmed',
    date: d(2),
    time: '09:00',
    country: '全球',
    countryFlag: '🌍',
    source: src('official', '@NewJeans_ADOR', 'official_sns'),
    description: 'ADOR 官方公告 NewJeans 第二張正規專輯《NJWMN》預計下季發行，同步公開宣傳排程預告與概念圖。',
    isFavorited: false,
    tags: ['官方公告', '新專輯', 'NJWMN'],
  },

  // ── pending（保留作為候選資料概念，前台不顯示）─────────────────────────────────
  {
    id: 'ev-009',
    idolId: 'le-sserafim',
    idolName: 'LE SSERAFIM',
    title: 'LE SSERAFIM 香港簽名會',
    type: 'concert',
    subType: 'fansign',
    status: 'tentative',
    date: d(21),
    time: '13:00',
    location: '香港 APM 購物中心',
    country: '香港',
    countryFlag: '🇭🇰',
    source: src('pending', 'lsf_hk_fans', 'community'),
    description: '粉絲社群整理資訊，官方尚未公告，香港場簽名會消息仍待確認。',
    isFavorited: false,
    tags: ['香港', '簽名會', '待確認'],
  },
  {
    id: 'ev-013',
    idolId: 'blackpink',
    idolName: 'BLACKPINK',
    title: 'BLACKPINK Jennie 個人 Weverse 直播',
    type: 'livestream',
    status: 'tentative',
    date: d(0),
    time: '22:00',
    country: '線上',
    countryFlag: '💻',
    source: src('pending', 'jennie_update', 'community'),
    description: '粉絲帳號消息，Jennie 暗示今晚或有 Weverse 直播，官方未公告。',
    isFavorited: false,
    tags: ['Jennie', '直播', '待確認'],
  },
  {
    id: 'ev-014',
    idolId: 'bts',
    idolName: 'BTS',
    title: 'BTS Jimin《MUSE》亞洲宣傳採訪 – 台灣媒體',
    type: 'media',
    subType: 'interview',
    status: 'tentative',
    date: d(4),
    time: '14:00',
    location: '台北',
    country: '台灣',
    countryFlag: '🇹🇼',
    source: src('pending', '匿名消息', 'unknown'),
    description: '尚未從可靠來源確認，消息指 Jimin 將於本週赴台接受媒體採訪。',
    isFavorited: false,
    tags: ['Jimin', '採訪', '待確認'],
  },
]

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getVisibleEvents(): Event[] {
  return MOCK_EVENTS.filter((e) => VISIBLE_TRUST_LEVELS.includes(e.source.level))
}

export function getEventById(id: string): Event | undefined {
  return MOCK_EVENTS.find((e) => e.id === id)
}

export function getEventsByIdol(idolId: string): Event[] {
  return MOCK_EVENTS.filter(
    (e) => e.idolId === idolId && VISIBLE_TRUST_LEVELS.includes(e.source.level),
  )
}

export function getTodayEvents(): Event[] {
  const today = new Date()
  return MOCK_EVENTS.filter((e) => {
    if (!VISIBLE_TRUST_LEVELS.includes(e.source.level)) return false
    const d = new Date(e.date)
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    )
  })
}

export function getUpcomingEvents(days = 14): Event[] {
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() + days)
  return MOCK_EVENTS.filter((e) => {
    if (!VISIBLE_TRUST_LEVELS.includes(e.source.level)) return false
    const d = new Date(e.date)
    return d >= now && d <= cutoff
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function getFavoritedEvents(): Event[] {
  return MOCK_EVENTS.filter(
    (e) => e.isFavorited && VISIBLE_TRUST_LEVELS.includes(e.source.level),
  )
}

export function getEventsByTypes(types: EventType[], days = 14): Event[] {
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() + days)
  return MOCK_EVENTS.filter((e) => {
    if (!VISIBLE_TRUST_LEVELS.includes(e.source.level)) return false
    if (!types.includes(e.type)) return false
    const d = new Date(e.date)
    return d >= now && d <= cutoff
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const month = d.getMonth() + 1
  const day = d.getDate()
  const wd = weekdays[d.getDay()]

  if (diffDays === 0) return `今天 (週${wd})`
  if (diffDays === 1) return `明天 (週${wd})`
  if (diffDays === -1) return `昨天 (週${wd})`
  return `${month}/${day} 週${wd}`
}
