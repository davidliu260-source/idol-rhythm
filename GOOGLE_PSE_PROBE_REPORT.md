# P1-A Google PSE Manual Probe Report

> **日期**：2026-05-24
> **結論**：Google PSE / Custom Search JSON API 暫不適合作為 Idol Rhythm v1 Search Discovery provider
> **狀態**：Deferred（探測失敗，改評估替代方案）

---

## 探測過程

1. 已建立 Programmable Search Engine（CX 取得）
2. PSE 設定限制：**無法開啟「搜尋整個網路」**，只能使用 trusted-site search（需逐一指定允許站點）
3. 已建立 `Idol Rhythm Google PSE Server Key`，API restriction 設為 Custom Search API
4. 實際呼叫 `https://www.googleapis.com/customsearch/v1?...`

## 錯誤結果

```
HTTP 403
{
  "error": {
    "message": "This project does not have the access to Custom Search JSON API."
  }
}
```

## 失敗原因分析

- Google Cloud 專案需另外啟用 Custom Search JSON API（在 API Library 明確開啟），僅建立 API key 並設定 restriction 不等於已啟用
- 即使啟用後，PSE 免費版預設限制為 trusted-site search，**無法搜尋整個網路**
- 要搜尋全網需升級至 Google Workspace 或企業方案，不符合 v1 輕量探索需求
- 進一步設定代價（billing 帳戶、API 啟用流程、配額管理）超出 v1 期望的低門檻

## 結論

**Google PSE / Custom Search JSON API 暫不採用**，理由：
- 403 錯誤代表啟用流程有額外門檻（Google Cloud API Library 開啟、billing 帳戶）
- 免費版 trusted-site search 限制使其無法作為通用 discovery 工具
- 配額每日 100 queries 的假設在這個限制下意義降低

## 下一步：替代方案評估

| 方案 | 說明 | 優點 | 缺點 |
|---|---|---|---|
| **SerpAPI** | 代理 Google 搜尋結果，不需自己管 Google API | 結構化 JSON、支援 site:、免費 100 searches/month | 月額度低；付費 $50/month 起 |
| **Brave Search API** | 獨立搜尋索引，非 Google | 免費 2000 queries/month、無 billing 門檻 | site: 效果弱；索引覆蓋率未驗證 |
| **Manual Search + Claude fallback** | 管理員手動搜尋，貼 URL 給 Claude 解析 | 零 API 成本、完全可控 | 純人工，無法自動化 |

**建議評估順序**：先評估 Brave Search API（免費額度高、無 billing 門檻），再看 SerpAPI（付費但體驗好），Manual fallback 作為無 API 時的過渡。

---

## 不影響現有系統

本次探測為純人工驗證，未改動任何 code / schema / migration / env var。現有 crawler 正常運作不受影響。
