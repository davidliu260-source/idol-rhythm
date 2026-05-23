# YouTube Official Channel Crawler 工作單（P2-A）

> **版本**：v1 — 2026-05-23  
> **範圍**：只做技術規劃，不寫 code、不申請 API key、不新增 migration、不改 schema、不新增 crawler_sources seed、不碰前台 UI。  
> **上游**：Streaming / Video Source Inventory 工作單（`STREAMING_VIDEO_SOURCE_WORK_ORDER.md`，PR #144）已確立 YouTube 查詢流程：channelId → playlistItems.list → videos.list；不用 search.list。  
> **下游**：本工作單 GPT audit 通過後，再開 YouTube crawler runtime PR + channelId seed migration。

---

## 一、目標

為 idol-rhythm 建立第一個影音來源 crawler，從已知官方 YouTube Channel 抓取最新影片，轉成 `event_candidates` 等待後台審核，補足目前活動排程系統對 MV 發布 / comeback showcase / concert film trailer 的覆蓋空缺。

**本工作單需要確定的事：**
1. channelId 存在哪裡（crawler_sources.config vs 其他）
2. parser_type 命名
3. 哪些 idol 先 seed（P0 第一波）
4. 每次 cron 幾個 channel、每 channel 幾支影片
5. title pattern / filter 規則（哪些影片進候選）
6. `metadata.platform` 記錄格式
7. videoId 如何 dedupe
8. API key 管理 / quota / fail gracefully 策略

---

## 二、範圍邊界（本工作單不做）

| 禁止 | 原因 |
|---|---|
| 申請或設定 YouTube Data API key | runtime PR 才做 |
| 寫任何 fetcher / parser runtime | 工作單先行 |
| 新增 migration 或修改 schema | 下個 PR 才做 |
| 新增 crawler_sources seed rows | 下個 PR 才做 |
| 使用 `search.list` 端點 | 明確禁止（P2 工作單裁定）|
| 直接 publish 任何候選 | 永遠走 event_candidates → admin 審核 |
| 碰前台 UI | 無關 |

---

## 三、channelId 儲存策略

### 3-A. 確認：用 `crawler_sources.config jsonb`

沿用現有架構（與 jyp_schedule 的 `groupId`、yg_artist_schedule 的 `artistId` 相同模式），不需新增 idols table 欄位、不需 migration 改 schema：

```sql
INSERT INTO crawler_sources (
  idol_id, source_key, parser_type, source_type, source_url, config, is_active
) VALUES (
  '<idol_uuid>',
  'bts-youtube-official',
  'youtube_official_channel',
  'official_youtube',
  'https://www.youtube.com/channel/<channelId>',
  '{
    "channelId": "UCLkAepWjdylmXSltofFvsYA",
    "maxVideosPerRun": 10,
    "publishedAfterHours": 25
  }'::jsonb,
  true
);
```

**欄位說明：**

| config 欄位 | 型別 | 說明 |
|---|---|---|
| `channelId` | string | YouTube Channel ID（以 UC 開頭，22 碼）|
| `maxVideosPerRun` | number | 每次 cron 最多抓幾支影片（預設 10，可 per-idol 覆蓋）|
| `publishedAfterHours` | number | 只抓幾小時內發布的影片（預設 25，與 N7 視窗一致）|

### 3-B. parser_type 命名

| 欄位 | 值 |
|---|---|
| `parser_type` | `youtube_official_channel` |
| `source_type` | `official_youtube` |

`source_type` 沿用現有 CHECK constraint 的值（`official_website` / `official_social` / ...）；若 `official_youtube` 不在現有 enum 內，runtime PR 需評估是否加入或沿用 `official_social`。

> **預查（runtime PR 前確認）**：目前 migration 001 的 `source_type` CHECK constraint 允許哪些值？若無 `official_youtube`，建議沿用 `official_website`，migration 加 enum 留 v2。

---

## 四、第一波 channelId seed 候選（P0）

**原則：**
- 優先選「現有爬蟲未覆蓋或覆蓋不足」的藝人
- JYP / YG schedule crawler 已覆蓋演唱會行程，但 **YouTube 的 MV release 仍為空缺**，因此 JYP / YG 藝人也應 seed
- 優先主流高活躍度藝人，確保 cron 跑起來就能看到候選
- channelId 值由 admin 在 Supabase SQL Editor 手動確認後寫入 migration（非本工作單範圍）

**P0 第一波（建議 runtime PR migration seed 的 20 個）：**

| 藝人 | slug | 所屬公司 | 備註 |
|---|---|---|---|
| BTS | `bts` | HYBE / BigHit | 現無任何 crawler，最高流量 |
| BLACKPINK | `blackpink` | YG | YG schedule 覆蓋演唱會，MV 未覆蓋 |
| TWICE | `twice` | JYP | JYP schedule 覆蓋演唱會，MV 未覆蓋 |
| aespa | `aespa` | SM | SMTOWN notice 覆蓋公告，MV 補洞 |
| RIIZE | `riize` | SM | 同上 |
| SEVENTEEN | `seventeen` | HYBE / Pledis | 現無任何 crawler |
| Stray Kids | `stray-kids` | JYP | JYP schedule 已覆蓋，MV 補洞 |
| IVE | `ive` | Starship | 現無 Starship crawler，Starship Verdict 等 Google Discovery |
| LE SSERAFIM | `le-sserafim` | HYBE / Source | 現無任何 crawler |
| ENHYPEN | `enhypen` | HYBE / Belift | 現無任何 crawler |
| NewJeans / NJZ | `newjeans` | ADOR / 狀態待確認 | 活躍度高，status uncertain 已標注 |
| (G)I-DLE | `g-i-dle` | Cube | 現無任何 crawler |
| ITZY | `itzy` | JYP | JYP schedule 已覆蓋，MV 補洞 |
| NMIXX | `nmixx` | JYP | 同上 |
| BABYMONSTER | `babymonster` | YG | YG schedule 已覆蓋，MV 補洞 |
| NCT 127 | `nct-127` | SM | SMTOWN notice 覆蓋公告，MV 補洞 |
| NCT DREAM | `nct-dream` | SM | 同上 |
| Red Velvet | `red-velvet` | SM | 同上 |
| ATEEZ | `ateez` | KQ | 現無任何 crawler |
| TXT | `txt` | HYBE / BigHit | 現無任何 crawler |

> **注意：** channelId 實際值（如 `UCLkAepWjdylmXSltofFvsYA`）需 admin 在 YouTube 上確認官方頻道後手動填入 migration SQL。本工作單只定義 seed 策略，不列實際 channelId 值（避免錯誤）。

**P1 第二波（P0 通過後再擴充）：**
- MONSTA X / CRAVITY / KiiiKiii（Starship 四藝人）
- fromis_9 / BOYNEXTDOOR / KATSEYE / TWS（HYBE）
- EXO / SHINee / Super Junior（SM 經典）
- TREASURE / WINNER（YG）
- 其他主流單元 / 解散後活躍 solo

---

## 五、cron 配置

### 5-A. 每次 cron 處理量

| 參數 | 建議值 | 說明 |
|---|---|---|
| channels per run | 全部 is_active=true 的 `youtube_official_channel` sources | 第一波 20 個 |
| maxVideosPerRun | 10 per channel | 只抓第 1 頁（playlistItems page_size=50，取前 10）|
| publishedAfterHours | 25 | 與 N7 視窗一致（不漏、不重複太多）|
| cron 頻率 | 每日一次 | Vercel Hobby plan daily 限制 |
| 排程時間建議 | `30 2 * * *`（UTC）= 10:30 Taipei | 與 N6（01:30）/ N7（02:00）錯開 |

### 5-B. Quota 估算（P0 20 個 channel）

| 步驟 | units | 說明 |
|---|---|---|
| Step 1 channels.list | 20 | 每 channel 1 unit |
| Step 2 playlistItems.list | 20 | 每 channel 1 頁 |
| Step 3 videos.list batch | 20 | 每 channel 最多 10 videoId，1 batch |
| **合計** | **60 units / 次** | 遠低於 10,000 unit/day 上限 |

P1 擴充至 50 個 channel 後約 150 units / 次，仍安全。

---

## 六、title / description 分類過濾規則

### 6-A. 應收 patterns（進 event_candidates）

**方法：** title 包含以下 keyword（大小寫不敏感）→ 進候選

| keyword 群組 | 代表關鍵字 | 對應 EventType | EventSubType |
|---|---|---|---|
| MV | `MV`, `M/V`, `Music Video`, `뮤직비디오`, `퍼포먼스` | `official` | `release` |
| Teaser | `Teaser`, `티저`, `Preview`, `Highlight` | `official` | `announcement` |
| Comeback Showcase | `Comeback Showcase`, `컴백 쇼케이스`, `Showcase` | `official` | `release` |
| Concert Film Trailer | `Concert Film`, `Concert Movie`, `Film Trailer`, `콘서트 필름` | `official` | `announcement` |
| Album / Release | `Album`, `앨범`, `EP`, `Single`, `싱글`, `Release` | `official` | `release` |
| Premiere | 由 `liveStreamingDetails.scheduledStartTime` 判斷（非 title keyword）| `official` | `announcement` |
| Official Livestream | 由 `liveStreamingDetails.liveBroadcastContent = 'live'` 或 `'completed'` 判斷 | `streaming` | — |

### 6-B. 排除 patterns（不進候選）

**方法：** 符合以下任一條件 → 跳過

| 條件 | 說明 |
|---|---|
| `duration < PT60S`（Shorts）| YouTube Shorts 通常 ≤ 60 秒，v1 排除 |
| title 含 `Lyric`, `Lyrics`, `가사` | lyric video，v1 保守排除 |
| title 含 `Behind`, `Making`, `Vlog`, `Diary`, `브이로그` | behind / vlog，v1 保守排除 |
| title 含 `Reaction`, `Cover`, `Dance Cover`, `Fan` | 非官方類內容，v1 排除 |
| channel 非 seeded channelId | 不信任任何非 seed 頻道 |

### 6-C. 無法分類時的處理

若影片不符合任何 6-A keyword 群組，但來自官方頻道 → **仍進候選**，`detected_event_type = null`，交 admin 審核決定。這避免新 content type 一律漏掉。

---

## 七、metadata 記錄格式

所有從 YouTube crawler 進入 `event_candidates` 的候選，`raw_data jsonb` 記錄：

```json
{
  "platform": "youtube",
  "videoId": "dQw4w9WgXcQ",
  "channelId": "UCXXXXXXxxx",
  "channelTitle": "HYBE LABELS",
  "duration": "PT4M33S",
  "liveBroadcastContent": "none",
  "scheduledStartTime": null,
  "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "publishedAt": "2026-05-23T10:00:00Z",
  "crawledAt": "2026-05-23T10:30:00Z"
}
```

`event_candidates.source_url` = `https://www.youtube.com/watch?v={videoId}`

---

## 八、dedupe 策略

**問題**：同一支 MV 可能在 25 小時視窗內被連續兩天的 cron 各抓一次。

**解法**：沿用現有 `source_hash` 機制（`computeSourceHash({ sourceUrl })` → SHA-256 → DB unique constraint）：

```
source_url = https://www.youtube.com/watch?v={videoId}
source_hash = sha256(source_url)
```

DB 的 `(source_hash, source_id)` unique constraint 會在 upsert 時攔截重複，等同於 per-video dedupe。fetcher 層也可在 upsert 時用 `onConflict: 'source_hash'` ignoreDuplicates，與現有 SMTOWN / WAKEONE crawler 相同模式。

---

## 九、API key 管理

| 項目 | 規劃 |
|---|---|
| 取得方式 | Google Cloud Console → YouTube Data API v3 → 建立 API key（無需 OAuth）|
| 環境變數 | `YOUTUBE_API_KEY`（加入 `.env.local` + Vercel 環境設定）|
| 存取範圍 | Server-side only（cron route 與 admin 手動觸發 route）|
| 金鑰限制 | 建議在 Google Cloud Console 限制 referrer / IP，避免外洩濫用 |
| Rotation | 若 quota 被濫用，Google Cloud Console 刪舊 key 建新 key，更新 Vercel env |

---

## 十、Fail Gracefully 策略

```
cron 觸發
  ↓
查詢 remaining quota（可用 quotaUser header 或 error code 403 判斷）
  ↓
若 quota 不足（< 500 units 或收到 403 quotaExceeded）
  → log warning，跳過本次 YouTube cron，不影響其他 crawler
  → 回傳 { status: 'skipped', reason: 'quota_exceeded' }
  ↓
正常執行：per channel 獨立 try/catch
  → 單一 channel 失敗 → log error + 繼續下一個 channel
  → 不因單一 channel 403 / 網路錯誤中止整個 cron
  ↓
全部 channel 完成後彙整結果
  → { processed: N, candidates: M, skipped: K, errors: [...] }
  → 與現有 SMTOWN / WAKEONE cron 相同回傳格式
```

---

## 十一、source_type CHECK constraint 確認（runtime PR 前置）

**待確認**：migration 001 的 `crawler_sources.source_type` CHECK constraint 允許哪些值？

```sql
-- 請在 Supabase SQL Editor 確認：
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%source_type%';
```

- 若 `official_youtube` 已在 enum → 直接用
- 若不在 → runtime PR 有兩個選項：
  - **方案 A（推薦）**：沿用 `official_website`，避免 migration
  - **方案 B**：新增 `official_youtube` 到 CHECK constraint（需 migration）

---

## 十二、admin 手動觸發 route

與現有 SMTOWN / WAKEONE crawler 相同，新增：

```
POST /api/admin/crawlers/youtube-official/run
```

- Admin-only（getCurrentAdmin() gate）
- 接受 optional body `{ channelId?: string }`（指定單一頻道 debug run）
- 回傳 candidates 寫入數、跳過數、error list

---

## 十三、決策輸出（GPT audit 需回答）

| # | 問題 | 影響 |
|---|---|---|
| Q1 | channelId 用 `crawler_sources.config jsonb`，不新增 idols table 欄位，是否同意？| 決定 migration 設計 |
| Q2 | parser_type = `youtube_official_channel`，source_type = `official_website`（不新增 enum），是否同意？| 決定 migration SQL |
| Q3 | P0 第一波 20 個藝人名單是否有調整？（如去掉 NewJeans / NJZ 狀態未確定者）| 決定 seed migration |
| Q4 | maxVideosPerRun = 10 per channel，是否夠用？還是要調高？| 決定 cron config |
| Q5 | title keyword 分類規則是否完整？有無遺漏重要 keyword？| 決定 fetcher filter 邏輯 |
| Q6 | 無法分類影片（不符合任何 keyword）仍進候選（detected_event_type = null），是否同意？| 決定漏掉率 vs 審核量平衡 |
| Q7 | Shorts 排除門檻：`duration < PT60S`，是否合適？| 決定 filter 邏輯 |
| Q8 | source_type 用 `official_website` 不新增 enum，是否同意？或需要先確認 CHECK constraint？| 決定是否需要 migration |

---

## 十四、建議 PR 拆分（工作單通過後）

```
runtime PR（本工作單通過後才開）：

PR-A：YouTube Official Channel Crawler runtime
  - src/lib/crawlers/youtubeOfficialChannel.ts（fetcher）
  - src/app/api/admin/crawlers/youtube-official/run/route.ts（admin 觸發）
  - src/lib/crawlers/runActiveCrawlerSources.ts 加 youtube_official_channel case
  - vercel.json 加 cron 排程 30 2 * * *

PR-B（同 PR-A 或分開）：channelId seed migration
  - supabase/migrations/048_seed_youtube_channel_sources.sql
  - P0 20 個藝人的 crawler_sources INSERT
  - 需 admin 在 Supabase SQL Editor 手動執行
```

---

## 十五、不做的事（邊界確認）

- ❌ 不寫任何 fetcher / parser runtime（工作單先行）
- ❌ 不申請 YouTube Data API key（runtime PR 才做）
- ❌ 不新增 migration（runtime PR 才做）
- ❌ 不新增 crawler_sources seed（runtime PR 才 seed）
- ❌ 不使用 `search.list` 端點（P2 工作單裁定，永久禁止在 cron 中用）
- ❌ 不直接 publish 任何候選
- ❌ 不碰前台 UI
- ❌ 不碰通知系統
- ❌ 不抓非 seed channelId 的頻道
