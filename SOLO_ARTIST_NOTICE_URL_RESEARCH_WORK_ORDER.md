# Solo Artist Notice URL Research Work Order

> **Status**: research planning only — no probe execution in this PR.
> **Type**: 研究工作單（規劃下一輪 AI / 人工 probe 的範圍與規則）
> **Date**: 2026-05-25
> **Owner**: idol-rhythm
> **Triggers**: WORKING.md「待處理 issue (3)」— ~20 位個人藝人無確認 notice URL，待下一輪 AI 研究。

---

## 1. 任務定位

本工作單只做**研究範圍與方法論的規劃**：

- 列出哪些 active solo / 個人藝人**還沒有對應的 crawler_sources row**
- 定義 probe 方法（curl / 結構檢查）與驗收門檻
- 定義 verdict 分類（A 可爬 / B 無可爬公開頁但 agency 確認 / C 結構性封鎖）
- 定義輸出格式（per-artist 報告文件）

**本輪不做**：

- 不執行任何 curl / 網頁 probe（probe 留給後續報告 PR）
- 不寫 crawler runtime / 不新增 parser_type
- 不新增 / 修改 migration、schema、RLS、GRANT
- 不 seed 任何 `crawler_sources` row
- 不改前台 / 後台 UI / API route
- 不消耗 ANTHROPIC_API_KEY / 不跑 Claude
- 不碰通知 / cron / sync-all

---

## 2. 背景：為什麼現在做

### 2.1 P1-B8 curl probe 結果（2026-05-24）

WORKING.md 紀錄 P1-B8 共測 22 個 URL：

- ✅ **5 個成功並已 seed**：aespa-smtown / Dynamicduo / YG notice / N.Flying JP / kpopconcerts
- ❌ **17 個結構性封鎖**：
  - HYBE 全系（hybe.com / ibighit / pledis / sourcemusic / beliftlab / adorent / kozent）：503 / 403 / 404 / SPA
  - Weverse 全 SPA（PR #131 / #132 已正式 Verdict C）
  - FNC CUPID（JS 反爬挑戰頁）
  - EDAM（IU agency）bot detection
  - Starship Cloudflare 封鎖
  - THEBLACKLABEL 503
  - RBW / WM / P NATION：HTTP 000（連線失敗或 timeout）
  - KQ bstage / Modhaus / Cube：404 / SPA
  - Instagram 全 SPA
  - 全球售票系統（Interpark / YES24 / Melon / Ticketmaster / Pia / e+ / AXS / Songkick / concertful / bandsintown）全 SPA 或反爬
  - soompi 404、allkpop 雜訊高

### 2.2 剩餘缺口

從 migration 038（M1b-3 solo / sub-unit）與 043（M1b-4 mainstream）seed 後，目前 active idols 中有約 20+ 位「個人 / solo」藝人**沒有對應的 crawler_sources row**。

這些藝人 falls through 既有的 label-level crawler 覆蓋（JYP / YG / WAKEONE / SMTOWN 各只覆蓋自家 label artist），且本人 agency 多為小型 / 個人經紀公司，未必有公開可爬的官方頁。

P1-B8 已測過的 HYBE / Weverse / Starship / CUBE / P NATION / RBW / WM 等都已是 verdict C；本輪研究的重點應放在**P1-B8 沒測過的個人 agency**。

---

## 3. In Scope（本輪允許規劃的工作）

- 整理 active idols 中目前**沒有對應 crawler_sources row** 的個人 / solo 藝人清單
- 標註每位藝人目前的 agency（依現有 migration / Wikipedia / 韓媒交叉確認的最佳推測，**不視為最終事實**）
- 列出每位藝人**可能的官方 URL 候選**（候選 ≠ 已驗證，留給下一輪 probe）
- 標註已知封鎖（P1-B8 已測過的 agency / domain 直接 carry forward verdict C，不重測）
- 定義 probe 方法、驗收門檻、verdict 分類、輸出格式

---

## 4. Explicitly Out of Scope

- 不執行 curl / WebFetch / fetch probe
- 不寫 crawler runtime / 不新增 parser_type
- 不 seed `crawler_sources`
- 不修改 schema / migration / RLS / GRANT
- 不引入 cookie / login / token / headless / 反爬繞路
- 不 reverse engineer 任何私有 API
- 不抓 Weverse（已 Verdict C，不重測）
- 不抓 HYBE 系任何子廠牌（已 Verdict C）
- 不抓 P NATION / RBW / WM / Starship / Cube / FNC（已 Verdict C）
- 不抓 EDAM（IU agency，已 bot-blocked）
- 不消耗 ANTHROPIC_API_KEY
- 不執行 Google PSE（Verdict Deferred per P1-A）

---

## 5. 缺口盤點：需要研究的藝人

> ⚠️ **agency 欄位以 migration 038 / 043 註解與 WORKING.md 紀錄為基礎**，但每位藝人 probe 前必須以韓媒 / Wikipedia + agency 官方 SNS 兩個獨立來源重新交叉確認，**不可直接視為事實**。

### 5.1 P0 — 高搜尋價值 + agency 尚未確認 verdict C

| # | name | slug | 推測 agency | 已知封鎖? | 建議候選 URL 形式 |
|---|---|---|---|---|---|
| 1 | G-DRAGON | `g-dragon` | Galaxy Corporation | 未測 | `galaxycorporation.com` / SNS profile / personal site |
| 2 | JENNIE | `jennie` | ODD ATELIER (OA) | 未測 | `oddatelier.com` / SNS / personal site |
| 3 | LISA | `lisa` | LLOUD | 未測 | `lloud.com` / SNS / personal site |
| 4 | JISOO | `jisoo` | BLISSOO | 未測 | `blissoo.com` / SNS / personal site |
| 5 | Lee Young Ji | `lee-young-ji` | MAINSTREAM | 未測 | MAINSTREAM agency notice / 官方 SNS |
| 6 | Jay Park | `jay-park` | MORE VISION | 未測 | `jaypark.com` (有 schedule/notice/tour 區塊 per M1b-4 工作單) |
| 7 | Baekhyun | `baekhyun` | INB100 | 未測 | `inb100.com` / artist profile / notice |
| 8 | Sunmi | `sunmi` | ABYSS Company | 未測 | ABYSS official / artist profile |
| 9 | Chungha | `chungha` | MORE VISION | 未測（與 Jay Park 同 agency，可一併測） | MORE VISION official / `chungha-official.com` |
| 10 | BIBI | `bibi` | Feel Ghood Music | 未測 | Feel Ghood Music notice / 88rising 不算 official |

### 5.2 P1 — 中等搜尋價值 / agency 可能複雜

| # | name | slug | 推測 agency | 已知封鎖? | 建議候選 URL 形式 |
|---|---|---|---|---|---|
| 11 | TAEYEON | `taeyeon` | SM Entertainment | smtown.com/notice 已 seed（migration 046）— 需確認 TAEYEON solo 公告是否會出現在現有 SMTOWN feed | 不開新 source；先觀察 SMTOWN crawler 是否能 cover |
| 12 | ROSÉ | `rose` | Atlantic Records + The Black Label | THEBLACKLABEL 已 verdict C；Atlantic 是美國廠牌，不適合 K-pop event crawler | 可能需走 Search Discovery / 手動候選路線 |
| 13 | Rain | `rain` | R&D Company / 個人 agency | 未測 | R&D Company notice / 個人 SNS |
| 14 | DAESUNG | `daesung` | R&D Company / D-LABLE | 未測（與 Rain 同 agency，可一併測） | R&D Company / D-LABLE official |
| 15 | QWER | `qwer` | Tamago Production / 3Y Corporation | 未測 | Tamago / 3Y official / band SNS |
| 16 | Dean | `dean` | you.will.knovv | 未測 | `youwillknovv.com` / artist profile |
| 17 | Paul Kim | `paul-kim` | Whyes Entertainment | 未測 | Whyes Entertainment notice |
| 18 | Epik High | `epik-high` | Ours Co. | 未測 | `epikhigh.com`（per M1b-4 工作單可用）/ Ours Co. |
| 19 | Jannabi | `jannabi` | Peponi Music | 未測 | Peponi Music official |
| 20 | PLAVE | `plave` | VLAST | 未測 | VLAST official / PLAVE SNS |

### 5.3 已 carry forward Verdict C（不重測）

| name | 原因 |
|---|---|
| IU | EDAM bot detection（P1-B8） |
| Crush, Heize | P NATION HTTP 000（P1-B8） |
| (G)I-DLE | CUBE 404 / SPA（P1-B8） |
| STAYC | Starship Cloudflare（P1-B8 + CRAWLER_WORK_ORDER_STARSHIP）|
| BTS solo（RM / Jin / SUGA / j-hope / Jimin / V / Jung Kook）| HYBE / BIGHIT 全系 verdict C（P1-B8） |
| ENHYPEN / TXT / SEVENTEEN / LE SSERAFIM / NewJeans 等 HYBE 系 | 已 Weverse Verdict C + HYBE 系 P1-B8 verdict C |

→ 這些藝人的 v1 路徑只有：**Search Discovery（P1-A deferred）/ 手動候選輸入 / kpopofficial 聚合**，不在本工作單研究範圍。

---

## 6. Probe 方法論（給後續 report PR 用）

研究報告 PR 的執行步驟（**本工作單不做**）：

### 6.1 Per-artist 探測流程

1. **agency 交叉驗證**
   - 至少兩個獨立來源（韓媒 / Wikipedia / agency 官方 SNS）
   - 若 agency 訊號分歧（如「離開 X 加入 Y」），標 `agency_uncertain` 不繼續 probe URL

2. **候選 URL 列舉**
   - agency 官網 notice / news / schedule / artists/[slug] 路徑
   - 個人官網（若知名度高，如 jaypark.com）
   - **不列**：Weverse / Instagram / Twitter / YouTube（已知 SPA 或反爬）

3. **curl 探測**（incognito-equivalent，無 cookie / 桌面 Chrome UA）
   ```
   curl -A "<UA>" -L -i -m 10 <URL>
   ```
   - 觀察 HTTP status、bytes、`server` header、`set-cookie` 出現 Cloudflare/CUPID 訊號

4. **HTML 結構檢查**
   - server-rendered？(grep 藝人名字 / 活動關鍵字 / 日期)
   - SPA shell？(只有 `<div id="root"></div>` + Vite/Next preloads)
   - bot challenge？(JS-only redirect、AES cookie、reCAPTCHA)

5. **robots.txt 檢查**
   - permissive? Disallow on path?

6. **rate-limit 觀察**
   - 同一 host 連抓 5 頁、每頁 2s 間隔，觀察是否出現 429 / Cloudflare

### 6.2 Verdict 分類

| Verdict | 定義 | 下一步 |
|---|---|---|
| A | HTTP 200 + server-rendered + 藝人名 / 活動關鍵字可在初始 HTML grep 命中 + robots permissive | 進 seed PR：新增 1 筆 `crawler_sources` row（`parser_type='generic_webpage'`, `is_active=false`），P1-B 雙階段（preview / commit）流程驗收 |
| B | agency 已確認但找不到可爬公開頁（SPA / 沒 notice 區 / 內容在 app only） | 走 Search Discovery（待 P1-A 重新評估）或手動候選輸入路線；不開 crawler |
| C | 結構性封鎖（Cloudflare / bot challenge / 404 / SPA / HTTP 000 / login wall） | Defer；記錄理由，不重測 |

### 6.3 驗收門檻（A 級必須全部滿足）

- HTTP 200（不含 Cloudflare 假 200）
- 至少 5000 bytes 真實內容（過小可能是 SPA shell）
- HTML 初始回應內可 grep 命中藝人名（韓文 / 英文皆可）
- HTML 初始回應內可 grep 命中**至少一個** event 關鍵字（concert / tour / fan / showcase / 콘서트 / 투어 / 팬미팅 等）
- 無 `set-cookie` 包含 Cloudflare/CUPID 訊號
- 無 `<noscript>` 提示「JavaScript required」為主內容
- robots.txt 對該 path 無 Disallow

---

## 7. 輸出格式（給後續 report PR）

建議新增 `SOLO_ARTIST_NOTICE_URL_PROBE_REPORT.md`：

```markdown
## <artist-slug>

- **name**: <name>
- **agency**: <confirmed-agency> [sources: ...]
- **agency_confidence**: high / medium / low / uncertain
- **candidate_urls_tested**:
  - <url-1>: HTTP <status>, <bytes> bytes, <server>, <verdict-fragment>
  - <url-2>: ...
- **verdict**: A / B / C
- **next_step**:
  - A: propose seed row → `seed key: <key>`, `idol_id: <id>`, `parser_type: generic_webpage`
  - B: defer to Search Discovery (P1-A revisit) or manual candidate flow
  - C: blocked because <reason>; do not retest
- **probe_artifacts**: /tmp/<artist>_<n>.html (not committed)
- **probe_date**: YYYY-MM-DD
```

---

## 8. 風險

| # | 風險 | 緩解 |
|---|---|---|
| R1 | agency 資訊過時導致 probe URL 全錯 | 每位藝人 probe 前重新交叉驗證 agency；agency_confidence 標 low/uncertain 時暫停 probe |
| R2 | curl 抓到表面 200 但實際是 Cloudflare/CUPID 假頁 | bytes < 5000 或包含 challenge 字串時自動降 verdict C |
| R3 | 過度頻繁 probe 引發 host rate-limit | 同 host 每秒不超過 1 req；單 host 一次不超過 5 page |
| R4 | 把研究結果當作最終事實 seed | report PR 與 seed PR **分開**；seed PR 必須 reference report 中的 verdict A + probe artifacts 才能寫 migration |
| R5 | probe 過程消耗 ANTHROPIC_API_KEY | probe 階段**不呼叫 Claude**，純 curl + HTML grep |
| R6 | DB 既有 row 與 probe 結論衝突 | probe 報告須列出 slug + 現有 `idols.id`，避免 seed 時 slug mismatch |

---

## 9. 與既有路徑的關係

- **既有 kpopofficial 聚合**仍能 cover 上述部分藝人（concerts/tours），但只是聚合來源，trust_level = pending；本工作單目標是補**官方來源**（trust_level = official 或 media）
- **既有 SMTOWN crawler**已 cover SM 系 solo（TAEYEON 等），probe 前先確認 SMTOWN feed 是否已包含該藝人的 solo 公告
- **既有 WAKEONE crawler**已 cover Jo Yuri，類似邏輯
- **既有 generic_webpage runtime (P1-B)** 是 verdict A 的標準執行載體，**不需要新 parser_type**
- **P1-A Google PSE** 已 deferred；若大量藝人落入 verdict B，後續可重啟 P1-A 評估

---

## 10. 後續 PR 拆分

| PR | 範圍 | 是否含 migration |
|---|---|---|
| 本工作單 PR | 研究範圍與方法論規劃；不執行 probe | ❌ |
| Report PR | 依本工作單方法論執行 probe；新增 `SOLO_ARTIST_NOTICE_URL_PROBE_REPORT.md`；不改 DB | ❌ |
| Seed PR(s) | 依 report 中 verdict A 的藝人，per-artist 或小批量 seed `crawler_sources` row（`is_active=false`），P1-B 流程手動驗收 | ✅（一筆 migration / source） |
| Acceptance PR(s) | 對 seed 後的 source 跑 Preview / Commit 驗收，不改 code | ❌ |

每個 seed PR 都要 reference report 中對應的 verdict A 證據，避免 seed 與 report 脫鉤。

---

## 11. 開放問題（留給 GPT audit 裁定）

1. ROSÉ（Atlantic Records + The Black Label）這類「美韓雙廠牌 + 韓方廠牌已 verdict C」的 case，是否該直接列入「C carry forward」而非 P1？
2. TAEYEON 屬於 SM 但 SMTOWN seed（migration 045 / 046）能否 cover solo 活動公告？需 SMTOWN feed 觀察一段時間才能下結論；本工作單該不該標「待觀察」而非進 probe 清單？
3. 「Search Discovery 路線」是否該與本工作單合併規劃，還是維持 P1-A 獨立路徑、本工作單僅產出 verdict A / C？
4. report PR 的 probe 由人工 curl 還是 Claude WebFetch 執行？兩者差異：人工 curl 完全不消耗 API key，Claude WebFetch 較快但會耗 token + 受 fetch tool 限制。
5. 每個 seed PR 是 per-artist（最細粒度）還是 small batch（每批 3–5 個 verdict A）？粒度權衡：細 → audit / rollback 容易；粗 → PR 數量少。

---

## 12. 不在本輪範圍（再次強調）

- 不執行 probe
- 不新增 migration / parser_type / API route
- 不 seed crawler_sources
- 不修改 schema / RLS / GRANT
- 不改 UI / 不改前台 / 不改通知
- 不消耗 ANTHROPIC_API_KEY
- 不碰 `.env.local`
- 不提交 `.claude/` / `.next/` / `node_modules/`
