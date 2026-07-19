# Scrapling Public Page Probe Work Order

> **狀態**：❌ **不投（2026-07-15 決議）** —— 本工作單保留為歷史紀錄與「不要重複嘗試」依據，**不執行**。
>
> **否決依據**：`BLOCKED_SITE_BROWSER_PROBE_REPORT.md`（2026-07-15，真瀏覽器實測）。
> 本工作單要解的是「能否突破 curl 失敗的反爬站點」，但實測證明**該問題不是瓶頸**：
> (G)I-DLE 日本官網零阻擋卻 15 個月未更新；BTS 官網 schedule 路徑已移除；
> THEBLACKLABEL 是維護模式不是反爬；Weverse 是登入牆，Scrapling 也不解。
> **它解「進不去」，而我們的問題是「裡面沒有」** → 期望報酬接近零。
>
> **改走**：資料在場館 / 售票 / 主辦端且全部公開無封鎖 → 見 `BLOCKED_SITE_BROWSER_PROBE_REPORT.md` §4。
>
> ---
>
> **原狀態**：📋 工作單（research-only）
> **建立**：2026-06-01
> **作者**：Claude（與使用者討論後）
> **產出**：本文件為**只研究**規劃，產出 `SCRAPLING_PROBE_REPORT.md`（下一個 PR）；不寫 runtime、不新增 parser_type、不新增 migration、不改 schema / RLS / GRANT、不 seed crawler_sources、不接 production。

---

## 1. 動機（Why Scrapling）

### 1.1 現有爬蟲的覆蓋缺口

`generic_webpage` parser 走「`curl`（Node.js `fetch`）→ cheerio 清理 → Claude Haiku 解析」。這條路對 server-rendered HTML（WordPress、Next.js SSG）有效，但有一批來源因反爬機制完全失敗：

| 分類 | 失敗模式 | 代表站點 |
|---|---|---|
| Cloudflare 封鎖 | 回 403 / Cloudflare 挑戰頁 | starshipent.com、fnc.co.kr、edm.co.kr |
| HTTP 000 / 連線失敗 | TCP 拒絕或 SSL 握手失敗 | rbw.kr、wm-entertainment.com、p-nation.com |
| Bot protection 403 | CDN 偵測到機器人 UA | cube-ent.com（RSS probe 時 DNS fail）|
| Bot protection 308/301 + CUPID | Cloudflare redirect chain | starshipent.com → shopstarship.com |

這些來源的公開頁面（notice / news / artist schedule）對人類瀏覽器是完全可讀的。問題不是「頁面存在嗎」，而是「我們的 Node.js fetch 被辨識為 bot 而被封鎖」。

### 1.2 Scrapling 是什麼

[Scrapling](https://github.com/D4Vinci/Scrapling) 是 Python 爬蟲函式庫，提供三種 fetcher：

| Fetcher | 底層 | 特點 |
|---|---|---|
| `StealthyFetcher` | `httpx` + 瀏覽器級 TLS fingerprint | 快、不需啟動 browser；繞過部分 CDN bot 偵測 |
| `PlayWrightFetcher` | Playwright + Chromium | 完整 JS 執行；JS-rendered SPA 可讀；最慢 |
| `CamoufoxFetcher` | Camoufox（Firefox 分支）| 瀏覽器指紋偽裝最強；針對 Cloudflare 設計 |

**假設**：用 `CamoufoxFetcher` 或 `StealthyFetcher` 探測目前 curl 失敗的站點，可能拿到完整 HTML，讓 idol-rhythm 的 generic_webpage parser 覆蓋到更多來源。

### 1.3 探測的保守邊界

本工作單**嚴格限制**在公開頁面：

- ✅ 任何人用一般瀏覽器（無帳號）打開的頁面
- ✅ 公開 notice / news / schedule / artist 頁
- ❌ 任何需要登入的頁面（weverse、Bubble、fancafe 等）
- ❌ 任何需要 cookie / session token 才能看到的內容
- ❌ 繞過 CAPTCHA
- ❌ 付費牆 / 會員專屬內容
- ❌ 接 production runtime / 接 Supabase / 接 Node.js 主程式

---

## 2. 目標與範圍

### 2.1 目標

- **驗證假設**：「對公開頁面，Scrapling 能突破目前 curl 失敗的反爬機制，拿到完整 HTML 內容」
- **產出證據**：每個站點的 Scrapling verdict + HTML 大小 + 關鍵字命中數 + curl 對比
- **決策輸入**：是否值得把 Scrapling Python script 加進爬蟲工具鏈、哪些來源值得進 crawler_sources（**不在本工作單範圍**）

### 2.2 範圍（要做）

| # | 內容 |
|---|---|
| A | 在本機用 Python Scrapling 探測目標清單（§3）的公開 notice / news / artist page |
| B | 與同一 URL 的 curl 結果對比：curl 失敗但 Scrapling 成功 = **突破**；兩者皆失敗 = Verdict C |
| C | 對命中頁面，grep 藝人名 / 活動關鍵字（concert / tour / 콘서트 / 공연 / live / event / schedule）確認內容 |
| D | 確認是否觸發 login wall / anti-bot / 需要 JS 才能看到 |
| E | 記錄 fetcher 類型（Stealthy / PlayWright / Camoufox），確認哪個等級才能突破 |
| F | 產出 `SCRAPLING_PROBE_REPORT.md`：每來源 verdict A/B/C/D + 証據摘要 |

### 2.3 範圍（不做）

| 不做 | 原因 |
|---|---|
| 寫 Scrapling runtime（Node.js 整合）| 等 probe verdict 通過後另開 runtime 工作單 |
| 新增 parser_type / migration / seed crawler_sources | 本工作單只驗收「能不能抓到」，不寫進系統 |
| 繞過登入牆 | 安全邊界，不管用哪種 fetcher 都不登入 |
| 繞過 CAPTCHA | 同上 |
| 在 production / Vercel 上執行 Scrapling | Python 只在本機 probe 用；Node.js 主程式完全不動 |
| 測試已明確 Verdict D 的站點（Weverse / Bubble / fancafe）| 本工作單確認過 Weverse 需 auth；不再嘗試 |
| 批量壓測 | 每站點限 1–2 個 URL，探測間 sleep ≥3s |

---

## 3. 探測目標清單

### 3.1 高優先（curl 失敗，潛在公開頁）

| 站點 | Domain / URL | curl 失敗原因 | 涵蓋藝人 |
|---|---|---|---|
| Starship 公告 | `starshipent.com/board` 或 `/notice` | Cloudflare 308 → CUPID | IVE, MONSTA X, CRAVITY, KiiiKiii |
| Starship 藝人 | `starshipent.com/artist/ive` 等 | 同上 | IVE |
| Cube notice | `cube-ent.com/en/news` 或 `/notice` | DNS fail / bot protection | (G)I-DLE, (여자)아이들, Pentagon, BTOB |
| THEBLACKLABEL | `theblacklabel.com/news` 或 `/artists` | 疑似 SPA / bot protection | ZICO, Jeon Somi, Teddy |
| P NATION | `p-nation.com/news` 或 `/artist` | HTTP 000（連線失敗）| PSY, Crush, HyunA, DAWN |
| RBW | `rbwent.com` 或 `rbw.kr/artists` | HTTP 000 | MAMAMOO, PURPLE KISS, OnlyOneOf |
| WM Entertainment | `wmentertainment.com` 或 `wm-entertainment.com/artists` | HTTP 000 | Oh My Girl, B1A4, ONF |
| FNC Entertainment | `fnc.co.kr/notice` 或 `/artist` | Cloudflare CUPID | N.Flying, SF9, Cherry Bullet |
| EDAM | `edm.co.kr/board` 或 `/artist` | Cloudflare CUPID | IU |

### 3.2 中優先（curl 部分失敗，確認完整性）

| 站點 | Domain / URL | 現況 | 目的 |
|---|---|---|---|
| Cube EN news | `cube-ent.com/en/news` | generic_webpage source 存在（migration 050）但 RSS probe 時 DNS fail | 確認是否 Scrapling 可穩定拿到 HTML |
| N.Flying JP | `nflying-official.jp/news` | curl 200 但 feed 失敗；generic_webpage source 存在 | 確認 Scrapling 是否提升內容品質 |
| Amoeba Culture | `amoebaculture.com/artists/67` | curl 200，但 RSS probe 全 path 回相同 HTML（可能 SPA）| 確認是否有 JS-rendered 內容被 curl 漏掉 |

### 3.3 低優先（驗證 Scrapling 上限）

| 站點 | Domain / URL | 目的 |
|---|---|---|
| SM Entertainment | `smtown.com/notice` | 已有 smtown_notice parser；用 Scrapling 看 HTML 是否比 curl 更完整 |
| YG Family | `ygfamily.com/artist/BABYMONSTER/news` | 已有 yg_artist_schedule parser（JSON API）；此為 HTML 備份驗證 |

---

## 4. 探測方法（Methodology）

### 4.1 環境設定

```bash
# 在本機建立 Python venv（不影響 idol-rhythm Node.js 專案）
python3 -m venv /tmp/scrapling_probe_env
source /tmp/scrapling_probe_env/bin/activate
pip install scrapling
scrapling install camoufox  # 下載 Camoufox browser
```

### 4.2 探測步驟（每個 URL）

```python
# probe_scrapling.py
import time
from scrapling import StealthyFetcher, CamoufoxFetcher

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

def probe(label, url):
    print(f"\n=== {label} ({url}) ===")
    
    # Step 1: curl 基準（同 RSS probe 方法）
    import subprocess
    r = subprocess.run(
        ["curl", "-sSL", "-A", UA, "--max-time", "10", "-o", "/tmp/curl_out.html",
         "-w", "%{http_code} %{size_download}", url],
        capture_output=True, text=True
    )
    print(f"  curl: {r.stdout.strip()}")
    
    # Step 2: Scrapling StealthyFetcher（快速，無 browser）
    try:
        page = StealthyFetcher.fetch(url, headless=True, network_idle=True)
        kw_hits = sum(page.html_content.lower().count(k) for k in
                      ["concert","tour","schedule","콘서트","공연","live","event","공지"])
        print(f"  Stealthy: {len(page.html_content)} bytes | kw_hits={kw_hits}")
    except Exception as e:
        print(f"  Stealthy: ERROR {e}")
    
    time.sleep(3)

    # Step 3: CamoufoxFetcher（較強；若 Stealthy 失敗才用）
    try:
        page = CamoufoxFetcher.fetch(url, headless=True, network_idle=True)
        kw_hits = sum(page.html_content.lower().count(k) for k in
                      ["concert","tour","schedule","콘서트","공연","live","event","공지"])
        print(f"  Camoufox: {len(page.html_content)} bytes | kw_hits={kw_hits}")
    except Exception as e:
        print(f"  Camoufox: ERROR {e}")
    
    time.sleep(3)

# 執行
probe("Starship",      "https://starshipent.com/board")
probe("Cube news",     "https://cube-ent.com/en/news")
probe("THEBLACKLABEL", "https://theblacklabel.com/news")
probe("P NATION",      "https://p-nation.com/artist")
probe("RBW",           "https://rbwent.com")
probe("WM Ent",        "https://wmentertainment.com")
probe("FNC",           "https://fnc.co.kr/artist")
probe("EDAM / IU",     "https://edm.co.kr/artist")
```

### 4.3 探測順序原則

1. 先跑 `StealthyFetcher`（快、輕量，httpx 等級）
2. 若 Stealthy 失敗（ERROR 或 HTML < 5KB），再跑 `CamoufoxFetcher`（重、需 Firefox 引擎）
3. 若 Camoufox 也失敗，記錄 Verdict C
4. 每個 URL 間 sleep ≥3s，避免被當壓測
5. 不同站點間 sleep ≥5s

### 4.4 判斷「成功」的標準

| 指標 | 門檻 |
|---|---|
| HTML 大小 | ≥ 10 KB（排除 SPA shell / redirect 頁） |
| 藝人名命中 | ≥ 1 次（頁面真的有提到該藝人） |
| 活動關鍵字命中 | ≥ 3 次（concert / tour / live / schedule 等） |
| 非 login wall | HTML 不含 "login" / "sign in" / "회원가입" 作為主要文字 |
| 非 bot challenge | HTML 不含 "cf-challenge" / "just a moment" / "checking your browser" |

---

## 5. Verdict 標準

| Verdict | 條件 | 行動 |
|---|---|---|
| **A — 公開可抓，內容完整** | Scrapling 成功（HTML ≥10KB）+ 藝人名命中 + 活動關鍵字 ≥3 次 + 無 login wall | 開 runtime 工作單評估接入 `generic_webpage`（或新 parser_type）|
| **B — 公開但需 browser mode** | 只有 `CamoufoxFetcher`（非 `StealthyFetcher`）才能拿到完整 HTML | 技術上可行，但 browser mode 成本高（需常駐 Firefox 引擎）；列「暫不進 production」|
| **C — 仍抓不到** | 兩種 fetcher 皆失敗，或 HTML < 5KB，或判定 bot challenge | 保持「不要重複嘗試」清單；無 runtime 工作單 |
| **D — 登入 / 會員 / 付費** | HTML 存在但明顯是 login wall / 付費牆 | 列入「不要重複嘗試」+「Auth required」；不做任何繞過嘗試 |

---

## 6. 產出格式（`SCRAPLING_PROBE_REPORT.md` 模板）

```markdown
# Scrapling Public Page Probe Report

> 日期：YYYY-MM-DD
> 探測工具：Scrapling vX.X（StealthyFetcher / CamoufoxFetcher）
> 環境：本機 macOS，無登入，無 cookie

## Summary

| Verdict | 數量 | 來源 |
|---|---|---|
| A — 完整可抓 | N | 列出 |
| B — 需 browser mode | N | 列出 |
| C — 仍失敗 | N | 列出 |
| D — Login wall | N | 列出 |

## Per-Site Findings

### Starship (starshipent.com)

- **curl**: HTTP 308 → redirect → 403 Cloudflare challenge
- **StealthyFetcher**: ERROR / X bytes (bot challenge)
- **CamoufoxFetcher**: 45KB | 藝人名命中 12 次 | kw_hits=8
- **Verdict**: B（需 CamoufoxFetcher）
- **Recommendation**: 列入「browser mode 候選」；v1 不接 production

### Cube (cube-ent.com/en/news)
- ...

## Verdict A — Runtime 工作單候選清單
| 站點 | URL | 所需 fetcher | 涵蓋藝人 |
|---|---|---|---|
| ... | ... | Stealthy / Camoufox | ... |

## Verdict B — Browser Mode 候選（暫緩）
| 站點 | URL | 需 fetcher | 原因 |
|---|---|---|---|
| ... | ... | Camoufox only | ... |

## 不要重複嘗試更新（Verdict C / D）
| 站點 | Verdict | 原因 |
|---|---|---|
| ... | C | Scrapling 也失敗 |
| ... | D | Login wall 確認 |

## 結論與建議

- 是否值得開 Scrapling runtime 工作單：Yes / No / Conditional
- 推薦下一步：...
```

---

## 7. 技術注意事項

### 7.1 Scrapling 的限制

| 限制 | 說明 |
|---|---|
| Python only | Scrapling 無 Node.js 版；若要整合 idol-rhythm，需跑 Python subprocess 或另起 microservice |
| Camoufox 需下載 Firefox binary | `scrapling install camoufox` 約 100MB；CI 上需快取 |
| PlayWrightFetcher 需 Chromium | 另外 100MB；與 Camoufox 擇一或並用 |
| 無法繞過真正需要帳號的頁面 | Cloudflare Bot Score 0 ≠ 已通過 auth；login wall 仍是 D |
| Camoufox 偶爾仍被 Cloudflare Turnstile 擋 | 進階反爬（Turnstile / hCaptcha）仍是 Verdict C |

### 7.2 整合路徑（探測通過後的決策樹，僅供參考）

```
Verdict A (Stealthy)
  → 考慮：Node.js 直接使用 undici 加強 TLS fingerprint？還是 Python sidecar？
  → 開工作單評估

Verdict B (Camoufox only)
  → 考慮：Playwright（Node.js 可用！）能否達到同等效果？
  → 開工作單評估 Playwright fetcher for generic_webpage

Verdict C / D
  → 加入「不要重複嘗試」清單
  → 繼續靠 kpopofficial + Google Discovery 補洞
```

> **重要**：整合路徑不在本工作單範圍內。本工作單只做探測與分類。

---

## 8. Acceptance Criteria（給 GPT audit 的 checklist）

- [ ] 工作單**只研究**，明確聲明不寫 runtime / parser / migration / seed
- [ ] 探測對象都是公開頁面；明確排除需 auth / 登入 / cookie 的內容
- [ ] 明確排除繞過 CAPTCHA / Turnstile
- [ ] 方法可重現：Python script 可直接複製貼上跑
- [ ] Verdict 標準量化：HTML 大小 / 關鍵字命中 / login wall 偵測皆有門檻
- [ ] 探測節奏保守：站點間 sleep ≥3s，不壓測
- [ ] 對既有 architecture 無侵入性：Node.js 主程式 / Supabase / cron / RLS 完全不動
- [ ] 後續路徑清楚：probe → report → 決策（Verdict A/B → runtime 工作單 / Verdict C/D → 不要嘗試清單）

---

## 9. 風險與不確定性

| 風險 | 緩解 |
|---|---|
| Camoufox 被 Cloudflare Turnstile 擋（進階挑戰）| 記錄為 Verdict C；不強求突破 |
| Scrapling 安裝失敗（環境依賴問題）| 用 `/tmp/venv` 隔離，不影響 idol-rhythm node_modules |
| 站方有 rate limit 偵測（探測被封 IP）| 每 URL 3s sleep + 站點間 5s sleep；單次只探測 1–2 個 URL/站點 |
| Camoufox headless 在 macOS 無 display 時崩潰 | 使用 `headless=True` 參數；若崩潰改 VNC 或 `xvfb-run` |
| 「公開頁面」判斷模糊 | 原則：用 Chrome 隱身模式（無帳號）能直接打開的 URL 才算公開 |
| Scrapling 版本 API 變動 | 探測前先 `pip show scrapling` 確認版本，report 中記錄 |

---

## 10. 後續路徑（Probe 通過後）

1. **本工作單 PR merge** → 執行探測 → 產出 `SCRAPLING_PROBE_REPORT.md`（下一個 PR）
2. **若 ≥3 Verdict A（Stealthy）**：開 `SCRAPLING_STEALTHY_RUNTIME_WORK_ORDER.md`，評估在 Node.js 層如何整合（Python subprocess、Playwright Node.js 等效、或強化 undici TLS）
3. **若 ≥3 Verdict B（Camoufox only）**：開 `PLAYWRIGHT_FETCHER_WORK_ORDER.md`，評估 `generic_webpage` 新增 `mode=browser` 支援（Node.js Playwright 可用）
4. **若 Verdict A < 3 且 Verdict B < 3**：放棄此方向；更新「不要重複嘗試」清單；資源轉向 Ticketmaster Discovery / Search Discovery v2

---

## 11. 與其他工作單的關係

| 工作單 | 關係 |
|---|---|
| `RSS_FEED_PROBE_WORK_ORDER.md`（PR #183）| 互補：RSS 是降低 Token 成本；Scrapling 是擴大覆蓋範圍（抓 curl 失敗的站） |
| `RSS_FEED_PROBE_REPORT.md`（PR #184）| Scrapling 目標清單（§3.1）有部分來源在 RSS probe 已確認 curl 失敗（Cube / YG / Starship）|
| `CLAUDE_WEBPAGE_DISCOVERY_WORK_ORDER.md`（PR #152）| `generic_webpage` 是現有 parser；Scrapling 是探測是否能擴展 fetcher 層 |
| `CRAWLER_WORK_ORDER_STARSHIP.md`（PR #142）| Starship 因 Cloudflare 阻擋走 Google Discovery 路線；Scrapling probe 是再驗證是否直爬可行 |
| 未來的 `SCRAPLING_STEALTHY_RUNTIME_WORK_ORDER.md` | 本工作單 Verdict A ≥3 才會出現 |
| 未來的 `PLAYWRIGHT_FETCHER_WORK_ORDER.md` | 本工作單 Verdict B ≥3 才會出現 |

---

**End of work order. Next PR: `SCRAPLING_PROBE_REPORT.md`（Python Scrapling 實測 + verdict）。**
