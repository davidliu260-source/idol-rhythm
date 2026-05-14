# Idol Rhythm — Supabase Schema 草稿

> 本文件為規劃用草稿，尚未在 Supabase 建立任何 table。
> 實際建立前須依 AGENTS.md 高風險任務流程，等待 GPT 工作單確認。

---

## 1. Schema 目標

| 目標 | 說明 |
|---|---|
| 取代 mock data | 將 `mockIdols.ts` / `mockEvents.ts` 靜態資料轉為可管理的資料庫資料 |
| 支援前台讀取 | 前台直接讀取 Supabase published events，不依賴 hardcoded 檔案 |
| 支援個人化 | 儲存使用者追蹤偶像、收藏活動、設定提醒 |
| 支援 admin 後台 | admin 可新增、修改、下架 idols / events |
| 支援候選池 | 爬蟲或 AI 初步整理的 event candidates 等待人工審核 |
| 支援分析 | 記錄點擊、行為事件供 analytics dashboard 使用 |

---

## 2. Tables 草稿

### `idols`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `slug` | `text` UNIQUE NOT NULL | 前台 URL slug，e.g. `bts` |
| `name` | `text` NOT NULL | 顯示名稱，e.g. `BTS` |
| `korean_name` | `text` | 韓文名稱 |
| `type` | `group_or_solo` | 團體或個人 |
| `gender` | `gender_type` | 性別類型 |
| `category` | `idol_category` | 音樂類別 |
| `agency` | `text` | 所屬經紀公司 |
| `debut_date` | `date` | 出道日 |
| `color` | `text` | 主題色 hex |
| `gradient` | `text` | Tailwind gradient class |
| `genres` | `text[]` | 音樂風格陣列 |
| `member_count` | `int2` | 成員人數（團體） |
| `description` | `text` | 簡介 |
| `is_active` | `bool` DEFAULT true | 是否顯示於前台 |
| `created_at` | `timestamptz` DEFAULT now() | 建立時間 |
| `updated_at` | `timestamptz` DEFAULT now() | 更新時間 |

---

### `events`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `idol_id` | `uuid` FK → idols | 所屬偶像 |
| `idol_name` | `text` NOT NULL | 冗餘欄位，避免 join |
| `title` | `text` NOT NULL | 活動標題 |
| `type` | `event_type` NOT NULL | 主分類 |
| `sub_type` | `event_sub_type` | 細分類 |
| `status` | `event_status` DEFAULT `confirmed` | 確認狀態 |
| `trust_level` | `trust_level` NOT NULL | 資料可信度 |
| `date` | `date` NOT NULL | 活動日期 |
| `time` | `text` | 時間（local time string） |
| `location` | `text` | 地點名稱 |
| `country` | `text` | 國家名稱 |
| `country_flag` | `text` | 國旗 emoji |
| `description` | `text` | AI 繁中摘要 |
| `tags` | `text[]` | 標籤陣列 |
| `ticket_url` | `text` | 購票連結 |
| `stream_url` | `text` | 串流連結 |
| `is_published` | `bool` DEFAULT false | 是否公開發佈 |
| `published_at` | `timestamptz` | 發佈時間 |
| `created_at` | `timestamptz` DEFAULT now() | 建立時間 |
| `updated_at` | `timestamptz` DEFAULT now() | 更新時間 |

---

### `event_sources`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `event_id` | `uuid` FK → events | 所屬活動 |
| `level` | `trust_level` NOT NULL | 可信度等級 |
| `label` | `text` NOT NULL | 來源名稱，e.g. `BIGHIT Official` |
| `type` | `source_type` | 來源類型 |
| `url` | `text` | 原始連結 |
| `created_at` | `timestamptz` DEFAULT now() | 建立時間 |

---

### `user_follows`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `user_id` | `uuid` FK → auth.users | 使用者 |
| `idol_id` | `uuid` FK → idols | 追蹤偶像 |
| `created_at` | `timestamptz` DEFAULT now() | 追蹤時間 |
| UNIQUE | `(user_id, idol_id)` | 防止重複追蹤 |

---

### `saved_events`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `user_id` | `uuid` FK → auth.users | 使用者 |
| `event_id` | `uuid` FK → events | 收藏活動 |
| `created_at` | `timestamptz` DEFAULT now() | 收藏時間 |
| UNIQUE | `(user_id, event_id)` | 防止重複收藏 |

---

### `reminders`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `user_id` | `uuid` FK → auth.users | 使用者 |
| `event_id` | `uuid` FK → events | 提醒活動 |
| `type` | `reminder_type` DEFAULT `day_before` | 提醒類型 |
| `is_sent` | `bool` DEFAULT false | 是否已推播 |
| `created_at` | `timestamptz` DEFAULT now() | 設定時間 |
| UNIQUE | `(user_id, event_id, type)` | 防止重複設定 |

---

### `event_candidates`

候選池：存放爬蟲或外部來源的原始資料，等待 admin 審核後升格為 events。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `raw_title` | `text` NOT NULL | 原始標題 |
| `raw_content` | `text` | 原始內容 |
| `detected_idol_id` | `uuid` FK → idols nullable | AI 猜測偶像 |
| `detected_event_type` | `event_type` | AI 猜測分類 |
| `detected_date` | `date` | AI 猜測日期 |
| `source_url` | `text` | 原始連結 |
| `source_name` | `text` | 來源名稱 |
| `source_type` | `source_type` | 來源類型 |
| `ai_confidence` | `numeric(3,2)` | AI 信心分數 0.00–1.00 |
| `review_status` | `review_status` DEFAULT `pending` | 審核狀態 |
| `reviewer_note` | `text` | 審核備註 |
| `approved_event_id` | `uuid` FK → events nullable | 核准後對應的 event |
| `created_at` | `timestamptz` DEFAULT now() | 建立時間 |
| `updated_at` | `timestamptz` DEFAULT now() | 更新時間 |

---

### `event_clicks`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `event_id` | `uuid` FK → events | 被點擊的活動 |
| `user_id` | `uuid` FK → auth.users nullable | 登入使用者（可 null） |
| `session_id` | `text` | 匿名 session |
| `referrer` | `text` | 來源頁面路徑 |
| `clicked_at` | `timestamptz` DEFAULT now() | 點擊時間 |

---

### `source_clicks`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `event_source_id` | `uuid` FK → event_sources | 被點擊的來源 |
| `event_id` | `uuid` FK → events | 所屬活動 |
| `user_id` | `uuid` FK → auth.users nullable | 登入使用者 |
| `session_id` | `text` | 匿名 session |
| `clicked_at` | `timestamptz` DEFAULT now() | 點擊時間 |

---

### `user_activity_logs`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | `uuid` PK | 主鍵 |
| `user_id` | `uuid` FK → auth.users nullable | 使用者 |
| `session_id` | `text` | 匿名 session |
| `action` | `text` NOT NULL | 行為名稱，e.g. `follow_idol`、`save_event` |
| `entity_type` | `text` | 操作對象類型，e.g. `idol`、`event` |
| `entity_id` | `uuid` | 操作對象 ID |
| `metadata` | `jsonb` | 額外資訊 |
| `created_at` | `timestamptz` DEFAULT now() | 發生時間 |

---

## 3. Enum 草稿

```sql
-- 偶像類別
CREATE TYPE idol_category AS ENUM ('kpop', 'cpop', 'jpop', 'idol', 'other');

-- 團體或個人
CREATE TYPE group_or_solo AS ENUM ('group', 'solo');

-- 性別類型
CREATE TYPE gender_type AS ENUM ('male', 'female', 'mixed', 'unknown');

-- 活動主分類
CREATE TYPE event_type AS ENUM (
  'concert',    -- 演唱會、見面會
  'ticketing',  -- 開票售票
  'livestream', -- 直播
  'streaming',  -- 串流平台
  'media',      -- 雜誌、採訪、音樂節目
  'brand',      -- 代言、品牌合作
  'official'    -- 官方公告、專輯發行
);

-- 活動細分類
CREATE TYPE event_sub_type AS ENUM (
  'fanmeet', 'fansign', 'musicshow', 'variety',
  'interview', 'award', 'release', 'announcement', 'magazine'
);

-- 活動確認狀態
CREATE TYPE event_status AS ENUM ('confirmed', 'tentative', 'cancelled', 'postponed');

-- 資料可信度（三級制）
CREATE TYPE trust_level AS ENUM (
  'official',  -- 官方 SNS / 官網直接公告
  'media',     -- 知名媒體或可靠粉絲帳號確認
  'pending'    -- 未確認，前台不顯示
);

-- 來源類型
CREATE TYPE source_type AS ENUM (
  'official_sns', 'official_website',
  'media_outlet', 'fan_account',
  'community', 'unknown'
);

-- 候選池審核狀態
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');

-- 提醒類型
CREATE TYPE reminder_type AS ENUM (
  'day_before',   -- 前一天
  'week_before',  -- 前一週
  'hour_before'   -- 前一小時
);
```

---

## 4. RLS 初步原則

### 公開讀取（無需登入）

```sql
-- events：只公開已發佈且可信度為 official / media 的活動
CREATE POLICY "public_read_events" ON events
  FOR SELECT USING (
    is_published = true
    AND trust_level IN ('official', 'media')
    AND status != 'cancelled'
  );

-- idols：公開所有 is_active 的偶像
CREATE POLICY "public_read_idols" ON idols
  FOR SELECT USING (is_active = true);

-- event_sources：公開讀取已發佈活動的來源
CREATE POLICY "public_read_sources" ON event_sources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_sources.event_id
        AND events.is_published = true
    )
  );
```

### 使用者自身資料（需登入）

```sql
-- user_follows：只能讀寫自己的追蹤
CREATE POLICY "user_own_follows" ON user_follows
  USING (auth.uid() = user_id);

-- saved_events：只能讀寫自己的收藏
CREATE POLICY "user_own_saved" ON saved_events
  USING (auth.uid() = user_id);

-- reminders：只能讀寫自己的提醒
CREATE POLICY "user_own_reminders" ON reminders
  USING (auth.uid() = user_id);
```

### Admin 限定

```sql
-- events 寫入：只有 admin role
CREATE POLICY "admin_write_events" ON events
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- event_candidates：只有 admin 可讀寫
CREATE POLICY "admin_candidates" ON event_candidates
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

---

## 5. Admin 後台未來頁面

| 路徑 | 功能 |
|---|---|
| `/admin/dashboard` | 活動總覽、候選池待審數、近期新增統計 |
| `/admin/idols` | 偶像列表 CRUD，管理 `is_active`、色彩、metadata |
| `/admin/events` | 活動列表，新增 / 編輯 / 發佈 / 下架 |
| `/admin/candidates` | 候選池審核介面，一鍵 approve → 升格為 event |
| `/admin/sources` | 來源管理，設定 trust_level、URL |
| `/admin/analytics` | 點擊統計、熱門活動、使用者行為趨勢 |

---

## 6. 分階段接入順序

| Phase | 內容 | 前提 |
|---|---|---|
| **Phase 1** | 建立 schema 文件（本文件） | ✅ 完成 |
| **Phase 2** | 在 Supabase 建立 tables + enums + RLS | 需 GPT 工作單 |
| **Phase 3** | seed idols / events（從 mock data 匯入） | Phase 2 完成 |
| **Phase 4** | 前台改為讀取 Supabase（`@supabase/supabase-js`） | Phase 3 完成 |
| **Phase 5** | admin CRUD 後台（idols / events 管理） | Phase 4 完成 |
| **Phase 6** | candidate review 流程（候選池 → event） | Phase 5 完成 |
| **Phase 7** | analytics dashboard（點擊 / 行為統計） | Phase 6 完成 |

> ⚠️ Phase 2 以後每個階段均屬高風險任務，需等待 GPT 工作單確認範圍後才能執行。
