# RSS Feed Probe Report

> **狀態**：探測報告（research-only）
> **建立**：2026-05-25
> **作者**：Claude（依 `RSS_FEED_PROBE_WORK_ORDER.md` § 6 腳本實測）
> **方法**：curl + Chrome desktop UA + 2s sleep（incognito-equivalent，無 cookie）
> **產出**：本文件為 verdict 結論；**不寫 runtime / 不新增 parser_type / 不 seed / 不改 schema**

---

## TL;DR

**結論：DEFER `wordpress_rss` runtime 開發。**

| 統計 | 數量 |
|---|---|
| 探測 domains | 11 |
| Verdict A（可用，含完整活動內容）| **2** |
| Verdict B（feed 存在但空 / 1 個 dummy item）| **2** |
| Verdict C（無可用 feed）| **7** |
| Verdict D（需 auth）| 0 |

**關鍵發現**：
- ✅ **WAKEONE** 與 **kpopofficial** 有可用的 RSS feed（內含真實 K-pop 活動 + pubDate）
- ❌ 但這兩個來源**目前都不走 `generic_webpage` parser**（不耗 Claude token），它們各自用獨立的 `wakeone_notice` / `kpopofficial_concerts` HTML cheerio parser，成本本來就低
- ❌ 所有**目前真正在用 `generic_webpage` + Claude Haiku 的來源**（BLISSOO / VLAST / Cube / Amoeba / Jay Park / Dean / N.Flying JP / YG）**全部 Verdict C 或 B（無可用 feed 或 feed 空）**
- ❌ 工作單原始動機「降低 Claude token 成本」**完全無法兌現**——能 RSS 的不用 Claude，用 Claude 的不能 RSS

**因此**：本探測**否決**了開發 `wordpress_rss` parser_type 的提案。下一步保留 generic_webpage 現狀，把資源投入其他方向（Search Discovery / Ticketmaster / YouTube）。

---

## 1. 探測結果（per domain）

### 1.1 🟢 Verdict A — 可用 feed（含真實活動）

#### WAKEONE (wake-one.com)

| Path | Status | 結果 |
|---|---|---|
| `/feed/` | 200 / 837 B | 0 items（基本 channel 資訊）|
| `/feed/atom/` | 200 / 584 B | 0 items |
| `/?feed=rss2` | 200 / 837 B | 0 items |
| `/news/feed/` | 200 / **158 KB** | **12 items** ✅ |
| `/notice/feed/` | 200 / **21 KB** | **12 items** ✅ |

**Sample（`/news/feed/`，最新 5 筆）：**
```
1. 김재환, 22일 신곡 '지금 데리러 갈게' 발표…전역 후 첫 신곡
   pubDate=Wed, 29 Apr 2026
2. 하현상, 아카이브 라이브 성료→오늘(6일) 컴백..'New Boat' 새 음악 여정 시작
   pubDate=Mon, 06 Apr 2026
3. 김필, 오늘(8일) 신곡 'Dry Flower' 발매…담담하게 건네는 감정의 기록
   pubDate=Mon, 08 Dec 2025
4. 하현상, 오늘(25일) 새 싱글 '코요테 릴리' 발매
5. 김필, 오늘(8일) 새 싱글 'HAPPY END' 발매
```

**Sample（`/notice/feed/`，最新 3 筆）：**
```
1. 소속 아티스트 권익 보호를 위한 법적 대응 진행 상황 안내
2. ALPHA DRIVE ONE 김건우 관련 사실관계 확인 및 향후 조치에 관한 안내
3. Kep1er 향후 활동 체제 및 멤버 서영은 활동 관련 안내
```

**觀察：**
- `/news/` 偏發片資訊（comeback announcements），結構乾淨
- `/notice/` 偏公司公告（contract issues / legal），相對少活動資訊
- **目前 WAKEONE 用 `wakeone_notice` 自製 HTML parser 抓 `/notice/` 列表頁**（PR #126），不走 Claude
- 若改 RSS：可少 5 行 cheerio selector，但**省不到 Claude token**（本來就沒用）

---

#### kpopofficial (kpopofficial.com)

| Path | Status | 結果 |
|---|---|---|
| `/feed/` | 200 / 19.5 KB | **15 items** ✅ |
| `/?feed=rss2` | 200 / 19.5 KB | 15 items（同 `/feed/`）|
| `/rss` | 200 / 19.5 KB | 15 items（同上）|

**Sample（最新 5 筆）：**
```
1. ALL KPOP COMEBACK SCHEDULE 2026                  Mon, 18 May 2026
2. [UPDATE] MAY 2026 Kpop Comeback Schedule         Mon, 18 May 2026
3. [UPDATE] JUNE 2026 Kpop Comeback Schedule        Mon, 18 May 2026
4. [UPDATE] JULY 2026 Kpop Comeback Schedule        Mon, 18 May 2026
5. [UPDATE] AUGUST 2026 Kpop Comeback Schedule      Mon, 18 May 2026
```

**觀察：**
- 內容是 monthly comeback schedule meta posts，跟目前 `kpopofficial_concerts` 抓的 `/category/concerts/` 不同分類
- 預設 `/feed/` 抓的是**首頁所有最新 post**，多為 schedule overview 而非 concert listing
- 若要 RSS 化，需用 `/category/concerts/feed/` — **未測**（本探測範圍只到 standard paths）
- **目前 kpopofficial 用 `kpopofficial_concerts` 自製 cheerio parser**（PR #40-42），不走 Claude

---

### 1.2 🟡 Verdict B — Feed 存在但無內容

#### VLAST (vlast.com)

- **Auto-discovery**：✅ HTML `<head>` 含 `<link rel="alternate" type="application/rss+xml" href="https://vlast.com/feed/" />`（最權威指標）
- **`/feed/`**：200 / 1 KB / valid RSS XML / **0 items**
- **`/plave/feed/`**：200 / 711 B / 0 items
- **`/category/plave/feed/`**：404

**Sample（feed channel 資訊）：**
```xml
<channel>
  <title>VLAST</title>
  <link>https://vlast.com/</link>
  <description>Play Beyond Play</description>
  <lastBuildDate>Wed, 13 May 2026 06:13:00 +0000</lastBuildDate>
  <generator>https://wordpress.org/?v=6.8.5</generator>
</channel>
```

**觀察：**
- 確認 WordPress 6.8.5
- Feed 端點正常開啟，但**首頁 / PLAVE 分類都沒有實際 post**
- VLAST 站可能用 WP 自訂 page templates（非標準 post）渲染藝人頁，feed 抓不到
- **不可用於 PLAVE event tracking**

#### you.will.knovv (youwillknovv.com)

- `/rss`：200 / 1.5 KB / valid RSS XML / **1 item**
- 但唯一一個 item 是**站點自己**（title=`you.will.knovv`、link=root domain）—— imweb 平台預設的 placeholder feed
- **不可用於 Dean event tracking**

---

### 1.3 🔴 Verdict C — 無可用 RSS

| 來源 | 探測結果 | 主因 |
|---|---|---|
| **BLISSOO** (blissoo.com) | `/?feed=rss2` 200 / 118 KB **但回 HTML**（`<!doctype html>`）；其他路徑 404 | WP 站但 feed 被站長關閉 / 重寫 |
| **Amoeba** (amoebaculture.com) | 所有 feed 路徑均 200 但回相同 HTML（首頁 fallback）| Site 不分 path，404 退回首頁 |
| **Cube** (cube-ent.com) | 全 DNS 解析失敗 / 6 (Could not resolve host) | Bot protection（與 WORKING.md 不要重複嘗試清單一致）|
| **YG family** (ygfamily.com) | `/feed/` 404，間歇性 SSL_ERROR_SYSCALL | 無 WP / 反爬中等強度 |
| **Jay Park** (jaypark.com) | `/feed/` 404，`/?feed=rss2` 200 HTML | Next.js SSG（非 WP）|
| **N.Flying JP** (nflying-official.jp) | `/?feed=rss2` 200 22KB HTML、`/news/feed/` 200 12KB HTML | 站非 WP；fallback to HTML |
| **SMTOWN** (smtown.com) | 所有路徑均 200 / 12KB 同回應 | 自製 framework，無 feed |

---

## 2. 對比工作單預期

| 預期假設（§ 1）| 實測結果 | 修正 |
|---|---|---|
| 「多數 WP 來源都有 `/feed/`」 | ❌ 8 個 generic_webpage 來源中**僅 VLAST 有開啟 feed**（且 0 items）| 假設過度樂觀 |
| 「省 Claude token」 | ❌ 唯二 Verdict A 來源本來就不用 Claude | 動機落空 |
| 「DOM 變動免疫」 | ✅ WAKEONE / kpopofficial feed 結構穩定 | 仍成立，但兩者目前 cheerio parser 也運作良好 |

---

## 3. Cost-Benefit Analysis（更新版）

### 3.1 若強行開發 `wordpress_rss` parser_type

**正面收益：**
- WAKEONE / kpopofficial 兩個 source 可從 cheerio 簡化到 xml2js（程式碼少 ~30 行）
- 若 WAKEONE 改 RSS，現有 `wakeone_notice` parser 仍須保留（4 個 active source 已綁定），需做 dual-track migration

**負面成本：**
- 新增 `wordpress_rss` enum + migration（一次性 ~30 LOC + GRANT/RLS 確認）
- 新 fetcher 程式碼 ~200 LOC + 測試
- Migration 把 `wakeone-notice` source_key 改 parser_type → 風險：runtime fan-out 邏輯要同步更新（PR 風險不算低）
- 對於 8 個真正會吃 Claude token 的 generic_webpage 來源**完全無幫助**

**淨結論：負ROI**。WAKEONE / kpopofficial 已經運作良好，沒有性能 / 維運痛點需要 RSS 來解決。

### 3.2 若採取「保留 generic_webpage 現狀」策略

**收益：**
- 0 程式碼變更
- 已知 cost：generic_webpage 8 個 active source × cron daily = 240 Haiku calls / 月 ≈ **$0.30–0.90 / 月**（Haiku 價格區間）
- 對 91 個 active idol 規模，**每月 < $1 美金的 AI 成本完全可接受**

**Risk：**
- 站方改 layout → drift diff（v1 已上，PR #179）會發現變動，admin 手動 resolve
- DOM 脆弱性已透過 drift detection 緩解，不是急迫問題

---

## 4. 最終 Verdict（per work order § 5.3）

| Domain | Verdict | 原因 |
|---|---|---|
| WAKEONE | A | `/news/feed/` + `/notice/feed/` 均含 12 items + pubDate |
| kpopofficial | A | `/feed/` 15 items + 真實 K-pop schedule meta posts |
| VLAST | B | WP feed 開啟但 0 items（首頁與 /plave 分類皆無）|
| you.will.knovv | B | 1 個 dummy item（站點自己），無實際內容 |
| BLISSOO | C | feed 被站長關閉，回 HTML |
| Amoeba | C | 所有 path 回相同首頁 HTML |
| Cube | C | DNS / bot protection 全擋 |
| YG | C | 404 + 連線間歇失敗 |
| Jay Park | C | Next.js，非 WP |
| N.Flying JP | C | 自製站，無 feed |
| SMTOWN | C | 自製 framework，無 feed |

---

## 5. 建議行動（per work order § 10）

### 5.1 主要建議：**否決 `WORDPRESS_RSS_RUNTIME_WORK_ORDER`**

工作單原本的決策樹：
- ≥3 Verdict A → 開 runtime 工作單
- 1–2 Verdict A → 「判斷值不值得 sample-of-one 實驗」
- 0 Verdict A → 放棄

**本探測落在「2 Verdict A」區間**，但 cost-benefit 分析顯示**負 ROI**（§ 3.1）。
故結論：**走「0 Verdict A」分支處理 — 放棄此方向。**

### 5.2 次要建議：加入「未來觀察」清單

| 來源 | 觀察條件 | 觸發後動作 |
|---|---|---|
| BLISSOO | 若站方未來啟用 feed | 重做探測；若 Verdict A 升級則考慮加入 |
| Amoeba Culture | 若站方未來啟用 feed | 同上 |
| VLAST `/plave/...` | 若未來有 post 進該分類 | 重測 `/plave/feed/` |

**但不主動排程探測**。等以下任一條件成立才重做：
- 該來源的 generic_webpage Claude cost 顯著上升（如 idol 規模 > 500）
- 該來源出現大量 drift detection alerts（站方頻繁改 layout）
- 站方公開宣布啟用 feed

### 5.3 「不要重複嘗試」清單更新

建議把以下加入 WORKING.md「不要重複嘗試」section：

| 來源 | 判定 | 原因 |
|---|---|---|
| smtown.com `/feed/` 等所有 feed 路徑 | ❌ 無 feed | 自製 framework，所有 path 回 12KB 相同 HTML |
| ygfamily.com `/feed/` 等 | ❌ 無 feed | 404 + 反爬 |
| jaypark.com `/feed/` 等 | ❌ 無 feed | Next.js SSG，非 WP |
| nflying-official.jp `/feed/` 等 | ❌ 無 feed | 自製站 |
| youwillknovv.com `/rss` | ❌ Dummy feed | imweb 預設只回站點自己 1 個 item |
| amoebaculture.com 所有 feed 路徑 | ❌ 無 feed | 所有 path 回相同 HTML |
| blissoo.com `/?feed=rss2` | ❌ Feed 已關閉 | WP 站但站長關閉 feed，回 HTML |

---

## 6. 下一步建議（決策權交回使用者）

按優先順序（恢復 RSS 探測前的隊列）：

| 方向 | 性質 | 預期時間 |
|---|---|---|
| 🥇 **Ticketmaster Discovery API 工作單** | 純研究 + API 評估 | 1 PR |
| 🥈 **Search Discovery v2（SerpAPI / Brave）** | 重啟 P1，補洞 HYBE 缺口 | 1 PR |
| 🥉 **YouTube P2-B 擴張啟用** | 已 seed 19 source，按需啟用 | 持續性，無 PR |
| 4 | 第二批 solo 藝人 seed（YENA / Chungha / Kwon Eunbi）| 1 探測 PR + 1 seed migration |

---

## 7. Acceptance Criteria（self-check）

- [x] 工作單 § 8 列出的 11 條 criteria 均對齊
- [x] 11 個 domain 全部探測完成
- [x] 每個 verdict 有量化證據（HTTP code / size / item count）
- [x] WAKEONE / kpopofficial 兩個 Verdict A 來源有 sample 內容驗證
- [x] cost-benefit 分析含 generic_webpage 月成本估算
- [x] 不主張立即開 wordpress_rss runtime
- [x] 對既有 architecture 零侵入性
- [x] 「不要重複嘗試」清單建議已產出
- [x] 下一步建議清楚

---

**End of probe report. 結論：放棄 `wordpress_rss` 方向，把資源轉向 Ticketmaster / Search Discovery。**
