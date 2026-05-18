# J7d 工作單草案：候選內容變更偵測（content_hash + needs_recheck）

> **狀態：** Draft，等 GPT 審核後才可開工。
> **作者：** Claude Code（草擬）
> **影響：** Migration 026 + 既有 fetcher 修改 + 後台 UI 加 badge。
> **風險：** 中（migration + fetcher 寫入邏輯改動 + 跨 cron 行為）。

---

## 1. 背景

目前 `event_candidates.source_hash`（migration 017）用來去重 — 同一筆 raw 資料抓第二次不會重複插入。但 **「同一筆候選的內容被官方修改」** 完全偵測不到：

| 情境 | 目前行為 | 正確行為 |
|---|---|---|
| 第一次抓到 BTS Concert 6/5 | INSERT 新 candidate | 一樣 |
| 同一頁重抓，內容沒變 | source_hash 命中，skip | 一樣 |
| 官方把 6/5 改成 6/6 | source_hash 不同 → INSERT 第二筆 candidate | 應該 UPDATE 既有 row 並標記「內容已變更，需重新審核」|

結果：審核員會看到「同一場演唱會」兩筆候選（舊版 + 新版），且如果舊版已 approve 變成 event，新版又進來時舊 event 不會更新。

J7d 目標：用一個語意 hash（`content_hash`，跟 source_hash 不同）追蹤候選的「實質內容」（標題、日期、地點等決定性欄位），變動時 UPDATE 既有 row 而不是新增。

---

## 2. 目標

1. `event_candidates` 加 `content_hash text`（核心欄位的 SHA-256）+ `needs_recheck boolean`（內容變動旗標）
2. 所有 fetcher（J2 BLACKPINK、J6d jyp_schedule、未來 M1a 第三方）寫入前計算 content_hash
3. 寫入策略：
   - 找不到既有 `source_hash` → INSERT
   - 找到既有 `source_hash` + content_hash 相同 → skip
   - 找到既有 `source_hash` + content_hash 不同 → UPDATE 該 row：覆寫核心欄位、`needs_recheck=true`、`reviewed_at=null`（若已審核要重新審）、更新 `updated_at`
4. 後台 `/admin/event-candidates` 已 approve 的 row 出現 `needs_recheck=true` 時顯示「⚠️ 內容已變更」橘色 badge + 篩選器

---

## 3. 技術設計

### 3.1 Migration 026

```sql
ALTER TABLE public.event_candidates
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS needs_recheck boolean NOT NULL DEFAULT false;

-- 索引：admin UI 篩選「需重審」候選
CREATE INDEX IF NOT EXISTS idx_event_candidates_needs_recheck
  ON public.event_candidates (needs_recheck)
  WHERE needs_recheck = true;

-- service_role 已有 INSERT/UPDATE GRANT（migration 018），新欄位自動繼承
-- authenticated 沿用 migration 012 的 admin SELECT/UPDATE policy

-- 後台手動 reset 需重審旗標（resolve 後）
GRANT UPDATE (needs_recheck) ON public.event_candidates TO authenticated;
```

**問題（需 GPT 決定）：** `needs_recheck` 預設 false 還是 NULL？建議 false + NOT NULL，避免在 UI 寫 null-check。

### 3.2 Content Hash 計算

新增 `src/lib/crawlers/contentHash.ts`：

```ts
import { createHash } from 'crypto'

// 決定性欄位排序後 join，避免欄位順序變動造成 hash 變
export function computeContentHash(input: {
  rawTitle: string
  idolId: string | null
  detectedDate: string | null
  detectedTime?: string | null
  location?: string | null
  eventType?: string | null
}): string {
  const parts = [
    input.rawTitle.trim().toLowerCase(),
    input.idolId ?? '',
    input.detectedDate ?? '',
    input.detectedTime ?? '',
    (input.location ?? '').trim().toLowerCase(),
    input.eventType ?? '',
  ]
  return createHash('sha256').update(parts.join('|')).digest('hex')
}
```

**問題（需 GPT 決定）：** 哪些欄位算 content（決定「實質上同一場活動」）？建議：rawTitle + idolId + detectedDate + detectedTime + location + eventType。`rawContent`、`sourceUrl`、`aiConfidence` 不算（這些是抓取 metadata，不是活動本身）。

### 3.3 Fetcher 寫入邏輯

`src/lib/crawlers/runJypScheduleFetcher.ts` 和 `src/lib/crawlers/blackpinkOfficialTour.ts` 都會走同樣的 upsert pattern。抽成 helper `src/lib/crawlers/upsertCandidate.ts`：

```ts
async function upsertCandidate(supabase, row): Promise<'inserted'|'unchanged'|'recheck'> {
  const contentHash = computeContentHash(row)

  // 1. 用 source_hash 找既有
  const { data: existing } = await supabase
    .from('event_candidates')
    .select('id, content_hash, review_status')
    .eq('source_hash', row.sourceHash)
    .maybeSingle()

  if (!existing) {
    // INSERT
    await supabase.from('event_candidates').insert({ ...row, content_hash: contentHash })
    return 'inserted'
  }

  if (existing.content_hash === contentHash) {
    return 'unchanged'
  }

  // UPDATE — content changed
  await supabase.from('event_candidates').update({
    raw_title: row.rawTitle,
    idol_id: row.idolId,
    detected_date: row.detectedDate,
    detected_time: row.detectedTime,
    location: row.location,
    event_type: row.eventType,
    content_hash: contentHash,
    needs_recheck: true,
    // 若已 approve，保留 approved_event_id 但要重審
  }).eq('id', existing.id)

  return 'recheck'
}
```

Cron summary 回傳的 `{ fetched, inserted, skipped, errors }` 加上 `recheck` 計數。

### 3.4 Admin UI

`src/app/admin/event-candidates/CandidatesClient.tsx`：

1. Candidate type 加 `needsRecheck: boolean`
2. 卡片若 `needsRecheck=true`：在 status badge 旁邊加橘色 `⚠️ 內容已變更`
3. 頂部加篩選器 tab：`全部 / 待審 / 已核准 / 已拒絕 / 需重審`
4. 卡片詳情頁加按鈕「重新核准（標記為已處理）」→ 呼叫 server action 設 `needs_recheck=false`

### 3.5 跨 cron 行為

- Cron fan-out（J6e）每次跑都會檢查所有 active sources
- 同一個 source 可能多次 cron 觸發 — upsert 是冪等的，所以重複跑沒副作用
- 若某次 cron 從 source 拿不到某筆活動（被官方刪除）— **不在 J7d 範圍**，這是 J7e 的範圍（標記「來源不再出現」）

---

## 4. 開放決策（需 GPT 確認）

| # | 問題 | Claude 建議 |
|---|---|---|
| 1 | content_hash 涵蓋哪些欄位？ | rawTitle + idolId + detectedDate + detectedTime + location + eventType |
| 2 | needs_recheck 預設 false NOT NULL 還是 NULL？ | false NOT NULL |
| 3 | 已 approve 的候選 content 變動時，approved_event_id 怎麼處理？ | 保留，不自動更新 event；needs_recheck=true 提示審核員重新處理 |
| 4 | 重審 resolve 是「整筆重新審 approve / reject」還是只設 needs_recheck=false？ | 後者，狀態不變，只清旗標 |
| 5 | UPDATE 時要不要保留歷史（多版本表）？ | 不要，只覆寫；歷史走 audit log（未來工作）|
| 6 | content_hash 演算法 sha256 還是 md5？ | sha256（跟 source_hash 一致）|
| 7 | upsertCandidate helper 放在哪？ | `src/lib/crawlers/upsertCandidate.ts` |

---

## 5. 範圍

### 包含
- Migration 026（content_hash + needs_recheck + index + GRANT）
- `src/lib/crawlers/contentHash.ts`
- `src/lib/crawlers/upsertCandidate.ts`
- 修改 JYP fetcher、BLACKPINK fetcher 改用 upsertCandidate
- Cron summary 增加 `recheck` 計數
- `/admin/event-candidates` 加 badge + 篩選器 + resolve 按鈕

### 不包含
- 變動歷史 / audit log
- 來源消失偵測（不在範圍）
- 自動同步 approved event（手動處理）
- Email / push 通知（沒有通知系統）
- 更動 `source_hash` 演算法

---

## 6. 驗收標準

1. Migration 026 執行後，所有既有候選 `content_hash=NULL`、`needs_recheck=false`
2. 手動觸發任一 fetcher，新候選 INSERT 時 content_hash 有值
3. 同一 source 再跑一次 fetcher，重複資料 skip（recheck=0）
4. 模擬官方內容變動（例如 SQL 改某 raw_title），再跑 fetcher，該 row UPDATE + needs_recheck=true
5. `/admin/event-candidates` 對應 row 顯示「⚠️ 內容已變更」badge
6. 篩選器選「需重審」只顯示 needs_recheck=true 的 row
7. 點 resolve 按鈕，badge 消失，row 仍在原狀態 tab

---

## 7. 預估工作量

| 部分 | 預估 |
|---|---|
| Migration 026 SQL + 文件 | 15 分鐘 |
| `contentHash.ts` + `upsertCandidate.ts` | 45 分鐘 |
| Fetcher 兩支改用 helper | 45 分鐘 |
| Cron summary 加 recheck 欄位 | 15 分鐘 |
| Admin UI 三個改動（badge / 篩選 / resolve）| 1.5 小時 |
| 測試 + build | 30 分鐘 |
| **合計** | **~4 小時** |

可拆兩個 PR：
- PR-A：Migration + helper + fetcher 改造（不動 UI）
- PR-B：Admin UI（badge + 篩選 + resolve）

---

## 8. GPT 審核請確認

- [ ] 是否同意整體技術方案
- [ ] 開放決策 #1–#7 的選擇
- [ ] 範圍是否需要增減
- [ ] 是否同意拆 PR-A / PR-B
- [ ] migration 026 SQL 是否安全（既有 row default 對齊產品意圖）
