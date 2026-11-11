-- =============================================================================
-- Idol Rhythm -- Seed mainstream / overlooked artists (Phase M1b-4)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   Per MAINSTREAM_ARTIST_SEED_WORK_ORDER.md (PR #81 merged), seed 16
--   mainstream artists that were not covered by migrations 034 / 036 / 038.
--
--   P0 artists (highest priority, agencies confirmed):
--     Lee Young Ji, QWER, BIBI, Jay Park, Chungha, Sunmi, Baekhyun
--
--   P1 artists (confirmed agencies):
--     Jannabi, Epik High, Dynamicduo, Crush, Heize, Dean, Paul Kim
--
--   P2 artists with confirmed agencies:
--     Jo Yuri (WAKEONE), DAESUNG (R&D Company / D-LABLE)
--
--   Skipped (agency uncertain at time of migration):
--     Lee Mujin (BPM contract dispute), 10CM (Magic Strawberry Sound /
--     POCLANOS former-artist signal), Kwon Eunbi (Woollim departure /
--     new agency TBD), T.O.P (TOPSPOT PICTURES uncertain), YENA
--     (Yuehua / YH rebrand uncertain).
--
-- CHANGES
--   - INSERT 16 idol rows
--   - No schema changes
--   - No GRANT / RLS changes
--   - No crawler_sources changes
--
-- IDEMPOTENCE
--   All INSERTs use ON CONFLICT (slug) DO NOTHING.
--   Existing rows (avatar / description / color set by admin) are never
--   overwritten. Running this migration a second time is safe.
--
-- DEPENDENCY
--   Must be run AFTER:
--     028_add_idol_alt_names.sql  (provides alt_names column)
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--
-- REVIEW CHECKLIST
--   [ ] Confirm 16 new rows were inserted (not skipped by ON CONFLICT).
--   [ ] Spot-check: bibi, baekhyun, chungha, sunmi slugs visible in
--       /admin/idols after refresh.
--   [ ] Confirm no existing slug was overwritten.
-- =============================================================================


BEGIN;


INSERT INTO public.idols
  (slug, name, korean_name, type, gender, category, agency, alt_names, is_active)
VALUES

-- ============================================================================
-- P0: Highest-priority mainstream artists
-- ============================================================================

  -- Lee Young Ji -- rapper / variety / festival; agency: MAINSTREAM
  ('lee-young-ji', 'Lee Young Ji', '이영지',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'MAINSTREAM',
   ARRAY['Lee Young Ji', 'Lee Youngji', 'Youngji', '이영지', '李泳知']::text[],
   true),

  -- QWER -- girl band; agency: Tamago Production / 3Y Corporation
  ('qwer', 'QWER', '큐더블유이알',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'Tamago Production',
   ARRAY['QWER', '큐더블유이알']::text[],
   true),

  -- BIBI -- R&B / hip-hop solo; agency: Feel Ghood Music
  -- Note: explicitly excluded from migration 034 (not THEBLACKLABEL).
  -- 88rising is a global distribution partner, not the management agency.
  ('bibi', 'BIBI', '비비',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'Feel Ghood Music',
   ARRAY['BIBI', '비비', 'Kim Hyeong-seo', 'Kim Hyungseo', '김형서']::text[],
   true),

  -- Jay Park -- rapper / producer; agency: MORE VISION
  ('jay-park', 'Jay Park', '박재범',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'MORE VISION',
   ARRAY['Jay Park', 'JAY PARK', '박재범', 'Park Jaebeom', '朴宰范']::text[],
   true),

  -- Chungha -- pop solo; agency: MORE VISION (signed 2023)
  ('chungha', 'Chungha', '청하',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'MORE VISION',
   ARRAY['Chungha', 'CHUNGHA', 'CHUNG HA', 'Chung Ha', '청하', '金請夏']::text[],
   true),

  -- Sunmi -- pop solo; agency: ABYSS Company
  -- Note: web search for "Sunmi" may return Chinese tech company SUNMI;
  -- use "선미 ABYSS" or "official_sunmi" for source lookup.
  ('sunmi', 'Sunmi', '선미',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'ABYSS Company',
   ARRAY['Sunmi', 'SUNMI', '선미', 'Lee Sun-mi', '이선미', '李宣美']::text[],
   true),

  -- Baekhyun -- EXO member solo; agency: INB100 (solo/CBX)
  -- EXO group activities remain under SM Entertainment.
  ('baekhyun', 'Baekhyun', '백현',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'INB100',
   ARRAY['Baekhyun', 'BAEKHYUN', '백현', 'Byun Baek-hyun', '변백현', '伯賢']::text[],
   true),

-- ============================================================================
-- P1: Confirmed agencies
-- ============================================================================

  -- Jannabi -- indie / pop band; agency: Peponi Music
  ('jannabi', 'Jannabi', '잔나비',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Peponi Music',
   ARRAY['Jannabi', 'JANNABI', '잔나비', 'Band Jannabi']::text[],
   true),

  -- Epik High -- hip-hop trio; agency: Ours Co. (left YG, founded own label)
  ('epik-high', 'Epik High', '에픽하이',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Ours Co.',
   ARRAY['Epik High', 'EPIK HIGH', '에픽하이', 'Tablo', 'Mithra Jin', 'DJ Tukutz']::text[],
   true),

  -- Dynamicduo -- hip-hop duo; agency: Amoeba Culture
  ('dynamicduo', 'Dynamicduo', '다이나믹듀오',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Amoeba Culture',
   ARRAY['Dynamicduo', 'Dynamic Duo', '다이나믹듀오', 'Gaeko', 'Choiza', '개코', '최자']::text[],
   true),

  -- Crush -- R&B solo; agency: P NATION
  ('crush', 'Crush', '크러쉬',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'P NATION',
   ARRAY['Crush', '크러쉬', 'Shin Hyo-seob', '신효섭']::text[],
   true),

  -- Heize -- R&B solo; agency: P NATION
  ('heize', 'Heize', '헤이즈',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'P NATION',
   ARRAY['Heize', '헤이즈', 'Jang Da-hye', '장다혜']::text[],
   true),

  -- Dean -- R&B solo; agency: you.will.knovv / Universal Music
  ('dean', 'Dean', '딘',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'you.will.knovv',
   ARRAY['Dean', 'DEAN', '딘', 'Kwon Hyuk', '권혁']::text[],
   true),

  -- Paul Kim -- ballad solo; agency: Whyes Entertainment
  -- Note: web search "paulkim.com" may surface an unrelated US location manager;
  -- use "폴킴 Whyes" for source verification.
  ('paul-kim', 'Paul Kim', '폴킴',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Whyes Entertainment',
   ARRAY['Paul Kim', '폴킴', 'Kim Tae-hyeong', '김태형']::text[],
   true),

-- ============================================================================
-- P2: Confirmed agencies
-- ============================================================================

  -- Jo Yuri -- former IZ*ONE; agency: WAKEONE
  ('jo-yuri', 'Jo Yuri', '조유리',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'WAKEONE',
   ARRAY['Jo Yuri', 'Jo Yu-ri', 'JO YURI', '조유리', '曺柔理']::text[],
   true),

  -- DAESUNG -- BIGBANG member solo; agency: R&D Company / D-LABLE (since 2023)
  ('daesung', 'DAESUNG', '대성',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'R&D Company',
   ARRAY['DAESUNG', 'Daesung', 'D-LITE', '대성', 'Kang Dae-sung', '강대성']::text[],
   true)

ON CONFLICT (slug) DO NOTHING;


-- Verification query (run after COMMIT):
-- SELECT slug, name, agency, is_active
--   FROM public.idols
--  WHERE slug IN (
--    'lee-young-ji', 'qwer', 'bibi', 'jay-park', 'chungha', 'sunmi',
--    'baekhyun', 'jannabi', 'epik-high', 'dynamicduo', 'crush', 'heize',
--    'dean', 'paul-kim', 'jo-yuri', 'daesung'
--  )
--  ORDER BY slug;


COMMIT;
