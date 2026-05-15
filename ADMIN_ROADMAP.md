# Idol Rhythm — Admin 後台開發路線圖

> 建立日期：2026-05-15
> 最後更新：2026-05-15（後台新增草稿活動閉環完成）
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

所有 migration 均使用 `admin_users` table 判斷，不依賴 JWT custom claim，不使用 service_role。

---

### 🔒 Phase F：Publish / Unpublish Flow（待實作）

**路由**：`/admin/events/[id]`（加入操作按鈕）

**功能規劃**：
- 在詳情頁新增「發布」按鈕（`is_published = false → true`）
- 在詳情頁新增「下架」按鈕（`is_published = true → false`）
- 操作後重新整理頁面，前台即時反映

**前置條件**：需 UPDATE policy（events）；當前 migrations 003–005 未包含 UPDATE。
**開始前需 GPT 工作單確認。**

---

### 🔒 Phase G：Event Edit（待實作）

**路由**：`/admin/events/[id]/edit`

**功能規劃**：
- 編輯現有活動所有欄位（同 new form 欄位）
- 更新 event_sources（含刪除舊來源、新增來源）

**前置條件**：需 UPDATE policy（events + event_sources）；Phase F 完成後進行。
**開始前需 GPT 工作單確認。**

---

### 🔒 Phase H：Admin Idols Management（待實作）

**路由**：`/admin/idols`、`/admin/idols/new`、`/admin/idols/[id]/edit`

**功能規劃**：
- 新增偶像（name、slug、category、color、description）
- 編輯偶像資料
- 切換 active / inactive 狀態
- 管理 official_links

**前置條件**：migration 003 完成（確認 admin 寫入機制穩定）

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
| `/admin/events/[id]` | ✅ 完成 | 活動詳情只讀預覽 |
| `/admin/events/new` | ✅ 完成 | 草稿新增閉環，人工驗收通過（2026-05-15） |
| `/admin/events/[id]/edit` | 🔒 未實作 | Phase G |
| `/admin/idols` | 🔒 未實作 | Phase H |
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
| Phase F：Publish/Unpublish | 🟡 中 | 🔒 待 GPT 工作單 + UPDATE policy |
| Phase G：Event Edit | 🟡 中 | 🔒 待 Phase F + UPDATE policy |
| Phase H：Idols Management | 🔴 高 | 🔒 待 Phase G |
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
    ↓
[下一個候選：Phase F — 發布 / 下架流程（需 GPT 工作單 + UPDATE policy）]
    ↓
Phase G（Event Edit）
    ↓
Phase H（Idols Management）
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
