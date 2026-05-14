# MVP Scope — Idol Rhythm 星動時刻

> Phase 1 MVP · 2026-05-14

---

## ✅ 已完成（本次交付）

### 資料層
- [x] `src/lib/mockIdols.ts` — 10 組偶像 mock 資料（BTS、BLACKPINK、aespa、NewJeans、Stray Kids、IVE、TWICE、LE SSERAFIM、TXT、EXO）
- [x] `src/lib/mockEvents.ts` — 15 筆活動 mock 資料（涵蓋 8 種類型、4 種來源可信度）
- [x] 輔助函式：`getEventById`、`getTodayEvents`、`getUpcomingEvents`、`getFavoritedEvents`、`formatEventDate`

### 元件
- [x] `BottomNav` — 5-tab 底部導航（今日 / 行程 / 偶像 / 收藏 / 我的）
- [x] `EventCard` — 活動卡片（標準 + compact 兩種模式）
- [x] `SourceBadge` — 來源可信度標籤（官方 / 已驗證 / 社群 / 待確認）
- [x] `EventTypeBadge` — 活動類型標籤（8 種類型）

### 頁面
- [x] `/` — 首頁（今日活動、追蹤偶像條、近期行程）
- [x] `/schedule` — 行程時間軸（按日期分組、時間軸 UI、偶像篩選 mock）
- [x] `/idols` — 偶像選擇（搜尋、流派篩選、追蹤 toggle）
- [x] `/events/[id]` — 活動詳情（Hero banner、完整資訊、來源說明、購票連結）
- [x] `/favorites` — 收藏頁（即將到來 / 已結束分組）
- [x] `/me` — 我的頁面（個人資料、統計、偶像列表、設定選單）

### 設定
- [x] Next.js 14 App Router + TypeScript
- [x] Tailwind CSS 深色主題設計 token
- [x] mobile-first RWD（最大寬度 448px）
- [x] `.gitignore`、`tsconfig.json`、`next.config.mjs`

### 文件
- [x] `PRODUCT_SPEC.md`
- [x] `MVP_SCOPE.md`
- [x] `AGENTS.md`

---

## 🔜 Phase 2（下一步建議）

### 功能擴充
- [ ] 偶像篩選實際過濾行程時間軸
- [ ] 收藏 / 取消收藏持久化（localStorage）
- [ ] 追蹤偶像持久化（localStorage）
- [ ] 日曆視圖（月曆 / 週曆切換）
- [ ] 活動通知提醒設定（前端模擬）
- [ ] 搜尋跨頁面整合

### 資料層
- [ ] 接入真實資料 API（爬蟲 / 粉絲社群 API）
- [ ] Supabase 資料庫接入
- [ ] 活動資料定期更新機制

### 用戶系統
- [ ] 登入 / 註冊（Supabase Auth）
- [ ] 雲端同步追蹤偶像與收藏
- [ ] 推播通知（Web Push）

### 設計
- [ ] 偶像真實頭像圖片
- [ ] 活動封面圖片
- [ ] 深色 / 淺色主題切換
- [ ] 動畫與過場效果

---

## ⛔ 明確不做（此 MVP）

- 社群功能（留言、轉發、按讚）
- 付款 / 訂閱系統
- AI 功能
- 多語言
- 爬蟲 / 自動抓取
