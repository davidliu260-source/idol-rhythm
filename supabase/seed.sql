-- =============================================================================
-- Idol Rhythm — Seed Data
-- Ref     : src/lib/mockIdols.ts + src/lib/mockEvents.ts
-- Created : 2026-05-14
--
-- Contents:
--   10 idols
--   21 events  (trust_level official / media → is_published = TRUE)
--   21 event_sources (one per published event)
--    3 event_candidates (trust_level pending → not published)
--
-- ⚠️  DEMO DATA — not real official schedules. Do not use as a source of truth.
-- ⚠️  Dates are fixed relative to 2026-05-14 (seed creation date).
--     Events with past dates will appear in the archive section of the frontend.
--
-- Usage: paste into Supabase SQL Editor and run.
-- The seed is idempotent — ON CONFLICT (id) DO NOTHING prevents duplicate errors.
-- =============================================================================

BEGIN;


-- =============================================================================
-- SECTION 1: IDOLS (10 rows)
-- Fixed UUIDs: 10000000-0000-4000-8000-0000000000{01..10}
-- =============================================================================

INSERT INTO idols (
  id, slug, name, korean_name,
  type, gender, category, agency, debut_date,
  color, gradient, genres, member_count,
  description, is_active
) VALUES

-- 01: BTS
(
  '10000000-0000-4000-8000-000000000001',
  'bts', 'BTS', '방탄소년단',
  'group', 'male', 'kpop', 'HYBE / BigHit Music', '2013-06-13',
  '#7c3aed', 'from-violet-900 to-purple-700',
  ARRAY['K-Pop', '嘻哈', '流行'], 7,
  '全球最具影響力的 K-Pop 男團，成員 RM、Jin、SUGA、j-hope、Jimin、V、Jung Kook。',
  TRUE
),

-- 02: BLACKPINK
(
  '10000000-0000-4000-8000-000000000002',
  'blackpink', 'BLACKPINK', '블랙핑크',
  'group', 'female', 'kpop', 'YG Entertainment', '2016-08-08',
  '#ec4899', 'from-pink-900 to-rose-700',
  ARRAY['K-Pop', '電子流行'], 4,
  'YG 旗下頂尖女團，成員 Jisoo、Jennie、Rosé、Lisa，風靡全球。',
  TRUE
),

-- 03: aespa
(
  '10000000-0000-4000-8000-000000000003',
  'aespa', 'aespa', '에스파',
  'group', 'female', 'kpop', 'SM Entertainment', '2020-11-17',
  '#06b6d4', 'from-cyan-900 to-teal-700',
  ARRAY['K-Pop', '未來流行', '電子'], 4,
  'SM 旗下概念最前衛的女團，結合現實與虛擬 AI 敘事宇宙。',
  TRUE
),

-- 04: NewJeans
(
  '10000000-0000-4000-8000-000000000004',
  'newjeans', 'NewJeans', '뉴진스',
  'group', 'female', 'kpop', 'ADOR / HYBE', '2022-07-22',
  '#3b82f6', 'from-blue-900 to-indigo-700',
  ARRAY['K-Pop', '青春', 'Y2K'], 5,
  '引領 Y2K 復古美學的新生代女團，以清新感與獨特音樂性迅速走紅。',
  TRUE
),

-- 05: Stray Kids
(
  '10000000-0000-4000-8000-000000000005',
  'stray-kids', 'Stray Kids', '스트레이 키즈',
  'group', 'male', 'kpop', 'JYP Entertainment', '2018-03-25',
  '#f59e0b', 'from-amber-900 to-orange-700',
  ARRAY['K-Pop', '嘻哈', '搖滾'], 8,
  '以自製曲 3RACHA 聞名，強烈個人風格的男團，自主創作能力超強。',
  TRUE
),

-- 06: IVE
(
  '10000000-0000-4000-8000-000000000006',
  'ive', 'IVE', '아이브',
  'group', 'female', 'kpop', 'Starship Entertainment', '2021-12-01',
  '#10b981', 'from-emerald-900 to-green-700',
  ARRAY['K-Pop', '流行'], 6,
  '以 ELEVEN、Love Dive 等大熱單曲橫掃各大榜單，清爽高雅的概念。',
  TRUE
),

-- 07: TWICE
(
  '10000000-0000-4000-8000-000000000007',
  'twice', 'TWICE', '트와이스',
  'group', 'female', 'kpop', 'JYP Entertainment', '2015-10-20',
  '#f97316', 'from-orange-900 to-red-700',
  ARRAY['K-Pop', '流行', '舞蹈'], 9,
  '以「一眼難忘」視覺與朗朗上口旋律聞名的九人女團，日韓台三國成員。',
  TRUE
),

-- 08: LE SSERAFIM
(
  '10000000-0000-4000-8000-000000000008',
  'le-sserafim', 'LE SSERAFIM', '르세라핌',
  'group', 'female', 'kpop', 'SOURCE MUSIC / HYBE', '2022-05-02',
  '#eab308', 'from-yellow-900 to-amber-700',
  ARRAY['K-Pop', '電子流行'], 5,
  '強調「無畏」精神的女團，視覺與舞台表現力備受矚目。',
  TRUE
),

-- 09: TXT
(
  '10000000-0000-4000-8000-000000000009',
  'txt', 'TXT', '투모로우바이투게더',
  'group', 'male', 'kpop', 'HYBE / BigHit Music', '2019-03-04',
  '#a855f7', 'from-purple-900 to-fuchsia-700',
  ARRAY['K-Pop', '另類流行'], 5,
  'HYBE 第二個男團，以夢幻、青春與奇幻世界觀構建獨特音樂宇宙。',
  TRUE
),

-- 10: EXO
(
  '10000000-0000-4000-8000-000000000010',
  'exo', 'EXO', '엑소',
  'group', 'male', 'kpop', 'SM Entertainment', '2012-04-08',
  '#ef4444', 'from-red-900 to-rose-700',
  ARRAY['K-Pop', '流行', 'R&B'], 9,
  '第三代 K-Pop 的代表男團，以行星超能力世界觀與強大舞台震撼出道。',
  TRUE
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- SECTION 2: EVENTS (21 published rows)
-- trust_level = official | media; is_published = TRUE
-- Fixed UUIDs: 20000000-0000-4000-8000-0000000000{01..24}
--   (gaps in numbering match the original ev-XXX IDs from mock data)
-- ⚠️  ticket_url / stream_url use '#' as demo placeholder — replace before launch
-- =============================================================================

INSERT INTO events (
  id, idol_id, idol_name,
  title, type, sub_type, status, trust_level,
  date, time, location, country, country_flag,
  description, tags,
  ticket_url, stream_url,
  is_published, published_at
) VALUES

-- ── 演唱會 / 見面會 ────────────────────────────────────────────────────────────

-- ev-001: BTS 台北演唱會
(
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'BTS',
  'BTS PERMISSION TO DANCE ON STAGE – 台北',
  'concert', NULL, 'confirmed', 'official',
  '2026-05-17', '19:00', '台北小巨蛋', '台灣', '🇹🇼',
  'BTS 台北場演唱會，七人完整陣容重磅回歸亞洲巡演首站。',
  ARRAY['台北', '演唱會', '七人完整陣容'],
  '#', NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-003: aespa 首爾巡演
(
  '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000003', 'aespa',
  'aespa SYNK: PARALLEL LINE 世界巡演 – 首爾',
  'concert', NULL, 'confirmed', 'official',
  '2026-05-24', '18:30', '首爾 KSPO DOME', '韓國', '🇰🇷',
  'aespa 首次世界巡演首爾場，融合 AR 技術與 ae 世界觀打造沉浸式演出。',
  ARRAY['世界巡演', '首爾', 'AR舞台'],
  '#', NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-004: IVE 台灣粉絲見面會
(
  '20000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000006', 'IVE',
  'IVE 台灣粉絲見面會',
  'concert', 'fanmeet', 'confirmed', 'official',
  '2026-05-28', '14:00', '台北流行音樂中心', '台灣', '🇹🇼',
  'IVE 六位成員親赴台北，與台灣粉絲近距離互動，現場遊戲環節特別豐富。',
  ARRAY['台北', '粉絲見面', '六人'],
  '#', NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-006: BTS j-hope 線上演唱會
(
  '20000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000001', 'BTS',
  'BTS j-hope《HOPE ON THE STAGE》Weverse Con',
  'concert', NULL, 'confirmed', 'official',
  '2026-05-19', '20:00', 'Weverse Live', '線上', '💻',
  'j-hope 個人線上演唱會，延續《HOPE ON THE STAGE》世界巡演能量。',
  ARRAY['線上', 'j-hope', '個人場'],
  '#', NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-007: Stray Kids 新加坡巡演
(
  '20000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000005', 'Stray Kids',
  'Stray Kids MANIAC WORLD TOUR – 新加坡',
  'concert', NULL, 'confirmed', 'official',
  '2026-06-01', '19:30', 'Singapore Indoor Stadium', '新加坡', '🇸🇬',
  'MANIAC WORLD TOUR 東南亞巡演新加坡場，八人強勢登台。',
  ARRAY['新加坡', '世界巡演', '東南亞'],
  '#', NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-011: EXO 十週年展覽
(
  '20000000-0000-4000-8000-000000000011',
  '10000000-0000-4000-8000-000000000010', 'EXO',
  'EXO 十週年特別展覽 – 首爾',
  'concert', 'fanmeet', 'confirmed', 'official',
  '2026-06-08', '10:00', 'SM TOWN COEX Artium', '韓國', '🇰🇷',
  'EXO 十週年紀念展覽，展出出道十年珍貴舞台照、手稿與親筆簽名。',
  ARRAY['十週年', '展覽', '首爾'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-015: NewJeans 馬來西亞粉絲見面會
(
  '20000000-0000-4000-8000-000000000015',
  '10000000-0000-4000-8000-000000000004', 'NewJeans',
  'NewJeans 馬來西亞粉絲見面會 – 吉隆坡',
  'concert', 'fanmeet', 'confirmed', 'official',
  '2026-06-13', '15:00', 'Axiata Arena 吉隆坡', '馬來西亞', '🇲🇾',
  'NewJeans 東南亞巡演吉隆坡站，為本次亞洲粉絲見面會最終場。',
  ARRAY['吉隆坡', '東南亞', '巡演最終場'],
  '#', NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ── 開票售票 ──────────────────────────────────────────────────────────────────

-- ev-016: BTS 台北演唱會開票
(
  '20000000-0000-4000-8000-000000000016',
  '10000000-0000-4000-8000-000000000001', 'BTS',
  'BTS 台北演唱會正式開票 · PERMISSION TO DANCE',
  'ticketing', NULL, 'confirmed', 'official',
  '2026-05-15', '12:00', '台北小巨蛋', '台灣', '🇹🇼',
  'BTS 台北小巨蛋演唱會今日 12:00 正式開票，一般席與 ARMY 預購票同步開搶，請備妥購票帳號。',
  ARRAY['開票', '台北', 'PERMISSION TO DANCE'],
  '#', NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-022: TWICE 台北演唱會開票
(
  '20000000-0000-4000-8000-000000000022',
  '10000000-0000-4000-8000-000000000007', 'TWICE',
  'TWICE READY TO BE 台北場正式開票',
  'ticketing', NULL, 'confirmed', 'official',
  '2026-05-25', '12:00', '台北小巨蛋', '台灣', '🇹🇼',
  'TWICE 台北演唱會全區開票，熱門場次預計秒殺，建議提前備妥購票帳號與信用卡。',
  ARRAY['開票', '台北', 'READY TO BE'],
  '#', NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ── 直播 ──────────────────────────────────────────────────────────────────────

-- ev-017: BLACKPINK Weverse 直播
(
  '20000000-0000-4000-8000-000000000017',
  '10000000-0000-4000-8000-000000000002', 'BLACKPINK',
  'BLACKPINK《REBIRTH》回歸直播 · Weverse',
  'livestream', NULL, 'confirmed', 'official',
  '2026-05-20', '21:00', NULL, '線上', '💻',
  '《REBIRTH》專輯發行週，四人齊聚 Weverse 進行回歸直播，與全球 BLINK 同慶新專輯。',
  ARRAY['Weverse直播', 'REBIRTH', '回歸'],
  NULL, '#', TRUE, '2026-05-14 00:00:00+00'
),

-- ev-023: TXT YouTube 直播 Q&A
(
  '20000000-0000-4000-8000-000000000023',
  '10000000-0000-4000-8000-000000000009', 'TXT',
  'TXT《Chasing》發行特別直播 Q&A',
  'livestream', NULL, 'confirmed', 'official',
  '2026-05-15', '20:00', NULL, '線上', '💻',
  'TXT 新曲《Chasing》發行隔日，五人齊聚 YouTube 官方頻道進行直播，現場即時回答粉絲提問。',
  ARRAY['YouTube直播', 'Q&A', 'Chasing'],
  NULL, '#', TRUE, '2026-05-14 00:00:00+00'
),

-- ── 串流 ──────────────────────────────────────────────────────────────────────

-- ev-018: aespa Netflix 紀錄片
(
  '20000000-0000-4000-8000-000000000018',
  '10000000-0000-4000-8000-000000000003', 'aespa',
  'aespa《Into the æ-WORLD》紀錄片 Netflix 上線',
  'streaming', NULL, 'confirmed', 'media',
  '2026-05-26', '08:00', NULL, '全球', '🌍',
  'aespa 首部幕後紀錄片《Into the æ-WORLD》於 Netflix 全球同步上線，揭露世界巡演籌備幕後。',
  ARRAY['Netflix', '紀錄片', '幕後特輯'],
  NULL, '#', TRUE, '2026-05-14 00:00:00+00'
),

-- ── 媒體 ──────────────────────────────────────────────────────────────────────

-- ev-008: TWICE 人氣歌謠
(
  '20000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000007', 'TWICE',
  'TWICE 出演《人氣歌謠》特別舞台',
  'media', 'musicshow', 'confirmed', 'media',
  '2026-05-16', '17:00', 'SBS 公開錄影', '韓國', '🇰🇷',
  'TWICE 確認出演本週《人氣歌謠》，預計演唱新回歸主打歌。',
  ARRAY['音樂節目', '人氣歌謠', '回歸宣傳'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-010: aespa Running Man
(
  '20000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000003', 'aespa',
  'aespa 出演《Running Man》特別企劃',
  'media', 'variety', 'confirmed', 'media',
  '2026-05-23', '21:00', NULL, '韓國', '🇰🇷',
  'aespa 確認出演 Running Man 特別企劃，播出時間暫定週日晚間。',
  ARRAY['Running Man', '綜藝', '四人'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-019: IVE VOGUE KOREA 封面
(
  '20000000-0000-4000-8000-000000000019',
  '10000000-0000-4000-8000-000000000006', 'IVE',
  'IVE × VOGUE KOREA 六月號封面特輯',
  'media', 'magazine', 'confirmed', 'official',
  '2026-05-22', '10:00', NULL, '韓國', '🇰🇷',
  'IVE 六人全員登上《VOGUE Korea》六月號封面，主題「In Full Bloom」，收錄獨家採訪。',
  ARRAY['VOGUE', '雜誌封面', '六月號'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-024: Stray Kids Harper's Bazaar 封面
(
  '20000000-0000-4000-8000-000000000024',
  '10000000-0000-4000-8000-000000000005', 'Stray Kids',
  'Stray Kids × Harper''s Bazaar Korea 七月號封面',
  'media', 'magazine', 'confirmed', 'media',
  '2026-05-29', '10:00', NULL, '韓國', '🇰🇷',
  'Stray Kids 登上《Harper''s Bazaar Korea》七月號封面，主題「Untamed」，收錄獨家採訪。',
  ARRAY['時尚雜誌', '封面', 'Harper''s Bazaar'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ── 代言品牌 ──────────────────────────────────────────────────────────────────

-- ev-020: LE SSERAFIM × PUMA 台北快閃
(
  '20000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000008', 'LE SSERAFIM',
  'LE SSERAFIM × PUMA 台北快閃店',
  'brand', NULL, 'confirmed', 'official',
  '2026-05-30', '11:00', '台北信義區 PUMA 旗艦店', '台灣', '🇹🇼',
  'LE SSERAFIM 與 PUMA 合作快閃店於台北信義區盛大開幕，展出聯名系列並設互動打卡區，限量周邊現場贈送。',
  ARRAY['PUMA', '品牌合作', '快閃', '台北'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ── 官方發布 ──────────────────────────────────────────────────────────────────

-- ev-002: BLACKPINK 新專輯《REBIRTH》
(
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002', 'BLACKPINK',
  'BLACKPINK 新專輯《REBIRTH》全球發行',
  'official', 'release', 'confirmed', 'official',
  '2026-05-21', '00:00', NULL, '全球', '🌍',
  '睽違兩年的全新正規專輯《REBIRTH》正式發行，主打歌 MV 同步上線。',
  ARRAY['新專輯', '全球', '回歸'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-005: NewJeans《Supernatural》日版 MV
(
  '20000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000004', 'NewJeans',
  'NewJeans《Supernatural》日版 MV 發行',
  'official', 'release', 'confirmed', 'official',
  '2026-05-15', '12:00', NULL, '日本', '🇯🇵',
  '《Supernatural》日本語版 MV 全平台同步上線，附加幕後拍攝特輯。',
  ARRAY['日語版', 'MV', 'Supernatural'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-012: TXT《Chasing》MV 首播
(
  '20000000-0000-4000-8000-000000000012',
  '10000000-0000-4000-8000-000000000009', 'TXT',
  'TXT 新曲《Chasing》MV 首播直播',
  'official', 'release', 'confirmed', 'official',
  '2026-05-14', '18:00', NULL, '全球', '🌍',
  '今日 18:00 全球同步在 YouTube 首播新曲《Chasing》MV，官方直播互動。',
  ARRAY['新曲', 'MV首播', '今日'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
),

-- ev-021: NewJeans 正規二輯公告
(
  '20000000-0000-4000-8000-000000000021',
  '10000000-0000-4000-8000-000000000004', 'NewJeans',
  'NewJeans 正規二輯《NJWMN》發行計畫公告',
  'official', 'announcement', 'confirmed', 'official',
  '2026-05-16', '09:00', NULL, '全球', '🌍',
  'ADOR 官方公告 NewJeans 第二張正規專輯《NJWMN》預計下季發行，同步公開宣傳排程預告與概念圖。',
  ARRAY['官方公告', '新專輯', 'NJWMN'],
  NULL, NULL, TRUE, '2026-05-14 00:00:00+00'
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- SECTION 3: EVENT_SOURCES (21 rows, one per published event)
-- Fixed UUIDs: 30000000-0000-4000-8000-0000000000{XX} — matches event numbering
-- =============================================================================

INSERT INTO event_sources (
  id, event_id, level, label, type, url
) VALUES

-- ev-001
('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  'official', '@BTS_official', 'official_sns', NULL),

-- ev-003
('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003',
  'official', 'SM Entertainment', 'official_website', NULL),

-- ev-004
('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004',
  'official', 'Starship Entertainment', 'official_website', NULL),

-- ev-006
('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006',
  'official', 'HYBE', 'official_website', NULL),

-- ev-007
('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000007',
  'official', 'JYP Entertainment', 'official_website', NULL),

-- ev-011
('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000011',
  'official', 'SM Entertainment', 'official_website', NULL),

-- ev-015
('30000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000015',
  'official', 'ADOR', 'official_website', NULL),

-- ev-016
('30000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000016',
  'official', 'HYBE 官方', 'official_website', NULL),

-- ev-022
('30000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000022',
  'official', 'JYP Entertainment', 'official_website', NULL),

-- ev-017
('30000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000017',
  'official', '@BLACKPINK', 'official_sns', NULL),

-- ev-023
('30000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000023',
  'official', '@TXT_bighit', 'official_sns', NULL),

-- ev-018
('30000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000018',
  'media', 'Netflix Korea', 'media_outlet', NULL),

-- ev-008
('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000008',
  'media', '@twiceupdates_', 'fan_account', NULL),

-- ev-010
('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000010',
  'media', 'SBS 官方預告', 'media_outlet', NULL),

-- ev-019
('30000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000019',
  'official', 'VOGUE KOREA', 'media_outlet', NULL),

-- ev-024
('30000000-0000-4000-8000-000000000024', '20000000-0000-4000-8000-000000000024',
  'media', 'Harper''s Bazaar Korea', 'media_outlet', NULL),

-- ev-020
('30000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000020',
  'official', 'PUMA Taiwan', 'official_sns', NULL),

-- ev-002
('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
  'official', '@BLACKPINK', 'official_sns', NULL),

-- ev-005
('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005',
  'official', '@NewJeans_ADOR', 'official_sns', NULL),

-- ev-012
('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000012',
  'official', '@TXT_bighit', 'official_sns', NULL),

-- ev-021
('30000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000021',
  'official', '@NewJeans_ADOR', 'official_sns', NULL)

ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- SECTION 4: EVENT_CANDIDATES (3 rows, trust_level = pending)
-- These are NOT published. They await admin review before graduating to events.
-- Fixed UUIDs: 40000000-0000-4000-8000-00000000000{1..3}
-- =============================================================================

INSERT INTO event_candidates (
  id,
  raw_title, raw_content,
  detected_idol_id, detected_event_type, detected_date,
  source_name, source_type,
  ai_confidence, review_status, reviewer_note
) VALUES

-- ev-009: LE SSERAFIM 香港簽名會（社群消息，待確認）
(
  '40000000-0000-4000-8000-000000000001',
  'LE SSERAFIM 香港簽名會',
  '粉絲社群整理資訊，官方尚未公告，香港場簽名會消息仍待確認。',
  '10000000-0000-4000-8000-000000000008', -- le-sserafim
  'concert',
  '2026-06-04',
  'lsf_hk_fans', 'community',
  0.35, 'pending', '社群消息，官方未公告，需等待 SM / SOURCE MUSIC 確認後再 approve'
),

-- ev-013: BLACKPINK Jennie 個人直播（粉絲帳號消息）
(
  '40000000-0000-4000-8000-000000000002',
  'BLACKPINK Jennie 個人 Weverse 直播',
  '粉絲帳號消息，Jennie 暗示今晚或有 Weverse 直播，官方未公告。',
  '10000000-0000-4000-8000-000000000002', -- blackpink
  'livestream',
  '2026-05-14',
  'jennie_update', 'community',
  0.40, 'pending', '非官方消息，信心低；若未發生可直接 reject'
),

-- ev-014: BTS Jimin 台灣媒體採訪（匿名消息）
(
  '40000000-0000-4000-8000-000000000003',
  'BTS Jimin《MUSE》亞洲宣傳採訪 – 台灣媒體',
  '尚未從可靠來源確認，消息指 Jimin 將於本週赴台接受媒體採訪。',
  '10000000-0000-4000-8000-000000000001', -- bts
  'media',
  '2026-05-18',
  '匿名消息', 'unknown',
  0.20, 'pending', '匿名消息，信心極低；需官方媒體確認後再考慮 approve'
)

ON CONFLICT (id) DO NOTHING;


COMMIT;


-- =============================================================================
-- SEED SUMMARY
-- =============================================================================
--
--  Idols          : 10
--  Events         : 21  (is_published = TRUE, trust_level official / media)
--  Event sources  : 21  (one per published event)
--  Candidates     : 3   (trust_level pending, review_status = pending)
--
--  ⚠️  Before running this seed, confirm:
--  [ ] 1. initial schema migration (001_initial_schema.sql) has been executed
--  [ ] 2. All 10 enum types exist in the database
--  [ ] 3. ticket_url / stream_url '#' placeholders are acceptable for demo
--  [ ] 4. debut_date values are approximate (based on publicly known info)
--         and should be verified before using as authoritative data
--  [ ] 5. Dates are fixed relative to 2026-05-14; events before today will
--         appear as past events in the frontend timeline
--
-- =============================================================================
