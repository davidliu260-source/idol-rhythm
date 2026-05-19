-- =============================================================================
-- Idol Rhythm — Seed mainstream K-pop idols batch 1 (Phase M1b 第二批)
-- Project : idol-rhythm (ap-southeast-2 Sydney)
--
-- PURPOSE
--   M1b 第二批：補齊主流 K-pop 藝人到 idols 表，讓 kpopofficial.com 聚合
--   爬蟲（M1a-B / matchIdolFromTitle）能透過 idols.name + alt_names 自動
--   匹配活動 → event_candidates。完全不必為每個藝人寫新 crawler。
--
--   本 migration 只新增 27 個 idol 列，不動 crawler_sources（聚合來源
--   kpopofficial-concerts 在 migration 029 已建好，無需重複）。
--
-- 27 NEW IDOLS（依公司分組，公司歸屬已根據 2026/05 官方資料校正）
--
--   HYBE / BigHit Music      : BTS、TXT、CORTIS
--   HYBE / Pledis            : SEVENTEEN、TWS
--   HYBE / Source Music      : LE SSERAFIM
--   HYBE / ADOR              : NewJeans
--   HYBE / BELIFT LAB        : ENHYPEN、ILLIT
--   HYBE / KOZ Entertainment : BOYNEXTDOOR
--   HYBE × Geffen Records    : KATSEYE
--   SM Entertainment         : aespa、NCT、Red Velvet、RIIZE、Hearts2Hearts
--   YG Entertainment         : BABYMONSTER、TREASURE
--   Starship Entertainment   : IVE、KiiiKiii
--   KQ Entertainment         : ATEEZ、xikers
--   WAKEONE                  : ZEROBASEONE
--   S2 Entertainment         : KISS OF LIFE
--   THEBLACKLABEL            : MEOVV、ALLDAY PROJECT
--   F&F Entertainment        : AHOF
--
--   公司歸屬修正紀錄（vs 原本草案）：
--   - fromis_9 已於 2024 結束 Pledis 合約 → 不列入
--   - AKMU 已於 2026/01 離開 YG → 不列入
--   - Kep1er 屬 WAKEONE / KLAP，不是 Starship → 留待 035
--   - BIBI 屬 Feel Ghood Music，不是 THEBLACKLABEL → 不列入
--   - JYP 系既有（TWICE / Stray Kids / ITZY / NMIXX / DAY6 / Xdinary Heroes /
--     2PM / J.Y. Park）不重複 seed
--
-- IDEMPOTENCE
--   ON CONFLICT (slug) DO NOTHING — 已存在的 slug（例如使用者透過 /admin/idols
--   新增的 BLACKPINK / NewJeans / BTS / EXO 等）會被跳過，不會覆蓋任何欄位。
--   admin 之後在 /admin/idols/<id>/edit 補的 avatar / color / gradient /
--   description 永遠不受 migration 影響。
--
-- ALT_NAMES 策略
--   - 韓文官方名（給 kpopofficial / Songkick 等英文聚合來源命中韓文標題用）
--   - 常見英文變體（連寫、空格、大小寫）
--   - 縮寫 / 縮稱（如 SVT、KIOF、ZB1）
--   - 不放粉絲名（aespa 的 MY → 與標題無關）
--
-- SCOPE
--   - 純資料 INSERTs。無 schema 變更、無新 GRANT、無 RLS 變更。
--   - 無新 crawler_sources（已有 kpopofficial-concerts 聚合接他們的活動）。
--   - 無前台 / 後台 code 改動。
--
-- DEPENDENCY
--   Must be run AFTER:
--     001_initial_schema.sql               — idols 表 + 三個 enum
--     028_add_idol_alt_names.sql           — alt_names text[] 欄位
--
-- EXECUTION
--   Run in Supabase SQL Editor:
--     BEGIN; <paste this file>; COMMIT;
--
-- ⚠️  HUMAN REVIEW REQUIRED before executing.
--     See review checklist at the bottom of this file.
-- =============================================================================


BEGIN;


INSERT INTO public.idols
  (slug, name, korean_name, type, gender, category, agency, alt_names, is_active)
VALUES

-- ── HYBE / BigHit Music ────────────────────────────────────────────────────
  ('bts', 'BTS', '방탄소년단',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BIGHIT MUSIC',
   ARRAY['BTS', '방탄소년단', 'Bangtan Boys', 'Bangtan Sonyeondan', 'Bangtan']::text[],
   true),

  ('txt', 'TXT', '투모로우바이투게더',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BIGHIT MUSIC',
   ARRAY['TXT', 'TOMORROW X TOGETHER', 'Tomorrow X Together', '투모로우바이투게더', 'TOMORROWXTOGETHER']::text[],
   true),

  ('cortis', 'CORTIS', '코르티스',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BIGHIT MUSIC',
   ARRAY['CORTIS', '코르티스']::text[],
   true),

-- ── HYBE / Pledis Entertainment ────────────────────────────────────────────
  ('seventeen', 'SEVENTEEN', '세븐틴',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'PLEDIS Entertainment',
   ARRAY['SEVENTEEN', '세븐틴', 'SVT']::text[],
   true),

  ('tws', 'TWS', '투어스',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'PLEDIS Entertainment',
   ARRAY['TWS', '투어스', 'Tws']::text[],
   true),

-- ── HYBE / Source Music ────────────────────────────────────────────────────
  ('le-sserafim', 'LE SSERAFIM', '르세라핌',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'Source Music',
   ARRAY['LE SSERAFIM', 'LESSERAFIM', 'Le Sserafim', '르세라핌']::text[],
   true),

-- ── HYBE / ADOR ────────────────────────────────────────────────────────────
  ('newjeans', 'NewJeans', '뉴진스',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'ADOR',
   ARRAY['NewJeans', 'New Jeans', 'NJZ', '뉴진스']::text[],
   true),

-- ── HYBE / BELIFT LAB ──────────────────────────────────────────────────────
  ('enhypen', 'ENHYPEN', '엔하이픈',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'BELIFT LAB',
   ARRAY['ENHYPEN', 'Enhypen', '엔하이픈']::text[],
   true),

  ('illit', 'ILLIT', '아일릿',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'BELIFT LAB',
   ARRAY['ILLIT', 'Illit', '아일릿']::text[],
   true),

-- ── HYBE / KOZ Entertainment ───────────────────────────────────────────────
  ('boynextdoor', 'BOYNEXTDOOR', '보이넥스트도어',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'KOZ Entertainment',
   ARRAY['BOYNEXTDOOR', 'Boy Next Door', 'BND', '보이넥스트도어']::text[],
   true),

-- ── HYBE × Geffen Records ──────────────────────────────────────────────────
  ('katseye', 'KATSEYE', '캣츠아이',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'HYBE × Geffen Records',
   ARRAY['KATSEYE', 'Katseye', 'Cat''s Eye', '캣츠아이']::text[],
   true),

-- ── SM Entertainment ───────────────────────────────────────────────────────
  ('aespa', 'aespa', '에스파',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['aespa', 'AESPA', 'Aespa', '에스파']::text[],
   true),

  ('nct', 'NCT', '엔시티',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['NCT', 'NCT 127', 'NCT127', 'NCT DREAM', 'NCT Dream', 'NCT U', 'WayV', 'NCT WISH', 'NCT Wish', '엔시티']::text[],
   true),

  ('red-velvet', 'Red Velvet', '레드벨벳',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['Red Velvet', 'RedVelvet', '레드벨벳']::text[],
   true),

  ('riize', 'RIIZE', '라이즈',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['RIIZE', 'Riize', '라이즈']::text[],
   true),

  ('hearts2hearts', 'Hearts2Hearts', '하츠투하츠',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'SM Entertainment',
   ARRAY['Hearts2Hearts', 'Hearts 2 Hearts', 'Hearts To Hearts', 'H2H', '하츠투하츠']::text[],
   true),

-- ── YG Entertainment ───────────────────────────────────────────────────────
  ('babymonster', 'BABYMONSTER', '베이비몬스터',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'YG Entertainment',
   ARRAY['BABYMONSTER', 'Baby Monster', 'BAEMON', '베이비몬스터']::text[],
   true),

  ('treasure', 'TREASURE', '트레저',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'YG Entertainment',
   ARRAY['TREASURE', 'Treasure', '트레저']::text[],
   true),

-- ── Starship Entertainment ─────────────────────────────────────────────────
  ('ive', 'IVE', '아이브',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'Starship Entertainment',
   ARRAY['IVE', 'Ive', '아이브']::text[],
   true),

  ('kiiikiii', 'KiiiKiii', '키키',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'Starship Entertainment',
   ARRAY['KiiiKiii', 'Kiiikiii', 'KIIIKIII', 'Kiki', '키키']::text[],
   true),

-- ── KQ Entertainment ───────────────────────────────────────────────────────
  ('ateez', 'ATEEZ', '에이티즈',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'KQ Entertainment',
   ARRAY['ATEEZ', 'Ateez', '에이티즈']::text[],
   true),

  ('xikers', 'xikers', '싸이커스',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'KQ Entertainment',
   ARRAY['xikers', 'XIKERS', 'Xikers', '싸이커스']::text[],
   true),

-- ── WAKEONE ────────────────────────────────────────────────────────────────
  ('zerobaseone', 'ZEROBASEONE', '제로베이스원',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'WAKEONE',
   ARRAY['ZEROBASEONE', 'Zerobaseone', 'Zero Base One', 'ZB1', '제로베이스원']::text[],
   true),

-- ── S2 Entertainment ───────────────────────────────────────────────────────
  ('kiss-of-life', 'KISS OF LIFE', '키스 오브 라이프',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'S2 Entertainment',
   ARRAY['KISS OF LIFE', 'Kiss of Life', 'KissOfLife', 'KIOF', '키스 오브 라이프', '키스오브라이프']::text[],
   true),

-- ── THEBLACKLABEL ──────────────────────────────────────────────────────────
  ('meovv', 'MEOVV', '미야오',
   'group'::group_or_solo, 'female'::gender_type, 'kpop'::idol_category,
   'THEBLACKLABEL',
   ARRAY['MEOVV', 'Meovv', '미야오']::text[],
   true),

  ('allday-project', 'ALLDAY PROJECT', '올데이프로젝트',
   'group'::group_or_solo, 'mixed'::gender_type, 'kpop'::idol_category,
   'THEBLACKLABEL',
   ARRAY['ALLDAY PROJECT', 'Allday Project', 'All Day Project', 'ADP', '올데이프로젝트']::text[],
   true),

-- ── F&F Entertainment ──────────────────────────────────────────────────────
  ('ahof', 'AHOF', '에이호프',
   'group'::group_or_solo, 'male'::gender_type, 'kpop'::idol_category,
   'F&F Entertainment',
   ARRAY['AHOF', 'A-HOF', 'Ahof', '에이호프']::text[],
   true)

ON CONFLICT (slug) DO NOTHING;


COMMIT;


-- =============================================================================
-- REVIEW CHECKLIST（執行前確認）
-- =============================================================================
--
--  □ Migrations 001–033 已執行。
--
--  □ 跑完後驗證新增筆數：
--    SELECT count(*) FROM idols
--     WHERE slug IN (
--       'bts','txt','cortis','seventeen','tws','le-sserafim','newjeans',
--       'enhypen','illit','boynextdoor','katseye','aespa','nct','red-velvet',
--       'riize','hearts2hearts','babymonster','treasure','ive','kiiikiii',
--       'ateez','xikers','zerobaseone','kiss-of-life','meovv','allday-project',
--       'ahof'
--     );
--    Expected: 27（如果之前已有 BLACKPINK / NewJeans / BTS / EXO 等手動加的
--    slug，count 會少；ON CONFLICT 跳過，這是正常的）。
--
--  □ 驗證 alt_names 寫入：
--    SELECT slug, alt_names FROM idols WHERE slug IN ('bts','le-sserafim','newjeans');
--    Expected: 韓文 + 英文變體都在 array 內。
--
--  □ 既有 8 個 JYP 藝人不受影響（slug 不重複，且沒有 UPDATE 子句）：
--    SELECT slug, name, agency, is_active FROM idols
--     WHERE slug IN ('twice','stray-kids','itzy','nmixx','day6','xdinary-heroes','2pm','jy-park');
--
--  □ 前台 / 後台：
--    - /admin/idols 列表 + 「HYBE / SM / YG / 其他」filter tabs 應顯示新藝人
--    - 下次 cron（09:00 Taipei）跑 kpopofficial-concerts 時，匹配率應顯著提升
--    - 新藝人預設無 avatar / 無描述，admin 之後到 /admin/idols/<id>/edit 補
--
--  □ 重跑驗證 idempotence：
--    再次執行此 migration 應無錯誤、無資料變動（DO NOTHING 全部跳過）。
--
-- =============================================================================
