# Idol Rhythm — Admin 後台開發路線圖

> 建立日期：2026-05-15
> 最後更新：2026-05-15（Phase H1/H2 偶像列表 + 詳情 + 新增完成，anon SELECT fix 完成）
> 本文件規劃 Idol Rhythm 後台分階段開發路線，供後續任務執行參考。

---

## 1. Admin 後台目標

| 功能 | 說明 |
|---|---|
| 管理 idols | 新增、編輯、停用偶像資料 |
| 管理 events | 新增、編輯、發布、下架活動 |
| 管理 event_sources | 管理活動來源連結與平台 |
| 審核 event_candidates | 審核 AI / 爬蟲候選資料，approve 或 reject |
| Analytics（未來） | 查看 user count、follows、clicks 等行為數據 |
| AI 搜尋 / 自動整理（未來） | 支援 AI 自動整理 event_candidates 流程 |

---

## 2. 為什麼不能一次做完整 Admin

Admin 後台涉及多個高風險技術層面，必須分階段推進以降低風險：

| 風險項目 | 說明 |
|---|---|
| **Auth** | Admin 必須有身份驗證，避免任何人都能進入後台 |
| **RLS** | 寫入 policy 必須正確設定，才能讓 admin 寫入生效而不洩漏 |
| **資料寫入** | 一旦開放寫入，錯誤操作可能影響前台顯示資料的正確性 |
| **Admin 權限** | Method B（admin_users table）已建立；寫入 RLS 仍待 migration 003 更新 |
| **真實資料正確性** | Approve event_candidates 後資料會直接進入前台，錯誤審核影響使用者體驗 |
| **分階段原則** | 先做只讀 → 再做 auth guard → 再做寫入 → 最後做審核，每階段獨立驗證 |

---

## 3. 分階段進度

### ✅ Phase 1：Admin Read-only Dashboard（已完成）

**路由**：`/admin`

**已實作**：
- Summary cards 顯示資料庫狀態（idols count、published events、upcoming events、pending candidates）
- Auth guard：`getCurrentAdmin()` 讀取 admin 身份，顯示或隱藏管理功能
- 管理員驗證 banner（已登入時顯示 email）
- Auth 診斷面板（開發用：Supabase 連線狀態、Auth user、admin_users row 查詢結果）
- Quick nav → 後台活動列表
- 只讀 Supabase，env 未設定時 graceful empty state

---

### ✅ Phase 2：Admin Events List（已完成）

**路由**：`/admin/events`

**已實作**：
- 顯示完整 events（title、idol、type、trust_level、status、date）
- Summary 統計（官方確認、媒體確認、即將到來）
- EventRow 為 `<Link>` → `/admin/events/[id]`
- 管理員可見「新增草稿活動」按鈕；非管理員顯示只讀提示

---

### ✅ Phase 2.5：Admin Event Detail Preview（已完成）

**路由**：`/admin/events/[id]`

**已實作**：
- 完整後台詳情：trust badge、title、idol、type/subtype、status（含顏色）
- date/time、country + flag、location
- 來源詳情（label、type、可點擊 URL）
- 票務 / 串流連結
- tags、description
- Event UUID（供後台除錯）
- Supabase 優先讀取，fallback mock，未找到顯示 not-found 狀態

---

### ✅ Phase D：Admin Guard 基礎（已完成）

**已實作**：
- `supabase/migrations/002_admin_users.sql`：admin_users table + GRANT SELECT + RLS self-read policy
- `src/lib/supabase/adminAuth.ts`：`getCurrentAdmin()` 返回 `{user, isAdmin, diag}`
- `src/lib/supabase/browserClient.ts`：`createBrowserClient`（cookie-based，解決 localStorage vs cookie session 不互通問題）
- `src/lib/supabase/serverClient.ts`：`createServerClient`（Server Component 讀 cookie session）
- 所有 `/admin/*` Server Component 均調用 `getCurrentAdmin()` 做 guard

**關鍵修正記錄**：
- `42501 permission denied`：補上 `GRANT SELECT ON TABLE admin_users TO authenticated`（PostgreSQL 兩層存取控制：GRANT + RLS）
- Session 不持久：LoginForm 從 `getSupabaseClient()`（localStorage）改為 `getBrowserSupabaseClient()`（cookie），Server Component 可讀取

---

### ✅ Phase C：Admin Login Page（已完成）

**路由**：`/admin/login`

**已實作**：
- Email + password 登入表單（`LoginForm.tsx`，`'use client'`）
- 使用 `getBrowserSupabaseClient()` → `signInWithPassword` → 儲存 session 至 cookie
- 登入成功後 `router.push('/admin')` + `router.refresh()`（強制 Server Component 重讀 session）
- 錯誤訊息顯示（不暴露原始 Supabase error）

---

### ✅ Phase E：Admin Event Create（已完成，人工驗收通過）

**路由**：`/admin/events/new`

**已實作**：
- Guard：非 admin 顯示 amber 提示 + 登入連結，不 redirect（避免 loop）
- 從 Supabase 讀取真實 idols（UUID），作為 dropdown 選項；查詢錯誤時頁面顯示紅色提示
- 完整表單欄位：idolId、title、type、subType、status、trustLevel（official/media only）、date、time、country、countryFlag、location、tags（逗號分隔）、description、sourceLabel、sourceType、sourceUrl、ticketUrl、streamUrl
- 兩步驟 INSERT：Step 1 events（is_published=false），Step 2 event_sources
- 部分失敗（event 建立但 source 失敗）清楚回報 event ID
- 成功後 redirect → `/admin/events/[id]`

**修正歷程**：
- migration 003（`c9acaf4`）：events + event_sources INSERT policy（admin_users-based）+ GRANT INSERT
- migration 004（`0313095`）：idols SELECT policy + GRANT SELECT，修正偶像下拉 `[42501]`
- migration 005（`3b0a37a`）：events + event_sources SELECT policy + GRANT SELECT，讓 admin 可讀草稿
- `f30156e`：getIdolsForForm 加入 error 捕捉，silent fail 改為頁面顯示錯誤
- `8fbfd30`：空白 tags 改傳 `[]`，修正 `[23502] not-null constraint`
- `cb43a76`：/admin/events/[id] 改用 getAdminEvent（server client，不加 is_published filter）

**人工驗收結果（2026-05-15）**：
- admin 登入 ✅
- 偶像下拉正常顯示 ✅
- INSERT events（is_published=false）✅
- INSERT event_sources ✅
- tags 空白送出 ✅
- redirect → /admin/events/[id] ✅
- 草稿詳情頁可讀取 ✅
- 前台 public policy 未受影響，草稿不出現在前台 ✅

---

### ✅ Migrations 003–005（已執行）

| Migration | 說明 | Commit |
|---|---|---|
| `003_admin_users_write_policy.sql` | events + event_sources INSERT policy + GRANT | `c9acaf4` |
| `004_admin_users_read_idols_policy.sql` | idols SELECT policy + GRANT（偶像下拉用）| `0313095` |
| `005_admin_users_read_drafts_policy.sql` | events + event_sources SELECT policy + GRANT（讀草稿用）| `3b0a37a` |

### ✅ Migrations 006–007（已執行）

| Migration | 說明 | Commit |
|---|---|---|
| `006_admin_users_publish_events_policy.sql` | events column-level GRANT UPDATE (is_published, published_at, updated_at) + UPDATE policy | `cf4049a` |
| `007_admin_users_edit_draft_events_policy.sql` | events content fields GRANT UPDATE + draft UPDATE policy；event_sources GRANT DELETE + draft DELETE policy | `d89ab37` |

所有 migration 均使用 `admin_users` table 判斷，不依賴 JWT custom claim，不使用 service_role。

---

### ✅ Phase F：Publish / Unpublish Flow（程式碼完成，待 migration 人工執行）

**路由**：`/admin/events/[id]`

**已實作**：
- `supabase/migrations/006_admin_users_publish_events_policy.sql`：column-level GRANT UPDATE (is_published, published_at, updated_at) + UPDATE RLS policy（USING + WITH CHECK，admin_users-based）
- `src/app/admin/events/[id]/actions.ts`：Server Actions `publishEvent` / `unpublishEvent`，雙重防線（`getCurrentAdmin()` + RLS），revalidatePath 涵蓋前後台（/、/schedule、/events/[id]、/admin/events、/admin/events/[id]）
- `/admin/events/[id]/page.tsx`：admin 見綠色「發布活動」或琥珀色「下架活動」按鈕；非 admin 維持只讀 banner

**Commit**：`cf4049a`  
**GPT Reviewer**：✅ 審查通過（Phase F 工作單）

**⏳ 待人工執行**：migration 006 需在 Supabase SQL Editor 手動執行後才能使用。  
**⏳ 待人工驗收**：migration 執行後，測試發布 / 下架流程，確認前台即時反映。

---

### ✅ Phase G：Event Edit（完成，人工驗收通過）

**路由**：`/admin/events/[id]/edit`

**已實作**：
- `supabase/migrations/007_admin_users_edit_draft_events_policy.sql`：column-level GRANT UPDATE（content fields，不含 is_published/published_at）+ draft-only UPDATE policy；GRANT DELETE + DELETE policy on event_sources（draft parent only）
- `src/app/admin/events/[id]/edit/actions.ts`：Server Action `updateDraftEvent`，雙重防線（getCurrentAdmin + is_published = false 驗證），UPDATE events + DELETE/INSERT sources
- `src/app/admin/events/[id]/edit/EditEventForm.tsx`：Client Component，初始值由 server props 傳入，同 NewEventForm 欄位結構
- `src/app/admin/events/[id]/edit/page.tsx`：Guard（非 admin / 已發布 / 找不到 event）+ 預填表單
- `/admin/events/[id]/page.tsx`：草稿狀態時顯示「編輯草稿內容」連結

**Commit**：`d89ab37`  
**GPT Reviewer**：✅ 審查通過（Phase G 工作單）  
**人工驗收**：✅ 通過（2026-05-15）

---

### ✅ Phase H1：Admin Idols List（已完成）

**路由**：`/admin/idols`

**已實作**：
- 顯示所有偶像（含 is_active = false，管理視角）
- 每列顯示：啟用指示點（綠 / 灰）、name、korean_name、slug、category、type、agency
- 統計：共 N 筆（M 啟用 / K 停用）
- 管理員可見「新增偶像」按鈕（→ /admin/idols/new）；非管理員顯示只讀 banner
- 每列為 `<Link>` → `/admin/idols/[id]`

**Commit**：`ffc8e1a`

---

### ✅ Phase H2：Admin Idol Detail + Create（已完成）

**路由**：`/admin/idols/[id]`、`/admin/idols/new`

**已實作（詳情頁）**：
- 只讀詳情：基本識別（name、korean_name、slug）、分類（type、gender、category、member_count）、詳細資訊（agency、debut_date、color swatch、genres chips、description）、時間紀錄、Idol ID
- 啟用 / 停用狀態 banner
- 只讀說明 banner（Phase H3/H4 預告）

**已實作（新增頁 + 表單）**：
- `supabase/migrations/008_admin_users_insert_idols_policy.sql`：`GRANT INSERT ON public.idols TO authenticated` + INSERT policy（admin_users-based）
- Server Action `createIdol(payload)`：slug 格式驗證（`/^[a-z0-9-]+$/`）、重複 slug 友善提示、genres 空陣列安全送出、`revalidatePath('/admin/idols')` + `revalidatePath('/idols')`、成功後 redirect → `/admin/idols/[id]`
- `NewIdolForm.tsx`：name 自動產生 slug（英文小寫）、即時 slug 格式驗證、slug invalid 時禁止送出
- 欄位：name、slug、korean_name、type、gender、category、agency、debut_date、color（hex）、genres（逗號分隔）、member_count、description、is_active checkbox
- 非管理員顯示 lock screen（amber 提示 + 登入連結）

**Commit**：`ffc8e1a`

---

### ✅ Migration 009：Grant anon SELECT on idols（已完成）

**問題**：`getActiveIdols()` 使用 anon client，但 anon role 從未被 GRANT SELECT（004 只補了 authenticated）。PostgREST object-level 權限檢查先於 RLS，結果傳回 42501 → `[]` → 前台 fallback MOCK_IDOLS。

**修法**：`GRANT SELECT ON public.idols TO anon`（RLS `"idols: public read active"` 已存在，row filter 不需重建）

**Commit**：`890b5e0`

---

### 🔒 Phase H3：Edit Idol Basic Info（待實作）

**路由**：`/admin/idols/[id]/edit`

**功能規劃**：
- 編輯偶像資料（name、korean_name、category、gender、agency、debut_date、color、genres、member_count、description）
- slug 不可修改（顯示但 disabled，影響前台路由）
- 需要 migration（GRANT UPDATE + UPDATE policy，admin_users-based）

**前置條件**：Phase H2 完成（✅）；需 GPT 工作單

---

### 🔒 Phase H4：Toggle Idol is_active（待實作）

**路由**：`/admin/idols/[id]`（按鈕操作）

**功能規劃**：
- 詳情頁「啟用 / 停用」按鈕，一鍵切換 `is_active`
- 停用後不出現在前台偶像頁 + 不出現在新增活動的偶像下拉選單
- 需要 migration（GRANT UPDATE is_active + UPDATE policy）
- `revalidatePath('/admin/idols')` + `revalidatePath('/idols')` + `revalidatePath('/admin/idols/[id]')`

**前置條件**：Phase H3 完成（或獨立實作）；需 GPT 工作單

---

### 🔒 Phase I：event_candidates Review（待實作）

**路由**：`/admin/candidates`

**功能規劃**：
- 候選資料列表（review_status = pending）
- Approve → 建立 event（trust_level = media）
- Reject → 更新 review_status = rejected，填寫 reviewer_note

**前置條件**：Phase F/G 完成；AI 搜尋 / 爬蟲 pipeline 設計完成

---

### 🔒 Phase J：Analytics Dashboard（待實作）

**路由**：`/admin/analytics`

**功能規劃**：
- User count、active users（7 / 30 天）
- Follows count、saved events count、reminders count
- Top idols by follows、top events by saves
- Source clicks、event clicks

**前置條件**：前台 Supabase Auth 接入；event_clicks / source_clicks 資料累積足夠

---

## 4. 目前 Admin 路由完成狀態

| 路由 | 狀態 | 說明 |
|---|---|---|
| `/admin` | ✅ 完成 | 只讀 Dashboard + Auth guard + 診斷 |
| `/admin/login` | ✅ 完成 | Email 登入，cookie session |
| `/admin/events` | ✅ 完成 | 活動列表，管理員可見新增按鈕 |
| `/admin/events/[id]` | ✅ 完成 | 活動詳情 + 發布 / 下架按鈕（Phase F，migration 006 待人工執行） |
| `/admin/events/new` | ✅ 完成 | 草稿新增閉環，人工驗收通過（2026-05-15） |
| `/admin/events/[id]/edit` | ✅ 完成 | 草稿編輯，人工驗收通過（2026-05-15） |
| `/admin/idols` | ✅ 完成 | Phase H1（偶像列表，管理員可見新增按鈕） |
| `/admin/idols/[id]` | ✅ 完成 | Phase H2（只讀詳情） |
| `/admin/idols/new` | ✅ 完成 | Phase H2（新增偶像表單，admin guard） |
| `/admin/idols/[id]/edit` | 🔒 未實作 | Phase H3（需 GPT 工作單） |
| `/admin/candidates` | 🔒 未實作 | Phase I |
| `/admin/analytics` | 🔒 未實作 | Phase J |

---

## 5. 安全規則

| 規則 | 說明 |
|---|---|
| Admin 身份 | Method B：`admin_users` table（user_id + is_active = true），不依賴 JWT custom claim |
| 寫入前必須先處理 RLS | migrations 003–005 已執行；UPDATE policy 尚未建立，發布 / 編輯需獨立工作單 |
| 不得在前端使用 service_role key | service_role key 只能用於後端 / Edge Function，絕不可暴露在前端 |
| 不得提交任何 key | `.env.local` 不進版控，key 不貼入任何程式碼 |
| pending 資料不得出現在前台 | `event_candidates` 只在 admin 區，前台 query 不得讀取 |
| 高風險任務需 GPT 工作單 | UPDATE / DELETE policy、批量操作、event_candidates 審核，執行前需確認 |
| is_published 控制前台可見性 | 新增活動預設 `is_published = false`，需手動發布（Phase F）才出現在前台 |

---

## 6. 各 Phase 風險等級

| Phase | 風險等級 | 狀態 |
|---|---|---|
| Phase 1：Read-only Dashboard | 🟢 低 | ✅ 完成 |
| Phase 2：Events List | 🟢 低 | ✅ 完成 |
| Phase 2.5：Event Detail | 🟢 低 | ✅ 完成 |
| Phase D：Admin Guard | 🟡 中 | ✅ 完成 |
| Phase C：Login Page | 🟡 中 | ✅ 完成 |
| Phase E：Event Create Form | 🟡 中 | ✅ 完成，人工驗收通過 |
| Migrations 003–005：Write + Read RLS | 🔴 高 | ✅ 完成，已執行 |
| Phase F：Publish/Unpublish | 🟡 中 | ✅ 程式碼完成（`cf4049a`），migration 006 待人工執行 |
| Phase G：Event Edit | 🟡 中 | ✅ 完成，人工驗收通過（`d89ab37`） |
| Phase H1：Idols List | 🟡 中 | ✅ 完成（`ffc8e1a`） |
| Phase H2：Idol Detail + Create | 🟡 中 | ✅ 完成（`ffc8e1a`），migration 008 已執行 |
| Migration 009：anon SELECT idols | 🟡 中 | ✅ 完成（`890b5e0`），前台 /idols 接真實資料 |
| Phase H3：Edit Idol Info | 🔴 高 | 🔒 待 GPT 工作單 |
| Phase H4：Toggle is_active | 🔴 高 | 🔒 待 GPT 工作單 |
| Phase I：Candidates Review | 🔴 高 | 🔒 待 Phase G + AI pipeline |
| Phase J：Analytics | 🟡 中 | 🔒 待前台 Auth + 資料累積 |

---

## 7. 建議執行順序

```
✅ Phase 1（只讀 Dashboard）
✅ Phase 2（Events List）
✅ Phase 2.5（Event Detail Preview）
✅ Phase D（Admin Guard：admin_users table + session cookie）
✅ Phase C（Admin Login Page）
✅ Phase E（Event Create Form — 草稿新增閉環完成，人工驗收通過）
✅ Migrations 003–005（INSERT + SELECT RLS，admin_users-based）
✅ Phase F（Publish/Unpublish — 程式碼完成，`cf4049a`，GPT Reviewer 審查通過）
✅ Phase F（Publish/Unpublish — `cf4049a`，人工驗收通過）
✅ Migrations 006–007（已執行）
✅ Phase G（Event Edit — `d89ab37`，人工驗收通過）
✅ Phase H1（Idols List — `ffc8e1a`）
✅ Phase H2（Idol Detail + Create — `ffc8e1a`，migration 008 已執行）
✅ Migration 009（anon SELECT idols — `890b5e0`，前台 /idols 接真實資料）
    ↓
[下一個候選：Phase H3 — 編輯偶像資料（需 GPT 工作單）]
[或：Phase H4 — Toggle is_active（需 GPT 工作單）]
    ↓
Phase I（Candidates Review）
    ↓
Phase J（Analytics）
```

> ⛔ 明確禁止（未被工作單授權前不得實作）：
> - 完整 CRUD（含草稿刪除）
> - 批量操作
> - event_candidates approve / reject
> - AI auto-publish
> - service_role 使用於前端
