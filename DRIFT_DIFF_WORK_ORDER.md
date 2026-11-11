# Drift Diff Work Order
## 候選 needs_recheck 顯示新舊內容差異

> **Status**: planning only — no code in this PR.
> **Type**: 規劃工作單（規劃下一輪實作的範圍、資料模型、UI 與驗收）
> **Date**: 2026-05-25
> **Owner**: idol-rhythm
> **Triggers**: 使用者觀察 — admin 看到 needs_recheck 旗標時無法在後台得知到底改了什麼，必須打開來源網站人工比對。

---

## 1. 任務定位

### 1.1 本輪只做

- 規劃下一輪實作的範圍、資料保存格式、UI 顯示策略、驗收方式
- 釐清受影響的 crawler 清單
- 列出已知風險與開放問題供 GPT audit

### 1.2 本輪不做

- 不寫任何 runtime / parser code
- 不新增 migration / schema / RLS / GRANT
- 不改 UI
- 不改既有 `resolveRecheck` server action（單筆）
- 不改 PR #177 的 `bulk-resolve-recheck` endpoint
- 不消耗 ANTHROPIC_API_KEY
- 不碰 \`.env.local\`
- 不修改前台 / 通知 / cron 既有行為

---

## 2. 目前行為（從 code 驗證）

### 2.1 Crawler 偵測 drift 時做了什麼

以 `runJypScheduleFetcher.ts:438-445` 為代表，所有 J7d-A drift 路徑的 fetcher 在 `content_hash` 不一致時**只 update 3 個欄位**：

| 欄位 | 改變 |
|---|---|
| `needs_recheck` | `true` ← 旗標 |
| `content_hash` | 新值 ← 只是 SHA-256，不是可讀內容 |
| `reviewer_note` | append 時間戳註記 |

**完全不動**的欄位（候選還是舊內容）：
- `raw_title`
- `raw_content`
- `detected_date`
- `source_url`
- `raw_data`
- `review_status`
- `approved_event_id`

### 2.2 Event 表完全不被動到

**Crawler 永遠不寫 `events` 表**。已發布活動的 title / date / location / description 完全不會被 crawler 改動，無論來源網站改了什麼。

### 2.3 Resolve（已處理）也不會同步主要欄位

單筆 `resolveRecheck` server action 與 PR #177 的 `bulk-resolve-recheck` endpoint 都**只同步繁中欄位**（`display_title_zh` / `display_summary_zh` / `location_name_zh` / `translation_*`）到 event。**不同步** title / date / location / description。

### 2.4 受影響的 fetcher 清單（grep 確認）

| Fetcher | 受影響 | 備註 |
|---|---|---|
| `runBlackpinkFetcher.ts` | ✅ | BLACKPINK 官方 tour |
| `runJypScheduleFetcher.ts` | ✅ | JYP 系列（TWICE / ITZY / NMIXX / DAY6 / Xdinary Heroes / 2PM / Stray Kids / J.Y. Park）|
| `runKpopofficialConcertsFetcher.ts` | ✅ | kpopofficial 聚合 |
| `runSmtownNoticeFetcher.ts` | ✅ | SM 系列（aespa / RIIZE / EXO / NCT 等）|
| `runWakeoneNoticeFetcher.ts` | ✅ | WAKEONE 系列（ZB1 / Kep1er / izna / Jo Yuri）|
| `runYgArtistScheduleFetcher.ts` | ✅ | YG 系列（BLACKPINK group / BABYMONSTER / TREASURE）|
| `runYoutubeOfficialChannelFetcher.ts` | ✅ | YouTube 官方頻道 |
| `runGenericWebpageFetcher.ts` | ❌ | P1-B 純人工 Preview / Commit，**無 cron drift loop**，不在本輪範圍 |

---

## 3. 風險（目前狀態）

| # | 場景 | 後果 |
|---|---|---|
| R1 | 演唱會日期被官方延期 | 前台仍顯示舊日期，用戶誤判 |
| R2 | 演唱會取消 | 前台仍顯示 confirmed，用戶買票或飛去現場 |
| R3 | 場館移動（KSPO ↔ Inspire Arena ↔ 其他）| 前台仍顯示舊場館，用戶到錯地方 |
| R4 | 售票連結改變 | 前台連結指向舊 URL，可能 404 或誤導 |
| R5 | Admin 在後台看 needs_recheck 候選 | 候選 raw 內容仍是舊的，必須打開 source URL 人工比對 |
| R6 | 大量 needs_recheck 同時出現 | 不知道哪些改動是大事（日期 / 取消）哪些是小事（描述微調），無法分輕重 |

本工作單**只解決 R5、R6**（後台可見性 + 差異視覺化）。R1–R4 的修復路徑仍是 admin **手動**編輯 event。

---

## 4. 目標

### 4.1 Must

1. Crawler 偵測 drift 時，**保留**原始 `raw_title / raw_content / detected_date / source_url`（不動）
2. Crawler 偵測 drift 時，**同時把新抓到的版本**保存起來（候選詳情頁可讀）
3. 候選詳情頁可以顯示「原本內容」與「新抓到內容」的差異
4. Admin 看完後**仍須手動**決定是否更新對應 event
5. 不自動改 events / 不自動發布 / 不自動取消 / 不改前台顯示

### 4.2 Nice-to-have（v1 可不做）

- 多次 drift 的歷史快照（v1 只記錄最新一次新版本，不留多代版本）
- 自動分類 drift 重要性（日期改 vs 描述微調）
- Diff highlighting（v1 純並列顯示即可，admin 自行對比）
- Cancellation detection（連續 N 次 fetch 沒抓到 → 可能取消）

---

## 5. 資料保存設計（建議方案比較）

### 5.1 三個候選

| 方案 | 儲存位置 | 優點 | 缺點 | Migration |
|---|---|---|---|---|
| **A. 新增 5 個 column** | `event_candidates.latest_raw_title` / `latest_raw_content` / `latest_detected_date` / `latest_source_url` / `latest_detected_at` | 欄位明確、SQL 容易查、type safety 強 | 需 migration + column-level GRANT | ✅ |
| **B. 用既有 jsonb** | `event_candidates.raw_data.latest_snapshot = { title, content, detected_date, source_url, detected_at }` | **零 migration**、可即時實作 | 查詢 / 顯示 / type 都靠 jsonb 操作，較鬆散 | ❌ |
| **C. 新建 history 表** | `event_candidate_drift_snapshots` 一行 = 一次 drift | 完整歷史、可追溯多代 | migration 重；超出 v1 範圍 | ✅ + 新 RLS |

### 5.2 推薦：**方案 A**

理由：
- 結構清楚，TypeScript 型別與查詢都直觀
- column-level GRANT 完全沿用 J7d-A 既有 pattern（migration 026 add column + service_role + admin）
- 與 jsonb 比，admin UI 在 server component 端能直接 select 出 latest_*，不必 cast jsonb
- 多代歷史（方案 C）屬於 v2 議題，本輪不混入

**反對方案 B 的關鍵理由**：未來如果改成方案 A，要做兩次 migration（先進 jsonb 再搬出來），不如一次到位。

### 5.3 方案 A 欄位細節

```
ALTER TABLE event_candidates
  ADD COLUMN latest_raw_title    text,
  ADD COLUMN latest_raw_content  text,
  ADD COLUMN latest_detected_date date,
  ADD COLUMN latest_source_url   text,
  ADD COLUMN latest_detected_at  timestamptz;
```

- 預設都 NULL（從沒 drift 過的候選 = NULL，UI 直接判斷「無變更」）
- `latest_detected_at` = drift 偵測**那一次** fetch 的 `now()`
- 這 5 欄是「最新一次」snapshot，不是「下一次審核要採用」(沒有 promote 行為，純人工)

### 5.4 GRANT / RLS 邊界（待 GPT 裁定）

| 角色 | 既有 GRANT on event_candidates | 新欄位是否需要明示？ |
|---|---|---|
| `service_role` | INSERT / SELECT / UPDATE（migration 018）| **可能需要** column-level UPDATE 明示，沿用 migration 026 pattern |
| `authenticated`（admin）| SELECT / UPDATE（migration 012 + J7b）| **可能需要** column-level SELECT 明示 |
| `anon` | 無 | 不變 |

> ⚠️ 使用者要求「不改權限策略除非工作單明確說明必要性」。本工作單**建議**為 5 個新欄位加 column-level GRANT，理由：完全沿用 J7d-A migration 026 既有 pattern（不是新概念），避免實作時遇到 RLS / GRANT 卡住。實作 PR 前要請 GPT 確認此 GRANT 範圍是否可接受。

---

## 6. Crawler 改動範圍（v1）

### 6.1 共通改動

7 個受影響 fetcher 在 drift 分支（`content_hash` differs）的 UPDATE payload，從現在的 3 欄位擴成 8 欄位：

```ts
// Before
update({
  needs_recheck: true,
  content_hash: payload.content_hash,
  reviewer_note: newNote,
})

// After (v1 plan)
update({
  needs_recheck: true,
  content_hash: payload.content_hash,
  reviewer_note: newNote,
  // ── new in v1 ──
  latest_raw_title:    payload.raw_title,
  latest_raw_content:  payload.raw_content,
  latest_detected_date: payload.detected_date,
  latest_source_url:   payload.source_url,
  latest_detected_at:  new Date().toISOString(),
})
```

### 6.2 既有欄位（`raw_title` / `raw_content` 等）行為**完全不變**

- 不覆寫
- 不清空
- 保留為「當初核准時看到的版本」

### 6.3 INSERT 分支不受影響

新候選首次寫入時，`latest_*` 都是 NULL。只有 drift 路徑會填入。

### 6.4 Resolve 行為

當 admin 點「已處理」清除 `needs_recheck` 時，**v1 建議不清空 `latest_*`**：保留最後一次 snapshot 供 audit。下一次 drift 再覆寫即可。

> 這個策略意味著 `latest_*` 永遠是「最後一次 drift 偵測到的版本」，不是「上次未處理的版本」。要做更細緻的 audit log 屬於方案 C 範疇。

---

## 7. 後台 UI 設計

### 7.1 觸發條件

候選詳情頁（`/admin/event-candidates/[id]`）滿足 **`latest_detected_at IS NOT NULL`** 時顯示「內容變更紀錄」區塊。需重審 tab 的列表卡片不變（既有「內容已變更」橘色 badge 已足夠暗示）。

### 7.2 區塊位置

建議放在候選詳情頁的「原始資訊」區塊上方，緊接在頁首 status / source badge 之後，admin 一進來就看到。

### 7.3 區塊內容（並列比較）

```
┌─── 內容變更紀錄 ──────────────────────────────────┐
│ 最近偵測：2026-05-25 09:30                       │
│                                                 │
│ ┌── 原本內容（核准時） ──┬── 新抓到內容 ───────┐ │
│ │ 標題                  │ 標題                 │ │
│ │ <raw_title>           │ <latest_raw_title>   │ │
│ │ 日期                  │ 日期                 │ │
│ │ <detected_date>       │ <latest_detected_date>│ │
│ │ 來源 URL              │ 來源 URL             │ │
│ │ <source_url>          │ <latest_source_url>  │ │
│ │ 內容                  │ 內容                 │ │
│ │ <raw_content>         │ <latest_raw_content> │ │
│ └─────────────────────┴────────────────────────┘ │
│                                                 │
│ ⚠️ 此區塊純粹顯示來源最新版本。                  │
│    系統不會自動更新對應的已發布活動。            │
│    若需更新，請至活動編輯頁人工調整。            │
└─────────────────────────────────────────────────┘
```

### 7.4 視覺設計細節

- 並列兩欄（mobile 折成上下）
- 欄位逐項對比，**單欄相同時不需特別標記**（v1 不做 diff highlighting）
- 欄位不同時舊內容用 `text-muted line-through`，新內容用 `text-emerald-400`（標準 diff 顏色）
- 留一行**警語**：「系統不會自動更新已發布活動，請手動處理」

### 7.5 連動「已處理」按鈕的行為

不變 — 既有按鈕（單筆 + 批量）邏輯維持，只清 `needs_recheck`、同步繁中欄位。**不**在 resolve 時做主要欄位 promote。

> Promote 屬於 J7d-B「approved event 自動同步策略」範疇，需另外工作單。本輪維持「人工編輯 event」原則。

### 7.6 不影響的 UI

- 候選列表頁（`/admin/event-candidates`）不加新欄位顯示
- 既有「內容已變更」橘色 badge 維持
- 待審 / 已通過 / 已退回 / 全部 tab 不變
- 前台（`/`, `/schedule`, `/events/[id]` 等）**完全不動**

---

## 8. 人工驗收方式

### 8.1 Pre-flight

1. 確認 v1 範圍的 7 個 fetcher 中至少 1 個 source 是 active（如某個 SMTOWN notice）
2. 確認該 source 下有至少 1 筆 review_status=approved + needs_recheck=false 的候選（作為 baseline）

### 8.2 模擬 drift

選項：
- **A**（真實）：等該 source 自然出現內容變更（耗時不可控）
- **B**（受控）：直接在 Supabase SQL Editor 對該候選 UPDATE content_hash 為任意舊值，然後手動觸發該 source 的 fetcher（後台 Run Source）。Fetcher 抓回新 hash 不一致 → 觸發 drift 路徑

建議用 B 驗收。

### 8.3 預期結果

1. `needs_recheck = true` ✅
2. `content_hash` 變新值 ✅
3. **新欄位 `latest_raw_title` / `latest_raw_content` / `latest_detected_date` / `latest_source_url` / `latest_detected_at` 都被填入** ✅
4. 既有 `raw_title` / `raw_content` / `detected_date` / `source_url` / `raw_data` **完全不變** ✅
5. 候選詳情頁顯示「內容變更紀錄」區塊，並列原本內容與新抓到內容 ✅
6. 對應的 published event **完全不動**（在 `/events/[id]` 前台看到的還是舊內容）✅
7. 點「已處理」清 flag 後：
   - `needs_recheck = false` ✅
   - `latest_*` 欄位**保留**（不清空，供 audit）✅
   - 繁中欄位有的話依然同步到 event ✅

### 8.4 反向驗收（沒踩雷）

- 新候選首次寫入時 `latest_*` 全 NULL ✅
- `needs_recheck=false` 候選頁無「內容變更紀錄」區塊 ✅
- 前台活動完全不變 ✅
- 既有單筆 `resolveRecheck` server action 與 PR #177 批量 endpoint 行為一字不變 ✅

---

## 9. 不在本輪範圍（再次強調）

- ❌ 不寫任何 runtime / parser code
- ❌ 不新增 migration / schema / RLS / GRANT（規劃可寫草案 SQL，但不執行）
- ❌ 不改 UI
- ❌ 不改既有 `resolveRecheck` server action（單筆）
- ❌ 不改 PR #177 的 `bulk-resolve-recheck` endpoint
- ❌ 不自動更新 events 主要欄位
- ❌ 不自動發布 / 不自動取消活動 / 不自動下架
- ❌ 不改前台 `/`, `/schedule`, `/events/[id]` 等任何顯示
- ❌ 不使用 service_role 做新行為（crawler 既有路徑沿用既有 service_role；UI 端讀取沿用既有 admin session）
- ❌ 不改 generic_webpage（無 drift loop，本輪無關）
- ❌ 不做 cancellation detection（v2 議題）
- ❌ 不做 diff highlighting（v1 純並列）
- ❌ 不做多代歷史（v1 只記最新一次）
- ❌ 不做自動 promote「latest_* → raw_*」

---

## 10. 後續 PR 拆分建議

| PR | 範圍 | Migration |
|---|---|---|
| **本工作單 PR** | 純規劃文件；不改 code | ❌ |
| **Migration PR** | `ALTER TABLE event_candidates ADD COLUMN latest_*` 5 欄位 + column-level GRANT | ✅ 1 筆（編號以執行時的 main 狀態為準）|
| **Crawler runtime PR** | 7 個 fetcher 的 drift 分支 UPDATE payload 擴 5 欄位；不改 INSERT 分支 | ❌ |
| **Admin UI PR** | 候選詳情頁加「內容變更紀錄」區塊；前台 / 列表頁不動 | ❌ |
| **Acceptance PR**（選做）| 跑 §8 驗收流程 | ❌ |

每個 PR 都要 reference 本工作單章節編號，避免 scope creep。

---

## 11. 開放問題（留給 GPT audit）

1. **方案 A vs B vs C** 是否確認用 A（5 個 column）？或 GPT 偏好 B（jsonb，零 migration）作為先期試點？
2. **`latest_*` GRANT 範圍**：是否確認沿用 J7d-A migration 026 的 column-level GRANT pattern（service_role UPDATE、admin SELECT）？還是先 Audit 一次完整 GRANT 矩陣？
3. **`latest_*` 在 resolve 時的命運**：v1 建議保留（供 audit）。GPT 是否認可？還是建議清空（防 admin 之後混淆）？
4. **多代 history**：v1 只記「最新一次」，多代屬方案 C。GPT 是否認為 v1 應一次到位走方案 C，還是 v1 / v2 分階段？
5. **Diff highlighting**：v1 不做（並列即可）。GPT 是否認可？
6. **UI 區塊位置**：候選詳情頁頂部 vs 底部 vs 中段？建議頂部（admin 一進來就看到），但 mobile UX 待設計。
7. **Cancellation detection**（連續 N 次 fetch 沒抓到 → 可能取消）是否該與本工作單合併或獨立？
8. **`runGenericWebpageFetcher.ts`** 雖然 v1 不在範圍，但未來如果 generic_webpage 加 cron 自動跑，drift 也會發生。是否該在工作單就預留 hook，或留給該 cron 工作單再處理？
