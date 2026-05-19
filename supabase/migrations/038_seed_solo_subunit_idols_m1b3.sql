-- =============================================================================
-- Idol Rhythm — Seed solo / subunit idols (Phase M1b-3)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   M1b-3：依 PR #70 Source Inventory A，補下一批 solo / 分隊 / 大團成員
--   到 idols 表，提高 kpopofficial.com 聚合來源與未來官方來源 parser 的
--   匹配率。
--
--   本 migration 只處理 idols seed 與一個 agency typo 修正：
--     - 新增 19 個 idol rows
--     - 修 aespa agency: "SSM Entertainment" -> "SM Entertainment"
--     - 不新增 crawler_sources
--     - 不改 schema / GRANT / RLS
--
-- NEW IDOLS
--   Solo / independent:
--     Rain, IU, TAEYEON, G-DRAGON
--
--   BLACKPINK solo:
--     JISOO, JENNIE, LISA
--     Note: ROSÉ already exists from migration 036, so this migration does
--     not re-seed `rose`.
--
--   BTS solo:
--     RM, Jin, SUGA / Agust D, j-hope, Jimin, V, Jung Kook
--
--   Units / groups:
--     NCT 127, NCT DREAM, NCT WISH, PLAVE, (G)I-DLE, STAYC
--
-- SKIPPED BECAUSE ALREADY SEEDED
--   TAEYANG (`taeyang`) exists from migration 036.
--
-- IDEMPOTENCE
--   INSERTs use ON CONFLICT (slug) DO NOTHING. Existing rows are never
--   overwritten, so admin-filled avatar / description / color data remains
--   safe. The aespa typo fix is a narrow UPDATE constrained to slug='aespa'.
--
-- DEPENDENCY
--   Must be run AFTER:
--     028_add_idol_alt_names.sql
--     034_seed_mainstream_kpop_idols_batch_1.sql
--     036_seed_tier2_kpop_idols_batch_2.sql
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--
-- REVIEW CHECKLIST
--   [ ] Confirm no duplicate slugs will be created.
--   [ ] Confirm `aespa` agency is corrected after running.
--   [ ] Confirm `rose` and `taeyang` remain unchanged.
-- =============================================================================


BEGIN;


-- ── Existing row correction ─────────────────────────────────────────────────
UPDATE public.idols
   SET agency = 'SM Entertainment',
       updated_at = NOW()
 WHERE slug = 'aespa'
   AND agency = 'SSM Entertainment';


INSERT INTO public.idols
  (slug, name, korean_name, type, gender, category, agency, alt_names, is_active)
VALUES

-- ── Solo / independent ─────────────────────────────────────────────────────
  ('rain', 'Rain', '비',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Rain Company',
   ARRAY['Rain', 'RAIN', '비', 'Jung Ji-hoon', 'Jung Ji Hoon', '정지훈']::text[],
   true),

  ('iu', 'IU', '아이유',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'EDAM Entertainment',
   ARRAY['IU', '아이유', 'Lee Ji-eun', 'Lee Jieun', '이지은']::text[],
   true),

  ('taeyeon', 'TAEYEON', '태연',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['TAEYEON', 'Taeyeon', '태연', 'Kim Tae-yeon', 'Kim Taeyeon', '김태연']::text[],
   true),

  ('g-dragon', 'G-DRAGON', '지드래곤',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Galaxy Corporation',
   ARRAY['G-DRAGON', 'G Dragon', 'GDragon', 'GD', '지드래곤', 'Kwon Ji-yong', 'Kwon Jiyong', '권지용']::text[],
   true),

-- ── BLACKPINK solo ─────────────────────────────────────────────────────────
  ('jisoo', 'JISOO', '지수',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'Blissoo',
   ARRAY['JISOO', 'Jisoo', '지수', 'Kim Ji-soo', 'Kim Jisoo', '김지수']::text[],
   true),

  ('jennie', 'JENNIE', '제니',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'ODD ATELIER',
   ARRAY['JENNIE', 'Jennie', '제니', 'Kim Jennie', 'Jennie Kim', '김제니']::text[],
   true),

  ('lisa', 'LISA', '리사',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'LLOUD',
   ARRAY['LISA', 'Lisa', '리사', 'Lalisa', 'Lalisa Manobal', '라리사 마노반']::text[],
   true),

-- ── BTS solo ───────────────────────────────────────────────────────────────
  ('rm', 'RM', '알엠',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BigHit Music / HYBE',
   ARRAY['RM', '알엠', 'Rap Monster', 'Kim Nam-joon', 'Kim Namjoon', '김남준']::text[],
   true),

  ('jin', 'Jin', '진',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BigHit Music / HYBE',
   ARRAY['Jin', 'JIN', '진', 'Kim Seok-jin', 'Kim Seokjin', '김석진']::text[],
   true),

  ('suga', 'SUGA', '슈가',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BigHit Music / HYBE',
   ARRAY['SUGA', 'Suga', '슈가', 'Agust D', 'AGUST D', '어거스트 디', 'Min Yoon-gi', 'Min Yoongi', '민윤기']::text[],
   true),

  ('j-hope', 'j-hope', '제이홉',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BigHit Music / HYBE',
   ARRAY['j-hope', 'J-Hope', 'J Hope', '제이홉', 'Jung Ho-seok', 'Jung Hoseok', '정호석']::text[],
   true),

  ('jimin', 'Jimin', '지민',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BigHit Music / HYBE',
   ARRAY['Jimin', 'JIMIN', '지민', 'Park Ji-min', 'Park Jimin', '박지민']::text[],
   true),

  ('v', 'V', '뷔',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BigHit Music / HYBE',
   ARRAY['V', '뷔', 'Kim Tae-hyung', 'Kim Taehyung', 'Taehyung', '김태형']::text[],
   true),

  ('jung-kook', 'Jung Kook', '정국',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BigHit Music / HYBE',
   ARRAY['Jung Kook', 'Jungkook', 'JUNG KOOK', '정국', 'Jeon Jung-kook', 'Jeon Jungkook', '전정국']::text[],
   true),

-- ── SM units ───────────────────────────────────────────────────────────────
  ('nct-127', 'NCT 127', '엔시티 127',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['NCT 127', 'NCT127', '엔시티 127', '엔시티127']::text[],
   true),

  ('nct-dream', 'NCT DREAM', '엔시티 드림',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['NCT DREAM', 'NCT Dream', 'NCTDREAM', '엔시티 드림', '엔시티드림']::text[],
   true),

  ('nct-wish', 'NCT WISH', '엔시티 위시',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['NCT WISH', 'NCT Wish', 'NCTWISH', '엔시티 위시', '엔시티위시']::text[],
   true),

-- ── Additional high-value groups ───────────────────────────────────────────
  ('plave', 'PLAVE', '플레이브',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'VLAST',
   ARRAY['PLAVE', 'Plave', '플레이브']::text[],
   true),

  ('gidle', '(G)I-DLE', '(여자)아이들',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'Cube Entertainment',
   ARRAY['(G)I-DLE', 'GIDLE', 'I-DLE', 'IDLE', '아이들', '(여자)아이들', '여자아이들']::text[],
   true),

  ('stayc', 'STAYC', '스테이씨',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'High Up Entertainment',
   ARRAY['STAYC', 'StayC', 'Stayc', '스테이씨']::text[],
   true)

ON CONFLICT (slug) DO NOTHING;


-- Verification queries:
-- SELECT slug, name, agency FROM public.idols
--  WHERE slug IN (
--    'rain','iu','taeyeon','g-dragon','jisoo','jennie','lisa',
--    'rm','jin','suga','j-hope','jimin','v','jung-kook',
--    'nct-127','nct-dream','nct-wish','plave','gidle','stayc',
--    'aespa','rose','taeyang'
--  )
--  ORDER BY slug;


COMMIT;

