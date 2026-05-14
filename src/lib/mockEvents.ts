export type EventType =
  | 'concert'
  | 'fanmeet'
  | 'musicshow'
  | 'fansign'
  | 'release'
  | 'variety'
  | 'interview'
  | 'award'

export type SourceLevel = 'official' | 'verified' | 'community' | 'unverified'

export interface IdolEvent {
  id: string
  idolId: string
  idolName: string
  title: string
  type: EventType
  date: string
  time?: string
  location?: string
  country: string
  countryFlag: string
  source: SourceLevel
  sourceLabel: string
  sourceUrl?: string
  description: string
  isFavorited: boolean
  ticketUrl?: string
  tags: string[]
  confirmed: boolean
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  concert: '演唱會',
  fanmeet: '粉絲見面',
  musicshow: '音樂節目',
  fansign: '簽名會',
  release: '專輯發行',
  variety: '綜藝節目',
  interview: '採訪宣傳',
  award: '頒獎典禮',
}

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  concert: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  fanmeet: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  musicshow: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  fansign: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  release: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  variety: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  interview: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  award: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}

export const SOURCE_CONFIG: Record<
  SourceLevel,
  { label: string; color: string; dot: string; desc: string }
> = {
  official: {
    label: '官方',
    color: 'text-emerald-400',
    dot: 'bg-emerald-400',
    desc: '來自官方 SNS 或官網公告',
  },
  verified: {
    label: '已驗證',
    color: 'text-blue-400',
    dot: 'bg-blue-400',
    desc: '由知名粉絲帳號或媒體確認',
  },
  community: {
    label: '社群',
    color: 'text-amber-400',
    dot: 'bg-amber-400',
    desc: '粉絲社群匯整，可信度中等',
  },
  unverified: {
    label: '待確認',
    color: 'text-gray-400',
    dot: 'bg-gray-400',
    desc: '尚未經官方或可靠來源確認',
  },
}

const today = new Date()
const d = (offset: number, hour = 19, min = 0) => {
  const dt = new Date(today)
  dt.setDate(dt.getDate() + offset)
  dt.setHours(hour, min, 0, 0)
  return dt.toISOString()
}

export const MOCK_EVENTS: IdolEvent[] = [
  {
    id: 'ev-001',
    idolId: 'bts',
    idolName: 'BTS',
    title: 'BTS PERMISSION TO DANCE ON STAGE – 台北',
    type: 'concert',
    date: d(3),
    time: '19:00',
    location: '台北小巨蛋',
    country: '台灣',
    countryFlag: '🇹🇼',
    source: 'official',
    sourceLabel: '@BTS_official',
    description: 'BTS 台北場演唱會，七人完整陣容重磅回歸亞洲巡演首站。',
    isFavorited: true,
    ticketUrl: '#',
    tags: ['台北', '演唱會', '七人完整陣容'],
    confirmed: true,
  },
  {
    id: 'ev-002',
    idolId: 'blackpink',
    idolName: 'BLACKPINK',
    title: 'BLACKPINK 新專輯《REBIRTH》全球發行',
    type: 'release',
    date: d(7),
    time: '00:00',
    country: '全球',
    countryFlag: '🌍',
    source: 'official',
    sourceLabel: '@BLACKPINK',
    description: '睽違兩年的全新正規專輯《REBIRTH》正式發行，主打歌 MV 同步上線。',
    isFavorited: false,
    tags: ['新專輯', '全球', '回歸'],
    confirmed: true,
  },
  {
    id: 'ev-003',
    idolId: 'aespa',
    idolName: 'aespa',
    title: 'aespa SYNK: PARALLEL LINE 世界巡演 – 首爾',
    type: 'concert',
    date: d(10),
    time: '18:30',
    location: '首爾 KSPO DOME',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: 'official',
    sourceLabel: 'SM Entertainment',
    description: 'aespa 首次世界巡演首爾場，融合 AR 技術與 ae 世界觀打造沉浸式演出。',
    isFavorited: true,
    ticketUrl: '#',
    tags: ['世界巡演', '首爾', 'AR舞台'],
    confirmed: true,
  },
  {
    id: 'ev-004',
    idolId: 'ive',
    idolName: 'IVE',
    title: 'IVE 台灣粉絲見面會',
    type: 'fanmeet',
    date: d(14),
    time: '14:00',
    location: '台北流行音樂中心',
    country: '台灣',
    countryFlag: '🇹🇼',
    source: 'official',
    sourceLabel: 'Starship Entertainment',
    description: 'IVE 六位成員親赴台北，與台灣粉絲近距離互動，現場遊戲環節特別豐富。',
    isFavorited: true,
    ticketUrl: '#',
    tags: ['台北', '粉絲見面', '六人'],
    confirmed: true,
  },
  {
    id: 'ev-005',
    idolId: 'newjeans',
    idolName: 'NewJeans',
    title: 'NewJeans《Supernatural》日版 MV 發行',
    type: 'release',
    date: d(1),
    time: '12:00',
    country: '日本',
    countryFlag: '🇯🇵',
    source: 'official',
    sourceLabel: '@NewJeans_ADOR',
    description: '《Supernatural》日本語版 MV 全平台同步上線，附加幕後拍攝特輯。',
    isFavorited: false,
    tags: ['日語版', 'MV', 'Supernatural'],
    confirmed: true,
  },
  {
    id: 'ev-006',
    idolId: 'bts',
    idolName: 'BTS',
    title: 'BTS j-hope《HOPE ON THE STAGE》Weverse Con',
    type: 'concert',
    date: d(5),
    time: '20:00',
    location: 'Weverse Live',
    country: '線上',
    countryFlag: '💻',
    source: 'official',
    sourceLabel: 'HYBE',
    description: 'j-hope 個人線上演唱會，延續《HOPE ON THE STAGE》世界巡演能量。',
    isFavorited: true,
    ticketUrl: '#',
    tags: ['線上', 'j-hope', '個人場'],
    confirmed: true,
  },
  {
    id: 'ev-007',
    idolId: 'stray-kids',
    idolName: 'Stray Kids',
    title: 'Stray Kids MANIAC WORLD TOUR – 新加坡',
    type: 'concert',
    date: d(18),
    time: '19:30',
    location: 'Singapore Indoor Stadium',
    country: '新加坡',
    countryFlag: '🇸🇬',
    source: 'official',
    sourceLabel: 'JYP Entertainment',
    description: 'MANIAC WORLD TOUR 東南亞巡演新加坡場，八人強勢登台。',
    isFavorited: false,
    ticketUrl: '#',
    tags: ['新加坡', '世界巡演', '東南亞'],
    confirmed: true,
  },
  {
    id: 'ev-008',
    idolId: 'twice',
    idolName: 'TWICE',
    title: 'TWICE 出演《人氣歌謠》特別舞台',
    type: 'musicshow',
    date: d(2),
    time: '17:00',
    location: 'SBS 公開錄影',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: 'verified',
    sourceLabel: '@@twiceupdates_',
    description: 'TWICE 確認出演本週《人氣歌謠》，預計演唱新回歸主打歌。',
    isFavorited: false,
    tags: ['音樂節目', '人氣歌謠', '回歸宣傳'],
    confirmed: true,
  },
  {
    id: 'ev-009',
    idolId: 'le-sserafim',
    idolName: 'LE SSERAFIM',
    title: 'LE SSERAFIM 香港簽名會',
    type: 'fansign',
    date: d(21),
    time: '13:00',
    location: '香港 APM 購物中心',
    country: '香港',
    countryFlag: '🇭🇰',
    source: 'community',
    sourceLabel: 'lsf_hk_fans',
    description: '粉絲社群整理資訊，官方尚未公告，香港場簽名會消息仍待確認。',
    isFavorited: false,
    tags: ['香港', '簽名會', '待確認'],
    confirmed: false,
  },
  {
    id: 'ev-010',
    idolId: 'aespa',
    idolName: 'aespa',
    title: 'aespa 出演《Running Man》特別企劃',
    type: 'variety',
    date: d(9),
    time: '21:00',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: 'verified',
    sourceLabel: 'SBS 官方預告',
    description: 'aespa 確認出演 Running Man 特別企劃，播出時間暫定週日晚間。',
    isFavorited: false,
    tags: ['Running Man', '綜藝', '四人'],
    confirmed: true,
  },
  {
    id: 'ev-011',
    idolId: 'exo',
    idolName: 'EXO',
    title: 'EXO 十週年特別展覽 – 首爾',
    type: 'fanmeet',
    date: d(25),
    time: '10:00',
    location: 'SM TOWN COEX Artium',
    country: '韓國',
    countryFlag: '🇰🇷',
    source: 'official',
    sourceLabel: 'SM Entertainment',
    description: 'EXO 十週年紀念展覽，展出出道十年珍貴舞台照、手稿與親筆簽名。',
    isFavorited: false,
    tags: ['十週年', '展覽', '首爾'],
    confirmed: true,
  },
  {
    id: 'ev-012',
    idolId: 'txt',
    idolName: 'TXT',
    title: 'TXT 新曲《Chasing》MV 首播直播',
    type: 'release',
    date: d(0),
    time: '18:00',
    country: '全球',
    countryFlag: '🌍',
    source: 'official',
    sourceLabel: '@TXT_bighit',
    description: '今日 18:00 全球同步在 YouTube 首播新曲《Chasing》MV，官方直播互動。',
    isFavorited: true,
    tags: ['新曲', 'MV首播', '今日'],
    confirmed: true,
  },
  {
    id: 'ev-013',
    idolId: 'blackpink',
    idolName: 'BLACKPINK',
    title: 'BLACKPINK Jennie 個人 Weverse 直播',
    type: 'variety',
    date: d(0),
    time: '22:00',
    country: '線上',
    countryFlag: '💻',
    source: 'community',
    sourceLabel: 'jennie_update',
    description: '粉絲帳號消息，Jennie 暗示今晚或有 Weverse 直播，官方未公告。',
    isFavorited: false,
    tags: ['Jennie', '直播', '待確認'],
    confirmed: false,
  },
  {
    id: 'ev-014',
    idolId: 'bts',
    idolName: 'BTS',
    title: 'BTS Jimin《MUSE》亞洲宣傳採訪 – 台灣媒體',
    type: 'interview',
    date: d(4),
    time: '14:00',
    location: '台北',
    country: '台灣',
    countryFlag: '🇹🇼',
    source: 'unverified',
    sourceLabel: '匿名消息',
    description: '尚未從可靠來源確認，消息指 Jimin 將於本週赴台接受媒體採訪。',
    isFavorited: false,
    tags: ['Jimin', '採訪', '待確認'],
    confirmed: false,
  },
  {
    id: 'ev-015',
    idolId: 'newjeans',
    idolName: 'NewJeans',
    title: 'NewJeans 馬來西亞粉絲見面會 – 吉隆坡',
    type: 'fanmeet',
    date: d(30),
    time: '15:00',
    location: 'Axiata Arena 吉隆坡',
    country: '馬來西亞',
    countryFlag: '🇲🇾',
    source: 'official',
    sourceLabel: 'ADOR',
    description: 'NewJeans 東南亞巡演吉隆坡站，為本次亞洲粉絲見面會最終場。',
    isFavorited: false,
    ticketUrl: '#',
    tags: ['吉隆坡', '東南亞', '巡演最終場'],
    confirmed: true,
  },
]

export function getEventById(id: string): IdolEvent | undefined {
  return MOCK_EVENTS.find((e) => e.id === id)
}

export function getEventsByIdol(idolId: string): IdolEvent[] {
  return MOCK_EVENTS.filter((e) => e.idolId === idolId)
}

export function getTodayEvents(): IdolEvent[] {
  const today = new Date()
  return MOCK_EVENTS.filter((e) => {
    const d = new Date(e.date)
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    )
  })
}

export function getUpcomingEvents(days = 14): IdolEvent[] {
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() + days)
  return MOCK_EVENTS.filter((e) => {
    const d = new Date(e.date)
    return d >= now && d <= cutoff
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function getFavoritedEvents(): IdolEvent[] {
  return MOCK_EVENTS.filter((e) => e.isFavorited)
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
