# Idol Rhythm — Admin 後台開發路線圖

> 建立日期：2026-05-15
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
| **RLS** | 需在 Supabase 設定 JWT custom claim（`user_role = 'admin'`），才能讓 admin 寫入 policy 生效 |
| **資料寫入** | 一旦開放寫入，錯誤操作可能影響前台顯示資料的正確性 |
| **Admin 權限** | 未正確設定 JWT Hook 前，admin RLS 全部不通過，貿然接入會造成寫入失敗或安全漏洞 |
| **真實資料正確性** | Approve event_candidates 後資料會直接進入前台，錯誤審核影響使用者體驗 |
| **分階段原則** | 先做只讀 → 再做寫入 → 最後做審核，每階段獨立驗證，避免多變數同時出問題 |

---

## 3. 分階段規劃

### Phase 1：Admin Read-only Dashboard

**路由**：`/admin`

**功能**：
- Summary cards 顯示目前資料庫狀態：
  - Idols count（is_active = true）
  - Published events count（is_published = true）
  - Pending candidates count（event_candidates，review_status = pending）
  - Recent events count（最近 30 天）
- 只讀 Supabase，無寫入操作
- env 未設定或查詢失敗時顯示 fallback empty state（不 crash）

**限制**：
- 不做寫入
- 不做 auth（暫時無保護，僅供內部使用）
- 不做 RLS 修改
- 不做任何資料變更

**前置條件**：無（可直接執行）

---

### Phase 2：Admin Events List

**路由**：`/admin/events`

**功能**：
- 顯示完整 events table，欄位含：title、idol、event_type、trust_level、is_published、start_date
- 篩選器：idol / event_type / trust_level / is_published
- 點擊可查看 event detail preview（只讀）

**限制**：
- 只讀，不做新增 / 編輯 / 刪除
- 不做 auth

**前置條件**：Phase 1 完成

---

### Phase 3：Admin Event Create / Edit

**路由**：`/admin/events/new`、`/admin/events/[id]/edit`

**功能**：
- 新增活動（含 idol 選擇、event_type、dates、trust_level）
- 編輯現有活動
- 發布（is_published = true）/ 下架（is_published = false）
- 管理 event_sources（新增 / 刪除來源連結）

**限制與前置條件**：
- **此階段必須先完成 Supabase Auth 設定**
- **必須先設定 JWT custom claim（`user_role = 'admin'`）**
- **必須驗證 admin RLS policy 全部生效後才能開放寫入**
- 需 GPT 工作單確認後執行

---

### Phase 4：Admin Idols Management

**路由**：`/admin/idols`、`/admin/idols/new`、`/admin/idols/[id]/edit`

**功能**：
- 新增偶像（name、slug、category、color、description）
- 編輯偶像資料
- 切換 active / inactive 狀態
- 管理 official_links（官網、Instagram、Twitter 等）
- 未來：管理 avatar_url / cover_url

**前置條件**：Phase 3 完成（auth / RLS 已驗證）

---

### Phase 5：event_candidates Review

**路由**：`/admin/candidates`

**功能**：
- 候選資料列表（review_status = pending）
- 顯示 AI confidence score（若有）
- Approve → 自動建立 event 並設定 trust_level = media
- Reject → 更新 review_status = rejected，填寫 reviewer_note
- Reviewer note 欄位

**前置條件**：Phase 3 完成；AI 搜尋 / 爬蟲 pipeline 設計完成

---

### Phase 6：Analytics Dashboard

**路由**：`/admin/analytics`

**功能**：
- User count（Supabase Auth users）
- Active users（最近 7 / 30 天）
- Follows count（user_follows table）
- Saved events count（saved_events table）
- Reminders count（reminders table）
- Top idols by follows
- Top events by saves
- Source clicks（source_clicks table）
- Event clicks（event_clicks table）

**前置條件**：Supabase Auth 接入；event_clicks / source_clicks 資料累積足夠

---

## 4. 第一個可執行任務建議

**下一輪只做 Phase 1：Admin Read-only Dashboard**

| 項目 | 說明 |
|---|---|
| 新增頁面 | `/admin`（`src/app/admin/page.tsx`） |
| 資料來源 | 只讀 Supabase counts（idols / events / event_candidates） |
| Fallback | env 未設定或查詢失敗時顯示 empty state，不 crash |
| 寫入 | 無 |
| Auth | 無 |
| RLS 修改 | 無 |
| Schema 修改 | 無 |

---

## 5. 安全規則

| 規則 | 說明 |
|---|---|
| 寫入前必須先處理 auth / RLS | Phase 3 開始前必須完成 Supabase Auth 設定與 JWT claim |
| 不得在前端使用 service_role key | service_role key 只能用於後端 / Edge Function，絕不可暴露在前端 |
| 不得提交任何 key | `.env.local` 不進版控，key 不貼入任何程式碼 |
| pending 資料不得出現在前台 | `event_candidates` 只在 admin 區，前台 query 不得讀取 |
| event_candidates 只出現在 admin 區 | 前台 RLS 與 query filter 均排除 pending 資料 |
| 高風險任務需 GPT 工作單 | Phase 3 以上涉及寫入 / auth / RLS，執行前需確認 |

---

## 6. 各 Phase 風險等級

| Phase | 風險等級 | 前置條件 |
|---|---|---|
| Phase 1：Read-only Dashboard | 🟢 低 | 無，可直接執行 |
| Phase 2：Events List | 🟢 低 | Phase 1 |
| Phase 3：Event Create / Edit | 🔴 高 | Auth + RLS + GPT 工作單 |
| Phase 4：Idols Management | 🔴 高 | Phase 3 |
| Phase 5：Candidates Review | 🔴 高 | Phase 3 + AI pipeline |
| Phase 6：Analytics | 🟡 中 | Auth + 資料累積 |

---

## 7. 建議執行順序

```
Phase 1（只讀 Dashboard）
    ↓
Phase 2（Events List）
    ↓
[等 GPT 工作單：Auth + RLS 設定]
    ↓
Phase 3（Event Create / Edit）
    ↓
Phase 4（Idols Management）
    ↓
Phase 5（Candidates Review）
    ↓
Phase 6（Analytics）
```
