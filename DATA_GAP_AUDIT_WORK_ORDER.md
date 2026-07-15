# 資料缺口盤點工作單（DATA_GAP_AUDIT）

> 類型：純研究 / PM 直接執行（不涉 code / migration / schema）
> 目的：在考慮「開社群配合網站」前，先量化目前行程資料的**覆蓋率與缺口**，
> 決定下一步是「批量核准既有候選」、「補來源」還是「補 AI 搜尋」。
> 產出：本檔填入真實數字後的缺口分析 + 行動建議。

---

## 0. 背景

- 目前 91 個 active idol，但前台已發布活動長期只有 ~22 場（集中在 kpopofficial 聚合源）。
- 候選池累積 375 筆：129 待審 / 161 已核准 / 85 已拒絕（2026-07-14 後台截圖）。
- PR #186 已開放聚合來源批量核准 → 129 筆待審可快速轉草稿。
- Owner 想法：資料夠完整 → 開 LINE 社群 / TG 頻道分發 → 粉絲經濟變現。
- **前提**：社群一旦開就不能斷更。必須先確認「資料供給的量與穩定度」撐得起每日分發。

---

## 1. 要回答的問題

| # | 問題 | 為什麼重要 |
|---|---|---|
| Q1 | 91 個 active idol 裡，有幾個「完全沒有任何已發布活動」？ | 覆蓋率黑洞 = 社群裡這些藝人的粉絲會失望 |
| Q2 | 已發布活動集中在哪幾個藝人 / 公司？ | 判斷是否過度偏食（只有 HYBE 聚合源那批）|
| Q3 | 129 筆待審候選，分佈在哪些藝人 / 來源 / 活動類型？ | 批量核准後能補上哪些缺口 |
| Q4 | 候選池裡有多少筆「有 detected_idol」可直接批量核准，多少筆缺 idol？ | 缺 idol 的無法批量核准，需人工或 idolMatcher |
| Q5 | 未來活動 vs 過期活動的比例？ | 過期的對社群無價值；要看「未來可推」的實際存量 |
| Q6 | 哪些 active 來源最近有實際產出候選？哪些是死來源？ | 決定補哪些來源 / 停用哪些 |

---

## 2. 盤點 SQL（Supabase SQL Editor 逐段執行）

> 每段獨立跑，把結果貼回給 PM。若某段報錯，貼錯誤訊息即可。

### SQL-1 · 已發布活動總覽（Q2, Q5）

```sql
-- 已發布活動：按公司與未來/過期分佈
SELECT
  COUNT(*)                                                    AS published_total,
  COUNT(*) FILTER (WHERE date >= CURRENT_DATE)                AS upcoming,
  COUNT(*) FILTER (WHERE date <  CURRENT_DATE)                AS past,
  COUNT(DISTINCT idol_id)                                     AS distinct_idols
FROM public.events
WHERE is_published = true;
```

### SQL-2 · 已發布活動按藝人排行（Q2）

```sql
SELECT idol_name, COUNT(*) AS published_events,
       COUNT(*) FILTER (WHERE date >= CURRENT_DATE) AS upcoming
FROM public.events
WHERE is_published = true
GROUP BY idol_name
ORDER BY published_events DESC;
```

### SQL-3 · 「零已發布活動」的 active idol（Q1）— 覆蓋黑洞

```sql
SELECT i.name, i.agency, i.type
FROM public.idols i
LEFT JOIN public.events e
  ON e.idol_id = i.id AND e.is_published = true
WHERE i.is_active = true
  AND e.id IS NULL
ORDER BY i.agency NULLS LAST, i.name;
```

### SQL-4 · 待審候選按藝人 + 來源分佈（Q3）

```sql
SELECT
  COALESCE(ec.detected_idol_id::text, '(無對應)')            AS idol_key,
  ec.source_name,
  ec.source_type,
  COUNT(*)                                                   AS n
FROM public.event_candidates ec
WHERE ec.review_status = 'pending'
GROUP BY idol_key, ec.source_name, ec.source_type
ORDER BY n DESC;
```

### SQL-5 · 待審候選：可批量核准 vs 缺 idol（Q4）

```sql
SELECT
  COUNT(*)                                                       AS pending_total,
  COUNT(*) FILTER (WHERE detected_idol_id IS NOT NULL)           AS has_idol_batchable,
  COUNT(*) FILTER (WHERE detected_idol_id IS NULL)               AS missing_idol,
  COUNT(*) FILTER (WHERE detected_date >= CURRENT_DATE)          AS future_dated,
  COUNT(*) FILTER (WHERE detected_date <  CURRENT_DATE)          AS past_dated
FROM public.event_candidates
WHERE review_status = 'pending';
```

### SQL-6 · 待審候選按活動類型（Q3）

```sql
SELECT COALESCE(detected_event_type::text, '(未分類)') AS event_type,
       COUNT(*) AS n
FROM public.event_candidates
WHERE review_status = 'pending'
GROUP BY event_type
ORDER BY n DESC;
```

### SQL-7 · 來源健康度：各 active 來源的最近產出（Q6）

```sql
SELECT
  cs.source_key,
  cs.parser_type,
  cs.is_active,
  cs.last_status,
  cs.last_run_at,
  (SELECT COUNT(*) FROM public.event_candidates ec
     WHERE ec.source_name = cs.name)                       AS total_candidates_ever
FROM public.crawler_sources cs
ORDER BY cs.is_active DESC, cs.last_run_at DESC NULLS LAST;
```

> 註：SQL-7 以 `event_candidates.source_name = crawler_sources.name` 近似關聯
> （候選以顯示名記錄來源，非 source_key）。名稱若有微差可能低估，僅作趨勢判讀。

---

## 3. 結果填寫區（PM 待填）

### 3.1 覆蓋率快照（2026-07-14 實測）
- 已發布活動：**156 場**（未來 **68** / 過期 **88**），涵蓋 **20** 個藝人
- 零活動的 active idol：**72 / 92**（約 78% 的名冊完全沒資料）
- 待審候選：**129 筆**（可批量核准 **129** / 缺 idol **0**；未來日期 **120** / 過期 **9**）

### 3.2 缺口熱點（SQL-3 黑洞清單，72 筆節錄）
- **BTS 全體 solo**：j-hope / Jimin / Jin / Jung Kook / RM / SUGA / V（BigHit / HYBE）— 全零
- **(G)I-DLE / PENTAGON**（Cube）— 全零
- **Sunmi**（ABYSS）、**Dynamicduo**（Amoeba Culture）— 全零
- ⚠️ 關鍵觀察：黑洞名單與「不要重複嘗試」清單**高度重疊** — 最大粉絲基數的藝人（BTS 系 / HYBE / Weverse-gated）正是目前爬不到的來源。

### 3.3 資料集中度
- 156 場活動集中在 20 個藝人（平均每人 ~7.8 場）；其餘 72 個藝人 0 場。
- 極度偏食：有資料的是少數在跑巡演的團（BABYMONSTER / TWS 等聚合源命中者）。

### 3.4 待審候選歸屬（SQL-4 帶名字版，決定性發現）
- 129 筆待審分佈在 **17 個藝人**，**全部是「加厚既有」，0 筆「填補黑洞」**。
- 意即：批量核准這 129 筆**不會增加涵蓋藝人數**（維持 20），只會讓已有資料的藝人更豐富。
- 官方來源（非聚合，可設 official）：Stray Kids 21 / ITZY 16 / BABYMONSTER 3 / Xdinary Heroes 2 = 42 筆。
- 其餘 ~87 筆為 KPopOfficial Concerts 聚合源（設 media/pending）。
- 主要受益藝人：Stray Kids、ITZY、BABYMONSTER、TREASURE、BTS（團）、LE SSERAFIM、MAMAMOO、TWS、EXO、PLAVE 等 —— 皆為正在跑巡演的團體。
- **72 個黑洞（BTS solo / (G)I-DLE / PENTAGON / Sunmi 等）完全沒有待審候選** → 因為它們的來源本來就爬不到，候選池裡根本沒有它們。

### 3.5 最終判讀
- 批量核准 129 筆 = 深化 20 個「巡演團」的資料，**不拓寬涵蓋面**。
- 拓寬涵蓋（填補 72 黑洞）**無法靠現有候選池**，需新來源突破（Scrapling 探測 / 人工維護），屬另一條線。
- 開群結論：**「巡演 / 演唱會行程」垂直社群（聚焦這 20 個有料的團）現在可行**；「全藝人大群」不可行（78% 名冊空白）。

---

## 4. 決策框架（拿到數字後 PM 給建議）

| 情境 | 判讀 | 建議行動 |
|---|---|---|
| 批量核准後未來活動 > 80 場、涵蓋 > 40 藝人 | 存量足夠 | 可開社群工作單，先小規模試營運 |
| 未來活動 < 40 場、集中少數藝人 | 存量不足、偏食 | 先補來源（挑黑洞裡的高人氣藝人）再談社群 |
| 缺 idol 候選佔比高（>30%）| idolMatcher 覆蓋不足 | 先驗證 P1-B8 idolMatcher 命中率，補 alt_names |
| 死來源多、活來源少 | 供給不穩 | 社群會斷更，暫緩開群，先穩定 pipeline |

---

## 5. 邊界

- 本工作單**只做盤點與分析**，不改任何 code / migration / schema / 資料。
- SQL 皆為唯讀 SELECT，不含 UPDATE / DELETE / INSERT。
- 開社群相關的任何自動推播 bot 屬 CLAUDE.md 高風險任務，需另開 GPT 工作單，不在本檔範圍。
