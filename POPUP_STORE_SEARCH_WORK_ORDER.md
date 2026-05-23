# 快閃店搜尋與呈現工作單

> Status: **planning complete — awaiting GPT audit before implementation**.
>
> Created: 2026-05-23
> Owner: idol-rhythm

---

## 1. 目標

讓前台用戶可以清楚地搜尋與過濾三種品牌活動子類型：

- `popup_store` → 快閃店 / POP-UP
- `exhibition` → 展覽 / EXHIBITION
- `brand_event` → 品牌活動 / BRAND EVENT

這三種活動在現有資料模型已有完整支援（schema、TypeScript types、badge 元件），
但前台搜尋與 filter UI 有以下缺口需要補齊（見 §5）。

**這輪只做工作單**：不寫 runtime code、不改 schema、不新增 migration、
不改 crawler、不改 admin、不改 auth、不改 notifications。

---

## 2. 現有資料前提（已確認，無需 migration）

### 2.1 Schema

| 項目 | 確認狀態 |
|---|---|
| `events.sub_type` 欄位 | ✅ 已存在（migration 001 加欄，migration 041 加三個 enum 值） |
| `event_sub_type` enum：`popup_store` | ✅ migration 041 已加 |
| `event_sub_type` enum：`exhibition` | ✅ migration 041 已加 |
| `event_sub_type` enum：`brand_event` | ✅ migration 041 已加 |
| `events.start_date / end_date / date_label` | ✅ migration 041 已加（快閃店展期）|
| `events.location_name_zh / city / venue_name` | ✅ migration 041 已加 |

`events.sub_type` 為 nullable — 有值代表細分類型，NULL 代表只靠 `type` 分類。

### 2.2 TypeScript 與前端元件（已就緒）

| 項目 | 確認狀態 |
|---|---|
| `EventSubType` type includes `popup_store \| exhibition \| brand_event` | ✅ `src/lib/types.ts` |
| `EVENT_SUBTYPE_LABELS['popup_store']` → `'快閃店'` | ✅ `src/lib/mockEvents.ts` |
| `EVENT_SUBTYPE_LABELS['exhibition']` → `'展覽'` | ✅ |
| `EVENT_SUBTYPE_LABELS['brand_event']` → `'品牌活動'` | ✅ |
| `EventTypeBadge` 支援三種 subtype（Store / Images / ShoppingBag icon）| ✅ `src/components/EventTypeBadge.tsx` |

### 2.3 結論

**不需要新 migration、不需要新 enum、不需要改 TypeScript types。**
工作範圍限於前台 query、filter logic、search haystack、UI 文案。

---

## 3. 現有缺口分析（實作前必須修正的兩個問題）

### 缺口 A — 關鍵字搜尋不命中 subtype

`src/app/schedule/ScheduleClient.tsx` 的 `getSearchHaystack()` 函數
目前搜尋欄位為：

```
title / originalTitle / idolName / location / originalLocation /
venueName / city / country / source.label / description / tags
```

**不包含** `type` label 或 `subType` label。因此搜尋「快閃店」、「pop-up」、
「popup」、「展覽」、「品牌活動」**全部不命中**，除非事件 title 或 description
本身含有這些詞彙。

### 缺口 B — Filter 粒度不足（三種 subtype 捆綁在一個 chip）

`/schedule` 有 8 個 category chip：
`all / concert / musicshow / media / brand / youtube / netflix / other`

`brand` chip 對應的 `matchesScheduleCategory` 邏輯：
```ts
case 'brand':
  return (
    event.type === 'brand' ||
    event.subType === 'popup_store' ||
    event.subType === 'exhibition' ||
    event.subType === 'brand_event'
  )
```

三種 subtype 全部捆綁在「品牌快閃」一個 chip 下，無法分開篩選。

---

## 4. 資料邏輯（不變）

- 只讀已 published events（`is_published = true`）
- 只讀 `trust_level IN ('official', 'media')`
- 不顯示 draft / pending
- 不改 event_candidates
- 不改 crawler
- 不改 publish 流程

所有現有 Supabase query 已有上述 filter，runtime PR 不需要新增 query 條件，
只需調整 client-side filter logic 與 search haystack。

---

## 5. 影響頁面評估

### 5.1 `/schedule`（主要改動）

需要修正 **缺口 A**（搜尋）與 **缺口 B**（filter 粒度）。

**搜尋改動**：`getSearchHaystack()` 加入 subtype label + 關鍵字別名。詳見 §6.1。

**Filter 改動方案選擇**：

#### 方案 X（推薦）— 拆分 `brand` chip，不增加總 chip 數

將「品牌快閃」chip 拆為三個：「快閃店」「展覽」「品牌活動」。
同時保留一個 `brand` 泛型 catch-all 供 sub_type 為 NULL 的 `type=brand` 活動，
或改為併入「其他行程」。

| chip | label | 對應邏輯 |
|---|---|---|
| `popup_store` | 快閃店 | `event.subType === 'popup_store'` |
| `exhibition` | 展覽 | `event.subType === 'exhibition'` |
| `brand_event` | 品牌活動 | `event.subType === 'brand_event' \|\| event.type === 'brand'` |

總 chip 數：原 8 → 新 10（`all / concert / musicshow / media /
popup_store / exhibition / brand_event / youtube / netflix / other`）。

英文質感 pill 顯示：「POP-UP」「EXHIBITION」「BRAND EVENT」。

#### 方案 Y（備選）— 保留 `brand` chip，只修搜尋

保持現有 8 chip 不動，只修 `getSearchHaystack()` 讓關鍵字搜尋可命中。
適合不想改 filter UI 的版本。

**GPT 擇一後實作。本工作單推薦方案 X，但以 GPT 裁定為準。**

### 5.2 `/events/[id]`（已就緒，確認即可）

`EventTypeBadge` 已正確顯示 `popup_store / exhibition / brand_event` 的 icon 與
中文 label。活動詳情頁展期（`start_date` / `end_date` / `date_label`）與地點欄位
（`location_name_zh / city / venue_name`）已在 PR #86 前台中文顯示實作中處理。

runtime PR 需確認詳情頁 subtype pill 正確顯示（smoke test）。

### 5.3 首頁 upcoming / personalized 區塊

首頁活動卡片使用 `EventCard` 元件，已透過 `EventTypeBadge` 顯示 subtype pill。
無需額外改動。

### 5.4 `/favorites`

收藏頁活動卡片同樣使用 `EventCard`，已正確顯示 subtype。無需改動。

---

## 6. 搜尋與篩選規劃（runtime PR 實作細節）

### 6.1 Search haystack 補齊（缺口 A 修正）

在 `getSearchHaystack(event)` 加入以下欄位：

```ts
// 新增至 haystack
EVENT_SUBTYPE_LABELS[event.subType] ?? '',   // 中文 label：'快閃店' / '展覽' / '品牌活動'
EVENT_TYPE_LABELS[event.type] ?? '',          // 中文主類型 label
SUBTYPE_KEYWORD_ALIASES[event.subType] ?? '', // 英文關鍵字別名（見下）
```

**關鍵字別名表（hardcode，無需 DB）**：

```ts
const SUBTYPE_KEYWORD_ALIASES: Partial<Record<EventSubType, string>> = {
  popup_store: 'popup pop-up pop up 快閃 快閃店',
  exhibition: 'exhibition exhibit 展覽 展',
  brand_event: 'brand event 品牌 品牌活動',
}
```

效果：搜尋「快閃店」「pop-up」「popup」→ 命中 `popup_store` 活動。
搜尋「展覽」「exhibition」→ 命中 `exhibition` 活動。

### 6.2 Filter chip label（方案 X）

更新 `SCHEDULE_CATEGORIES` 陣列，拆分 `brand` 為三個 chip：

```ts
type ScheduleCategory =
  | 'all' | 'concert' | 'musicshow' | 'media'
  | 'popup_store' | 'exhibition' | 'brand_event'
  | 'youtube' | 'netflix' | 'other'

const SCHEDULE_CATEGORIES = [
  { id: 'all',         label: '全部' },
  { id: 'concert',     label: '演唱會' },
  { id: 'musicshow',   label: '音樂節目' },
  { id: 'media',       label: '媒體雜誌' },
  { id: 'popup_store', label: '快閃店' },
  { id: 'exhibition',  label: '展覽' },
  { id: 'brand_event', label: '品牌活動' },
  { id: 'youtube',     label: 'YouTube' },
  { id: 'netflix',     label: 'Netflix' },
  { id: 'other',       label: '其他行程' },
]
```

`matchesScheduleCategory` 對應更新：

```ts
case 'popup_store':
  return event.subType === 'popup_store'
case 'exhibition':
  return event.subType === 'exhibition'
case 'brand_event':
  return event.subType === 'brand_event' || event.type === 'brand'
  // type=brand without subtype → 歸入品牌活動作為 catch-all
case 'other':
  // 移除 brand 條件（已拆出）
  return !(
    event.type === 'concert' ||
    event.type === 'ticketing' ||
    event.type === 'official' ||
    event.subType === 'fanmeet' || event.subType === 'fansign' ||
    event.subType === 'award' || event.subType === 'musicshow' ||
    event.type === 'media' ||
    event.subType === 'popup_store' || event.subType === 'exhibition' ||
    event.subType === 'brand_event' || event.type === 'brand' ||
    matchesPlatformKeyword(event, 'youtube') ||
    matchesPlatformKeyword(event, 'netflix')
  )
```

### 6.3 空狀態文案

各 filter 的空狀態（`filtered.length === 0`）需白話提示：

| filter | 空狀態文案 |
|---|---|
| `popup_store` | 目前沒有收錄快閃店活動 |
| `exhibition` | 目前沒有收錄展覽活動 |
| `brand_event` | 目前沒有收錄品牌活動 |
| `all` | 沒有符合條件的活動 |

（其他 filter 沿用現有空狀態文案）

---

## 7. 風險

| 風險 | 說明 | 緩解方式 |
|---|---|---|
| `sub_type` 為 NULL 的 `type=brand` 活動歸屬 | 現有 `brand` type 的活動若未設 sub_type，方案 X 下會歸入 `brand_event` chip（catch-all）。實際資料可能有此情況 | 實作前在後台確認現有 `type=brand AND sub_type IS NULL` 的活動數量；若數量多，考慮保留一個「品牌（其他）」chip 或保留 `brand` catch-all |
| Filter chip 數量增加（8→10）| 手機螢幕 chip 列可能更長，需確認 scroll behavior | 現有 chip 列已有橫向 scroll；10 個 chip 在現有 UX pattern 下可接受，但需視覺驗收 |
| 搜尋 haystack 加入 alias 字串影響無關搜尋 | alias 字串（如「展」）可能誤命中其他活動 | alias 設計應保守；「展」這種單字 alias 避免使用，改用「展覽 exhibition」較長詞 |
| 舊資料 `city / venue_name / location_name_zh` 為 NULL | 快閃店類活動的地點欄位在 migration 041 前的舊資料不存在 | 前台已有 fallback 機制（PR #86），location fallback 到 `originalLocation`；runtime PR 確認 fallback 路徑仍正確 |
| filter 讓 /schedule 變複雜 | 10 個 chip 是臨界點 | 方案 Y（只修搜尋）是備選，GPT 可依 UI 複雜度裁定 |
| `event.type === 'brand'` 涵蓋範圍 | `brand_event` catch-all 的語意邊界 | 工作單已明確定義，實作前與 GPT 確認一致 |

---

## 8. 建議實作拆分

### runtime PR 範圍（下一張 PR）

**只改前台 query / filter / helper / UI，不動以下任何東西**：
- schema / migration / RLS
- admin 後台
- crawler
- notifications / cron
- auth
- `src/lib/types.ts`（EventSubType 已就緒，不需改）

**改動範圍上限**：

| 檔案 | 改動說明 |
|---|---|
| `src/app/schedule/ScheduleClient.tsx` | `SCHEDULE_CATEGORIES` 陣列更新、`ScheduleCategory` type 更新、`matchesScheduleCategory` 拆分邏輯、`getSearchHaystack` 加入 subtype label + alias、空狀態文案 |
| `src/lib/mockEvents.ts`（可選）| 若要加 `SUBTYPE_KEYWORD_ALIASES` helper，可放這裡；或直接 inline 在 ScheduleClient |

**不新增任何檔案**（除非 ScheduleClient 過長需要 extract helper）。

Build + GPT audit 後 merge。

---

## 9. 白話驗收標準

實作 PR merge 後，以下驗收全部通過才算完成：

1. ✅ `/schedule` filter chip 可看到「快閃店」「展覽」「品牌活動」獨立 chip
2. ✅ 點「快閃店」chip 只看到 `sub_type = 'popup_store'` 的活動
3. ✅ 點「展覽」chip 只看到 `sub_type = 'exhibition'` 的活動
4. ✅ 點「品牌活動」chip 看到 `sub_type = 'brand_event'` 或 `type = 'brand'` 的活動
5. ✅ 搜尋「快閃店」「pop-up」「popup」有結果（若有對應活動）
6. ✅ 搜尋「展覽」「exhibition」有結果（若有對應活動）
7. ✅ 搜尋「品牌活動」「brand event」有結果（若有對應活動）
8. ✅ 無結果時顯示對應空狀態文案（白話中文）
9. ✅ 活動卡片 subtype pill 正確顯示（快閃店 / 展覽 / 品牌活動 + icon）
10. ✅ `/events/[id]` 詳情頁 subtype badge 正確顯示
11. ✅ 原本演唱會、直播、票務、音樂節目、媒體雜誌 filter 行為不受影響
12. ✅ `npm run build` 通過，無 TypeScript 錯誤

---

## 10. 實作前確認項目（runtime PR 作者必查）

1. **`type=brand AND sub_type IS NULL` 活動有幾筆？**
   ```sql
   SELECT COUNT(*) FROM events
   WHERE type = 'brand' AND sub_type IS NULL AND is_published = true;
   ```
   若有大量此類活動，考慮是否需要保留一個「品牌（泛）」chip 或確認要歸入
   `brand_event` catch-all。

2. **現有 `popup_store / exhibition / brand_event` 已發布活動有幾筆？**
   ```sql
   SELECT sub_type, COUNT(*) FROM events
   WHERE sub_type IN ('popup_store','exhibition','brand_event')
     AND is_published = true
   GROUP BY sub_type;
   ```
   若全為 0，代表目前無真實資料，filter chip 會立即進入空狀態 — 視覺上可接受
   （空狀態文案已規劃），但功能仍需通過 build + type check。

3. **確認 ScheduleClient 的 `getSearchHaystack` 函數位置**（已知在 line ~743）
   和 `SCHEDULE_CATEGORIES` 陣列位置（已知在 line ~20），以便精準修改。

---

## 11. 不在範圍

- 快閃店地圖 / 地理位置功能
- 活動日期範圍（多日展期）的新 UI 元件 — `start_date / end_date` 已在 PR #86 前台中文顯示中處理
- 活動類型 icon 新增（Store / Images / ShoppingBag 已就緒）
- 後台新增 popup_store 活動的表單 UI 改動
- AI 自動分類 sub_type（crawler 端）
- 任何 migration / schema 變更
