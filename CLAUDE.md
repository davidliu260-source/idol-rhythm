# Idol Rhythm — Claude Code 工作規範

## 專案資訊

| 項目 | 值 |
|---|---|
| 專案名稱 | Idol Rhythm / 星動時刻 |
| 本地路徑 | `~/Desktop/idol-rhythm` |
| GitHub | `davidliu260-source/idol-rhythm` |
| 技術棧 | Next.js 14 App Router + TypeScript + Tailwind CSS + Supabase |
| 詳細參考 | `AGENTS.md`（目錄結構、型別、設計 token 等參考文件） |

---

## 每次任務前

1. 確認 `pwd` 是 `~/Desktop/idol-rhythm`，避免在錯誤目錄操作
2. **先確認邊界再動手**：任務有歧義時，先回報疑問點，等確認後才實作
3. 只做任務明確要求的事，不猜測未來需求、不預先抽象、不順手重構
4. **不得修改** ming-app、Omens 或任何非 idol-rhythm 專案

---

## 資料可見性規則（每次都要遵守）

前台正式頁面**只能顯示** `trust_level = official` 或 `media` 的資料。

- `pending` 資料只能進 `event_candidates` 候選池，**不得渲染到任何使用者可見頁面**
- 所有 Supabase query 必須 filter `is_published = true` + `trust_level IN ('official', 'media')`
- UI 必須在首頁、行程頁、詳情頁顯示 Demo data 標示（`⚠️ Demo 展示資料`）

---

## 禁止自行加入的功能

未被明確要求前，**不得加入**：

- 使用者登入 / 會員系統
- 付款 / 訂閱
- AI 搜尋 / 自動爬蟲
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
   git commit -m "..."
   git push origin feature/<phase-name>
   gh pr create --title "..." --body "..."
   ```
   PR 開出後，等 GPT 在 GitHub 上 audit 確認無誤後再 merge to main。
6. 回報：修改檔案、build 結果、feature branch 名稱、commit hash、PR 連結

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
