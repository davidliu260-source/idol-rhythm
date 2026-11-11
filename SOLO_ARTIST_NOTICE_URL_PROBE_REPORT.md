# Solo Artist Notice URL Probe Report

> **Status**: research output — informational only.
> **Type**: probe report（依 `SOLO_ARTIST_NOTICE_URL_RESEARCH_WORK_ORDER.md` 方法論執行）
> **Probe date**: 2026-05-25
> **Owner**: idol-rhythm
> **Method**: 人工 curl + HTML grep（per GPT audit verdict #4）
> **API key consumed**: 0（不呼叫 Claude / WebFetch）

---

## 1. 範圍與環境

### 1.1 範圍

依工作單分類：
- P0：10 位（G-DRAGON / JENNIE / LISA / JISOO / Lee Young Ji / Jay Park / Baekhyun / Sunmi / Chungha / BIBI）
- P1：9 位（**TAEYEON 已 GPT 裁定改「待觀察」，本輪不 probe**）—— ROSÉ / Rain / DAESUNG / QWER / Dean / Paul Kim / Epik High / Jannabi / PLAVE
- 合計 **19 位** probe 目標

### 1.2 探測環境注意

- 環境 DNS 將部分外部域名解析為 `198.18.3.x`（RFC 2544 benchmark range）—— 並非錯誤，是 sandbox 內 NAT 行為。
- 多數真實域名仍可正常 fetch（如 `chungha-official.com` 200 + 127KB 真實內容）。
- 部分 `HTTP 000`（連線失敗）可能是環境限制，而非真實域名問題；本報告對該類結果**僅標 "inconclusive"，不下 Verdict C**。
- Probe 使用兩種 UA 交叉驗證：桌面 Chrome（`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ... Chrome/120.0.0.0`）+ 專案 bot UA（`IdolRhythm-Bot/0.1 (+https://idol-rhythm.vercel.app)`）。Verdict A 候選兩者皆已測 → 相同回應。

### 1.3 Verdict 分類

| Verdict | 定義 |
|---|---|
| **A** | HTTP 200 + 顯著 server-rendered HTML + 藝人名 / 活動關鍵字 grep 命中 + 無 SPA root 主導 + bot UA 等同 Chrome UA 接受 |
| **B** | HTTP 200 但內容靠 client-side hydration（如 bstage / Next.js with `__NEXT_DATA__` 但無事件資料）— 不適合 generic_webpage |
| **C** | 確認封鎖（bot challenge、interstitial、TLS cert reject、HTTP 4xx/5xx persistent） |
| **Inconclusive** | HTTP 000 from this env，需從真實瀏覽器手動 re-probe |

---

## 2. 結論摘要

| Verdict | 數量 | 藝人 |
|---|---|---|
| **A — 建議進 seed PR** | **4** | **Jay Park / JISOO / Dean / PLAVE** |
| B — SPA pattern，不適合 | 2 | Chungha / Epik High（皆 bstage） |
| C — 確認封鎖 | 2 | Baekhyun（INB100，TLS reject）/ Jay Park 的 agency MORE VISION root（"Checking your browser..."；不影響 jaypark.com 個人站） |
| Inconclusive | 11 | G-DRAGON / JENNIE / LISA / Lee Young Ji / Sunmi / BIBI / ROSÉ / Rain / DAESUNG / QWER / Paul Kim / Jannabi |

> 4 個 Verdict A 在 GPT audit 裁定的 3-5 個 small batch 範圍內 → **建議下一個 seed PR 一次處理全部 4 個**。

---

## 3. Verdict A — 建議進 seed PR

### 3.1 jay-park

- **name**: Jay Park
- **slug**: `jay-park`
- **agency**: MORE VISION
- **agency_confidence**: high（M1b-4 工作單已確認；個人站 meta 顯示 `og:image` host = morevision.mycafe24.com）
- **candidate URL**: `https://jaypark.com`
- **probe result**:
  - HTTP 200, 23,809 bytes
  - server: Vercel / Next.js（`x-powered-by: Next.js`, `x-vercel-cache: HIT`）
  - 無 SPA root div
  - 25 keyword hits（"jay park / 박재범 / tour / concert / schedule / notice / fan" 等）
  - 無 Cloudflare / CUPID / 反爬訊號
  - bot UA = Chrome UA（皆 200 + 23,809 bytes，回應一致）
- **verdict**: **A**
- **next_step**: seed 1 筆 `crawler_sources`，`parser_type='generic_webpage'`，`source_type='official_website'`，`idol_id` = `jay-park` 的 id，`is_active=false`，等手動 Preview / Commit 驗收

### 3.2 jisoo

- **name**: JISOO
- **slug**: `jisoo`
- **agency**: BLISSOO（JISOO 自創）
- **agency_confidence**: high（公開資料）
- **candidate URL**: `https://blissoo.com`
- **probe result**:
  - HTTP 200, 118,873 bytes
  - server: PHP-based（`<!-- PHP 코드 시작 -->` 註解，meta 顯示 facebook-domain-verification）
  - 無 SPA root div
  - **232 keyword hits**（"jisoo / 지수 / blissoo / tour / concert / notice / schedule / fan / 콘서트 / 투어 / 2025 / 2026"）— **本批最密集**
  - 無 Cloudflare / CUPID / 反爬訊號
  - bot UA = Chrome UA（皆 200 + 118,873 bytes）
- **verdict**: **A**
- **next_step**: seed 1 筆 `crawler_sources`，同 jaypark pattern
- **附註**: 本探測未深入子路徑（`/news` / `/notice` 等），root 本身 keyword 密度已足夠；若 root 萃取效果不理想，下一輪 acceptance PR 可改試子路徑

### 3.3 dean

- **name**: Dean
- **slug**: `dean`
- **agency**: you.will.knovv
- **agency_confidence**: high（M1b-4 工作單確認）
- **candidate URL**: `https://www.youwillknovv.com`
- **probe result**:
  - HTTP 200, 387,535 bytes（**本批最大**）
  - server: 韓文 PHP-like 站
  - 無 SPA root div
  - **2,317 keyword hits**（"dean / 딘 / tour / concert / notice / schedule / fan / event / 콘서트 / 투어 / 2025 / 2026"）— **本批密度最高**
  - 無 Cloudflare / CUPID / 反爬訊號
  - bot UA = Chrome UA（皆 200 + 387,535 bytes）
- **verdict**: **A**
- **next_step**: seed 1 筆 `crawler_sources`，同 pattern
- **附註**: 387KB > 專案 `MAX_HTML_BYTES = 500KB` 仍在範圍內；單一頁 keyword 密度高，預期 Claude 萃取效果良好

### 3.4 plave

- **name**: PLAVE
- **slug**: `plave`
- **agency**: VLAST
- **agency_confidence**: high（公開資料）
- **candidate URL**: `https://vlast.com/plave`（artist-specific 子路徑，非 root）
- **probe result（root + /plave 兩段）**:
  - root `https://vlast.com`：HTTP 200, 73,791 bytes, 62 keyword hits, WordPress（pretendard CSS, naver-site-verification meta）, 無 SPA
  - `/plave`：HTTP 200, **181,645 bytes**, **188 keyword hits** — artist-specific page，內容更豐富
  - 無 Cloudflare / 反爬訊號
  - bot UA = Chrome UA（root 皆 200 + 73,791 bytes）
- **verdict**: **A**
- **next_step**: seed 1 筆 `crawler_sources`，`source_url='https://vlast.com/plave'`（用 artist-specific path 而非 root），同 pattern
- **附註**: 與其他 3 個用 root 不同，本筆建議用 `/plave` 子路徑，避免 root 含其他 VLAST 旗下藝人混雜

---

## 4. Verdict B — SPA pattern，本輪不 seed

### 4.1 chungha（bstage SPA）

- **name**: Chungha
- **agency**: MORE VISION
- **candidate URLs tested**:
  - `https://chungha-official.com`: HTTP 200, 127,839 bytes — 但 `id="root"` SPA shell + `__NEXT_DATA__` 標籤 + `<style data-fullcalendar="true">` bstage 特徵
  - `https://chungha-official.com/schedule`: HTTP 200, 104,050 bytes — 同樣 SPA shell，初始 HTML 只有 page metadata 標題（"Home", "CHUNG HA STORY", "Community"），**無事件資料**
  - Keyword grep 在 `/schedule` 只命中 11 次 "2026" + 1 次 "OCT" / "FEB"，遠低於 Verdict A 候選的密度
- **verdict**: **B**
- **reason**: bstage 平台架構為 Next.js SSR + client-side fetch；事件資料在 hydration 後才從 API 載入，初始 HTML 不含可萃取的 event listing
- **next_step**: defer；未來如要支援，需獨立工作單評估 bstage 平台 API（風險：可能需 token / 不公開）

### 4.2 epik-high（bstage SPA 同 pattern）

- **name**: Epik High
- **agency**: Ours Co.
- **candidate URL**: `https://www.epikhigh.com`
- **probe result**: HTTP 200, 123,778 bytes，`id="root"` + `<style data-fullcalendar="true">` — **與 chungha 同為 bstage SPA pattern**，47 keyword hits 但同樣是 metadata 而非事件
- **verdict**: **B**
- **next_step**: 同 Chungha，與 bstage 評估綁定

---

## 5. Verdict C — 確認封鎖

### 5.1 baekhyun（INB100 TLS reject）

- **name**: Baekhyun
- **agency**: INB100
- **candidate URL**: `https://inb100.com`
- **probe result**:
  - 無 `-k` flag：HTTP 000，curl 報 TLS error（exit code 60）
  - 加 `-k`：HTTP 200, 276,105 bytes（有真實內容）
- **verdict**: **C**
- **reason**: 專案 `fetchPublicHtml` 走 Node fetch，**不能** `-k` skip TLS validation。憑證問題對 production crawler 是 hard block。
- **next_step**: defer；通知 INB100 修憑證後可重測（不在本專案責任範圍）

### 5.2 morevision-root（agency root interstitial — 不影響 jaypark 個人站）

- **agency**: MORE VISION
- **candidate URL**: `https://www.morevision.com`
- **probe result**: HTTP 200, 9,698 bytes，但 body 內容是 `<title>Checking your browser...</title>` interstitial 頁
- **verdict**: **C**
- **reason**: 自訂 bot challenge interstitial
- **附註**: 此 verdict C **僅影響 MORE VISION agency root**，不影響 `jaypark.com`（個人站，Verdict A）；Chungha 在 MORE VISION 但個人站是 bstage `chungha-official.com`（Verdict B）

---

## 6. Inconclusive — 環境 probe 失敗，需手動 re-probe

下列 11 位藝人在本環境的 curl probe 均回 HTTP 000 / connection failed。**不視為 Verdict C**：可能是環境 DNS / TLS 路由限制，也可能是域名實際無公開站。下一輪需從真實瀏覽器（含正確 DNS）手動 re-probe。

| # | name | agency | tested URL | result |
|---|---|---|---|---|
| 1 | G-DRAGON | Galaxy Corporation | `https://galaxycorporation.com` | HTTP 000 / 15s timeout |
| 2 | JENNIE | ODD ATELIER (OA) | `https://oddatelier.com` | HTTP 000 / 15s timeout |
| 3 | LISA | LLOUD | `https://lloud.com` + `https://www.lloud.com` | HTTP 400 / 000 |
| 4 | Lee Young Ji | MAINSTREAM | `https://www.mainstream.kr` | HTTP 000 / 15s timeout |
| 5 | Sunmi | ABYSS Company | `https://www.abysscompany.com` | HTTP 000 / 15s timeout |
| 6 | BIBI | Feel Ghood Music | `https://www.feelghoodmusic.com` | HTTP 000 / 15s timeout |
| 7 | ROSÉ | Atlantic / The Black Label | `https://www.rosiesrosie.com`（猜測 URL）| HTTP 000 |
| 8 | Rain | R&D Company | `https://www.rndcompany.kr`（推測 URL）| HTTP 000 |
| 9 | DAESUNG | R&D Company / D-LABLE | （同 Rain 候選 URL，未獨立測） | inferred 000 |
| 10 | QWER | Tamago Production / 3Y | `https://tamagoproduction.com` | HTTP 000 |
| 11 | Paul Kim | Whyes Entertainment | `https://www.whyesent.com` | HTTP 000 |
| 12 | Jannabi | Peponi Music | `https://peponimusic.com` | HTTP 000 |

**Inconclusive 處理建議**：
- 下一輪可從真實桌面瀏覽器 / 一般家用網路手動驗證
- 若 root URL 確實不存在，再依藝人重新研究是否有：
  - 個人專屬站（如 jaypark.com pattern）
  - 經紀公司專屬 artist page（如 vlast.com/plave pattern）
  - 官方 SNS landing（IG / Twitter / FB — 多半為 SPA，可預期 Verdict B/C）
- ROSÉ 的 `rosiesrosie.com` URL 為純猜測，需重新研究 ROSÉ 是否有可爬個人 / Atlantic 官網 artist page

---

## 7. 下一步建議（per GPT audit verdict #5）

### 7.1 立即可開的 Seed PR（small batch ≤ 5）

| seed PR | 範圍 | 來源 |
|---|---|---|
| **Seed Batch 1** | 一次 seed 4 個 Verdict A，每筆 `is_active=false` | jay-park / jisoo / dean / plave |

建議 migration 編號：當時 main 最新狀態為 055（PR #171），下一筆為 **056**。

每筆 `crawler_sources` row 預期 schema：
```sql
INSERT INTO public.crawler_sources (
  name, source_key, idol_id, source_url, source_type, parser_type, is_active, config
)
SELECT
  '<artist> — <agency> notice',
  'generic-<artist-slug>-<short-agency>',
  idols.id,
  '<verdict-A-URL>',
  'official_website'::source_type,
  'generic_webpage',
  false,
  jsonb_build_object('provider','generic_webpage','phase','p1-b-solo-artist','scouted','2026-05-25')
FROM public.idols
WHERE idols.slug = '<artist-slug>'
ON CONFLICT (source_key) DO UPDATE
SET name = EXCLUDED.name, source_url = EXCLUDED.source_url, ...
```

### 7.2 Acceptance PR（per Seed Batch）

Seed 後手動跑：
1. Preview → 觀察 Claude 萃取結果 + `idolMatchResults` 是否命中對應 idol
2. Commit（若 Preview 結果合理且 confidence ≥ 0.65）→ 觀察 `inserted` / `deduped` / `lowConf` summary

驗收標準：
- Preview `events.length ≥ 1` 且 `pageRelevance ≠ 'none'`
- Commit `inserted + deduped ≥ 1`（首次 inserted，重跑 deduped）
- 無 Cloudflare / CUPID / bot challenge warning

### 7.3 Deferred（不在 Seed Batch 1 範圍）

- **Verdict B**（Chungha / Epik High）：不開 seed，等 bstage 平台評估
- **Verdict C**（Baekhyun INB100、MORE VISION agency root）：不開 seed，等外部修復
- **Inconclusive 11 位**：等下一輪手動 re-probe 結果出來才能決定

---

## 8. Probe artifacts

下列檔案保存在 `/tmp/probe/`，**不入庫**：

| file | content |
|---|---|
| `jay-park.html` | jaypark.com 完整回應（Chrome UA） |
| `jaypark-bot.html` | jaypark.com 完整回應（bot UA，比對用） |
| `blissoo.html` / `blissoo-bot.html` | blissoo.com 完整回應（兩 UA） |
| `vlast.html` / `vlast-bot.html` | vlast.com root（兩 UA） |
| `vlast-plave.html` | vlast.com/plave 完整回應 |
| `youwillknovv.html` / `yww-bot.html` | youwillknovv.com（兩 UA） |
| `chungha.html` / `chungha-schedule.html` | Verdict B 證據 |
| `epikhigh.html` | Verdict B 證據 |
| `morevision-root.html` | "Checking your browser..." interstitial |
| `inb100-k.html` | INB100 TLS reject 證據（-k flag） |

---

## 9. 開放問題（留給 GPT audit）

1. Seed Batch 1 是否一次包含 4 個（Jay Park / JISOO / Dean / PLAVE），還是建議拆 2 個 PR（每個 2 筆）？
2. PLAVE 用 `vlast.com/plave` 子路徑 vs root（`vlast.com`），是否要在 seed PR 同時測兩個版本？
3. Inconclusive 11 位的下一輪 manual re-probe，是否要另開新工作單 PR，還是直接以本報告為依據在 Issue tracker 跟進？
4. Verdict B（Chungha / Epik High）是否值得另開 bstage 平台評估工作單？涉及 bstage API 探測，可能踩到 ToS。
5. 本輪未測的「藝人個人 IG / Twitter / YouTube channel landing 頁」是否要列入下一輪？預期 Verdict B/C（SPA）但 IG/Twitter 為主要曝光管道，可能值得記錄 inconclusive。

---

## 10. 不在本報告範圍（再次強調）

- 不新增 `crawler_sources` row（僅在 §7 提供建議 SQL，**不執行**）
- 不新增 migration
- 不改 schema / RLS / GRANT / parser_type
- 不跑 generic_webpage runtime（Preview / Commit）
- 不消耗 ANTHROPIC_API_KEY
- 不碰前台 / 後台 UI / API route
- 不修改 cron / sync-all / 通知
