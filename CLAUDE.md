# Idol Rhythm — Claude Code / Codex 工作規範

> **適用對象：Claude Code CLI、Codex、任何 AI coding agent。**
> 本文件是唯一維護中的規範與索引，其他 MD 檔案為輔助參考。

---

## 專案資訊

| 項目 | 值 |
|---|---|
| 專案名稱 | Idol Rhythm / 星動時刻 |
| 本地路徑 | `~/Desktop/idol-rhythm` |
| GitHub | `davidliu260-source/idol-rhythm` |
| 技術棧 | Next.js 14 App Router + TypeScript + Tailwind CSS + Supabase |
| 目前階段 | J0–J7a 完成（手動匯入、BLACKPINK + JYP 平台 fetcher、AI 解析、去重、Vercel Cron fan-out、Stray Kids 種子）|
| 輔助參考 | `ADMIN_ROADMAP.md`（後台分階段開發路線）、`AI_PIPELINE_PLAN.md`（爬蟲架構設計文件）|

---

## 每次任務前

1. 確認 `pwd` 是 `~/Desktop/idol-rhythm`，避免在錯誤目錄操作
2. **先確認邊界再動手**：任務有歧義時，先回報疑問點，等確認後才實作
3. 只做任務明確要求的事，不猜測未來需求、不預先抽象、不順手重構
4. **不得修改** ming-app、Omens 或任何非 idol-rhythm 專案
5. **更新任何 MD 索引時，CLAUDE.md 必須同步更新**（AGENTS.md 已廢棄，不需維護）

---

## 資料可見性規則（每次都要遵守）

前台正式頁面**只能顯示** `trust_level = official` 或 `media` 的資料。

- `pending` 資料只能進 `event_candidates` 候選池，**不得渲染到任何使用者可見頁面**
- 所有 Supabase query 必須 filter `is_published = true` + `trust_level IN ('official', 'media')`
- UI 必須在首頁、行程頁、詳情頁顯示 Demo data 標示（`⚠️ Demo 展示資料`）

---

## 禁止自行加入的功能

未被明確要求前，**不得加入**：

- 使用者登入 / 會員系統（已完成的部分除外）
- 付款 / 訂閱
- 真實推播通知
- 社群功能（留言、按讚）
- 後台管理介面（除非任務明確指定）
- 多語系 / 地圖完整版

---

## 高風險任務

以下任務**必須先等 GPT 工作單確認後才能執行**：

- Supabase schema / migration / RLS 變更
- Auth / admin 權限設定
- 真實資料來源接入
- AI / 爬蟲 / 推播
- 付款整合
- 大量重構或刪除資料
- 部署設定（Vercel / CI/CD）

---

## 每次任務後

1. 執行 `npm run build`，**build 失敗不得 commit**，先修正再重 build
2. `git add` 只加本輪相關檔案，**不得提交**：`.claude/`、`node_modules/`、`.next/`、`.env.local`、其他 repo 的檔案
3. `package-lock.json` 應該提交
4. Commit message 簡短清楚，反映變更核心目的；禁止 `update / fix / changes / wip`
5. **開 feature branch + PR（品管流程）**：
   ```bash
   git checkout -b feature/<phase-name>
   git add <相關檔案>
   git commit -m "簡短說明本輪變更目的"
   git push origin feature/<phase-name>
   gh pr create \
     --base main \
     --head feature/<phase-name> \
     --title "<phase-name>: 簡短說明" \
     --body "$(cat <<'EOF'
   ## 本輪變更
   - <bullet>

   ## 測試方式
   - <bullet>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```
   指令執行完成後，終端機會輸出 PR 網址，將此連結回報給使用者，等 GPT 在 GitHub 上 audit 確認無誤後再 merge to main。
6. 回報（必填）：修改檔案、build 結果、feature branch 名稱、commit hash、**PR 連結**

---

## 遇到不確定時

| 情境 | 處理方式 |
|---|---|
| 命名、樣式微調等小細節 | 做合理假設並繼續，回報中說明 |
| 影響資料結構 / 產品方向 / 安全性 / 付款 / 登入 的決策 | **停下來，等確認後再執行** |
| Build 失敗 | 修正錯誤，重新 build，不得 commit 失敗版本 |

---

## 編碼原則（Karpathy）

- **Simplicity First**：只實作本輪明確要求的功能，不加「備用」邏輯
- **Surgical Changes**：只動必要的檔案與行數，保持現有風格與 pattern
- **Goal-Driven**：每輪以可驗證的成功條件為目標（build 通過、畫面正確、commit hash），達到即停止

---

## 已完成進度索引

| # | 階段 | 說明 | 狀態 |
|---|---|---|---|
| 1 | MVP foundation | 頁面骨架、mock data、元件 | ✅ |
| 2 | UI polish | demo data 補強、暗色主題 | ✅ |
| 3 | 資料模型 | types.ts、型別收斂 | ✅ |
| 4 | localStorage 個人化 | 收藏、追蹤、提醒持久化 | ✅ |
| 5 | Supabase schema | migrations 001–010 | ✅ |
| 6 | Admin 後台基礎 | 登入、guard、dashboard | ✅ |
| 7 | Admin Events 管理 | 新增 / 編輯 / 發布 / 下架（migrations 003–007）| ✅ |
| 8 | 前台接 Supabase | 全頁 fallback mock | ✅ |
| 9 | Admin Idols 管理 | H1–H3（migrations 008–010）| ✅ |
| 10 | is_active toggle | Phase H4（migration 011）| ✅ |
| 11 | Candidates 審核 | Approve / Reject（migration 012）| ✅ |
| 12 | Auth Milestone 1 | Email magic link + saved_events（migration 013）| ✅ |
| 13 | Auth Milestone 2 | Google OAuth | ✅ |
| 14 | Auth Milestone 3 | Email + Password 登入 / 註冊 | ✅ |
| 15 | Auth Milestone 4 | user_follows 持久化（migration 015）| ✅ |
| 16 | J0 | AI pipeline 設計文件 | ✅ |
| 17 | J1 | 手動匯入候選表單（migration 016）| ✅ |
| 18 | J2 | BLACKPINK 官方 tour fetcher | ✅ |
| 19 | J4 | source_hash 去重（migration 017）| ✅ |
| 20 | J3 | AI 解析公告（Claude Haiku）| ✅ |
| 21 | J5 | Vercel Cron dry-run 觸發 | ✅ |
| 22 | J5b | Cron 安全寫入 event_candidates（migration 018）| ✅ |
| 23 | J6a | crawler_sources table + admin UI（migration 019）| ✅ |
| 24 | J6b | crawler_sources RLS + Blackpink 整合（migration 020）| ✅ |
| 25 | J6c→J6d | JYP 平台化 fetcher jyp_schedule（migrations 021/022）| ✅ |
| 26 | J6e | Cron fan-out 跨所有 active sources | ✅ |
| 27 | J6f | 12 個月視窗 + 過去日期過濾 | ✅ |
| 28 | J7a | Stray Kids 種子（migration 023，PR #16）| ✅ |
| 29 | J7b | 批量審核 UI（approve / reject）| 🔲 待辦 |
| 30 | J7c | 過期候選清理 | 🔲 待辦 |
| 31 | J7d | 內容變更偵測（content_hash）| 🔲 待辦 |
| 32 | 個人化首頁 | user_follows 過濾 timeline | 🔲 待辦 |
| 33 | 忘記密碼 / 帳號設定 | — | 🔲 待辦 |
| 34 | Apple Sign-In | 上 App Store 前再做 | 🔲 待辦 |

---

## Migration 索引

| Migration | 說明 | 狀態 |
|---|---|---|
| 001 | 完整 schema（tables + enums + RLS 21 條）| ✅ 已執行 |
| 002 | admin_users table + GRANT + self-read policy | ✅ 已執行 |
| 003 | events + event_sources INSERT policy | ✅ 已執行 |
| 004 | idols SELECT policy（admin 讀偶像下拉）| ✅ 已執行 |
| 005 | events + event_sources SELECT policy（admin 讀草稿）| ✅ 已執行 |
| 006 | events column-level GRANT UPDATE (is_published, published_at) + UPDATE policy | ✅ 已執行 |
| 007 | events content GRANT UPDATE + draft UPDATE；event_sources GRANT DELETE | ✅ 已執行 |
| 008 | GRANT INSERT ON idols + INSERT policy | ✅ 已執行 |
| 009 | GRANT SELECT ON idols TO anon（修正前台讀取）| ✅ 已執行 |
| 010 | idols content fields GRANT UPDATE + UPDATE policy | ✅ 已執行 |
| 011 | GRANT UPDATE (is_active) ON idols（Phase H4）| ✅ 已執行 |
| 012 | event_candidates GRANT SELECT/UPDATE + admin SELECT/UPDATE policy | ✅ 已執行 |
| 013 | saved_events GRANT SELECT/INSERT/DELETE TO authenticated | ✅ 已執行 |
| 014 | reminders GRANT SELECT/INSERT/DELETE TO authenticated | ✅ 已執行 |
| 015 | user_follows GRANT SELECT/INSERT/DELETE TO authenticated | ✅ 已執行 |
| 016 | event_candidates GRANT INSERT + INSERT RLS policy | ✅ 已執行 |
| 017 | ADD COLUMN source_hash + raw_data；unique index（J4）| ✅ 已執行 |
| 018 | GRANT SELECT/INSERT/UPDATE ON event_candidates TO service_role（J5b）| ✅ 已執行 |
| 019 | crawler_sources table（J6a）| ✅ 已執行 |
| 020 | crawler_sources RLS + service_role GRANT（J6b）| ✅ 已執行 |
| 021 | Seed TWICE idol + JYP schedule source（J6c）| ✅ 已執行 |
| 022 | ADD COLUMN config jsonb；TWICE → parser_type='jyp_schedule'（J6d）| ✅ 已執行 |
| 023 | Seed Stray Kids idol + JYP schedule source（J7a）| ⏳ 待人工執行 |

---

## Env 設定

| 環境變數 | 本地 `.env.local` | Vercel Production | Vercel Preview |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ |
| `ANTHROPIC_API_KEY` | ✅ | ✅ | ✅ |
| `CRON_SECRET` | ✅ | ✅ | — |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ❌ 不可設 |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` 必須是 Supabase → Settings → API → `service_role` 的 JWT（`eyJ...`），不是 `sb_secret_...`。絕不可加 `NEXT_PUBLIC_` 前綴，不可進版控，不可設在 Preview 環境。

---

## 目錄結構

```
src/
├── app/
│   ├── layout.tsx / page.tsx / error.tsx / not-found.tsx
│   ├── schedule/page.tsx
│   ├── idols/page.tsx + IdolsClient.tsx
│   ├── events/[id]/page.tsx
│   ├── favorites/page.tsx + FavoritesClient.tsx
│   ├── me/page.tsx + MeClient.tsx
│   ├── login/page.tsx + LoginForm.tsx
│   ├── auth/callback/route.ts
│   └── admin/
│       ├── page.tsx                          # Dashboard
│       ├── login/page.tsx + LoginForm.tsx
│       ├── events/
│       │   ├── page.tsx
│       │   ├── [id]/page.tsx + actions.ts
│       │   ├── [id]/edit/page.tsx + EditEventForm.tsx + actions.ts
│       │   └── new/page.tsx + NewEventForm.tsx + actions.ts
│       ├── idols/
│       │   ├── page.tsx
│       │   ├── [id]/page.tsx + actions.ts
│       │   ├── [id]/edit/page.tsx + EditIdolForm.tsx + actions.ts
│       │   └── new/page.tsx + NewIdolForm.tsx + actions.ts
│       ├── sources/
│       │   ├── page.tsx                      # 爬蟲來源列表（J6a）
│       │   └── [id]/page.tsx + RunSourceButton.tsx   # 詳情 + 手動觸發（J6b）
│       └── event-candidates/
│           ├── page.tsx
│           ├── CrawlerButton.tsx
│           ├── [id]/page.tsx + actions.ts
│           ├── new/page.tsx + NewCandidateForm.tsx + actions.ts
│           └── parse/page.tsx + ParseClient.tsx + actions.ts
├── components/
│   ├── BottomNav.tsx
│   ├── EventCard.tsx
│   ├── EventDetailActions.tsx
│   ├── EventTypeBadge.tsx
│   ├── HomePersonalized.tsx
│   └── SourceBadge.tsx
└── lib/
    ├── types.ts
    ├── appState.tsx
    ├── mockIdols.ts / mockEvents.ts
    ├── supabase/
    │   ├── client.ts                         # anon client（前台唯讀）
    │   ├── serverClient.ts                   # cookie server client
    │   ├── browserClient.ts                  # cookie browser client
    │   ├── serviceClient.ts                  # service_role（cron 專用）
    │   ├── events.ts                         # getPublishedEvents / getActiveIdols / getEventById
    │   ├── auth.ts                           # getCurrentUser()
    │   ├── adminAuth.ts                      # getCurrentAdmin()
    │   └── adminStats.ts                     # getAdminStats()
    ├── crawlers/
    │   ├── sourceHash.ts                     # SHA-256 source_hash
    │   ├── crawlerSource.ts                  # getCrawlerSourceByKey()、updateRunStatus()
    │   ├── blackpinkOfficialTour.ts          # BLACKPINK HTML parser（cheerio）
    │   ├── jypSchedule.ts                    # JYP JSON API 通用 parser
    │   └── runJypScheduleFetcher.ts          # jyp_schedule fetcher（12 個月，config.groupId）
    └── ai/
        └── parseCandidate.ts                 # Claude Haiku wrapper

supabase/
├── migrations/001–023（見 Migration 索引）
└── seed.sql

public/manifest.json
vercel.json                                   # Cron "0 1 * * *"（09:00 Taipei）
```

---

## API Routes 索引

| Route | 方法 | 說明 |
|---|---|---|
| `/api/cron/sync-candidates` | GET | Vercel Cron fan-out（J6e；Bearer CRON_SECRET；dispatch by parser_type）|
| `/api/admin/crawlers/blackpink-tour/run` | POST | BLACKPINK 手動觸發（admin guard）|
| `/api/admin/crawlers/jyp-schedule/run` | POST | JYP 手動觸發（body: {sourceKey}）|
| `/api/admin/crawlers/twice-schedule/run` | POST | 相容 shim → jyp-schedule('twice-jyp-schedule')|
| `/api/admin/ai/parse-candidate` | POST | AI 解析公告（admin guard + Claude Haiku）|
| `/auth/callback` | GET | Magic link / OAuth callback |

---

## 設計規範

### 色彩 Token（tailwind.config.ts）

| Token | 色碼 | 說明 |
|---|---|---|
| `bg` | `#08080f` | 主底色 |
| `card` | `#0f0f1e` | 卡片底 |
| `card-border` | `#1e1e36` | 邊框 |
| `primary` | `#e91e8c` | 主色（熱粉）|
| `violet` | `#8b5cf6` | 輔色 |
| `text-base` | `#f0f0ff` | 主文字 |
| `muted` | `#6b6b9a` | 次文字 |

### 元件慣例

- 卡片：`rounded-2xl border border-card-border bg-card`
- 主色按鈕：`bg-primary text-white rounded-xl`
- 次要按鈕：`border border-card-border bg-transparent text-muted`
- 底部安全距離：`pb-24`；最大寬度：`max-w-md`（448px）mobile-first
- 預設 Server Component；需要 `useState` / `usePathname` 才加 `'use client'`
