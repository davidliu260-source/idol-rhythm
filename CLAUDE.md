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

## 每次任務後

1. 執行 `npm run build`，確認 build 成功後才能提交
2. 只 `git add` 本輪相關檔案，不提交 `.claude/` 目錄
3. `git commit` 並 `git push origin main`
4. 回報：修改檔案、build 結果、commit hash、push 狀態

## 高風險任務

涉及資料模型變更、Supabase schema、刪除功能、大幅架構調整時，需先等待 GPT 工作單確認範圍，不得自行擴展。
