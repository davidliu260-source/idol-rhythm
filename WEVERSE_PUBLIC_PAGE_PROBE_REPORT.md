# Weverse / Weverse Shop Public Page Probe Report

> **Status**: research output — informational only.
> **Type**: probe report（依 `WEVERSE_PUBLIC_PAGE_RESEARCH_WORK_ORDER.md` 方法論執行）
> **Probe date**: 2026-05-25
> **Owner**: idol-rhythm
> **Method**: 人工 curl + grep + Next.js \_buildManifest 解析
> **API key consumed**: 0（不呼叫 Claude / WebFetch）
> **§4 硬規則遵守**：✅ 全程無 login / cookie / token / session / DM / 付費 / 會員 / 反爬繞路

---

## 1. TL;DR

| 領域 | 整體 Verdict | 結論 |
|---|---|---|
| **`weverse.io`** 主站（9 藝人 × 4 page type）| **C 全線** | 與 PR #132 結論完全一致 — 同一個 5478-byte SPA shell |
| **`shop.weverse.io`** `/home` | **A**（限定範圍）| 有 SSR + `__NEXT_DATA__` 含 9 個目標藝人 artistId / name / logoImageUrl — 但**只是 roster metadata，無事件 / 日期 / 商品**，對 Idol Rhythm 價值極低 |
| **`shop.weverse.io`** 其他所有 page type（product detail / membership / fanclub / event / album / pre-order）| **C** | `_buildManifest.js` 列出全部公開 Next.js routes — **不存在任何 artist-specific / product / event Next.js route**。內容全在 `api.weverseshop.io`（auth-gated）或 mobile app |
| 直播 / 會員 / 付費 / DM 內容 | **D** | 永久硬性禁止 — 即使技術上可達也不納入 |

**整體建議**：Weverse / Weverse Shop 對 Idol Rhythm v1 **不可用作 event source**。資料品質高的部分全 auth-gated 或 app-only；公開頁面只有 roster metadata（藝人列表 + logo），我們既有的 idols 表已涵蓋。

---

## 2. 探測環境

- 探測工具：`curl -sL/-sLI -A <UA> -m 10~15`
- UA 雙重驗證（per work order §7.2）：桌面 Chrome + 專案 bot UA — Phase 1 已對核心 URL 驗證兩者回應一致
- Probe artifacts 儲存：`/tmp/wvprobe/*.html` / `*.js`（不入庫）
- Rate-limit 自律：同 host 每秒最多 1 req，單一 host 一次不超過 5 URL
- **無任何 cookie / session / token 重放**
- **無嘗試登入任何 provider**（email / Apple / Google / NAVER / LINE）

---

## 3. Phase 1 — BTS 為定錨藝人（9 個 page type）

### 3.1 Weverse.io 主站（4 個 page type）

| URL | HTTP | Size | md5 | Verdict | 理由 |
|---|---|---|---|---|---|
| `https://weverse.io/bts/notice` | 200 | 5478 | `895f929720753ce71ab54b56fab21a2c` | **C** | SPA shell（`<div id="root">` + Vite 預載），無藝人名、無內容 |
| `https://weverse.io/bts/media` | 200 | 5478 | `895f929720753ce71ab54b56fab21a2c` | **C** | **與 notice 完全相同 md5**（同一 shell） |
| `https://weverse.io/bts/live` | 200 | 5478 | `895f929720753ce71ab54b56fab21a2c` | **C** | 同上 |
| `https://weverse.io/bts/highlight` | 200 | 5478 | `895f929720753ce71ab54b56fab21a2c` | **C** | 同上 |

**關鍵發現**：4 個不同 URL **完全相同的 md5 hash** — 證實 `weverse.io` 對所有 path 回傳同一個無內容 SPA shell。內容必須等 client-side 從 `accountapi.weverse.io` / `global.apis.naver.com` 等 auth-gated endpoint 載入後才會出現。**PR #132 結論完全成立**。

### 3.2 Weverse Shop（5 個 page type，per work order §5.2）

#### 3.2.1 Canonical domain 確認

| URL | HTTP | Size | 最終 URL |
|---|---|---|---|
| `https://shop.weverse.io` | 200 | 129990 | `https://shop.weverse.io/en/home` |
| `https://weverseshop.io` | 200 | 129992 | `https://shop.weverse.io:443/en/home`（轉址）|

→ **`shop.weverse.io` 是 canonical**。後續 probe 全用此 domain。

#### 3.2.2 `/en/home` 深度分析

- HTTP 200, 129990 bytes
- 含 `<script id="__NEXT_DATA__">` + Next.js SSR
- robots.txt **permissive**（只 disallow `/*/order/*` 與 `/*/api/*`）
- **全 9 個目標藝人 artistId / name / shortName / logoImageUrl 都在初始 HTML 的 JSON props**：

| Artist | artistId | shortName | logo hash（檔名）|
|---|---|---|---|
| BTS | 2 | BTS | `12f28b6dd91504e4882f5138b4a2f369` |
| TOMORROW X TOGETHER | 3 | TXT | `7d9c47963daa4f6667a07755c283eaa8` |
| CORTIS | 255 | CORTIS | `16168443841c7d16fd9e0ab28d36fdb8` |
| ENHYPEN | 10 | ENHYPEN | `557de454660ae90ce2256a4a5b4f4dac` |
| ILLIT | 120 | ILLIT | `ebff8a28f66a0b3c4c7bca532a10af92` |
| BOYNEXTDOOR | 112 | BOYNEXTDOOR | `44c2dc0cc7ad24738ad9758234895820` |
| SEVENTEEN | 7 | SEVENTEEN | `473056f5b32e53b2ab5b2d9cba5529db` |
| TWS | 165 | TWS | `56336b61ad424442623f1854b4ea4130` |
| LE SSERAFIM | 50 | LE SSERAFIM | `c020d66fa89e94b15f7eb6827f3f8b90` |

- **Verdict A**（home 本身）— **但只是 roster metadata，無事件 / 日期 / 商品 detail / release / pre-order / event**

#### 3.2.3 嘗試找 artist-specific URL pattern

所有以下嘗試**全部 404**：

| 嘗試 URL pattern | HTTP | 結果 |
|---|---|---|
| `/en/shop/<logoHash>` | 404 | hash 是檔名，不是 URL slug |
| `/en/shops/<artistId>` | 404 | — |
| `/en/artist/<artistId>` | 404 | — |
| `/en/artist/bts` | 404 | — |
| `/en/bts` | 404 | — |
| `/en/<artistId>` | 404 | — |
| `/en/sales/<num>` | 404 | — |
| `/en/event` | 404 | — |
| `/en/notice` | 404 | — |
| `/en/help` | 404 | — |
| `/en/membership` | 404 | — |
| `/en/fanclub` | 404 | — |
| `/en/about` | 404 | — |

#### 3.2.4 `_buildManifest.js` 解析（決定性證據）

從 `https://shop.weverse.io/_next/static/GtwP2tI7ggKPmVN-aBtHg/_buildManifest.js` 取得**全部公開 Next.js routes**：

```
/404, /500, /_app, /_error, /cart, /error, /home,
/my/addresses, /my/billing-addresses, /my/cash,
/not-supported, /order/card, /order/checkout, /order/fail,
/order/history, /payment/bridge, /payment/failed,
/plcc, /plcc/landing,
/test/case-change, /test/weverse-app, /test/weverseshop-app,
/weversebyfans
```

**沒有任何 artist-specific / product / membership / fanclub / event / album / pre-order route**。

#### 3.2.5 `/en/weversebyfans` 驗證

- HTTP 200, 94765 bytes
- 藝人 / 商品 / 事件關鍵字 grep 只 9 次命中
- 純品牌行銷頁，無 event / product / 日期資料
- **Verdict B**（公開但對 Idol Rhythm 無用）

### 3.3 Phase 1 Verdict 摘要（BTS）

| Page type | Domain / URL | Verdict | Notes |
|---|---|---|---|
| notice | `weverse.io/bts/notice` | C | SPA shell |
| media | `weverse.io/bts/media` | C | SPA shell |
| live preview | `weverse.io/bts/live` | C | SPA shell |
| highlight | `weverse.io/bts/highlight` | C | SPA shell |
| merch list | `shop.weverse.io/en/...` | C | 無 public route |
| merch detail | `shop.weverse.io/en/...` | C | 無 public route |
| fanclub / membership | `shop.weverse.io/en/...` | C | 無 public route |
| album / release / pre-order | `shop.weverse.io/en/...` | C | 無 public route |
| event / benefit / lucky draw | `shop.weverse.io/en/...` | C | 無 public route |
| 直播 / 會員 / 付費 / DM 內容 | （未嘗試）| **D** | 硬性禁止，per §4 |

唯一 Verdict A 落點：`shop.weverse.io/en/home` 自身（不是某藝人 page），僅含 roster metadata。

---

## 4. Phase 2 — 其他 8 藝人是否與 BTS 一致

per work order §5.3「先測架構，再測藝人差異」策略，Phase 2 只需 spot-check 確認 SPA shell 對所有藝人一致。

| Artist | URL | HTTP | Size | md5 | 與 BTS notice 一致？ |
|---|---|---|---|---|---|
| SEVENTEEN | `weverse.io/seventeen/notice` | 200 | 5478 | （同 BTS shell hash）| ✅ |
| CORTIS | `weverse.io/cortis/notice` | 200 | 5478 | （同）| ✅ |
| ILLIT | `weverse.io/illit/notice` | 200 | 5478 | （同）| ✅ |
| LE SSERAFIM | `weverse.io/le_sserafim/notice` | 200 | 5478 | （同）| ✅ |

→ Weverse.io 主站對**所有 community slug** 都回傳同一個 SPA shell。Phase 2 **不需 expand**：剩餘 4 個藝人（TXT / ENHYPEN / TWS / BOYNEXTDOOR）的 weverse.io paths 推定為 Verdict C。

Shop 領域 Phase 2 **無需測試**：`_buildManifest.js` 證實沒有 per-artist Next.js route，所有 8 個藝人 × 5 個 shop page type = 40 個假設 URL 全都會 404，不存在於公開 web。

---

## 5. 完整 Verdict 矩陣（per work order §6）

### 5.1 Weverse.io 主站

| Artist | notice | media | live(preview) | highlight |
|---|---|---|---|---|
| BTS | C | C | C | C |
| TXT | C* | C* | C* | C* |
| SEVENTEEN | C | C* | C* | C* |
| ENHYPEN | C* | C* | C* | C* |
| LE SSERAFIM | C | C* | C* | C* |
| ILLIT | C | C* | C* | C* |
| TWS | C* | C* | C* | C* |
| BOYNEXTDOOR | C* | C* | C* | C* |
| CORTIS | C | C* | C* | C* |

`C*` = 推定值，依 Phase 2 抽樣（SEVENTEEN / CORTIS / ILLIT / LE SSERAFIM 全部 5478 SPA shell）+ `_buildManifest.js` 證據。

### 5.2 Weverse Shop

| Artist | merch list | merch detail | fanclub | album/release/pre-order | event/benefit |
|---|---|---|---|---|---|
| 全 9 藝人 | C | C | C | C | C |

理由：`shop.weverse.io` 的 `_buildManifest.js` 不存在任何 per-artist / product / event Next.js route。所有商品 / 會員 / 活動瀏覽行為都走 `api.weverseshop.io`（auth-gated）或 mobile app（不在 §3 In Scope）。

### 5.3 Shop home 例外

| URL | Verdict | 對 Idol Rhythm 價值 |
|---|---|---|
| `shop.weverse.io/en/home` | **A** | 9 個目標藝人 artistId / name / logoImageUrl roster — **但無事件 / 日期 / 商品**，價值極低 |

### 5.4 永久 Verdict D 範圍（硬性禁止）

per work order §4 + §6：

| 範圍 | Verdict |
|---|---|
| Weverse live 實況播放內容 | D |
| Weverse 會員限定 post / moment | D |
| Weverse Shop 會員 / 付費商品 detail | D |
| Weverse DM / 私訊 | D |
| Weverse Shop 訂單 / 個人資料 / 付款 endpoints（robots.txt 也明確 Disallow `/*/order/*` 與 `/*/api/*`）| D |
| 任何 mobile app private API endpoints | D |

→ 這些範圍**不會**在任何後續 PR 中被嘗試，即使技術上可達。

---

## 6. Verdict 統計

| Verdict | 數量 |
|---|---|
| **A** | 1（shop.weverse.io/en/home，限定用途）|
| **B** | 1（shop.weverse.io/en/weversebyfans，公開但無 event 價值）|
| **C** | 81（9 artists × 4 weverse paths + 9 artists × 5 shop paths）|
| **D** | 6 大類（live 實況 / 會員 post / 付費 detail / DM / order / private API）|

---

## 7. 建議

### 7.1 下一步：**不開 runtime 工作單**

- Weverse / Weverse Shop **不適合**作為 v1 event source
- 唯一 Verdict A 落點（shop home roster）對 Idol Rhythm 邊際效益極低 — 我們的 idols 表已涵蓋這 9 個藝人
- HYBE 系藝人 event 覆蓋仍維持現有路徑：
  - `kpopofficial-concerts` 聚合（既有）
  - 人工候選輸入
  - 未來 Search Discovery（P1-A 重啟議題）

### 7.2 寫入 WORKING.md「不要重複嘗試」列表（per open question #8）

建議下次 maintainer 在 `WORKING.md` 加註：

> Weverse / Weverse Shop（任何 page type / 任何藝人）已二次研究確認 Verdict C 主導 + 部分硬性 D（PR #132 + 本 PR）。**不要再開新工作單嘗試**，直到出現以下情況之一：
> 1. Weverse / Shop 推出新的公開 SSR routes
> 2. HYBE 開放公開 API（無需 login）
> 3. Idol Rhythm 商業上願意走 partnership / licensing 路徑

### 7.3 對既有 sources 的影響

無影響。本探測**完全不寫 DB / 不 seed / 不修改 crawler_sources / 不改任何 runtime**。

---

## 8. Probe artifacts

| 檔案 | 內容 |
|---|---|
| `/tmp/wvprobe/bts-notice.html` | 5478 bytes SPA shell |
| `/tmp/wvprobe/bts-media.html` | 同上（md5 相同）|
| `/tmp/wvprobe/bts-live.html` | 同上 |
| `/tmp/wvprobe/bts-highlight.html` | 同上 |
| `/tmp/wvprobe/seventeen-notice.html` / `cortis-notice.html` / `illit-notice.html` / `lesserafim-notice.html` | Phase 2 抽樣 SPA shell |
| `/tmp/wvprobe/shop-root.html` | shop.weverse.io/en/home 130KB SSR + __NEXT_DATA__ |
| `/tmp/wvprobe/weverseshop-root.html` | weverseshop.io 轉址證據 |
| `/tmp/wvprobe/shop-byfans.html` | weversebyfans 品牌頁 94KB |
| `/tmp/wvprobe/shop-hash1.html` | `/en/shop/<hash>` 404 證據（83KB Next.js 404 page）|
| `/tmp/wvprobe/buildManifest.js` | 9324 bytes — 全 Next.js routes 列表 |

artifacts **不入庫**（per work order §8）。

---

## 9. 與工作單開放問題的回應

| # | 開放問題 | 本 probe 結論 |
|---|---|---|
| 1 | Shop 主域選擇 | `shop.weverse.io` canonical；`weverseshop.io` 是轉址 |
| 2 | Phase 1 定錨藝人 | 用 BTS（資料最完整）；Phase 2 抽 SEVENTEEN/CORTIS/ILLIT/LE SSERAFIM 驗證一致 |
| 3 | Live preview 列入 In Scope？ | 已測 `weverse.io/bts/live`：5478 SPA shell，**無公開 preview metadata**；整體 Verdict C |
| 4 | Fan event / Lucky draw 切分 | **無 public Next.js route**，全 C；不需切分 A / D |
| 5 | Verdict D 是否列出 | 已列（§5.4），方便未來 session 避免重複嘗試 |
| 6 | Pre-order / release scheduler | 同 album / merch，全 C；無獨立 page type |
| 7 | CORTIS / TWS / BOYNEXTDOOR community | weverse.io 全有 SPA shell 回應（即使 community 不存在也回同 shell）— 無法用此 probe 區分「有 community 但 SPA」vs「無 community」 |
| 8 | 寫進「不要重複嘗試」列表 | **建議寫**（見 §7.2） |

---

## 10. 不在本報告範圍（再次強調）

- ❌ 不新增 `crawler_sources` row
- ❌ 不新增 migration / schema / RLS / GRANT
- ❌ 不寫 crawler runtime / 不新增 parser_type
- ❌ 不消耗 ANTHROPIC_API_KEY
- ❌ 不嘗試 mobile app API / Weverse / Naver login / OAuth
- ❌ 不保存任何 cookie / session / token / JWT
- ❌ 不繞過驗證碼 / 反爬 / Cloudflare / app 強制下載引導
- ❌ 不抓會員 / 付費 / DM / 私密 / 直播實況內容（Verdict D 範圍）
- ❌ 不改 UI / 前台 / 後台 / API route / 通知
