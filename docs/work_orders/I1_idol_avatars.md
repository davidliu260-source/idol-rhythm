# I1 工作單草案：藝人頭像（avatar）

> **狀態：** Draft，等 GPT 審核後才可開工。
> **作者：** Claude Code（草擬）
> **影響：** Migration 025 + 新 Supabase Storage bucket + 新 API route + admin UI + 前台 4 處顯示。
> **風險：** 高（涉及 schema、Storage 設定、外部圖片抓取）。

---

## 1. 背景

目前 `/idols`、首頁、活動卡片所有顯示「藝人」的地方都用 `idol.name.charAt(0)` 渲染在漸層色塊上（見 `src/components/EventCard.tsx:114`、`src/app/idols/IdolsClient.tsx:108`）。

使用者希望改用真實藝人照片，且後台不要手動找圖、由 AI 搜尋後提供選項。

---

## 2. 目標

1. `idols` 表新增 `avatar_url`（nullable text）
2. 後台 `/admin/idols/<id>/edit` 加「搜尋照片」按鈕：呼叫 AI 取得候選圖片 → 顯示縮圖 → 使用者選一張 → 下載並上傳到 Supabase Storage → 寫入 `idols.avatar_url`
3. 前台四處顯示：
   - `/idols` 卡片左上角的字母色塊
   - `/me` 「追蹤中的偶像」列表
   - 個人化首頁追蹤偶像 strip
   - `EventCard` 的藝人小頭像（compact + full 兩種樣式）
4. fallback：`avatar_url` 為 null 時保留現有字母色塊（漸進升級，不需要一次全部藝人都有照片）

---

## 3. 技術設計

### 3.1 Migration 025

```sql
ALTER TABLE public.idols
  ADD COLUMN avatar_url text;

-- 補上 column-level GRANT，避免重蹈 migration 010 的 UPDATE 全表 GRANT 漏洞
GRANT UPDATE (avatar_url) ON public.idols TO authenticated;
```

註：`idols.avatar_url` 的 SELECT 走 migration 009 給的全表 SELECT TO anon，自動可讀。

### 3.2 Supabase Storage Bucket

新建 bucket：`idol-avatars`

| 設定 | 值 | 備註 |
|---|---|---|
| Public | true | 前台 anon 直接讀 URL，不用 signed URL |
| File size limit | 2 MB | 一般宣傳照夠用 |
| Allowed MIME | `image/jpeg`, `image/png`, `image/webp` | 排除 SVG（XSS 風險）|

RLS policies（Storage RLS 在 `storage.objects` 表上）：

```sql
-- 任何人都可以下載（public read）
CREATE POLICY "idol-avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'idol-avatars');

-- 只有 admin 可以上傳 / 覆寫 / 刪除
CREATE POLICY "idol-avatars admin write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'idol-avatars'
    AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "idol-avatars admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'idol-avatars'
    AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "idol-avatars admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'idol-avatars'
    AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );
```

**問題（需 GPT 決定）：** Storage RLS 要寫進 migration 025 還是手動在 Supabase Dashboard 設定？Migration 內操作 `storage.objects` policy 需要 service_role 權限執行，且 Supabase Dashboard 對 Storage policies 有 UI。建議 migration 只負責表 schema + GRANT，bucket / policies 手動在 Dashboard 建。

### 3.3 AI 搜圖 API Route

新增 `POST /api/admin/idols/<id>/search-avatars`：

| 步驟 | 動作 |
|---|---|
| 1 | admin guard（`getCurrentAdmin()`，沿用既有 pattern）|
| 2 | 從 idol row 取 `name`（英文）、`korean_name` 作為搜尋關鍵字 |
| 3 | 呼叫圖片搜尋來源（**選項見下方**），回傳 4–6 個候選 URL |
| 4 | response: `{ candidates: [{ url, thumbUrl, width, height, source }, ...] }` |

**圖片來源選項（需 GPT 決定）：**

A. **Anthropic web_search tool**（推薦）
   - Claude Sonnet 帶 `web_search` 找官方 IG / 官網照片
   - 缺點：可能不會直接回圖 URL，需要再 follow-up 抓
   - 缺點：Sonnet API 成本較 Haiku 高

B. **Bing Image Search API**
   - 直接給結構化圖片結果
   - 需要新環境變數 `BING_SEARCH_API_KEY`
   - 月免費額度 1000 次查詢
   - 風險：可能拿到非官方 / 低畫質照片

C. **直接 scrape 官網**
   - 如 Stray Kids 從 `jype.com`、BLACKPINK 從 `ygfamily.com` 抓 og:image
   - 最準確但每個 agency 要寫不同 parser
   - 違反 M1a 「先做框架不要為單一藝人寫死」的精神

**建議 A**，因為 Anthropic API 已在 env 設好。

### 3.4 Upload Flow

新增 `POST /api/admin/idols/<id>/upload-avatar`：

| 步驟 | 動作 |
|---|---|
| 1 | admin guard |
| 2 | body: `{ source_url: string }` |
| 3 | server-side `fetch(source_url)` 下載 binary（避免瀏覽器 CORS 問題）|
| 4 | 驗證 MIME / size（拒絕 SVG、大於 2MB、長寬比異常）|
| 5 | 上傳到 Storage：`idol-avatars/<idol_slug>-<timestamp>.jpg` |
| 6 | UPDATE `idols.avatar_url = <public storage url>` |
| 7 | revalidate `/admin/idols`、`/idols`、`/`、`/schedule` |

**問題：** 舊頭像要不要砍？建議：覆寫時刪 Storage 舊檔（避免長期累積垃圾）。

### 3.5 前台顯示

新增 helper `src/components/IdolAvatar.tsx`：

```tsx
function IdolAvatar({ idol, size }: { idol: Idol; size: 'sm'|'md'|'lg' }) {
  if (idol.avatarUrl) {
    return <img src={idol.avatarUrl} alt={idol.name} className="..." />
  }
  return (
    <div className={`bg-gradient-to-br ${idol.gradient} ...`}>
      {idol.name.charAt(0)}
    </div>
  )
}
```

四處呼叫點都改用這個元件，避免散落。

`Idol` type 加 `avatarUrl?: string`，`rowToIdol()` 從 Supabase row 帶過來。

---

## 4. 開放決策（需 GPT 確認）

| # | 問題 | Claude 建議 |
|---|---|---|
| 1 | 圖片來源用 A / B / C？ | A（Anthropic web_search）|
| 2 | Storage RLS 寫進 migration 還是 Dashboard 手動？ | Dashboard 手動 |
| 3 | Bucket 命名 `idol-avatars` 還是別的？ | `idol-avatars` |
| 4 | Public bucket 還是 private + signed URL？ | Public（節省 token、降低 latency）|
| 5 | 覆寫舊頭像時砍舊檔嗎？ | 砍 |
| 6 | 檔案命名規則？ | `<slug>-<timestamp>.<ext>` |
| 7 | 失敗 fallback 是否保留字母色塊？ | 保留 |
| 8 | API route 的圖片下載超時設定？ | 10 秒 |
| 9 | 後台 UI 是否要支援手動貼 URL（不走 AI）？| 是，當 AI 找不到時的逃生口 |

---

## 5. 範圍

### 包含
- Migration 025（idols 加 avatar_url + GRANT）
- Supabase Storage bucket + RLS（手動建）
- `POST /api/admin/idols/<id>/search-avatars`
- `POST /api/admin/idols/<id>/upload-avatar`
- 後台 EditIdolForm 加搜圖按鈕 + 縮圖選擇 UI + 上傳 progress
- `IdolAvatar` 元件 + 四處顯示替換
- `Idol` type + `rowToIdol` 加 avatarUrl

### 不包含
- 為現有 3 個藝人實際上傳照片（功能完成後使用者自己上傳）
- 圖片裁切 / 編輯工具
- 多張照片輪播
- 偶像團體成員個別頭像
- AI 自動每月更新照片

---

## 6. 驗收標準

1. Migration 025 執行後，`idols.avatar_url` 欄位存在，所有現有 row 為 NULL
2. Storage bucket `idol-avatars` 可從前台 URL 直接讀取
3. 後台 `/admin/idols/<id>/edit` 點「搜尋照片」，10 秒內回傳至少 3 個候選
4. 選一張縮圖按「使用此圖」，5 秒內顯示「上傳成功」，DB 中 `avatar_url` 已更新
5. 前台 `/idols` 對應藝人卡片顯示真實照片，其他無頭像的藝人仍顯示字母色塊
6. 未登入也能看到公開頭像
7. 非 admin 呼叫 search / upload API 回 401
8. 前台所有頁面（首頁、行程、活動卡片、收藏、我的）都用 `IdolAvatar` 元件渲染

---

## 7. 預估工作量

| 部分 | 預估 |
|---|---|
| Migration 025 SQL + 文件 | 15 分鐘 |
| Storage bucket / RLS 設定（手動）| 10 分鐘 |
| search-avatars API route | 1 小時 |
| upload-avatar API route | 1 小時 |
| EditIdolForm 後台 UI | 1.5 小時 |
| `IdolAvatar` 元件 + 4 處替換 | 1 小時 |
| 測試 + build | 30 分鐘 |
| **合計** | **~5 小時** |

可拆兩個 PR：
- PR-A：Migration + Storage + `IdolAvatar` 元件 + fallback 顯示（先不接 AI，純手動貼 URL 也能用）
- PR-B：AI 搜圖 + 後台縮圖選擇 UI（前端 UX 升級）

---

## 8. GPT 審核請確認

- [ ] 是否同意整體技術方案
- [ ] 開放決策 #1–#9 的選擇
- [ ] 範圍是否需要增減
- [ ] 預估工作量是否合理，是否同意拆成 PR-A / PR-B 兩步走
- [ ] 是否有遺漏的安全性 / RLS / 隱私考量
