# 封鎖站真瀏覽器探測報告（BLOCKED_SITE_BROWSER_PROBE）

> **日期**：2026-07-15
>
> **執行者**：PM（Claude），真實瀏覽器直接實測，非 curl
>
> **範圍**：research-only；只讀公開頁面；未寫入任何 DB、未修改 `src/`
>
> **Verdict**：**「封鎖清單」的框架是錯的 → 建議 Scrapling 線（PR #185）不投**

---

## TL;DR

- 用真實瀏覽器（App 內建 + Owner 的 Chrome）實測 4 個被列為「封鎖 / 不要重複嘗試」的站。
- **關鍵發現：進得去也沒用——經紀公司官網自己就沒有這些資料。**
  - (G)I-DLE 日本官網：**零阻擋、完全載入**，但最新一筆是 **2025.04.05**（15 個月未更新）。
    而 (G)I-DLE **確實有 2026 行程**（Kai Tak Stadium 6/27–28，已於 B-1a 驗證）。官網不知道。
  - BTS 官網 `ibighit.com/bts/eng/schedule/`：Owner 的 Chrome 進得去，但該 URL **被導向 `/ko/main`**
    —— schedule 頁面已不存在。
  - THEBLACKLABEL：**「유지 관리 모드」（維護模式）**。兩個月前 503，現在仍是關的。不是反爬，是站沒開。
  - Weverse：**登入牆**（「僅供社群成員使用」），與兩個月前 Verdict C/D 一致。
- → **63 個零候選黑洞的成因不是「爬不到官網」，是「官網沒有資料」。** 這與盤點文件自己的結論
  （「跑了也沒可發布活動」）一致，只是當時沒往下追問「那資料在哪」。
- **資料在場館 / 售票 / 主辦端**，而且**全部公開無封鎖**：Kai Tak Sports Park、SoFi Stadium、
  Gillette Stadium、Galaxy Macau、Tokyo Dome —— B-1a 的 17 個 citation 全從這類來源取得，
  5/5 精準、0 假陽性、$0.049/event。
- **結構性理由**：經紀公司沒有動機即時更新官網；**場館與售票商必須更新，因為他們要賣票**。

---

## 1. 實測明細

| 站 | 工具 | 結果 | 資料可用性 |
|---|---|---|---|
| `weverse.io/enhypen/notice` | App 內建瀏覽器 | 載入 → 導向登入 | ❌ 登入牆：「僅供社群成員使用。登入後查看」 |
| `gidle.cubeent.jp/schedule/` | App 內建瀏覽器 | **HTTP 200，完整渲染** | ❌ **最新 2025.04.05**，15 個月未更新；無 2026 行程 |
| `theblacklabel.com` | App 內建瀏覽器 | 載入 | ❌ 標題「THEBLACKLABEL - 유지 관리 모드」＝維護模式 |
| `ibighit.com/bts/eng/schedule/` | App 內建瀏覽器 | ❌ 拒絕 | — |
| `ibighit.com/bts/eng/schedule/` | **Owner 的 Chrome** | ✅ **載入成功** | ❌ 被導向 `/ko/main`；schedule 路徑已不存在 |
| `cubeent.co.kr/artist/schedule` | App 內建瀏覽器 | ❌ 拒絕 | — |

> 對照組：同一個 App 內建瀏覽器成功載入 `gidle.cubeent.jp`，證明拒絕來自站方而非工具故障。
> Owner 的 Chrome 能突破 `ibighit.com` 的封鎖 → **真瀏覽器確實可繞過部分反爬**。

### (G)I-DLE 日本官網實際內容（節錄）

```
2025.04.05 TV    【(G)I-DLE】番組出演情報 (TBS系「夜明けのラヴィット！」)
2025.01.31 OTHERS MIYEON BIRTHDAY
2024.09.01 EVENT&LIVE 【東京】2024 (G)I-DLE WORLD TOUR [iDOL] DAY 2
```

最新一筆 2025.04.05。**2026 Kai Tak 場次完全不存在於官網**，但 Kai Tak Sports Park 官方頁明列
「i-dle WORLD TOUR [Syncopation] ... at Kai Tak Stadium on June 27 and 28, 2026」。

---

## 2. 對 Scrapling 線（PR #185）的結論

**建議：不投。**

`SCRAPLING_PROBE_WORK_ORDER.md` 要解的問題是「能否突破 curl 失敗的反爬站點」。
本次實測顯示**該問題不是瓶頸**：

1. 有的站根本沒鎖（Cube JP）——突破了也只拿到 15 個月前的資料。
2. 有的站鎖了但裡面是空的（BTS schedule 頁已移除）。
3. 有的站已經關閉（THEBLACKLABEL 維護模式）。
4. Weverse 是登入牆，不是反爬——Scrapling 也不解登入。

→ 投入 Scrapling 的期望報酬接近零：**它解「進不去」，而我們的問題是「裡面沒有」。**

> ⚠️ 本結論**只否決 Scrapling 這條技術路線**，不否決 `SCRAPLING_PROBE_WORK_ORDER.md` 文件本身
> （保留為歷史紀錄 + 「不要重複嘗試」依據）。

---

## 3. 真瀏覽器的能力邊界（重要，別誤用）

Owner 的 Chrome 可突破部分封鎖，但**不能作為 runtime**：

- **不可自動化**：需要 Owner 的桌機開著、需要 agent 在對話中在場。
- **不可部署**：Vercel cron 無法驅動桌面瀏覽器。
- **定位**：它是**探測工具**（本次五分鐘推翻兩個月的假設）與一次性補資料工具，
  **不是每日自動管道**。

---

## 4. 下一步建議

**不要**再往「突破經紀公司官網」投資源。改走已驗證的路：

- **B-6 discovery 探測（建議新開票）**：把 B-1/B-1a 已驗證的 B-direct 設定
  （`web_search_20260209` + `allowed_callers:["direct"]`），從「求證既有候選」轉為
  **「對零候選藝人主動發現行程」**，讓它去場館 / 售票 / 主辦端找。
- ⚠️ **但求證 ≠ 發現，不可假設**：
  - 求證＝「這個說法對不對」，有標準答案可比對 → 已證明 5/5。
  - 發現＝「有沒有我不知道的事」，**無候選可對照，假陽性更危險**（憑空生出不存在的場次直接上前台），
    且「查無資料」與「真的沒活動」難以區分。
  - → **必須先探測再實作**，比照 P1-A / P1-B / B-0 紀律。

---

## 5. Repo / 資料影響

- 只新增本報告一個 Markdown 文件。
- 未寫入任何 Supabase table；未修改 `src/`、schema、migration、RLS、發布邏輯或前台。
- 未使用 Owner 的登入 session 抓取會員限定內容（Weverse 僅確認登入牆存在即停止）。
