# 資料補齊計畫（DATA_BACKFILL_PLAN）

> 類型：規劃 / PM 起草（實作動作另開票交 Codex；涉爬蟲 / migration 走高風險流程）
> 依據：`DATA_GAP_AUDIT_WORK_ORDER.md`（2026-07-14 盤點）
> 目標：把 72 個「零已發布活動」的 active idol，按來源可行性分成四類槓桿，
> 排出「便宜 → 貴」的補洞順序，讓「補齊資料」變成可勾選清單。

---

## 0. 盤點結論（前情提要）

- 已發布 156 場，集中在 20 個藝人；**72 / 92 藝人零活動**。
- 129 筆待審全部「加厚既有」，不填補黑洞。
- **關鍵發現**：官方爬蟲（smtown_notice / jyp_schedule）**每天 cron 都在跑且成功**
  （aespa / DAY6 / NMIXX 今日 01:17 success），但仍 0 活動。
  → 黑洞不是「沒跑爬蟲」，而是「跑了也沒可發布活動」：多數藝人**現在沒官方公告的未來活動**。

---

## 1. 四類補洞槓桿

| 槓桿 | 定義 | 動作 | 成本 |
|---|---|---|---|
| **L1** | 有 active 爬蟲、候選池有「待審」筆數 | 後台審核 → 發布 | 低 |
| **L2** | 有爬蟲但 `is_active=false`（generic_webpage / youtube）| 手動 Preview→Commit，或按需啟用 | 低～中 |
| **L3** | 官網來源封鎖（HYBE / Cube / Starship / THEBLACKLABEL 等）| 等 Scrapling 探測 / 人工維護 | 高 |
| **接受空白** | 藝人現階段真的沒活動 | 不動，避免塞雜訊 | 0 |

> ⚠️ 原則：**寧可正確地空白，也不塞雜訊。** 沒活動的藝人 0 場是正確狀態，
> 不應為了「補滿」而放寬 event filter 或降 trust_level。

---

## 2. 72 黑洞按公司分類（依已知資訊，L 標記待 SQL 驗證後定稿）

> 資料來源：SQL-3（黑洞清單）+ 來源健康度查詢 + `WORKING.md` 不要重複嘗試清單。
> 「待驗證」= 需「有候選沒審 vs 零產出」SQL 結果才能確定是 L1 還是接受空白。

### 已有 active 官方爬蟲（待驗證 L1 或 接受空白）
| 公司 | 藝人 | 現有爬蟲 | 判讀 |
|---|---|---|---|
| SM Entertainment | aespa / Red Velvet / NCT 全系 / Hearts2Hearts 等 12 | smtown_notice（active, 每日 success）| 爬蟲有跑；查候選池有無待審 |
| JYP Entertainment | DAY6 / NMIXX | jyp_schedule（active, 每日 success）| 同上 |
| WAKEONE | izna / Jo Yuri / Kep1er / ZEROBASEONE | wakeone_notice | 查是否 active + 有無候選 |

### 有爬蟲但未啟用（L2 — 可手動 / 按需啟用）
| 公司 | 藝人 | 現有爬蟲 | 動作 |
|---|---|---|---|
| Amoeba Culture | Dynamicduo | generic_webpage（preview success, inactive）| 後台手動 Preview→Commit |
| MORE VISION | Jay Park | generic_webpage（preview success, inactive）| 同上 |
| FNC | N.Flying | generic_webpage（last skipped）| 查 skip 原因 |
| HYBE / BELIFT LAB | ENHYPEN / ILLIT | youtube_official_channel（inactive）| 有近期 MV/comeback 才啟用 |
| HYBE / Pledis | SEVENTEEN / TWS(?) | youtube_official_channel（inactive）| 同上 |
| KQ | ATEEZ / xikers | youtube_official_channel（inactive）| 同上 |
| SM | aespa / NMIXX 等 | youtube_official_channel（inactive）| 同上（smtown 已涵蓋，youtube 為補充）|

> 註：YouTube 為 HYBE 系目前**唯一可存取的官方頻道**（官網 / Weverse 全封鎖），
> 是 L2 對 HYBE 藝人的關鍵破口，但受「按需啟用、不批量開」政策限制。

### 官網封鎖（L3 — 等 Scrapling / 人工）
| 公司 | 藝人 | 狀態 |
|---|---|---|
| BigHit / HYBE | BTS solo：j-hope / Jimin / Jin / Jung Kook / RM / SUGA / V | 官網 / Weverse 封鎖；部分可試 L2 個人 YouTube |
| HYBE / KOZ | BOYNEXTDOOR / ZICO | 封鎖 |
| Cube | (G)I-DLE / PENTAGON | SPA / 404 |
| THEBLACKLABEL | ALLDAY PROJECT / JEON SOMI / MEOVV / ROSÉ / TAEYANG | 503 封鎖 |
| Starship | CRAVITY / KiiiKiii / MONSTA X | Cloudflare；建議 Google Discovery |
| Modhaus | ARTMS / tripleS | SPA |

### 尾端中小公司（38 家中約 27 家各 1 人，待完整清單分類）
- SQL-3 完整 72 筆裡，尾端多為單藝人小公司 → 逐一判 L2（有官網可 seed generic_webpage）/ L3 / 接受空白。

---

## 2.5 決定性驗證（2026-07-14）：72 黑洞中只有 9 個有候選

「有候選沒審 vs 零產出」查詢結果 —— **72 個黑洞裡，只有 9 個藝人的候選池有東西**，其餘 63 個**零候選**（真正的來源缺口）。

| 藝人 | 公司 | 候選總數 | 待審 | 已核准(草稿) | 已拒絕 | 判讀 |
|---|---|---|---|---|---|---|
| ENHYPEN | HYBE / BELIFT | 18 | **17** | 0 | 1 | ★ L1 最大單筆，17 筆待審 |
| Jay Park | MORE VISION | 17 | **17** | 0 | 0 | ★ L1，官方源（jaypark.me）|
| CORTIS | HYBE / BigHit | 9 | **7** | 2 | 0 | ★ L1，7 待審 + 2 草稿 |
| (G)I-DLE | Cube | 5 | 0 | **5** | 0 | 5 草稿已建，卡發布（AGGREGATOR crash）|
| aespa | SM | 4 | 1 | 0 | 3 | L1 弱（多為雜訊被拒）|
| DAY6 | JYP | 3 | **3** | 0 | 0 | L1，官方 jyp_schedule |
| ILLIT | HYBE / BELIFT | 3 | **2** | 0 | 1 | L1 |
| JENNIE | ODD ATELIER | 1 | 0 | **1** | 0 | 1 草稿已建，待發布 |
| NMIXX | JYP | 1 | 0 | 0 | 1 | 純雜訊（已拒）→ 接受空白 |

**兩個現成快贏（比審核更便宜）：**
- **已核准草稿卡在發布**：(G)I-DLE(5) / CORTIS(2) / JENNIE(1) → 草稿已建，只差「發布」。
  (G)I-DLE 正是 AGGREGATOR publish crash 受害者 → 需確認 crash 修正（PR #170–172）已上線。
- **待審可直接處理**：ENHYPEN(17) / Jay Park(17) / CORTIS(7) / DAY6(3) / ILLIT(2)。

**L1 補洞潛力**：這 9 個藝人若審核 + 發布，涵蓋數可望從 20 → ~28（+8 藝人），零工程成本。
- ⚠️ 發布依賴：HYBE 系（ENHYPEN / CORTIS / ILLIT）候選多來自 kpopofficial 聚合源，
  發布時 trust_level 需設 media 且需 crash 修正已上線；Jay Park / DAY6 為官方源，可乾淨發布。

**63 個零候選黑洞** → 全部落 L2（啟用未跑的來源）/ L3（封鎖源）/ 接受空白，
無法靠審核解決，需來源突破。

- 待「有候選沒審 vs 零產出」SQL + 完整公司清單回來後補完。

---

## 2.6 發布閘門確認（2026-07-14）：聚合源不能直接發布是「設計」

- PR #170–172 **已在 main**（`7c01d5e` 修 crash / `cba4b1d` Dynamicduo / `d870916` idolMatcher）。
- crash 已修（`error.tsx` 接住），但**發布閘門是刻意的**，兩條路徑都擋聚合源：
  - `publishEvent`（單筆）：`trust_level==='pending'` → throw「請先補官方…來源」
  - `bulk-publish`：`trust_level==='pending'` → 靜默 `continue`（跳過）
- 依 `inferTrustLevelFromSource`：kpopofficial / concerts / community → `pending` → **不可發布**。
  這是 CLAUDE.md「前台只顯示 official/media」的守門，**正確行為，非 bug**。

**因此 9 個有候選黑洞的真實命運：**
| 命運 | 藝人 | 說明 |
|---|---|---|
| ✅ 乾淨發布 | Jay Park(17 官方 jaypark.me)、DAY6(3 官方 jyp_schedule) | 審核→發布一條龍，+2 藝人真免費 |
| ⚠️ 需人工補來源 | ENHYPEN(17)、CORTIS(9)、(G)I-DLE(5)、ILLIT(2)、JENNIE(1) | 聚合源，發布前須逐筆補官方/售票/媒體 source |

→ 真正零成本補洞只有 **Jay Park + DAY6**。其餘 34 筆聚合源事件需**人工補來源**
  或另做「admin 信任聚合事件設 media」的產品決策（見 §5 待決策）。

---

## 3. 建議執行順序（便宜 → 貴）

1. **先跑「有候選沒審」SQL** → 確定 SM / JYP / WAKEONE 那批是 L1（審一審就有）還是接受空白。
   - 若是 L1 → 開票：後台審核發布，涵蓋數立刻上升，零工程成本。
2. **L2 手動 generic_webpage**（Jay Park / Dynamicduo）→ 已 preview success，後台 Commit + 審核即可補 2 個。
3. **L2 YouTube 按需**：挑近期有 comeback / MV 的 HYBE / KQ 藝人啟用（不批量）。
4. **L3 Scrapling**：併入既有 `scrapling-probe-work-order` branch，探測能否突破 HYBE / Cube / Starship 官網。
5. **接受空白**：確認真無活動的藝人，維持 0，不塞雜訊。

---

## 4. 邊界

- 本檔為規劃；任何**啟用來源 / 跑爬蟲 / seed migration / 改 event filter** 都需另開票，
  涉爬蟲 / migration 者走 `CLAUDE.md` 高風險流程（工作單 → GPT audit）。
- **不得**為補滿而放寬 event filter 或降 trust_level。
- L3 Scrapling 屬獨立探測線，成敗未定，不作為開群前置的必要條件。

---

## 5. 待決策（需 Owner / GPT 拍板）

**D1. 聚合源事件如何發布？** 這是補洞的最大槓桿（kpopofficial 是最高產來源，但其事件受設計擋住）。三個選項：
- **選項 A（現狀，最保守）**：維持人工逐筆補官方/售票/媒體 source 才發布。品質最高，但勞力密集（ENHYPEN 17 筆 = 17 次人工查證）。
- **選項 B（半自動）**：後台加「admin 確認為可信活動 → 手動設 trust_level=media」按鈕，繞過聚合源閘門但留人工守門 + 稽核紀錄。需開票（涉發布邏輯 + 可能 migration）。
- **選項 C（維持不發）**：聚合源事件只留候選 / 草稿，不上前台；接受這些藝人前台空白，等官方源或 Scrapling 補。

> PM 傾向：**先做 §3 步驟 1（Jay Park + DAY6 官方源，零成本 +2 藝人）驗證流程**，
> 再由 Owner 決定 D1 要不要投入人工（選項 A）或開發半自動（選項 B）。

**D1 已定案（2026-07-14）**：Owner 選 **選項 B（自動求證）**。
- 現場驗證：99 筆草稿 = 94 community + 5 official_website；後台「自動判斷+發布」對 94 筆聚合源 0/84 生效（閘門正確運作）。
- 已發布 156 場中，27 場聚合源是人工升級（達人力極限），94 筆卡住無法比照。
- → 已開 `AGGREGATOR_EVENT_VERIFICATION_WORK_ORDER.md`（B 選項工作單）；下一步 PM 開 B-0 探測票交 Codex。

**D2. 開群時機**：即使只補 Jay Park + DAY6，涵蓋仍集中在巡演團。
「巡演垂直群」結論不變；「全藝人大群」仍不可行。開群不必等 D1 全部解決。
