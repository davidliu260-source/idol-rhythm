INSERT INTO public.crawler_sources (
  source_key, name, source_url, source_type, parser_type, idol_id, is_active, config
) VALUES (
  'kaoarena-venue-calendar',
  '高雄巨蛋官方行事曆',
  'https://www.kaoarena.com.tw/Home/CalendarList',
  'official_website',
  'venue_calendar',
  NULL,
  true,
  '{"venueKey":"kaoarena","yearsAhead":1}'::jsonb
)
ON CONFLICT (source_key) DO UPDATE SET
  name = EXCLUDED.name,
  source_url = EXCLUDED.source_url,
  source_type = EXCLUDED.source_type,
  parser_type = EXCLUDED.parser_type,
  idol_id = EXCLUDED.idol_id,
  is_active = EXCLUDED.is_active,
  config = EXCLUDED.config;
