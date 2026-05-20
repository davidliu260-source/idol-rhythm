# Idol Rhythm — Claude Code / Codex 工作規範

> **適用對象：Claude Code CLI、Codex、任何 AI coding agent。**
> 本文件維護工作規則與安全邊界；工作排程、進度索引與 migration 狀態請看 `WORKING.md`。

---

## 專案資訊

| 項目 | 值 |
|---|---|
| 專案名稱 | Idol Rhythm / 星動時刻 |
| 本地路徑 | `~/Desktop/idol-rhythm` |
| GitHub | `davidliu260-source/idol-rhythm` |
| 技術棧 | Next.js 14 App Router + TypeScript + Tailwind CSS + Supabase |
| 工作排程 | `WORKING.md`（目前階段、進度索引、migration 狀態、API / 目錄 / 設計索引） |

---

## 每次任務前

1. 確認 `pwd` 是 `~/Desktop/idol-rhythm`，避免在錯誤目錄操作
2. **先確認邊界再動手**：任務有歧義時，先回報疑問點，等確認後才實作
3. 只做任務明確要求的事，不猜測未來需求、不預先抽象、不順手重構
4. **不得修改** ming-app、Omens 或任何非 idol-rhythm 專案
5. **更新工作排程 / 進度 / migration / API / 目錄索引時，改 `WORKING.md`；更新規則與安全邊界時，改 `CLAUDE.md`**（AGENTS.md 已廢棄，不需維護）

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

## 偵錯與重大修改原則（從實戰學到）

- **Read before write**：改 bug 前先讀完相關流程的所有檔案 + 註解，特別注意 `TODO` / `later phase` / `to be added` 字樣 — 那很可能就是答案
  - 反例：PR #49 / #50 / #51 三輪都在症狀治療，因為沒先讀 `serverClient.ts` 註解；註解早寫了「Session refresh happens via middleware (to be added in a later phase)」，PR #52 才補上 middleware，才是根因
- **修了 2 次還沒中就停下重讀**：不要連開 3 個症狀治療 PR；第二次修錯時主動承認假設可能有問題，重新讀整個流程
- **完成 ≠ 結束**：build pass、commit、push 都不等於實際運作。Silent-hang（Promise 不 resolve 也不 reject）、catch 沒命中、async finally 沒跑 都算未完成。預設懷疑「表面平靜」
- **長 session 主動 checkpoint**：累積 5+ PRs 時主動整理一次成果盤點；換主題前先 summary，避免後面迷路

---

## K-pop 資料 / 來源搜尋原則

idol-rhythm 的資料品質直接決定爬蟲匹配率與前台正確性。搜尋藝人活動 / 公司歸屬 / 來源網站時必須遵守：

- **單藝人一次搜一個**：禁止 bundled query（"A B C latest activity"）— 大新聞會被稀釋成「找不到」。每個藝人獨立查詢。
  - 反例：第一次搜「2PM SF9 ONEUS MONSTA X latest 2025 2026」回報 2PM 沒新動作，實際上 2PM 2026 有兩個 dome 級巡演（Tokyo Dome + Inspire Arena Incheon）。
- **「沒搜到 ≠ 不活躍」**：英文搜尋空手而回時，**改用韓文關鍵字再搜一次**（如 `투피엠 콘서트 2025`、`컴백`、`완전체 활동`）。韓文媒體通常比英文早且完整。
- **新出道團 / 改公司 / 解約消息**至少查兩個獨立來源確認（Wikipedia + 韓文新聞 / 官方公告），不靠單一聚合站。
  - 反例：CORTIS 第一次盤點漏掉（2025/8 出道，HYBE/BigHit 第三團，破百萬銷量）。
- **預設「都收」勝過「我來判斷該停用誰」**：is_active 預設為 true。dormant 偶像在 kpopofficial 聚合來源命中後若加上「偶像目前停用」reviewer_note 之類的機制再說（目前未實作；之前討論過的選項 B）。**不要靠我手動判斷活躍度去 UPDATE is_active**。

---

## 接手須知（給下一個 session 的 Claude）

進來新工作時，**先讀本檔**，然後：

1. **找出使用者要做哪個代號**（例如 I1b-B、M1a、J7d-B）— 從 `WORKING.md` 進度索引找狀態 🔒 / 🔲 的項目
2. **若是 🔒「待 GPT 工作單」**：使用者會貼 GPT review 結論給你，再開實作 PR
3. **若是 🔲「待辦」且不涉 migration / Storage / RLS**：可直接開 feature branch 實作
4. **若是 🔲 但涉及 migration / Storage / RLS / AI / 爬蟲 / 付款**：先寫工作單草案 PR，等使用者拿給 GPT review

**工作流程：**
- 每個任務：`git fetch origin main && git checkout -b feature/<phase> origin/main`
- 寫 code → `npm run build` 必過 → `git add` 只加本任務檔案 → commit → push → `gh pr create`
- 涉及 migration：SQL 檔放 `supabase/migrations/`，使用者手動到 Supabase SQL Editor 執行
- PR merge ≠ migration 已執行；migration 要使用者再去 Supabase 跑

**Worktree 注意：** 本 repo 開 worktree 在 `.claude/worktrees/<name>`，無法直接 `git checkout main`。改用 `git fetch origin main && git checkout -b <new-branch> origin/main`。

**文件分工注意：** `CLAUDE.md` 是規則與安全邊界入口；`WORKING.md` 是工作排程、進度索引、migration 狀態與 API / 目錄索引。`SOURCE_INVENTORY_A.md` 等文件只是研究附件，不是新的工作紀錄中心。

**交接閱讀順序（給未來 Claude Code / Codex）：**
1. 先讀 `CLAUDE.md`：規則、安全邊界、工作流程。
2. 再讀 `WORKING.md`：目前做到哪裡、下一步做什麼、migration 狀態、API / 目錄索引。
3. 依任務主題按需補讀：
   - crawler / AI pipeline：`AI_PIPELINE_PLAN.md`
   - 官方來源研究：`SOURCE_INVENTORY_A.md`
   - 特定來源工作單：`CRAWLER_WORK_ORDER_YG.md`、`CRAWLER_WORK_ORDER_WAKEONE.md`、`CRAWLER_WORK_ORDER_SMTOWN.md`
   - 中文顯示 / 快閃店規劃：`DISPLAY_LOCALIZATION_AND_POPUP_WORK_ORDER.md`
   - 中文生成規劃：`CHINESE_GENERATION_WORK_ORDER.md`
   - 主流漏網藝人 seed 規劃：`MAINSTREAM_ARTIST_SEED_WORK_ORDER.md`

**不要把以下文件當作目前真相來源：**
- `AGENTS.md`：已廢棄，只保留 redirect。
- `PROJECT_STATUS.md`：歷史交接快照，已落後 `WORKING.md`。
- `MVP_SCOPE.md`、`PRODUCT_SPEC.md`：產品早期規劃 / 歷史背景。
- `SUPABASE_SCHEMA.md`、`ADMIN_WRITE_PLAN.md`：早期草稿 / 安全方案，實際狀態以 migrations + `WORKING.md` 為準。
- `00_Obsidian首頁.md`、`TASK_驗證 draft 不出現在前台.md`：個人筆記 / 單次任務卡，不作為 agent 工作入口。

---

## 工作排程與索引

- 目前階段、已完成進度、待辦、migration 狀態、Env、目錄結構、API Routes、設計規範：請看 `WORKING.md`。
- 新 session 先讀本檔確認規則，再依任務需要讀 `WORKING.md` 的相關段落。
