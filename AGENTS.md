# AGENTS.md — Idol Rhythm 星動時刻

> AI 協作指引文件，給 Claude Code 或其他 AI 工程師閱讀。

---

## 專案概述

**Idol Rhythm（星動時刻）** 是 K-Pop / 偶像行程追蹤 MVP。  
技術：Next.js 14 App Router + TypeScript + Tailwind CSS。  
目前所有資料為 mock，無後端或資料庫。

---

## 目錄結構

```
src/
├── app/
│   ├── layout.tsx          # Root layout（含 BottomNav）
│   ├── page.tsx            # 首頁 /
│   ├── schedule/page.tsx   # 行程時間軸 /schedule
│   ├── idols/page.tsx      # 偶像選擇 /idols（'use client'）
│   ├── events/[id]/page.tsx# 活動詳情 /events/:id
│   ├── favorites/page.tsx  # 收藏頁 /favorites
│   └── me/page.tsx         # 我的頁 /me
├── components/
│   ├── BottomNav.tsx       # 底部導航（'use client'）
│   ├── EventCard.tsx       # 活動卡片，支援 compact prop
│   ├── SourceBadge.tsx     # 來源可信度標籤
│   └── EventTypeBadge.tsx  # 活動類型標籤
└── lib/
    ├── mockIdols.ts        # Mock 偶像資料 + 型別定義
    └── mockEvents.ts       # Mock 活動資料 + 型別定義 + 工具函式
```

---

## 型別定義

### IdolEvent（`src/lib/mockEvents.ts`）
```ts
type EventType = 'concert' | 'fanmeet' | 'musicshow' | 'fansign' | 'release' | 'variety' | 'interview' | 'award'
type SourceLevel = 'official' | 'verified' | 'community' | 'unverified'

interface IdolEvent {
  id: string
  idolId: string
  idolName: string
  title: string
  type: EventType
  date: string        // ISO string
  time?: string       // 'HH:MM'
  location?: string
  country: string
  countryFlag: string // emoji
  source: SourceLevel
  sourceLabel: string
  description: string
  isFavorited: boolean
  ticketUrl?: string
  tags: string[]
  confirmed: boolean
}
```

### Idol（`src/lib/mockIdols.ts`）
```ts
interface Idol {
  id: string
  name: string
  koreanName: string
  type: 'group' | 'solo'
  agency: string
  debut: string
  color: string       // hex
  gradient: string    // Tailwind from-X to-Y
  genres: string[]
  memberCount?: number
  following: boolean
  description: string
}
```

---

## 設計規範

### 色彩 Token（tailwind.config.ts）
```
bg:           #08080f   主底色
card:         #0f0f1e   卡片底
card-border:  #1e1e36   邊框
primary:      #e91e8c   主色（熱粉）
primary-dim:  rgba(233,30,140,0.15)  主色半透明
violet:       #8b5cf6   輔色
text-base:    #f0f0ff   主文字
muted:        #6b6b9a   次文字
```

### 元件慣例
- 卡片：`rounded-2xl border border-card-border bg-card`
- 主色按鈕：`bg-primary text-white rounded-xl`
- 次要按鈕：`border border-card-border bg-transparent text-muted`
- 底部安全距離：頁面加 `pb-24`

---

## 開發規範

### Server / Client Component
- **預設 Server Component**（無 `'use client'`）
- 需要 `useState` / `usePathname` 的元件才加 `'use client'`
- 目前需要 client：`BottomNav`、`idols/page.tsx`、`EventCard`（含 onClick）

### 新增偶像
在 `src/lib/mockIdols.ts` 的 `MOCK_IDOLS` 陣列中加入一筆 `Idol` 物件。

### 新增活動
在 `src/lib/mockEvents.ts` 的 `MOCK_EVENTS` 陣列中加入一筆 `IdolEvent` 物件。  
日期請使用 `d(offset)` 工具函式（相對於今天的天數）。

---

## 本地開發

```bash
cd ~/Desktop/idol-rhythm
npm install
npm run dev
# 預設 http://localhost:3000
```

## Build

```bash
npm run build
```

---

## 下一步 Phase 2 方向
請參考 `MVP_SCOPE.md` 的 Phase 2 清單。
重點：偶像篩選實際功能化、localStorage 持久化、Supabase 接入。
