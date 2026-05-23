# YouTube Official Channel Crawler 工作單（P2-A）

> **版本**：v3 — 2026-05-23（產品裁定 patch：YouTube 收錄邊界 A/B 級分類、metadata 補 youtube_content_type + content_priority）  
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
  'official_website',
  'https://www.youtube.com/channel/<channelId>',
  '{
    "channelId": "UCLkAepWjdylmXSltofFvsYA",
    "uploadsPlaylistId": "UULkAepWjdylmXSltofFvsYA",
    "maxVideosPerRun": 10,
    "publishedAfterHours": 25
  }'::jsonb,
  true
);
```

> **`uploadsPlaylistId` 說明**：每個 YouTube channel 有一個對應的 uploads playlist（Channel ID 的 `UC` 前綴替換為 `UU` 通常可得到，但需 admin 確認實際值）。seed migration 時 admin 應同時填入 `channelId` 與 `uploadsPlaylistId`。平台細分記錄在 `raw_data.platform = "youtube"`；v1 不新增 source_type enum 或 CHECK constraint migration。

**config 欄位說明：**

| config 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `channelId` | string | ✅ | YouTube Channel ID（UC 開頭，22 碼）|
| `uploadsPlaylistId` | string | 建議填 | uploads playlist ID（UU 開頭）；缺失時 runtime fallback channels.list（+1 unit）|
| `maxVideosPerRun` | number | 否 | 每次 cron 最多抓幾支影片（預設 10）|
| `publishedAfterHours` | number | 否 | 只抓幾小時內發布的影片（預設 25）|

**runtime 優先順序：**
1. 若 `uploadsPlaylistId` 有值 → 直接 `playlistItems.list`（跳過 channels.list，節省 1 unit）
2. 若 `uploadsPlaylistId` 缺失 → `channels.list` 取得 uploads playlist ID，再繼續 Step 2；並在 cron 回報中提示「建議補 uploadsPlaylistId 到 config」

### 3-B. parser_type 命名

| 欄位 | 值 |
|---|---|
| `parser_type` | `youtube_official_channel` |
| `source_type` | `official_website` |

`source_type = 'official_website'` 沿用現有 CHECK constraint 已允許的值，v1 不新增 enum、不做 migration。平台細分資訊統一放 `raw_data.platform = "youtube"`。

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

**P0 為 19 個**（移除 NewJeans / NJZ，待公司與帳號狀態確認後再 seed）。

**P1 第二波（P0 通過後再擴充）：**
- NewJeans / NJZ：`newjeans`（**暫不 seed，待公司狀態與官方頻道歸屬確認**）
- MONSTA X / CRAVITY / KiiiKiii（Starship 藝人）
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

### 5-B. Quota 估算（P0 19 個 channel，全部已填 uploadsPlaylistId）

**正常每日 cron（uploadsPlaylistId 已 seed）：**

| 步驟 | units | 說明 |
|---|---|---|
| playlistItems.list | 19 | 每 channel 1 頁（跳過 channels.list）|
| videos.list batch | 19 | 每 channel 最多 10 videoId，1 batch |
| **合計** | **38 units / 次** | 遠低於 10,000 unit/day 上限 |

**若部分 channel 缺 uploadsPlaylistId（fallback）：**

| 步驟 | units | 說明 |
|---|---|---|
| channels.list（僅缺失者）| N | 每個缺失的 channel +1 unit |
| playlistItems.list | 19 | 同上 |
| videos.list batch | 19 | 同上 |
| **合計** | **38 + N units** | N = 缺 uploadsPlaylistId 的 channel 數 |

P1 擴充至 50 個 channel 後正常約 100 units / 次，仍安全。

---

## 六、YouTube 收錄邊界裁定（產品決策）

### 6-A. 產品定位

YouTube v1 **不做「官方頻道全影片同步」**，也不是把每支新影片都丟進排程。

YouTube crawler 的定位是：
> **重大影音事件 / 發行節點 / 官方上架訊號來源**

幫粉絲抓到重要資訊，而不是整理偶像頻道所有更新。

### 6-B. A 級：高優先，應進 event_candidates，前台可凸顯

這些內容有「發行感 / 上架感 / 行程感」，是 Idol Rhythm 的核心收錄目標。

**以 liveStreamingDetails 判斷（優先於 title keyword）：**

| 判斷條件 | youtube_content_type | EventType | EventSubType |
|---|---|---|---|
| `scheduledStartTime` 有值（Premiere 預排）| `premiere` | `official` | `announcement` |
| `liveBroadcastContent = 'live'`（進行中直播）| `official_livestream` | `streaming` | — |
| `liveBroadcastContent = 'completed'`（直播存檔）| `official_livestream_vod` | `streaming` | — |

**以 title keyword 判斷（大小寫不敏感）：**

| keyword 群組 | 代表關鍵字 | youtube_content_type | EventType | EventSubType |
|---|---|---|---|---|
| Official MV | `MV`, `M/V`, `Music Video`, `뮤직비디오` | `official_mv` | `official` | `release` |
| Title Track MV | title 含藝人名 + album 關鍵字 + MV | `official_mv` | `official` | `release` |
| Comeback / Album Trailer | `Comeback Trailer`, `Album Trailer`, `컴백 트레일러` | `comeback_trailer` | `official` | `announcement` |
| Comeback Live / Showcase Live | `Comeback Live`, `Showcase`, `쇼케이스`, `컴백 라이브` | `comeback_live` | `official` | `release` |
| Anniversary Live | `Anniversary`, `주년`, `기념 콘서트` | `anniversary_live` | `streaming` | — |
| Concert Film Trailer | `Concert Film`, `Concert Movie`, `Film Trailer`, `콘서트 필름` | `concert_film_trailer` | `official` | `announcement` |
| Documentary Trailer | `Documentary`, `다큐멘터리` + `Trailer` | `documentary_trailer` | `official` | `announcement` |
| Streaming Release Trailer | `Netflix`, `Disney+`, `Apple TV+` + `Trailer` / `Official` | `streaming_release_trailer` | `streaming` | — |
| Official Album / EP Release | `Album`, `앨범`, `EP`, `Single`, `싱글`, `Release` | `album_release` | `official` | `release` |
| Major Performance Video | `Special Stage`, `스페셜 스테이지`, `Stage Mix` + 視情況判斷 | `performance_video` | `official` | `release` |

> **所有 A 級**：`content_priority = "high"`

### 6-C. B 級：可收，低優先，不一定前台凸顯

這些可以視情況進候選，但不當成主線重大事件。進候選時標記低優先。

| 類型 | youtube_content_type | content_priority |
|---|---|---|
| MV Teaser | `mv_teaser` | `low` |
| Album Teaser | `album_teaser` | `low` |
| Concept Film | `concept_film` | `low` |
| Visualizer | `visualizer` | `low` |
| Lyric Video（官方頻道）| `lyric_video` | `low` |
| Short Performance Clip | `performance_clip` | `low` |
| Short Trailer（非 Comeback / Concert Film）| `short_trailer` | `low` |

> B 級 keyword 判斷：`Teaser`, `티저`, `Concept`, `Visualizer`, `Lyric`, `가사`, `Clip`

### 6-D. 明確排除（不進候選）

**方法：** 符合以下任一條件 → 跳過，不進候選

| 條件 | 說明 |
|---|---|
| `duration < PT60S`（Shorts）| YouTube Shorts，v1 排除 |
| title 含 `Behind`, `Making`, `Vlog`, `Diary`, `브이로그` | behind / vlog，非發行節點，v1 排除 |
| title 含 `Reaction`, `Cover`, `Dance Cover` | 非官方類內容，排除 |
| title 含 `Fan`, `Fanmade`, `Unofficial` | 非官方來源標誌，排除 |
| channel 非 seeded channelId | 不信任任何非 seed 頻道 |

### 6-E. 無法分類時的處理

若影片不符合任何 6-B / 6-C keyword 群組，但來自官方頻道，且未觸發 6-D 排除：
→ **仍進候選**，`detected_event_type = null`，`youtube_content_type = "unknown"`，`content_priority = "low"`，交 admin 審核決定。這避免新 content type 一律漏掉。

---

## 七、metadata 記錄格式

所有從 YouTube crawler 進入 `event_candidates` 的候選，`raw_data jsonb` 記錄：

```json
{
  "platform": "youtube",
  "youtube_content_type": "official_mv",
  "content_priority": "high",
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

**`youtube_content_type` 可選值：**
- A 級：`official_mv` / `comeback_trailer` / `comeback_live` / `anniversary_live` / `premiere` / `official_livestream` / `official_livestream_vod` / `concert_film_trailer` / `documentary_trailer` / `streaming_release_trailer` / `album_release` / `performance_video`
- B 級：`mv_teaser` / `album_teaser` / `concept_film` / `visualizer` / `lyric_video` / `performance_clip` / `short_trailer`
- 未分類：`unknown`

**`content_priority` 可選值：** `"high"`（A 級）/ `"low"`（B 級 + unknown）

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

YouTube Data API v3 不提供「查詢剩餘 quota」的公開端點，不能在 cron 開始前主動查餘量。v1 改採**保守本地估算 + 捕捉 API 錯誤**的方式：

```
cron 觸發
  ↓
正常執行（無前置 quota 查詢）：per channel 獨立 try/catch
  → Step 1–3 任何 API 呼叫若收到：
      - 403 reason: quotaExceeded         → quota 用盡，終止整個 YouTube cron
      - 403 reason: dailyLimitExceeded    → 同上，終止整個 YouTube cron
      - 其他 4xx / 5xx / 網路錯誤        → log error，跳過此 channel，繼續下一個
  ↓
quota 錯誤（quotaExceeded / dailyLimitExceeded）時：
  → log warning（"YouTube API quota exceeded, skipping remaining channels"）
  → 回傳 { status: 'skipped', reason: 'quota_exceeded', processed: N }
  → 不影響 SMTOWN / WAKEONE / YG / JYP 等其他 crawler（各 crawler 獨立 route）
  ↓
全部 channel 完成（或 quota 終止）後彙整結果
  → { processed: N, candidates: M, skipped: K, errors: [...] }
  → 與現有 SMTOWN / WAKEONE cron 相同回傳格式
```

> **為什麼不預查 quota**：YouTube Data API 無公開 quota 查詢端點；quotaUser 是 per-user tracking 參數，不回傳剩餘量。保守本地估算（P0 19 channels ≈ 38 units << 10,000 上限）確保正常運作；異常時靠 403 捕捉即可。

---

## 十一、source_type 裁定（已確認）

v1 統一使用 `source_type = 'official_website'`，理由：
- 現有 CHECK constraint 已允許此值（migration 001）
- 不需新增 enum 值或 migration
- 平台細分資訊記錄在 `raw_data.platform = "youtube"`，不需要獨立欄位

runtime PR 直接使用 `official_website`，無需前置 Supabase 查詢確認。

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
