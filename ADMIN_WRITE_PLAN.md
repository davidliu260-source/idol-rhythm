# Idol Rhythm — Admin 寫入安全方案

> 建立日期：2026-05-15
> 本文件規劃後台正式開始寫入 Supabase 前，必須完成的安全前置工作。
> 所有寫入功能（Phase 3 以上）在本文件確認前不得實作。

---

## 1. 為什麼需要寫入前規劃

| 風險項目 | 說明 |
|---|---|
| **影響真實資料** | 後台寫入會直接影響 `events`、`idols`、`event_sources`，錯誤操作可能導致前台顯示錯誤或資料遺失 |
| **Supabase Auth** | 寫入必須搭配身份驗證，否則任何人都能呼叫 API 修改資料 |
| **RLS policy** | 目前 admin 寫入 policy 依賴 `auth.jwt() ->> 'user_role' = 'admin'`，未正確設定 JWT claim 前所有 admin 寫入會被封鎖或直接失敗 |
| **Admin 權限** | 需要明確定義誰是 admin、如何判斷，避免權限設定錯誤導致資料被任意修改 |
| **資料正確性** | events 上線後會直接顯示給使用者，錯誤的日期、信任等級或來源資訊會影響產品可信度 |
| **pending 誤公開** | `trust_level = pending` 或 `is_published = false` 的資料絕不可出現在前台，寫入流程必須有明確 guard |

---

## 2. 寫入前必須完成的前置條件

### 2.1 管理員登入方案
- 選定 Supabase Auth 登入方式（建議：Email + Password 或 Magic Link）
- 建立 `/admin/login` 登入頁
- 確認登入後 session 正確儲存，`getSession()` 可正常取得 user

### 2.2 Admin 身分判斷方式
- 決定採用 **方案 A（JWT custom claim）** 或 **方案 B（admin_users table）**（見第 3 節比較）
- 在所有 admin 寫入頁面加上 server-side guard，未通過驗證時 redirect 至登入頁或回傳 403

### 2.3 RLS 寫入策略
- 確認 `events`、`idols`、`event_sources`、`event_candidates` 的 admin 寫入 policy 已正確設定
- 在 Supabase 測試 admin 身份的 policy：authenticated + admin role 才能寫入
- 確認非 admin 用戶無法透過 anon key 或一般 authenticated key 寫入

### 2.4 表單資料驗證
- 所有必填欄位在 server action 或 API route 中進行 server-side 驗證
- 不依賴前端 HTML validation 作為唯一保護
- trust_level 必須限定為 `official`、`media`（不允許寫入 `pending` 到 `events` 表）

### 2.5 event_sources 寫入策略
- `events` 與 `event_sources` 必須在同一個操作流程中完成
- 建立 event 後立即建立對應的 event_source，避免出現無來源的 event
- 失敗時兩者都不建立（見 2.7 錯誤處理）

### 2.6 publish / draft 狀態規則
- 新增 event 預設 `is_published = false`（draft 狀態）
- 發布（`is_published = true`）需要獨立的確認動作，不在新增表單中預設開啟
- 只有 `is_published = true` + `trust_level IN ('official', 'media')` 的 event 才能出現在前台

### 2.7 錯誤處理與回滾策略
- insert events 失敗 → 不建立 event_sources，顯示錯誤訊息
- insert event_sources 失敗 → 回傳錯誤，提示管理員重新操作（不自動刪除已建立的 event，改為留存 draft 狀態讓管理員手動處理）
- 所有失敗狀態需在 UI 明確呈現，不靜默失敗

### 2.8 不使用 service_role key 在前端
- service_role key 只能在 Supabase Edge Function 或 server-only 環境使用
- 前端（包含 Server Component）只能使用 anon key + 使用者 session
- 任何情況下 service_role key 不得出現在前端程式碼或 `NEXT_PUBLIC_` 環境變數

---

## 3. Admin 身分方案比較

### 方案 A：JWT custom claim（`user_role = 'admin'`）

**做法**：在 Supabase Auth Hook（或 Edge Function）中，當使用者登入時，在 JWT 中注入 `user_role = 'admin'` claim，RLS policy 直接讀取 `auth.jwt() ->> 'user_role'`。

| 項目 | 說明 |
|---|---|
| **優點** | RLS 可直接驗證，不需額外 DB query；效能佳；適合多角色複雜系統 |
| **缺點** | 需設定 Supabase Auth Hook（有一定複雜度）；JWT claim 變更需重新登入才生效；目前 Supabase Hook 設定門檻較高 |
| **對本專案適合度** | ⚠️ 中等。MVP 階段 admin 只有一人，JWT Hook 的複雜度超過目前需求；但這是 Supabase 官方推薦的長期方案 |

---

### 方案 B：admin_users table（用 user id 判斷是否 admin）

**做法**：建立 `admin_users` 表，欄位只有 `user_id`（對應 `auth.users.id`）。Server action 或 guard 查詢這張表判斷目前使用者是否為 admin，RLS policy 改為 `EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())`。

| 項目 | 說明 |
|---|---|
| **優點** | 設定簡單直覺；新增 / 撤除 admin 只需操作這張表；不需要設定 Auth Hook；適合 MVP 階段 |
| **缺點** | 每次 RLS 驗證都需要一次額外 DB query（效能略差）；不支援複雜多角色；擴充性較弱 |
| **對本專案適合度** | ✅ 高。MVP 單一 admin，設定成本低，邏輯清楚，出錯風險低 |

---

## 4. 建議本專案採用方案

### 第一階段：採用方案 B（admin_users table）

理由：
- 目前 admin 只有一人，不需要複雜角色系統
- 設定成本低，不需要 Auth Hook 或 Edge Function
- 出錯風險低，邏輯直覺（看表就知道誰是 admin）
- 可在 Supabase Dashboard 直接操作，不需要額外工具

### 第二階段（未來）：補上 JWT custom claim

當有多角色需求（editor、reviewer、super_admin）或效能需要優化時，再遷移至方案 A。

---

## 5. 第一個寫入功能建議

**不要先做完整 CRUD**，第一個寫入功能只做：

### `/admin/events/new` — 新增 Draft Event

| 規則 | 說明 |
|---|---|
| 預設 `is_published = false` | 建立後不會出現在前台，管理員需手動發布 |
| `trust_level` 必須手動選擇 | 選項限定 `official` 或 `media`，不得預設 `pending` |
| `source` 必填 | 來源名稱、來源類型、來源 URL 至少填來源名稱 |
| 同步建立 `event_sources` | insert event 成功後立即 insert event_source |
| 成功後導向詳情頁 | redirect 至 `/admin/events/[id]` |
| 失敗時顯示錯誤 | 不靜默失敗，不產生半套資料 |
| 不允許刪除 | 只能下架（`is_published = false`），不做硬刪除 |
| 不允許批量操作 | 一次只建立一筆 |

---

## 6. 寫入流程草稿

```
1. admin 進入 /admin/login
2. 輸入 Email + Password → Supabase Auth 登入
3. Server guard 查詢 admin_users 表，確認 user_id 存在
   → 不存在 → redirect /admin/login，顯示「無管理員權限」
   → 存在 → 允許進入後台
4. 進入 /admin/events/new
5. 填寫表單：
   - 偶像（從 idols 選）
   - 標題（必填）
   - 活動類型（必填）
   - 日期（必填）
   - trust_level（必填，選 official / media）
   - 來源名稱（必填）
   - 來源類型、來源 URL（選填）
   - 地點、時間、說明（選填）
6. Submit → Server Action：
   a. 驗證必填欄位（server-side）
   b. 確認 trust_level 不為 pending
   c. INSERT INTO events（is_published = false）
   d. 取得新建 event.id
   e. INSERT INTO event_sources（event_id = 新 event.id）
   f. 兩步都成功 → redirect /admin/events/[id]
   g. 任一步失敗 → 回傳錯誤，顯示在表單，不殘留半套資料
```

---

## 7. 安全規則

| 規則 | 說明 |
|---|---|
| **pending 不得出現在前台** | 前台所有 query 必須 filter `trust_level IN ('official', 'media')` |
| **`is_published = false` 不得出現在前台** | 前台所有 query 必須 filter `is_published = true` |
| **event_candidates approve 前不得公開** | approve 流程必須先建立 event（draft），再由管理員手動發布 |
| **service_role key 不得進前端** | 只能用在 Edge Function 或 server-only 環境，不得出現在 `NEXT_PUBLIC_` 變數 |
| **所有寫入必須經過 RLS 或 Server Action** | 不允許前端直接呼叫 Supabase client 進行寫入，必須透過 Server Action 並驗證身份 |
| **不做硬刪除** | 只做下架（`is_published = false`）或 draft 狀態，保留資料可追查 |
| **Admin guard 每次都要執行** | 每個 admin 寫入頁面的 Server Component 都要重新查詢 admin_users，不依賴 client-side 狀態 |

---

## 8. 分階段實作順序

| Phase | 工作 | 風險等級 | 前置條件 |
|---|---|---|---|
| **Phase A** | 新增 ADMIN_WRITE_PLAN.md（本文件） | 🟢 無 | 無 |
| **Phase B** | 建立 `admin_users` table migration 草稿 | 🔴 高 | GPT 工作單確認 schema |
| **Phase C** | 建立 Supabase Auth 登入頁（`/admin/login`） | 🔴 高 | Phase B + GPT 工作單 |
| **Phase D** | 建立 admin guard（Server Component guard function） | 🔴 高 | Phase C |
| **Phase E** | 建立 `/admin/events/new` draft-only 新增頁 | 🔴 高 | Phase D + RLS 驗證通過 |
| **Phase F** | `event_sources` 同步寫入 | 🔴 高 | Phase E |
| **Phase G** | 發布 / 下架流程（publish / unpublish） | 🔴 高 | Phase F |
| **Phase H** | 編輯 events（edit existing） | 🔴 高 | Phase G |
| **Phase I** | `event_candidates` approve / reject | 🔴 高 | Phase G + AI pipeline |

> ⚠️ Phase B 以上所有工作在 GPT 工作單確認前不得執行。

---

## 9. 明確暫不做

| 項目 | 理由 |
|---|---|
| **刪除（硬刪除）** | 風險過高，先用下架替代，保留資料可追查 |
| **批量操作** | MVP 階段不需要，避免誤操作大量資料 |
| **AI 自動發布** | 需要完整 pipeline 設計，候選資料必須先進 event_candidates 審核 |
| **完整 Analytics** | 需要 Supabase Auth + 資料累積，留到 Phase 6 |
| **付款 / 會員** | 超出 MVP 範圍 |
| **複雜角色權限** | MVP 只有一個 admin，不需要 editor / reviewer 等多角色 |
| **JWT custom claim（短期）** | 留到未來多角色需求出現時再設定 |
