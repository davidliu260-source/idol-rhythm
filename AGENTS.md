# Idol Rhythm｜GPT × Claude Code 工作守則

> 本文件供 GPT 與 Claude Code 協作時共同遵守。
> 每次開始任務前請先確認目前工作目錄，再閱讀相關任務說明。

---

## 1. 專案邊界

本專案是：

| 項目 | 值 |
|------|-----|
| 專案名稱 | 偶像節奏 Idol Rhythm 星動時刻 |
| 本地路徑 | `~/Desktop/idol-rhythm` |
| GitHub repo | https://github.com/davidliu260-source/idol-rhythm |
| 技術 | Next.js 14 App Router + TypeScript + Tailwind CSS |
| 目前階段 | MVP Demo / mock data 階段 |

任何 Idol Rhythm 相關任務都必須在以下目錄執行：

```
~/Desktop/idol-rhythm
```

**不得在以下專案中修改 Idol Rhythm 相關內容：**

- `~/Desktop/ming-app`
- Omens / Ming 相關 repo
- 其他無關 repo

每次開始任務前，Claude Code 必須先執行 `pwd` 確認目前工作目錄。

---

## 2. 角色分工

### GPT 負責

- 產品方向與 MVP 範圍判斷
- 任務拆解與 Claude Code 工作單撰寫
- 驗收標準定義
- 回報內容檢查
- 下一步優先級排序
- 判斷哪些功能應該延後

**GPT 不直接修改 repo 檔案。**

### Claude Code 負責

- 讀取現有程式碼
- 修改任務指定的檔案
- 建立必要的新檔案
- 執行 `npm run build`
- `git add` 相關檔案（不含 `.claude/`）
- `git commit`
- `git push origin main`
- 按格式回報修改內容與結果

**Claude Code 不應自行擴大產品範圍。**

---

## 3. 任務執行原則

每次任務必須小而明確。

Claude Code 收到任務後應依序執行：

1. 確認目前目錄是 `~/Desktop/idol-rhythm`
2. 讀取相關現有檔案
3. 判斷任務影響範圍
4. 只修改任務要求的檔案
5. 不加入任務外功能或額外抽象層
6. 執行 `npm run build`
7. 只 `git add` 相關檔案（見第 7 節）
8. `git commit`
9. `git push origin main`
10. 按第 9 節格式回報

如果任務不需要修改程式碼（例如純文件任務），也必須明確回報「未修改程式碼」。

---

## 4. 禁止範圍蔓延

在未被明確要求前，**不得加入以下功能**：

- 後端資料庫 / Supabase 連線
- 使用者登入 / 會員系統
- 付款 / 訂閱
- AI 搜尋 / 自動爬蟲
- 真實推播通知
- 社群功能（留言、按讚、轉發）
- 粉絲論壇 / 電商
- 大量圖片授權
- 官方藝人合作功能
- 多語系國際版
- 地圖模式完整版

**目前 MVP 只驗證：**

- 偶像選擇
- 活動時間軸
- 活動卡片
- 活動詳情
- 收藏概念（mock）
- 提醒概念（mock）
- 來源可信度
- Demo data 展示

---

## 5. 資料可信度規則

前台正式頁面**只能顯示**：

- `official` / 官方確認
- `media` / 媒體確認

**不得在使用者可見頁面顯示：**

- `pending` / 待確認
- 粉絲傳聞
- 論壇截圖
- 未標來源整理文
- 社群轉傳但未確認資料

`pending` 資料只能作為未來 `event_candidates` 候選池概念保留在 mock data 中，**不得渲染到**首頁、行程頁、收藏頁或活動詳情頁。

技術實作上使用 `VISIBLE_TRUST_LEVELS: TrustLevel[] = ['official', 'media']`，所有查詢函式一律過濾。

---

## 6. Demo data 規則

目前所有資料仍是 mock data。

UI **必須清楚標示**：

```
⚠️ Demo 展示資料｜目前為展示資料，非真實官方行程
```

此標示需出現在：首頁頂部、行程頁頂部、活動詳情頁內容區。

**不得讓使用者誤以為資料是真實官方行程。**

Mock data 可以使用真實藝人名稱作為展示，但不能假裝是真實公告。

---

## 7. Git 規則

每次任務完成後必須依序執行：

```bash
npm run build
git status
git add <只加相關檔案>
git commit -m "..."
git push origin main
git status   # 確認成功
```

**不得提交：**

- `.claude/`
- `node_modules/`
- `.next/`
- 無關暫存檔
- 其他 repo 的檔案

`package-lock.json` 應該提交。

---

## 8. Commit message 規則

Commit message 必須簡短清楚，反映本次變更的核心目的。

**格式建議（已用範例）：**

```
Initialize Idol Rhythm MVP foundation
Add npm lockfile
Polish Idol Rhythm MVP demo experience
Prepare Idol Rhythm data models
Document Idol Rhythm collaboration workflow
Persist demo interactions locally
Add Supabase schema draft
Add admin event management draft
```

**不要使用模糊訊息：**

```
update / fix / changes / misc / wip
```

---

## 9. 回報格式

Claude Code 每次完成任務後，**必須回報以下所有項目**：

1. 修改檔案
2. 新增檔案
3. Build 結果
4. Commit message
5. Commit hash
6. Push 是否成功
7. 完成項目清單
8. 仍是 mock 的部分
9. 是否有任何 UI / 行為改變
10. 需要人工測試的項目
11. 下一步建議

如果 push 失敗，必須明確說明原因，**不得假裝成功**。

---

## 10. 任務失敗處理

### Build 失敗

1. **不得 commit**
2. 先修正 TypeScript / 編譯錯誤
3. 再重新執行 `npm run build`
4. Build 成功後才能 commit / push

### 遇到不確定細節

| 情境 | 處理方式 |
|------|---------|
| 不影響核心方向的小細節（命名、樣式微調） | 做合理假設並繼續，回報中說明 |
| 影響產品方向 / 資料結構 / 後端 / 安全性 / 付款 / 登入 / AI 成本的決策 | **停下來回報，等待確認後再執行** |

---

## 11. 高風險變更規則

以下任務屬於高風險，**必須先經 GPT 拆解成明確工作單後才能執行**：

- Supabase schema / migration / RLS policy
- Auth / admin 權限設定
- 真實資料來源接入
- AI 搜尋 / 爬蟲
- 推播通知
- 付款整合
- 大量重構或刪除資料
- 修改 repo 結構
- 部署設定（Vercel / CI/CD）

**不得自行開始高風險任務。**

---

## 12. 推薦工作順序

| 階段 | 內容 |
|------|------|
| 1 | MVP foundation — 頁面骨架、mock data、元件 |
| 2 | UI polish + demo data 補強 |
| 3 | 資料模型整理（types.ts、型別收斂） |
| 4 | 前端互動 localStorage（收藏、追蹤持久化） |
| 5 | Supabase schema 草稿（不連線，只定義） |
| 6 | 前台讀 Supabase（替換 mock data） |
| 7 | 極簡 admin 後台（活動管理） |
| 8 | event_candidates 候選池 |
| 9 | AI 搜尋 / 整理輔助 |
| 10 | 真實通知 / 使用者個人化 |

**不得跳過前面階段直接做大型系統。**

---

## 13. 人工驗收規則

每次 Claude Code 完成後，使用者應先人工確認：

- [ ] 本地頁面 `http://localhost:3000` 能否打開
- [ ] 底部導航是否正常（五個 tab active 狀態）
- [ ] 首頁五個區塊是否顯示正確
- [ ] 活動卡片資訊是否好讀
- [ ] 活動詳情頁是否能打開
- [ ] `pending` 資料是否沒有出現在前台
- [ ] Demo data 標示是否清楚顯示
- [ ] 手機版 spacing 是否正常（最大寬度 448px）

人工驗收後，再決定下一個任務。

---

## 14. 專案目前狀態紀錄

### ✅ 已完成

- Next.js 14 + TypeScript + Tailwind CSS 專案初始化
- GitHub repo 建立並 push（`davidliu260-source/idol-rhythm`）
- MVP 六個頁面（/ / schedule / idols / events/[id] / favorites / me）
- 底部導航（5 tab，active 狀態正確）
- `src/lib/types.ts` — 統一型別定義（Idol / Event / TrustLevel / EventCandidate 等）
- mock idols data（10 組，含 gender / category 欄位）
- mock events data（24 筆，7 大 EventType，3 層 TrustLevel）
- 活動卡片（full + compact 兩種模式，含操作列）
- 活動詳情頁（AI 摘要 mock、票務/串流區塊）
- Demo data 標示（首頁 / 行程頁 / 詳情頁）
- 前台過濾 `pending` 資料（只顯示 official / media）
- 首頁五區塊（今日不能錯過 / 本週重點 / 我的倒數 / 最近可看 / 最新情報）
- Build 全程通過，無 TypeScript 錯誤

### 🔲 仍是 mock（尚未真實實作）

- 收藏 / 取消收藏（前端 state，無持久化）
- 提醒設定
- 分享功能
- AI 繁中摘要
- 票務 / 串流連結（全為 `#`）
- 使用者資料
- 偶像篩選（tab 顯示但無過濾效果）
- 後台 / 資料庫

---

## 15. 目錄結構參考

```
src/
├── app/
│   ├── layout.tsx              # Root layout（含 BottomNav）
│   ├── page.tsx                # 首頁 /（5 個區塊）
│   ├── schedule/page.tsx       # 行程時間軸 /schedule
│   ├── idols/page.tsx          # 偶像選擇 /idols（'use client'）
│   ├── events/[id]/page.tsx    # 活動詳情 /events/:id
│   ├── favorites/page.tsx      # 收藏頁 /favorites
│   └── me/page.tsx             # 我的頁 /me
├── components/
│   ├── BottomNav.tsx           # 底部導航（'use client'）
│   ├── EventCard.tsx           # 活動卡片（'use client'，含操作列）
│   ├── SourceBadge.tsx         # 來源可信度標籤
│   └── EventTypeBadge.tsx      # 活動類型標籤（支援 subType）
└── lib/
    ├── types.ts                # 所有核心型別定義
    ├── mockIdols.ts            # Mock 偶像資料 + 查詢函式
    └── mockEvents.ts           # Mock 活動資料 + 查詢函式 + 顯示常數
```

---

## 16. 型別概覽（Phase 3 整理後）

```ts
// src/lib/types.ts

type EventType = 'concert' | 'ticketing' | 'livestream' | 'streaming' | 'media' | 'brand' | 'official'
type EventSubType = 'fanmeet' | 'fansign' | 'musicshow' | 'variety' | 'interview' | 'award' | 'release' | 'announcement' | 'magazine'
type EventStatus = 'confirmed' | 'tentative' | 'cancelled' | 'postponed'
type TrustLevel = 'official' | 'media' | 'pending'
type SourceType = 'official_sns' | 'official_website' | 'media_outlet' | 'fan_account' | 'community' | 'unknown'

interface EventSource { level: TrustLevel; label: string; url?: string; type?: SourceType }

interface Event {
  id: string; idolId: string; idolName: string
  title: string; type: EventType; subType?: EventSubType; status: EventStatus
  date: string; time?: string; location?: string; country: string; countryFlag: string
  source: EventSource; description: string; isFavorited: boolean
  ticketUrl?: string; streamUrl?: string; tags: string[]
}
```

---

## 17. 設計規範

### 色彩 Token（tailwind.config.ts）

| Token | 色碼 | 說明 |
|-------|------|------|
| `bg` | `#08080f` | 主底色 |
| `card` | `#0f0f1e` | 卡片底 |
| `card-border` | `#1e1e36` | 邊框 |
| `primary` | `#e91e8c` | 主色（熱粉）|
| `primary-dim` | `rgba(233,30,140,0.15)` | 主色半透明 |
| `violet` | `#8b5cf6` | 輔色 |
| `text-base` | `#f0f0ff` | 主文字 |
| `muted` | `#6b6b9a` | 次文字 |

### 元件慣例

- 卡片：`rounded-2xl border border-card-border bg-card`
- 主色按鈕：`bg-primary text-white rounded-xl`
- 次要按鈕：`border border-card-border bg-transparent text-muted`
- 底部安全距離：頁面加 `pb-24`
- 最大寬度：`max-w-md`（448px）mobile-first

### Server / Client Component

- 預設 Server Component（無 `'use client'`）
- 需要 `useState` / `usePathname` 的元件才加 `'use client'`
- 目前需要 client：`BottomNav`、`idols/page.tsx`、`EventCard`

---

## 18. 本地開發

```bash
cd ~/Desktop/idol-rhythm
npm install
npm run dev      # http://localhost:3000
npm run build    # 生產版本 build（每次 commit 前必須通過）
```
