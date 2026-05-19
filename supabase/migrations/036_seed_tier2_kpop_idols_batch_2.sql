-- =============================================================================
-- Idol Rhythm — Seed Tier 2 K-pop idols batch 2 (Phase M1b 第二批 cont.)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   M1b 第二批接 034 — 24 個 Tier 2 / 經典藝人。讓 kpopofficial.com 聚合
--   爬蟲（M1a-B）的匹配率涵蓋更多韓國主流名單。
--
-- 24 NEW IDOLS（依公司分組）
--
--   HYBE / YX Labels (Japan)    : &TEAM
--   HYBE / KOZ                  : ZICO (solo)
--   THEBLACKLABEL               : TAEYANG (solo), JEON SOMI (solo), ROSÉ (solo)
--   Modhaus                     : tripleS, ARTMS
--   Starship Entertainment      : MONSTA X, CRAVITY
--   WAKEONE                     : Kep1er, izna
--   FNC Entertainment           : SF9, N.Flying
--   WM Entertainment            : OH MY GIRL
--   RBW                         : MAMAMOO, ONEUS
--   Cube Entertainment          : BTOB, PENTAGON
--   SM Entertainment (classic)  : EXO, SHINee, Super Junior, Girls' Generation, TVXQ
--   YG Entertainment (classic)  : BIGBANG
--
-- 設計筆記
--   - ROSÉ 與 BLACKPINK 分開 seed：BLACKPINK 集體活動仍歸 BLACKPINK，
--     ROSÉ solo 活動歸 ROSÉ。longest-prefix matcher 不會誤配
--     （"BLACKPINK – ..." 命中 BLACKPINK，"ROSÉ – ..." 命中 ROSÉ）。
--   - TAEYANG 是 ex-BIGBANG 成員的 solo 身份，與 BIGBANG 同期 seed 互不衝突。
--   - HYBE 系列 agency 一律「HYBE / <label>」格式（與 035 對齊）。
--   - SM 經典團（EXO/SHINee/SJ/SNSD/TVXQ）雖然活動較少，但偶爾仍有；
--     有 alt_name 可以接到他們的演唱會 / 紀念活動。
--
-- IDEMPOTENCE
--   ON CONFLICT (slug) DO NOTHING — 已存在的 slug 跳過，不洗掉 admin 之前
--   手動補的 avatar / color / description。
--
-- ALT_NAMES 策略
--   - 韓文官方名
--   - 常見英文變體（含 apostrophe / dot / hyphen 變體）
--   - 經典英文縮寫（SNSD、SJ、SUJU、DBSK 等粉絲常用）
--
-- SCOPE
--   - 純資料 INSERTs。無 schema / GRANT / RLS 變更。
--   - 無新 crawler_sources。
--   - 無 code 改動。
--
-- DEPENDENCY
--   Must be run AFTER:
--     028_add_idol_alt_names.sql
--     034_seed_mainstream_kpop_idols_batch_1.sql
--     035_normalize_hybe_sublabel_agencies.sql
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
-- =============================================================================


BEGIN;


INSERT INTO public.idols
  (slug, name, korean_name, type, gender, category, agency, alt_names, is_active)
VALUES

-- ── HYBE 系列 ──────────────────────────────────────────────────────────────
  ('and-team', '&TEAM', '앤팀',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'HYBE / YX Labels',
   ARRAY['&TEAM', '&team', 'andTEAM', 'AND TEAM', '앤팀']::text[],
   true),

  ('zico', 'ZICO', '지코',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'HYBE / KOZ',
   ARRAY['ZICO', 'Zico', '지코', 'Woo Ji-ho']::text[],
   true),

-- ── THEBLACKLABEL (Solo) ───────────────────────────────────────────────────
  ('taeyang', 'TAEYANG', '태양',
   'solo'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'THEBLACKLABEL',
   ARRAY['TAEYANG', 'Taeyang', 'SOL', '태양', 'Sol', 'YB', 'Dong Young-bae']::text[],
   true),

  ('jeon-somi', 'JEON SOMI', '전소미',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'THEBLACKLABEL',
   ARRAY['JEON SOMI', 'Jeon Somi', 'Somi', '전소미', 'Ennik Somi Douma']::text[],
   true),

  ('rose', 'ROSÉ', '로제',
   'solo'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'THEBLACKLABEL',
   ARRAY['ROSÉ', 'Rose', 'Rosé', '로제', 'Park Chae-young', 'Roseanne Park']::text[],
   true),

-- ── Modhaus ────────────────────────────────────────────────────────────────
  ('triples', 'tripleS', '트리플에스',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'Modhaus',
   ARRAY['tripleS', 'Triple S', 'TripleS', 'TRIPLES', '트리플에스']::text[],
   true),

  ('artms', 'ARTMS', '아르테미스',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'Modhaus',
   ARRAY['ARTMS', 'Artms', '아르테미스']::text[],
   true),

-- ── Starship Entertainment ─────────────────────────────────────────────────
  ('monsta-x', 'MONSTA X', '몬스타엑스',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Starship Entertainment',
   ARRAY['MONSTA X', 'Monsta X', 'MonstaX', 'MONSTAX', '몬스타엑스']::text[],
   true),

  ('cravity', 'CRAVITY', '크래비티',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Starship Entertainment',
   ARRAY['CRAVITY', 'Cravity', '크래비티']::text[],
   true),

-- ── WAKEONE ────────────────────────────────────────────────────────────────
  ('kep1er', 'Kep1er', '케플러',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'WAKEONE',
   ARRAY['Kep1er', 'KEP1ER', 'Kepler', '케플러']::text[],
   true),

  ('izna', 'izna', '이즈나',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'WAKEONE',
   ARRAY['izna', 'IZNA', 'Izna', '이즈나']::text[],
   true),

-- ── FNC Entertainment ──────────────────────────────────────────────────────
  ('sf9', 'SF9', '에스에프나인',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'FNC Entertainment',
   ARRAY['SF9', 'Sensational Feeling 9', '에스에프나인']::text[],
   true),

  ('n-flying', 'N.Flying', '엔플라잉',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'FNC Entertainment',
   ARRAY['N.Flying', 'NFlying', 'N Flying', '엔플라잉']::text[],
   true),

-- ── WM Entertainment ───────────────────────────────────────────────────────
  ('oh-my-girl', 'OH MY GIRL', '오마이걸',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'WM Entertainment',
   ARRAY['OH MY GIRL', 'Oh My Girl', 'OhMyGirl', 'OMG', '오마이걸']::text[],
   true),

-- ── RBW Entertainment ──────────────────────────────────────────────────────
  ('mamamoo', 'MAMAMOO', '마마무',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'RBW',
   ARRAY['MAMAMOO', 'Mamamoo', '마마무']::text[],
   true),

  ('oneus', 'ONEUS', '원어스',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'RBW',
   ARRAY['ONEUS', 'Oneus', '원어스']::text[],
   true),

-- ── Cube Entertainment ─────────────────────────────────────────────────────
  ('btob', 'BTOB', '비투비',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Cube Entertainment',
   ARRAY['BTOB', 'BtoB', 'Born To Beat', '비투비']::text[],
   true),

  ('pentagon', 'PENTAGON', '펜타곤',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'Cube Entertainment',
   ARRAY['PENTAGON', 'Pentagon', '펜타곤']::text[],
   true),

-- ── SM 經典團 ──────────────────────────────────────────────────────────────
  ('exo', 'EXO', '엑소',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['EXO', 'Exo', '엑소', 'EXO-K', 'EXO-M', 'EXO-CBX', 'EXO-SC']::text[],
   true),

  ('shinee', 'SHINee', '샤이니',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['SHINee', 'Shinee', 'SHINEE', 'Shining', '샤이니']::text[],
   true),

  ('super-junior', 'Super Junior', '슈퍼주니어',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['Super Junior', 'SuperJunior', 'SUPER JUNIOR', 'SJ', 'SUJU', '슈퍼주니어', 'Super Junior-K.R.Y.', 'Super Junior-M']::text[],
   true),

  ('girls-generation', 'Girls'' Generation', '소녀시대',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['Girls'' Generation', 'Girls Generation', 'SNSD', 'GG', 'Sonyeo Sidae', '소녀시대']::text[],
   true),

  ('tvxq', 'TVXQ', '동방신기',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['TVXQ', 'TVXQ!', 'DBSK', 'Tohoshinki', 'Dong Bang Shin Ki', '동방신기']::text[],
   true),

-- ── YG 經典團 ──────────────────────────────────────────────────────────────
  ('bigbang', 'BIGBANG', '빅뱅',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'YG Entertainment',
   ARRAY['BIGBANG', 'Big Bang', 'BIG BANG', '빅뱅']::text[],
   true)

ON CONFLICT (slug) DO NOTHING;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST
-- =============================================================================
--
--  □ Migrations 001–035 已執行。
--
--  □ 跑完後驗證新增筆數：
--    SELECT count(*) FROM idols
--     WHERE slug IN (
--       'and-team','zico','taeyang','jeon-somi','rose','triples','artms',
--       'monsta-x','cravity','kep1er','izna','sf9','n-flying','oh-my-girl',
--       'mamamoo','oneus','btob','pentagon','exo','shinee','super-junior',
--       'girls-generation','tvxq','bigbang'
--     );
--    Expected: 24（若 admin 之前手動建過 EXO / SHINee / BIGBANG 等，會少幾筆）。
--
--  □ HYBE filter 應再 +2（&TEAM、ZICO）：
--    SELECT count(*) FROM idols WHERE lower(agency) LIKE '%hybe%';
--    Expected: 13（035 後是 11，加 2 = 13）
--
--  □ ROSÉ 與 BLACKPINK 不衝突：
--    SELECT slug, name, type, agency FROM idols
--     WHERE slug IN ('rose','blackpink') OR name LIKE '%BLACKPINK%';
--
--  □ 重跑驗證 idempotence：
--    再次執行此 migration 應為 no-op（DO NOTHING）。
--
-- =============================================================================
