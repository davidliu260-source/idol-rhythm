# Idol Rhythm — Claude Code 工作規範

## 專案資訊

- **專案名稱**：Idol Rhythm（星動時刻）
- **本地路徑**：`~/Desktop/idol-rhythm`
- **GitHub**：`davidliu260-source/idol-rhythm`
- **詳細規範**：見 `AGENTS.md`（每次任務前必讀）

## 每次任務前

1. 確認 `pwd` 是 `~/Desktop/idol-rhythm`，避免在錯誤目錄操作
2. 閱讀 `AGENTS.md` 確認本輪範圍與限制
3. **不得修改** ming-app、Omens 或任何非 idol-rhythm 專案
4. **先確認邊界再動手**：任務有歧義時，先回報疑問點，等確認後才開始實作

## 每次任務後

1. 執行 `npm run build`，確認 build 成功後才能提交
2. 只 `git add` 本輪相關檔案，不提交 `.claude/` 目錄
3. `git commit` 並 `git push origin main`
4. 回報：修改檔案、build 結果、commit hash、push 狀態

## 高風險任務

涉及資料模型變更、Supabase schema、刪除功能、大幅架構調整時，需先等待 GPT 工作單確認範圍，不得自行擴展。

## 編碼原則（Karpathy 守則）

- **Simplicity First**：只實作本輪明確要求的功能，不猜測未來需求、不預先抽象、不加「備用」邏輯
- **Surgical Changes**：只動必要的檔案與行數，保持現有風格與 pattern，不順手重構
- **Goal-Driven**：每輪以可驗證的成功條件為目標（build 通過、畫面正確、commit hash），達到即停止
