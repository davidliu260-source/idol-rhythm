# AI / Crawler Pipeline Plan — Phase J0

**Status:** J0–J7a 完成（2026-05-17）。J7b 批量審核 UI、J7c 過期清理、J7d 內容變更偵測為下一階段。
**Goal:** Establish a safe, staged roadmap for ingesting idol activity data via crawlers / AI parsing into the existing `event_candidates` staging pool.

| Phase | 說明 | 狀態 |
|---|---|---|
| J0 | 設計文件 | ✅ 完成（`cf1bd6a`） |
| J1 | 手動匯入候選表單 | ✅ 完成（`4c1baf0`，migration 016） |
| J2 | BLACKPINK 官方 tour fetcher | ✅ 完成（`acf7952`） |
| J3 | AI 解析公告（Claude Haiku） | ✅ 完成（`3cd09f2`） |
| J4 | source_hash 去重強化 | ✅ 完成（`2c2ec1c`，migration 017） |
| J5 | Vercel Cron dry-run 觸發 | ✅ 完成（`4c911e7`，`vercel.json`，`CRON_SECRET`） |
| J5b | Cron 安全寫入 event_candidates | ✅ 完成（`19ed919`，migration 018，Production 驗收通過） |
| J6a | crawler_sources table 基礎 | ✅ 完成（`3490082`，migration 019） |
| J6b | crawler_sources RLS + admin UI | ✅ 完成（`811a473`，migration 020） |
| J6c | TWICE 官方行程 fetcher | ✅ 完成（`5c624d5`，migration 021）→ 已由 J6d 平台化取代 |
| J6d | JYP 平台化 fetcher（jyp_schedule） | ✅ 完成（`452d995`，migration 022，PR #13 merged） |
| J6e | Cron fan-out 跨所有 active sources | ✅ 完成（`4449cc7`，PR #14 merged） |
| J6f | JYP fetcher 12 個月視窗 + 過去日期過濾 | ✅ 完成（`46f197f`，PR #15 merged） |
| J7a | Stray Kids 資料種子（第二 JYP 藝人） | ✅ 完成（`e058de0`，migration 023，PR #16 open）|
| J7b | 批量審核 UI（approve / reject） | 🔒 待實作 |
| J7c | 過期候選清理（expired pending cleanup） | 🔒 待實作 |
| J7d | 內容變更偵測（content_hash + needs_recheck） | 🔒 待實作 |

---

## 1. 目前資料流盤點

### 1.1 `event_candidates` 實際 schema（來源：`supabase/migrations/001_initial_schema.sql` L281-298）

```
id                   uuid           PK
raw_title            text           NOT NULL
raw_content          text
detected_idol_id     uuid           FK -> idols(id)  ON DELETE SET NULL
detected_event_type  event_type     (enum)
detected_date        date
source_url           text
source_name          text
source_type          source_type    (enum: official_sns | official_website |
                                          media_outlet | fan_account |
                                          community | unknown)
ai_confidence        numeric(3,2)   CHECK between 0.00 and 1.00
review_status        review_status  NOT NULL DEFAULT 'pending'
                                    (enum: pending | approved | rejected)
reviewer_note        text
approved_event_id    uuid           FK -> events(id) ON DELETE SET NULL
created_at           timestamptz    NOT NULL DEFAULT NOW()
updated_at           timestamptz    NOT NULL DEFAULT NOW() (trigger)
```

Indexes: `review_status`, `detected_idol_id`.

**Notes:**
- 沒有 `raw_data jsonb`，沒有 `source_hash`，沒有 `crawler_run_id`，沒有 `detected_location`。
- `raw_content` 是 text，足以塞 plain text 內文，但 raw HTML / 多欄位 metadata 無處放。
- `detected_idol_id` 是 **UUID**，不是 slug；AI 輸出若用 slug 必須先查表轉成 UUID。

### 1.2 既有 Admin Candidates 審核流程

| 入口 | 路徑 | 行為 |
|---|---|---|
| 列表 | `/admin/event-candidates` | 顯示所有候選 |
| 詳情 | `/admin/event-candidates/[id]` | 顯示 raw + detected 欄位 + Approve / Reject |
| Server Action | `src/app/admin/event-candidates/[id]/actions.ts` | `approveCandidate` / `rejectCandidate` |
| 守門 | `getCurrentAdmin()` | 必須為 active admin |

### 1.3 `approveCandidate` 轉換邏輯（簡述）

1. Fetch candidate（必須 `review_status = 'pending'`）。
2. 驗證 `detected_idol_id` 不可為空。
3. Lookup idol → 取 `name`。
4. INSERT `events`：
   - `trust_level = 'pending'`
   - `is_published = false`
   - `status = 'confirmed'`
   - `title = raw_title`, `description = raw_content`
   - `date = detected_date ?? today`
5. INSERT `event_sources`：`level='pending'`, `label=source_name`, `type=source_type`, `url=source_url`。
6. UPDATE candidate：`review_status='approved'`, `approved_event_id=new event id`。
7. Redirect to `/admin/events/[newId]`。

**重點：approve 後 event 仍是 draft 且 `trust_level='pending'`，前台看不到。** Admin 必須二段操作：先 approve candidate → 編輯 event → 切 `trust_level` 到 `official`/`media` → 再 publish。

### 1.4 前台為什麼看不到 pending candidate

- 前台所有 query 都 filter `is_published = true` AND `trust_level IN ('official','media')`。
- `event_candidates` 從未被前台讀取。
- Approve 產出的 event 預設 `is_published=false` + `trust_level='pending'`，雙重隔離。

### 1.5 既有可重用元件

| 類型 | 名稱 |
|---|---|
| Table | `event_candidates`, `events`, `event_sources`, `idols` |
| Server Actions | `approveCandidate`, `rejectCandidate` |
| Admin UI | `/admin/event-candidates`, `/admin/event-candidates/[id]` |
| Auth guard | `getCurrentAdmin()` |
| Supabase clients | `getSupabaseServerClient()`（server-only） |

---

## 2. 建議 Pipeline 分階段

每個 milestone 都是獨立工作單。**順序不可跳。**

### ✅ J1 — 手動匯入候選資料（已完成，`4c1baf0`）
- `/admin/event-candidates/new`：表單頁 + `createCandidate` server action。
- 欄位：raw_title（必填）、raw_content、source_url、detected_idol_id（下拉）、detected_event_type、detected_date、source_name、source_type、ai_confidence、reviewer_note。
- `source_hash` SHA-256 計算（migration 017 後）；`raw_data: { source: 'manual' }`。
- 23505 unique_violation → 中文友善提示。

### ✅ J2 — BLACKPINK 官方 tour fetcher（已完成，`acf7952`）
- `src/lib/crawlers/blackpinkOfficialTour.ts`：cheerio HTML parser，BLACKPINK_PARSER_VERSION = 1。
- `src/app/api/admin/crawlers/blackpink-tour/run/route.ts`：POST 手動觸發（admin guard + 雙 `.in()` 去重）。
- `CrawlerButton.tsx`：Admin UI 觸發按鈕，顯示中文結果摘要，router.refresh() 於 insert > 0。
- source_url = `BLACKPINK_TOUR_URL + '#' + cityId`（城市唯一）。

### ✅ J3 — AI 解析公告（已完成，`3cd09f2`）
- `src/lib/ai/parseCandidate.ts`：Claude Haiku wrapper，`resolveAnthropicModel()`（env ANTHROPIC_MODEL，預設 claude-haiku-4-5-20251001）。
- JSON fence 提取（`\`\`\`json` / 直接 JSON 均支援），enum 白名單驗證，slug → UUID 解析（LLM 不見 UUID）。
- `POST /api/admin/ai/parse-candidate`：admin guard + known_idols 查詢 → 呼叫 Claude → 回傳 `{ ok, parsed, idol_name }`。
- `/admin/event-candidates/parse`：Server Component（admin guard）+ `ParseClient.tsx`（預覽卡，信心顏色：≥70% 綠 / ≥40% 琥珀 / 其他紅）。
- `commitAiCandidate` server action：re-validate server-side（enum + date + confidence）+ re-resolve slug → UUID + source_hash fallback + `raw_data: { source: 'ai-parse', model, confidence, reason, input_text, parsed }`。

### ✅ J4 — 去重 / hash 強化（已完成，`2c2ec1c`）
- `src/lib/crawlers/sourceHash.ts`：SHA-256。URL branch = `sha256("source_url:" + normalized)`；fallback = `sha256([title, date, idolId, sourceName, sourceType].join("|"))`。
- `migration 016`：GRANT INSERT ON event_candidates + INSERT RLS policy（admin_users-based）。
- `migration 017`：ADD COLUMN source_hash text + raw_data jsonb；CREATE UNIQUE INDEX WHERE source_hash IS NOT NULL（partial）。
- 所有寫入路徑（手動 / fetcher / AI）均計算 source_hash；23505 → 中文友善提示。

### ✅ J5 — Cron / 自動觸發（完成，`4c911e7`）
- `vercel.json`：`"0 1 * * *"`（09:00 Asia/Taipei）。
- `GET /api/cron/sync-candidates`：`Authorization: Bearer ${CRON_SECRET}` header 驗證。
- `?dryRun=1` 保留乾跑模式。

### ✅ J5b — Cron 安全寫入（完成，`19ed919`）
- `src/lib/supabase/serviceClient.ts`：`import 'server-only'`，`SUPABASE_SERVICE_ROLE_KEY`。
- `migration 018`：`GRANT SELECT / INSERT / UPDATE ON event_candidates TO service_role`（idempotent）。
- Production 驗收通過（curl 三組測試）。

### ✅ J6a — crawler_sources table（完成，`3490082`）
- `migration 019`：`crawler_sources` table（id, name, source_key, idol_id FK, source_url, source_type, parser_type, is_active, last_run_at, last_status, last_error, created_at, updated_at）。
- `/admin/sources` 列表頁 + `/admin/sources/[id]` 詳情頁。
- `getCrawlerSourceByKey()` + `updateRunStatus()` helper functions。

### ✅ J6b — crawler_sources RLS（完成，`811a473`）
- `migration 020`：GRANT SELECT/UPDATE(last_run_at, last_status, last_error, updated_at) TO service_role + admin SELECT policy。
- Blackpink fetcher 改由 `crawler_sources` 行驅動（`getCrawlerSourceByKey('blackpink-official-tour')`）。
- `/admin/sources/[id]/RunSourceButton.tsx`：通用手動觸發按鈕。

### ✅ J6c → J6d — JYP 平台化 fetcher（完成，`452d995`）
- J6c 建立 TWICE 行程 fetcher（`5c624d5`，migration 021）。
- J6d 將其重構為通用 `jyp_schedule` parser：
  - `src/lib/crawlers/jypSchedule.ts`：`parseJypScheduleApiItems`、`entryToCandidatePayload`、`JypSourceContext`。
  - `src/lib/crawlers/runJypScheduleFetcher.ts`：`EXPECTED_PARSER_TYPE='jyp_schedule'`，讀 `config.groupId` 驅動 API。
  - `migration 022`：`ALTER TABLE crawler_sources ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'`；UPDATE TWICE row `parser_type='jyp_schedule'`, `config={groupId:'9', artistSlug:'twice'}`。
  - `src/app/api/admin/crawlers/jyp-schedule/run/route.ts`：通用 POST 手動觸發。
- 新增 JYP 藝人只需一行 DB row，零程式碼改動。

### ✅ J6e — Cron fan-out（完成，`4449cc7`）
- `GET /api/cron/sync-candidates` 改為列出所有 `is_active=true` crawler_sources，依 `parser_type` dispatch。
- Switch table：`blackpink_official_tour` → `runBlackpinkFetcher`；`jyp_schedule` → `runJypScheduleFetcher`。
- 逐條執行（sequential），每條獨立 try/catch，全失敗 → 502，部分失敗 → 200 with errorCount。
- Response：`{ok, trigger, mode, summary, results[]}`。

### ✅ J6f — JYP 12 個月視窗（完成，`46f197f`）
- `MONTHS_AHEAD = 12`（原為 3），`MAX_ENTRIES_PER_RUN = 200`（原為 50）。
- 過去日期過濾：`entries.filter(e => e.detectedDate >= todayIso)`（只對新 INSERT 生效，不影響已存 DB 的候選）。

### ✅ J7a — Stray Kids 資料種子（完成，`e058de0`）
- `migration 023`：INSERT idols（slug='stray-kids'，ON CONFLICT DO NOTHING）+ INSERT crawler_sources（source_key='stray-kids-jyp-schedule', config={groupId:'10', artistSlug:'stray-kids'}，ON CONFLICT DO UPDATE 只更新 parser_type/source_url/config/updated_at）。
- 零程式碼改動 — 驗證了 J6d 的「加新 JYP 藝人 = 一行 SQL」設計契約。
- PR #16 open；migration 023 需在 Supabase SQL Editor 執行。

### 🔒 J7b — 批量審核 UI（待實作）
- `/admin/event-candidates` 列表頁加 checkbox + 全選 + 頂端工具列。
- `POST /api/admin/event-candidates/bulk-review`：`{ids: string[], action: 'approve'|'reject'}`。

### 🔒 J7c — 過期候選清理（待實作）
- 過濾 `review_status='pending'` + `detected_date < today` 的候選。
- 批量設 `review_status='rejected'`，`reviewer_note='auto-expired'`（不 DELETE，保留記錄）。

### 🔒 J7d — 內容變更偵測（待實作）
- `event_candidates` 新增 `content_hash text` 欄位（SHA-256 of title+date+type+location）。
- Fetcher：source_hash 命中（已存在）但 content_hash 不同 → 標記 `needs_recheck=true`。
- Admin UI：候選列表顯示「內容已更新」badge。
- 需 migration（獨立工作單）。

---

## 3. 觸發方式比較

| 方式 | 優點 | 缺點 | MVP 適合？ |
|---|---|---|---|
| Vercel Cron Job | 自動、整合 Vercel | 失敗難 debug、執行時間限制（10s hobby）、需 secret | ❌ 不在 MVP |
| Admin 手動觸發 Route Handler | 完全可控、可立刻看結果、不需 cron secret 管理 | 需人工點 | ✅ **建議 J1–J4 用此** |
| 本地 script / CLI | 可用 service_role 跑批量、不受 Vercel timeout 限制 | 需在本機跑、不適合長期 | ✅ J2 prototype 可用 |
| GitHub Actions | 免費 cron、log 完整 | 設定複雜、env 同步要小心 | △ J5 候選之一 |

**建議：MVP 期間（J1–J4）一律 admin 手動觸發。J5 才考慮 cron。**

---

## 4. 資料來源策略

### 第一階段可做（J2 候選）
- **官方藝人 / 經紀公司網站公告頁**（HTML 結構相對穩定，可法律安全 scrape）。
- **官方 RSS feed**（若有；最安全的來源）。

### 後續再做
- 官方 X / Twitter API（需付費 tier，或用第三方 mirror）。
- Naver / Daum / Yahoo News 媒體 RSS。
- Melon / Genie 新歌發布列表。

### 暫不建議
- Weverse（需登入、ToS 模糊）。
- Instagram / TikTok（反爬蟲嚴、ToS 嚴禁）。
- YouTube scrape（用 API，不要 scrape）。
- 任何個人粉絲帳號或社群（trust_level 永遠是 fan_account，價值低）。

---

## 5. AI 解析層設計（J3）

### 輸入

```
{
  raw_title: string,
  raw_content: string,        // text 全文
  source_url: string | null,
  known_idols: [              // 提供給 LLM 對應用
    { slug: "bts", name: "BTS", aliases: ["방탄소년단", "防彈少年團"] },
    ...
  ]
}
```

### 期望輸出 schema

```
{
  detected_idol_slug: string | null,   // 必須在 known_idols 內，否則 null
  detected_event_type: "concert" | "fan_meeting" | "album_release" | ... | null,
  detected_date: "YYYY-MM-DD" | null,
  source_name: string | null,          // 例："HYBE 官方公告"
  source_type: source_type | null,     // enum 之一
  confidence: number (0.00 ~ 1.00),
  reason: string                        // LLM 為何下這個判斷，純供 admin 參考
}
```

### Slug → UUID 對應規則

1. 程式端收到 LLM 輸出後，用 `detected_idol_slug` 查 `idols` 表取 UUID。
2. 找不到 → `detected_idol_id = null`，candidate 照樣寫入 pending，`reviewer_note` 加上 “AI 無法對應偶像，需人工補”。
3. **絕不**讓 LLM 直接產 UUID（會幻覺）。

### Confidence 用途
- 只當參考，不自動 approve。
- Admin UI 可排序或標色（高 confidence 排前），但決策權永遠在 admin。

---

## 6. 寫入 `event_candidates` 策略

| 規則 | 強制 |
|---|---|
| 永遠寫入 `event_candidates`，永不直接寫入 `events` | ✅ |
| `review_status` 預設 `pending` | ✅ |
| `approved_event_id` 預設 `null` | ✅ |
| `ai_confidence` 只供參考，不影響自動化決策 | ✅ |
| Admin 最終人工審核仍是必要 | ✅ |
| 找不到 idol 對應時 candidate 仍寫入（保留證據），但 `detected_idol_id=null` | ✅ |
| 任何 pipeline 程式碼**不得**呼叫 `approveCandidate` | ✅ |
| 任何 pipeline 程式碼**不得**改 `is_published` 或 `trust_level` | ✅ |

---

## 7. 去重策略（J4 設計，暫不實作）

**最小可行去重：**

1. **Primary**：`source_url` 唯一性。寫入前 `SELECT 1 FROM event_candidates WHERE source_url = $1`。若已存在，skip 或更新 `updated_at`。
2. **Fallback**：當 `source_url` 為 null，用 `(raw_title, detected_date, detected_idol_id)` 三欄複合比對。
3. **理想**：新增 `source_hash text` 欄位（SHA-256 of normalized title+date+idol_id），加 unique index。**本輪不新增。**

對 `event_sources.url` 不做去重檢查（J4 範圍外）。

---

## 8. Migration 風險評估

**現有 schema 是否足夠跑 J1 / J2？**

| 階段 | 足夠？ | 原因 |
|---|---|---|
| J1（手動匯入） | ✅ | 完全使用既有欄位 |
| J2（單來源 fetcher，無 AI） | ✅ | `raw_title` + `raw_content` + `source_url` + `source_name` + `source_type` 夠用 |
| J3（AI 解析） | ✅（勉強） | LLM 的 `reason` 可塞 `reviewer_note`；無 `raw_data jsonb` 但目前不致命 |
| J4（去重） | △ | 沒有 `source_hash` 與 unique index，去重只能靠 application-level query |
| J5（cron 排程） | △ | 沒有 `crawler_run_id` 追蹤每次執行 |

**未來可能需要的 migration（本輪不做）：**

```
ALTER TABLE event_candidates
  ADD COLUMN raw_data jsonb,                  -- LLM 完整輸出、原始 HTML snippet
  ADD COLUMN source_hash text,                -- 去重 unique key
  ADD COLUMN crawler_run_id uuid,             -- 對應 crawler_runs(id)
  ADD COLUMN detected_location text,
  ADD COLUMN detected_confidence_reason text; -- LLM 的判斷理由

CREATE UNIQUE INDEX uq_candidates_source_url
  ON event_candidates (source_url) WHERE source_url IS NOT NULL;

CREATE UNIQUE INDEX uq_candidates_source_hash
  ON event_candidates (source_hash) WHERE source_hash IS NOT NULL;

CREATE TABLE crawler_runs (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_name  text NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT NOW(),
  finished_at  timestamptz,
  inserted_count integer DEFAULT 0,
  skipped_count  integer DEFAULT 0,
  error        text
);
```

**每一條 migration 都需要獨立 GPT 工作單，不可一次合併。**

---

## 9. API Key / Env 管理

未來可能需要的 env（**本輪不新增**）：

| Env | 用途 | 何時新增 |
|---|---|---|
| `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY` | LLM 解析 | J3 |
| `CRON_SECRET` | Vercel Cron header 驗證 | J5 |
| `CRAWLER_ADMIN_SECRET` | 手動觸發 route handler 雙保險（除 admin session 外） | J2 |
| Source-specific keys（如 Twitter Bearer Token） | 個別來源 | J6 |

**原則：**
- Key 一律走 Vercel Project Settings → Environment Variables。
- **絕不**寫進 repo，**絕不**用 `NEXT_PUBLIC_` prefix。
- Key 一律 server-only 使用（Route Handler / Server Action / Server Component）。

---

## 10. 安全邊界

**Hard rules — 不可破：**

1. `service_role` key **絕不**出現在 client component / public route handler / browser bundle。
2. 所有寫入 `event_candidates` 的程式必須是 server-only（`'use server'` action 或 Route Handler 用 `getSupabaseServerClient`）。
3. 手動觸發爬蟲的 Route Handler 必須驗證：
   - Admin session（透過 `getCurrentAdmin()`），**或**
   - `CRAWLER_ADMIN_SECRET` header（兩者擇一或合用）。
4. **不開**任何公開（未認證）寫入 endpoint。
5. AI 解析層**不得**直接呼叫 `approveCandidate`。
6. AI 解析層**不得**直接寫入 `events` 表。
7. AI 解析層**不得**修改 `trust_level` 或 `is_published`。
8. Cron Route Handler 必須驗證 `Authorization: Bearer ${CRON_SECRET}` 或 Vercel cron header。
9. 速率限制：所有 fetcher 必須在程式內加 sleep / concurrency limit，避免被 ban。
10. User-Agent 必須誠實標示（建議：`IdolRhythm-Bot/0.1 (+contact@example.com)`），並尊重 `robots.txt`。

---

## 11. 第一個可執行實作工作單建議

**建議從 J1 開始。**

| 候選 | 範圍 | 風險 | 工時估計 |
|---|---|---|---|
| **J1 — 手動匯入 candidate form** | 一個 admin 表單頁 + 一個 server action | 極低（只是另一個 admin CRUD） | 半天 |
| J2 — 單一官方來源 fetcher prototype | 需選來源、寫 HTML parser、route handler、錯誤處理 | 中（外部依賴） | 1–2 天 |

**理由選 J1：**
1. 完全沒有外部依賴，build 失敗風險低。
2. 立刻就能用 — 即使爬蟲全部跳票，admin 也能手動補資料。
3. 驗證 candidate 寫入 → approve 流程在「乾淨資料」下完全 OK，之後 J2 / J3 出問題才好 isolate 是 pipeline 還是審核流程的 bug。
4. UI / Server Action pattern 與既有 `/admin/idols/new`、`/admin/events/new`（如已存在）一致，零學習成本。

**J1 工作單建議涵蓋：**
- `/admin/event-candidates/new/page.tsx`：表單
- `/admin/event-candidates/new/actions.ts`：`createCandidate(formData)` server action
- 欄位驗證：`raw_title` required；其他選填
- INSERT 後 redirect 回 `/admin/event-candidates/[newId]`
- Admin guard：`requireActiveAdmin()`
- 不新增 migration、不改 RLS、不改 enum

---

## 12. 本輪不做事項（明確列表）

- ❌ 任何 migration
- ❌ 修改 RLS / policy
- ❌ 修改既有 admin UI 或前台
- ❌ 串接 OpenAI / Anthropic API
- ❌ 寫 crawler / fetcher 程式
- ❌ 新增 cron / GitHub Action
- ❌ 新增 env / secret
- ❌ 提交 `.claude/` 或 `supabase/.temp/`

本輪只新增 `AI_PIPELINE_PLAN.md`。
