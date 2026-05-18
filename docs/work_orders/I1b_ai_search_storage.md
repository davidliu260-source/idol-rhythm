# I1b 工作單草案：AI 搜圖 + Supabase Storage

> **狀態：** Draft，等 GPT 審核後才可開工。
> **前置：** I1a（PR #31）已完成且 migration 025 已執行。
> **作者：** Claude Code（草擬）
> **影響：** 新 Supabase Storage bucket + 兩個 API route + 後台 UI 升級。
> **風險：** 高（外部圖片抓取、Storage 設定、AI 成本、版權）。

---

## 1. 背景

I1a 完成後可手動貼圖片 URL，但每位藝人都要使用者自己找圖、複製圖片網址，繁瑣。I1b 用 AI 自動搜尋官方宣傳照，提供 4–6 個候選縮圖讓使用者選擇，選定後自動下載並上傳到 Supabase Storage，寫回 `idols.avatar_url`。

I1b **不**修改 schema（avatar_url 欄位 I1a 已加），純粹是後台 UX 升級 + Storage 接入。

---

## 2. 目標

1. 新建 Supabase Storage bucket `idol-avatars`（public read，admin write）
2. 後台 `/admin/idols/<id>/edit` 加「🔍 搜尋照片」按鈕
3. 點按鈕 → 呼叫 `POST /api/admin/idols/<id>/search-avatars` → AI 回傳候選圖片清單
4. 使用者點縮圖 → 呼叫 `POST /api/admin/idols/<id>/upload-avatar` → 後端下載 + 上傳到 Storage + 更新 `idols.avatar_url`
5. 保留 I1a 既有「手動貼 URL」欄位作為逃生口

---

## 3. 技術設計

### 3.1 Supabase Storage Bucket

**手動在 Supabase Dashboard 建**（不寫進 migration，因 storage policies API 需 service_role 且 Dashboard 有專用 UI）：

| 設定 | 值 |
|---|---|
| Bucket name | `idol-avatars` |
| Public | true |
| File size limit | 2 MB |
| Allowed MIME | `image/jpeg`, `image/png`, `image/webp` |

**RLS Policies on `storage.objects`：**

```sql
-- Public read
CREATE POLICY "idol-avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'idol-avatars');

-- Admin write (INSERT/UPDATE/DELETE)
CREATE POLICY "idol-avatars: admin write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'idol-avatars'
    AND EXISTS (SELECT 1 FROM public.admin_users
                 WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "idol-avatars: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'idol-avatars'
    AND EXISTS (SELECT 1 FROM public.admin_users
                 WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "idol-avatars: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'idol-avatars'
    AND EXISTS (SELECT 1 FROM public.admin_users
                 WHERE user_id = auth.uid() AND is_active = true)
  );
```

**問題（需 GPT 決定）：** 寫進 migration 026（J7d 用 026）還是 027？或留作 Dashboard 手動？建議 Dashboard 手動 — Storage policies 改錯易導致公開寫入或讀取失敗，UI 比 SQL 直觀。

### 3.2 AI 搜圖 API Route

`POST /api/admin/idols/<id>/search-avatars`

```ts
export async function POST(request, { params }) {
  // 1. admin guard (getCurrentAdmin)
  // 2. 從 idols 表讀 name + korean_name
  // 3. 呼叫 Claude（with web_search tool）：
  //    "Find 4-6 official promotional photos of <name> (<korean_name>).
  //     Return JSON: { candidates: [{ url, source, width, height }] }"
  // 4. 解析回應，validate URL 是 https + 圖片副檔名
  // 5. 回傳 { candidates: [...] }
}
```

**問題（需 GPT 決定）：** 圖片來源策略：

A. **Anthropic Claude + web_search tool**
   - 模型：Sonnet 4.6（Haiku 暫不支援 web_search）
   - 成本：~$0.003 per request（admin 觸發，量不大）
   - 優點：API key 已有
   - 缺點：回傳格式不穩定，要 prompt engineer + 多輪 retry
   - 缺點：可能回傳一般圖片網站 URL（Wikipedia / Wikimedia 等），需驗證授權

B. **Bing Image Search API**
   - 月免費 1000 次
   - 結構化結果，包含縮圖 / 原圖 / 來源頁
   - 需要新 env `BING_SEARCH_API_KEY`
   - 缺點：可能拿到低畫質、非官方照片

C. **混合：Claude 先 web_search 找官方來源頁，再 Bing 搜圖**
   - 兩段呼叫，成本疊加
   - 優點：偏好 official_website / 官方 IG 結果

**建議 A**：用 Claude + web_search，prompt 限定「official press release / press kit / Wikipedia / 經紀公司官網」，cost 可接受。

### 3.3 Upload API Route

`POST /api/admin/idols/<id>/upload-avatar`

```ts
Body: { sourceUrl: string }

export async function POST(request, { params }) {
  // 1. admin guard
  // 2. validate sourceUrl 是 https
  // 3. fetch(sourceUrl) — server-side 下載，避免瀏覽器 CORS
  //    timeout 10 秒, max 5 MB
  // 4. 檢查 Content-Type 是 image/jpeg|png|webp
  // 5. 用 sharp 壓縮到 512x512（jpeg quality 85），統一成 jpeg
  // 6. 用 service_role client 上傳到 Storage：
  //    path = `${idol.slug}-${Date.now()}.jpg`
  // 7. 拿到 publicUrl
  // 8. 砍舊頭像（若 avatar_url 已指向我們 Storage）
  // 9. UPDATE idols.avatar_url = publicUrl
  // 10. revalidatePath('/admin/idols', '/idols', '/', '/schedule')
  // 11. 回傳 { avatarUrl: publicUrl }
}
```

**Dependencies：** 需要 `sharp` package（`npm install sharp`）。Vercel runtime 已內建支援。

**問題（需 GPT 決定）：**
- 壓縮尺寸 512x512 vs 256x256 vs 不壓縮？建議 512（前台最大 lg=64px，2x retina=128px，512 給未來 hero 圖空間）
- 統一轉 jpeg 還是保留原格式？建議統一 jpeg（簡化儲存）
- 砍舊頭像時機（即時 vs cron 清理）？建議即時，避免累積垃圾

### 3.4 後台 UI

修改 `src/app/admin/idols/[id]/edit/EditIdolForm.tsx`：

在「頭像圖片 URL」欄位上方加：

```
┌─────────────────────────────────────┐
│ 🔍 用 AI 搜尋藝人照片                  │
└─────────────────────────────────────┘

[點按鈕後展開 4-6 張縮圖 grid]
┌────┐ ┌────┐ ┌────┐
│ 📷 │ │ 📷 │ │ 📷 │
│ A  │ │ B  │ │ C  │
└────┘ └────┘ └────┘

[使用此圖] [點縮圖選擇]
```

選定後上方既有「頭像圖片 URL」自動填入新的 Storage URL（使用者也能看到、可手動覆蓋）。

### 3.5 環境變數

如選方案 A，無需新 env（已有 `ANTHROPIC_API_KEY`）。
如選方案 B 或 C，需 Vercel Production 加 `BING_SEARCH_API_KEY`。

---

## 4. 開放決策（需 GPT 確認）

| # | 問題 | Claude 建議 |
|---|---|---|
| 1 | 圖片來源用 A / B / C？ | A（Claude + web_search）|
| 2 | Storage RLS 寫 migration 還是 Dashboard 手動？ | Dashboard 手動 |
| 3 | Bucket public 還是 private + signed URL？ | public（前台 anon 直讀）|
| 4 | 壓縮尺寸？ | 512×512 jpeg q85 |
| 5 | 覆寫舊頭像時砍舊檔嗎？ | 砍（只砍 idol-avatars bucket 內的，外部 URL 不動）|
| 6 | search-avatars 失敗時 fallback？ | 顯示錯誤訊息，保留手動貼 URL 欄位 |
| 7 | upload 大小上限？ | 5 MB（下載端），輸出 ~50 KB（壓縮後）|
| 8 | sharp 壓縮 vs Vercel Image Optimization？ | sharp（一次性壓縮存 Storage，免每次請求都走 Vercel）|
| 9 | 版權標示？ | 不顯示，但 search-avatars 回傳的 source 欄位記錄在 metadata（未來可加）|

---

## 5. 範圍

### 包含
- Supabase Storage bucket `idol-avatars` 建立（手動 Dashboard）+ 4 條 RLS policy
- `POST /api/admin/idols/<id>/search-avatars`
- `POST /api/admin/idols/<id>/upload-avatar`
- EditIdolForm 加 AI 搜尋按鈕 + 縮圖 grid + 上傳 progress + error UI
- `npm install sharp`
- I1a 既有「手動 URL」欄位保留

### 不包含
- 圖片裁切 / 編輯工具
- 多張照片輪播
- 偶像成員個別頭像
- 自動定期更新照片
- 版權自動驗證
- Migration 改動 idols schema（I1a 已加 avatar_url）
- 變更前台顯示邏輯（IdolAvatar 已支援）

---

## 6. 驗收標準

1. Dashboard 確認 bucket `idol-avatars` 存在，public read，admin write
2. 後台 `/admin/idols/<id>/edit` 看到「🔍 用 AI 搜尋藝人照片」按鈕
3. 點按鈕，10 秒內回傳至少 3 張候選縮圖（成功率允許 10% 失敗）
4. 點任一縮圖，5 秒內顯示「上傳成功」，「頭像圖片 URL」自動填入 Storage URL
5. 前台 `/idols` 立即看到新頭像
6. 第二次更換頭像，Storage 內舊檔被刪
7. 非 admin 呼叫 API → 401
8. 非圖片 URL → upload 拒絕，顯示錯誤
9. > 5MB → 拒絕
10. 圖片下載超時（>10s）→ 顯示「來源無回應」

---

## 7. 預估工作量

| 部分 | 預估 |
|---|---|
| Storage bucket + RLS（手動）| 15 分鐘 |
| `npm install sharp` + Vercel 設定確認 | 10 分鐘 |
| search-avatars API + prompt engineer | 2 小時 |
| upload-avatar API + sharp 壓縮 + Storage upload | 1.5 小時 |
| EditIdolForm UI（按鈕 + grid + state machine）| 2 小時 |
| 錯誤處理 + UX polish | 1 小時 |
| 測試（多種藝人 / 失敗情境）| 1 小時 |
| **合計** | **~8 小時** |

可拆兩個 PR：
- PR-A：Storage bucket（手動）+ upload-avatar API（純後端，先用 curl / Postman 測）
- PR-B：search-avatars API + EditIdolForm UI（接上 PR-A）

---

## 8. GPT 審核請確認

- [ ] 是否同意整體技術方案
- [ ] 開放決策 #1–#9 的選擇
- [ ] 圖片版權 / 授權層面是否需要額外標示
- [ ] AI 成本（每次 admin 觸發 ~$0.003）是否接受
- [ ] 是否同意拆 PR-A / PR-B
- [ ] sharp 壓縮 vs Vercel Image Optimization 的選擇
- [ ] Storage policy 是否走 Dashboard 而非 SQL migration

---

## 9. I1a 與 I1b 的銜接

| 行為 | I1a 後（現在）| I1b 後 |
|---|---|---|
| 後台填手動 URL | ✅ | ✅（保留逃生口）|
| 後台 AI 搜尋 | ❌ | ✅ |
| 圖片來源 | 外部任意 https | 內部 Storage（`idol-avatars.../*.jpg`）為主 + 外部 URL 為輔 |
| 圖片壽命 | 取決於來源網站 | 永久（Storage 自管）|
| 圖片速度 | 取決於來源 CDN | Supabase CDN（全球 edge）|

I1b 不破壞 I1a：avatar_url 仍是 nullable text，可以是任意 https。
