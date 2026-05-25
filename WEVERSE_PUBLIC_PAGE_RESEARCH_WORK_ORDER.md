# Weverse / Weverse Shop Public Page Research Work Order

> **Status**: research planning only — no probe execution in this PR.
> **Type**: 規劃工作單（規劃下一輪 Weverse + Weverse Shop 公開頁面 probe 的範圍、方法論、verdict 分類、輸出格式）
> **Date**: 2026-05-25
> **Owner**: idol-rhythm
> **Triggers**: HYBE 系藝人重要資訊（notice / LIVE / merch / membership / release / fan event）多落在 Weverse / Weverse Shop。需重新評估「公開頁面」的可爬性，特別是 **Weverse Shop（先前未深入探測）**。
> **Prior work**: `CRAWLER_WORK_ORDER_WEVERSE.md`（PR #131）+ `WEVERSE_PROBE_REPORT.md`（PR #132）= **Verdict C** on `weverse.io` core SPA. 本工作單不重測，但延伸到 Shop / 新藝人 / 新 page type。

---

## 1. 任務定位

### 1.1 本輪只做

- 規劃下一輪「公開頁面 probe」的範圍、方法論、verdict 分類、輸出格式
- 釐清要 probe 的 9 個 HYBE 藝人 × N 個 page type 矩陣
- 重申**禁止項目**邊界（login / cookie / token / 付費 / 會員 / 私密 / DM）
- 開放問題供 GPT audit 裁定

### 1.2 本輪不做

- ❌ 不執行 curl / WebFetch / 瀏覽器 probe
- ❌ 不寫 crawler runtime / 不新增 parser_type
- ❌ 不新增 migration / schema / RLS / GRANT
- ❌ 不 seed `crawler_sources`
- ❌ 不改 UI / 前台 / 後台 / API route / 通知
- ❌ 不消耗 ANTHROPIC_API_KEY
- ❌ 不碰 `.env.local`
- ❌ 不提交 `.claude/` / `.next/` / `node_modules/`

---

## 2. 背景

### 2.1 為什麼現在重新檢視 Weverse 領域

- HYBE 系藝人是 Idol Rhythm 主流量來源（BTS / SEVENTEEN / TXT / ENHYPEN / LE SSERAFIM / ILLIT / TWS / BOYNEXTDOOR / CORTIS 等）
- 既有 HYBE 廠牌（ibighit / pledis / sourcemusic / beliftlab / adorent / kozent）官網在 P1-B8 全 Verdict C（503 / 403 / 404 / SPA）
- `weverse.io` 在 PR #132 也被裁定 Verdict C（全 SPA shell 5478 bytes 對所有 URL）
- 目前 HYBE 系覆蓋只靠 `kpopofficial-concerts` 聚合 + 人工輸入；資料品質與時效不理想
- **Weverse Shop（`shop.weverse.io` / `weverseshop.io`）是獨立產品，先前未專門探測**，可能與主 Weverse SPA 不同架構（商品電商有時走 SSR + 商品結構化 metadata，利於 SEO）

### 2.2 與先前 PR #131 / #132 的關係

| Prior work | 結論 | 本工作單繼承 |
|---|---|---|
| `CRAWLER_WORK_ORDER_WEVERSE.md`（PR #131）| 探測規劃 | ✅ 沿用「禁止項目」邊界 + 11 條探測問題 |
| `WEVERSE_PROBE_REPORT.md`（PR #132）| `weverse.io` Verdict C | ✅ 不重測 `weverse.io` 已知 verdict C 路徑；只看是否有先前未檢查的 page type |

**重要**：本輪有可能再次整體 Verdict C — 但需逐 page type / 逐藝人確認，特別是 Weverse Shop 領域**從未確認過**。

---

## 3. In Scope

- Weverse.io 公開頁面 — 確認 PR #132 結論是否覆蓋 9 個指定藝人的下列 page type：
  - `notice`
  - `media`
  - `live`（**只看公開預告 metadata，不抓直播內容**）
  - `highlight`
- Weverse Shop 公開頁面（**主要焦點**）：
  - `merch`（商品列表 / 商品詳情）
  - `fanclub / membership`（會員介紹頁，**非會員登入後內容**）
  - `album / release / pre-order`
  - `event / benefit / lucky draw`（公開行銷頁面，**非會員限定優惠**）
- 9 個 HYBE 系藝人：
  1. **BTS**
  2. **TXT**（Tomorrow X Together）
  3. **SEVENTEEN**
  4. **ENHYPEN**
  5. **LE SSERAFIM**
  6. **ILLIT**
  7. **TWS**
  8. **BOYNEXTDOOR**
  9. **CORTIS**
- 每個 (artist × page type) 給 verdict A / B / C / D（見 §6）
- 觀察 robots.txt / ToS 公開條款（**不繞過任何條款**）

---

## 4. Explicitly Out of Scope（硬規則）

| # | 禁止項目 | 違反處置 |
|---|---|---|
| 1 | 登入 Weverse / Weverse Shop（任何 provider：email / Apple / Google / NAVER / LINE）| 自動 Verdict 不適用 — 整個 page type 跳過 |
| 2 | 使用帳號密碼 / API token / OAuth 授權 | 同上 |
| 3 | 保存 / 重放 cookie / session / token / JWT | 同上 |
| 4 | 抓會員限定 / 付費 / DM / 私密 / 直播內容 | 自動 Verdict D — 直接禁止納入 |
| 5 | 繞過驗證碼 / 登入牆 / 反爬 / access control / rate limit | 同 #1 |
| 6 | 反向工程 mobile app / WebView SDK / private API | 同 #1 |
| 7 | DRM / paid-content endpoint | 同 #4 |
| 8 | 留言 / 會員限定 post / live chat / moment | 同 #4 |
| 9 | 任何需要 Idol Rhythm 持有 Weverse credentials 的路徑 | 同 #1 |
| 10 | 自動繞過「Open in app」/ deep link 強制下載 app 的引導 | 自動 Verdict B（page type 屬於 app-only） |

> ⚠️ 「**技術上可以**繞過」不代表「**應該**繞過」。本工作單 / 後續 probe / 後續 runtime 一律不引入任何違反 §4 的路徑，即使該路徑會大幅提升資料品質。

---

## 5. 待 probe 的 (artist × page type) 矩陣

### 5.1 Weverse 主站（`weverse.io/<community>`）

| Artist | community slug（推測，需 probe 確認）| notice | media | live (preview) | highlight |
|---|---|---|---|---|---|
| BTS | `bts` | TBD | TBD | TBD | TBD |
| TXT | `txt` 或 `tomorrow_x_together` | TBD | TBD | TBD | TBD |
| SEVENTEEN | `seventeen` | TBD | TBD | TBD | TBD |
| ENHYPEN | `enhypen` | TBD | TBD | TBD | TBD |
| LE SSERAFIM | `le_sserafim` 或 `lesserafim` | TBD | TBD | TBD | TBD |
| ILLIT | `illit` | TBD | TBD | TBD | TBD |
| TWS | `tws` | TBD | TBD | TBD | TBD |
| BOYNEXTDOOR | `boynextdoor` | TBD | TBD | TBD | TBD |
| CORTIS | `cortis` | TBD | TBD | TBD | TBD |

> ⚠️ 9 × 4 = **36 個 page type**；實際 probe 時，若 PR #132 已確認 `weverse.io/<任意 community>` 是同樣 5478-byte SPA shell，則僅需各藝人 抽 1 個 page type 驗證（如 `/notice`）即可一次裁定全 4 個 page type Verdict C；不必跑滿 36 次。

### 5.2 Weverse Shop（**主要焦點**）

domain 候選（probe 確認用哪個）：
- `shop.weverse.io` 主域
- `weverseshop.io` 獨立域（部分國家版本）
- `*.weverseshop.com` 變體

| Artist | merch list | merch detail（任挑 1）| fanclub intro | album / release / pre-order | event / benefit |
|---|---|---|---|---|---|
| BTS | TBD | TBD | TBD | TBD | TBD |
| TXT | TBD | TBD | TBD | TBD | TBD |
| SEVENTEEN | TBD | TBD | TBD | TBD | TBD |
| ENHYPEN | TBD | TBD | TBD | TBD | TBD |
| LE SSERAFIM | TBD | TBD | TBD | TBD | TBD |
| ILLIT | TBD | TBD | TBD | TBD | TBD |
| TWS | TBD | TBD | TBD | TBD | TBD |
| BOYNEXTDOOR | TBD | TBD | TBD | TBD | TBD |
| CORTIS | TBD | TBD | TBD | TBD | TBD |

> 9 × 5 = **45 個 page type**；同樣，若 Shop 主架構統一，先 probe 2-3 藝人就能一次裁定。

### 5.3 預期數量（採聚合策略）

理論上 36 + 45 = 81 個 (artist × page type) probe 點。實際採「**先測架構，再測藝人差異**」策略：

1. 第 1 階段：對 **1 個藝人**（建議 BTS）跑滿 4 + 5 = 9 個 page type，定錨各 page type 的架構與 verdict
2. 第 2 階段：對其餘 8 個藝人**只 probe 第 1 階段中 verdict A / B 的 page type**，確認是否一致
3. C / D verdict 的 page type 假設適用全 9 藝人，不重測

預估 probe 點縮減到約 **15-25 個 URL**。

---

## 6. Verdict 定義（per page type per artist）

| Verdict | 定義 | 後續處置 |
|---|---|---|
| **A** | HTTP 200 + 顯著 server-rendered HTML + 藝人名 / 活動 / 商品 / 日期 / 標題 grep 命中 + 無 SPA shell 主導 + 無 Cloudflare / bot challenge + bot UA = 桌面 Chrome UA 一致接受 | 可考慮列入未來 source（**仍需另開 runtime 工作單**，不在本工作單範圍）|
| **B** | HTTP 200 但內容靠 client-side hydration（SPA + 事件資料在 hydration 後才載入）/ 或內容不完整（缺日期 / 缺藝人對應）/ 或強制 Open in app | 不開 source；記錄理由，留待未來 v2 評估 |
| **C** | 需要登入 / cookie / token / session 才能取得內容（哪怕是公開資訊也透過 auth gate）| 自動排除，不重測 |
| **D** | 付費 / 會員限定 / DM / 私密 / 直播實況內容 — **本質上不應該被爬** | **硬性禁止**納入，永久標記 |

> Verdict A 是**最高門檻**：需同時通過架構、內容、UA、無 bot challenge 4 項全部檢查。任一不通過即降為 B 或 C。

---

## 7. Probe 方法論（給後續 report PR 用）

### 7.1 工具

- **僅** `curl` + 系統瀏覽器 incognito DevTools
- **禁止**：headless（Puppeteer / Playwright / Selenium）— 因為這些工具的目的是模擬登入後行為，違反 §4
- **禁止**：保存 / 重放 cookie

### 7.2 UA 雙重驗證

- 桌面 Chrome：`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
- 專案 bot UA：`IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)`

兩者回應**必須一致**才能進 Verdict A。

### 7.3 Per-URL 探測流程

1. `curl -sLI -A "<UA>" -m 15 <url>` 觀察 status + server header
2. `curl -sL -A "<UA>" -m 15 <url> -o /tmp/probe/<key>.html` 取得 body
3. `wc -c` 確認 size（≥ 5000 bytes 過第一道）
4. `grep -c 'id="root"\|id="__next"'` 偵測 SPA shell（命中 = 弱訊號）
5. `grep -ic <藝人名 + 活動關鍵字>` 評估內容密度
6. `grep -ic "login\|sign in\|로그인\|Open in app"` 偵測 auth gate / app-redirect
7. `cat robots.txt` 確認該 path 是否被 Disallow
8. 觀察 `set-cookie`：含 `weverse_*` session / auth cookie → 是 auth gate 訊號

### 7.4 Rate-limit 自律

- 同一 host 每秒不超過 1 個 request
- 單一 host 一次不超過 5 個 URL
- 觀察到 429 / Cloudflare challenge 立即停止該 host

---

## 8. 輸出格式（給後續 report PR）

建議檔名：`WEVERSE_PUBLIC_PAGE_PROBE_REPORT.md`

per-URL 紀錄：

```markdown
### <artist> / <page type>

- **URL**: `<full url>`
- **method**: curl + browser DevTools incognito
- **HTTP**: <status>, <bytes>
- **server**: <header>
- **SPA shell?**: yes / no
- **artist name grep hits**: <count>
- **content keyword grep hits**: <count>
- **auth gate observed?**: yes / no (cookies set / login redirect / app redirect)
- **robots.txt**: permissive / Disallow / not checked
- **UA parity (Chrome vs bot)**: same / different
- **Verdict**: A / B / C / D
- **Reason**: <one sentence>
- **Probe artifacts**: /tmp/probe/<key>.html (not committed)
- **Probe date**: YYYY-MM-DD
```

最後總表：

```markdown
## Summary

| Artist | Notice | Media | Live | Highlight | Merch | Fanclub | Album | Event |
|---|---|---|---|---|---|---|---|---|
| BTS | C | C | C | C | A? | C | B? | C |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

Verdict A count: N
Verdict B count: N
Verdict C count: N
Verdict D count: N
```

---

## 9. 風險

| # | 風險 | 緩解 |
|---|---|---|
| R1 | 探測過程意外觸發 Weverse 帳號鎖 / IP 黑名單 | 嚴守 §7.4 rate-limit；只用桌面 incognito + bot UA，不模擬登入 |
| R2 | Verdict A 過於樂觀（架構看起來 OK，但實際 hydration 後內容才出現）| 在 report 加 `server-rendered content explicitly visible in initial HTML?` 必填欄位 |
| R3 | Shop 商品頁顯示「coming soon」/ 商品下架 而非完整資料 | report 紀錄該 URL 探測當下狀態；未來 runtime 工作單需另設 fallback |
| R4 | Verdict A 落入 ToS 灰區（公開可抓 ≠ ToS 允許）| robots.txt + ToS 公開條款必須一併 grep；違反條款的 page type 即使技術上 A 也降為 C |
| R5 | CORTIS / TWS / BOYNEXTDOOR / ILLIT 是較新藝人，Weverse 上可能尚未有完整 page | 紀錄為「page not found / artist not yet on Weverse」，不視為 verdict C |
| R6 | 韓國 IP / 美國 IP / 台灣 IP 可能看到不同版本（geo-block）| report 紀錄探測地 IP；不嘗試 VPN 換 IP（VPN 可能違反 ToS）|
| R7 | Verdict A 後續被誤讀為「立即可開 crawler」| 強制要求：本工作單與 report 之後**必開 runtime 工作單 PR**，不可直接 seed |

---

## 10. 後續 PR 拆分

| PR | 範圍 | 是否含 migration / code |
|---|---|---|
| **本工作單 PR** | 規劃範圍與方法論；不執行 probe | ❌ |
| **Report PR** | 依本工作單方法論執行 probe；新增 `WEVERSE_PUBLIC_PAGE_PROBE_REPORT.md`；不改 DB / code | ❌ |
| **Runtime 工作單 PR**（僅當有 Verdict A）| 規劃 parser_type / source 設計 / migration / API route | ❌（仍是規劃）|
| **Seed PR**（更後續）| seed `crawler_sources` rows，`is_active=false`；走 P1-B 雙階段流程 | ✅ |
| **Acceptance PR**（更後續）| 對每個 seed 跑手動 Preview / Commit；驗收 | ❌ |

每階段都要 reference 前一階段的明確證據（Verdict A 必須引用 probe report 的 URL + bytes + grep counts）。

---

## 11. 開放問題（留給 GPT audit）

1. **Shop 主域選擇**：probe 是用 `shop.weverse.io`、`weverseshop.io`、還是兩個都測？是否該先用 DNS / WHOIS 確認哪個是當前 canonical？
2. **第 1 階段定錨藝人**：建議 BTS（資料最完整）。GPT 是否認可？或改用較新藝人（如 CORTIS）以避免「BTS 特例」偏誤？
3. **Live preview**：`weverse.io/<community>/live`（公開預告頁 metadata，不是直播內容）是否可列入 §3 In Scope？需明確區分「直播實況」（Verdict D）vs「直播預告 metadata」。
4. **Fan event / Lucky draw**：行銷頁面（任何人可看）vs 會員限定參與條件 — 如何切分 verdict？建議：行銷頁本身可 A，**參與行為**或會員限定優惠細節 D。
5. **Verdict D 是否要在 report 中列出？** 或直接整批跳過不寫？建議**仍要列出**並標 D，避免未來重複研究時誤以為「未探測 = 未檢查」。
6. **Pre-order / release scheduler**：與「album release date」高度重疊；是否該獨立 page type 或併入 album？
7. **CORTIS / TWS / BOYNEXTDOOR**：若 Weverse 上尚無 community（page not found），如何記錄？建議用 `N/A — community not found` verdict 而非 C。
8. **本輪 report 完成後**：若整體仍 Verdict C / D，是否要把這份結論寫進 `WORKING.md` 的「不要重複嘗試」列表，避免未來 session 又問一次？

---

## 12. 不在本輪範圍（再次強調）

- ❌ 不執行 probe
- ❌ 不寫 crawler runtime / 不新增 parser_type
- ❌ 不 seed crawler_sources
- ❌ 不新增 migration / schema / RLS / GRANT
- ❌ 不消耗 ANTHROPIC_API_KEY
- ❌ 不使用 cookie / session / token / login（**hard rule**）
- ❌ 不繞過驗證碼 / 反爬 / access control（**hard rule**）
- ❌ 不抓會員 / 付費 / DM / 私密 / 直播內容（**hard rule**）
- ❌ 不改 UI / 前台 / 後台 / API route / 通知
