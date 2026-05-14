export type IdolType = 'group' | 'solo'

export interface Idol {
  id: string
  name: string
  koreanName: string
  type: IdolType
  agency: string
  debut: string
  color: string
  gradient: string
  genres: string[]
  memberCount?: number
  following: boolean
  description: string
}

export const MOCK_IDOLS: Idol[] = [
  {
    id: 'bts',
    name: 'BTS',
    koreanName: '방탄소년단',
    type: 'group',
    agency: 'HYBE / BigHit Music',
    debut: '2013',
    color: '#7c3aed',
    gradient: 'from-violet-900 to-purple-700',
    genres: ['K-Pop', '嘻哈', '流行'],
    memberCount: 7,
    following: true,
    description: '全球最具影響力的 K-Pop 男團，成員 RM、Jin、SUGA、j-hope、Jimin、V、Jung Kook。',
  },
  {
    id: 'blackpink',
    name: 'BLACKPINK',
    koreanName: '블랙핑크',
    type: 'group',
    agency: 'YG Entertainment',
    debut: '2016',
    color: '#ec4899',
    gradient: 'from-pink-900 to-rose-700',
    genres: ['K-Pop', '電子流行'],
    memberCount: 4,
    following: true,
    description: 'YG 旗下頂尖女團，成員 Jisoo、Jennie、Rosé、Lisa，風靡全球。',
  },
  {
    id: 'aespa',
    name: 'aespa',
    koreanName: '에스파',
    type: 'group',
    agency: 'SM Entertainment',
    debut: '2020',
    color: '#06b6d4',
    gradient: 'from-cyan-900 to-teal-700',
    genres: ['K-Pop', '未來流行', '電子'],
    memberCount: 4,
    following: true,
    description: 'SM 旗下概念最前衛的女團，結合現實與虛擬 AI 敘事宇宙。',
  },
  {
    id: 'newjeans',
    name: 'NewJeans',
    koreanName: '뉴진스',
    type: 'group',
    agency: 'ADOR / HYBE',
    debut: '2022',
    color: '#3b82f6',
    gradient: 'from-blue-900 to-indigo-700',
    genres: ['K-Pop', '青春', 'Y2K'],
    memberCount: 5,
    following: false,
    description: '引領 Y2K 復古美學的新生代女團，以清新感與獨特音樂性迅速走紅。',
  },
  {
    id: 'stray-kids',
    name: 'Stray Kids',
    koreanName: '스트레이 키즈',
    type: 'group',
    agency: 'JYP Entertainment',
    debut: '2018',
    color: '#f59e0b',
    gradient: 'from-amber-900 to-orange-700',
    genres: ['K-Pop', '嘻哈', '搖滾'],
    memberCount: 8,
    following: false,
    description: '以自製曲 3RACHA 聞名，強烈個人風格的男團，自主創作能力超強。',
  },
  {
    id: 'ive',
    name: 'IVE',
    koreanName: '아이브',
    type: 'group',
    agency: 'Starship Entertainment',
    debut: '2021',
    color: '#10b981',
    gradient: 'from-emerald-900 to-green-700',
    genres: ['K-Pop', '流行'],
    memberCount: 6,
    following: true,
    description: '以 ELEVEN、Love Dive 等大熱單曲橫掃各大榜單，清爽高雅的概念。',
  },
  {
    id: 'twice',
    name: 'TWICE',
    koreanName: '트와이스',
    type: 'group',
    agency: 'JYP Entertainment',
    debut: '2015',
    color: '#f97316',
    gradient: 'from-orange-900 to-red-700',
    genres: ['K-Pop', '流行', '舞蹈'],
    memberCount: 9,
    following: false,
    description: '以「一眼難忘」視覺與朗朗上口旋律聞名的九人女團，日韓台三國成員。',
  },
  {
    id: 'le-sserafim',
    name: 'LE SSERAFIM',
    koreanName: '르세라핌',
    type: 'group',
    agency: 'SOURCE MUSIC / HYBE',
    debut: '2022',
    color: '#eab308',
    gradient: 'from-yellow-900 to-amber-700',
    genres: ['K-Pop', '電子流行'],
    memberCount: 5,
    following: false,
    description: '強調「無畏」精神的女團，視覺與舞台表現力備受矚目。',
  },
  {
    id: 'txt',
    name: 'TXT',
    koreanName: '투모로우바이투게더',
    type: 'group',
    agency: 'HYBE / BigHit Music',
    debut: '2019',
    color: '#a855f7',
    gradient: 'from-purple-900 to-fuchsia-700',
    genres: ['K-Pop', '另類流行'],
    memberCount: 5,
    following: false,
    description: 'HYBE 第二個男團，以夢幻、青春與奇幻世界觀構建獨特音樂宇宙。',
  },
  {
    id: 'exo',
    name: 'EXO',
    koreanName: '엑소',
    type: 'group',
    agency: 'SM Entertainment',
    debut: '2012',
    color: '#ef4444',
    gradient: 'from-red-900 to-rose-700',
    genres: ['K-Pop', '流行', 'R&B'],
    memberCount: 9,
    following: false,
    description: '第三代 K-Pop 的代表男團，以行星超能力世界觀與強大舞台震撼出道。',
  },
]

export function getFollowingIdols(): Idol[] {
  return MOCK_IDOLS.filter((idol) => idol.following)
}

export function getIdolById(id: string): Idol | undefined {
  return MOCK_IDOLS.find((idol) => idol.id === id)
}
