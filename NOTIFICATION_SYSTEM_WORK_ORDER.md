# Notification System Work Order v1

> Scope: 規劃通知系統的第一版產品與實作拆分。
>
> Status: work order only. 本文件不實作 UI、不改 schema、不改 push runtime。
>
> Created: 2026-05-22

---

## 背景

目前專案已經有三個和通知相關的入口，但都還是「提醒」層，不是真正的通知系統：

1. 首頁右上角鈴鐺
   - 目前只顯示 `reminders` 數量
   - 點擊導向 `/me`

2. `/me` 的「提醒與通知」區塊
   - 目前是 UI shell
   - 文案已預留未來 app 化與手機通知方向

3. 活動卡 / 詳情頁上的提醒按鈕
   - 目前是 event-level toggle
   - 已有 local / cloud 模式
   - DB `reminders` 現況以單一 on/off 體驗為主，預設對應 `day_before`

因此，下一步不是立刻做 push，而是先把「提醒」和「通知」的邊界定清楚。

---

## 目標

- 定義 Idol Rhythm 第一版通知系統的產品邏輯
- 讓首頁鈴鐺、`/me` 通知區、未來 `/notifications` 頁面有一致分工
- 先以站內通知 / app push-ready 結構為主，不依賴 email
- 延續現有 `reminders` 互動，而不是推翻重做

---

## 非目標

- 這一輪不做 native push / APNs / FCM
- 不做 email 通知
- 不做 migration
- 不做 cron 或 background worker
- 不做 `/notifications` 正式 UI 頁
- 不改現有 reminders toggle 行為

---

## 建議名詞定義

### Reminder

使用者主動對「某一個活動」設定的提醒。

特性：
- 以 event 為單位
- 由使用者手動開啟 / 關閉
- 目前 UI 已存在
- 未來可擴充提醒時間（如前 1 天 / 前 1 小時）

### Notification

系統主動出現在鈴鐺 / 通知中心裡的一則通知項目。

特性：
- 以 feed item 為單位
- 不一定來自 reminder，也可能來自追蹤偶像的新活動
- 未來可對應 app push
- 會有已讀 / 未讀概念

簡單說：
- `reminder` 是「我想被提醒這個活動」
- `notification` 是「系統真的送出一則提醒或更新給我」

---

## v1 建議範圍

第一版通知系統，建議只支援兩種通知來源：

1. **活動提醒通知**
   - 來自使用者已設定 reminder 的活動
   - 例如：活動即將在 24 小時內開始

2. **追蹤偶像新活動通知**
   - 當使用者追蹤的偶像出現新的已發布活動
   - 不需要使用者逐場手動提醒

先不要做：
- 收藏活動變通知
- 活動內容異動通知
- 票務開賣通知
- 來源網站公告摘要通知
- 行銷 / 系統公告通知

---

## 首頁鈴鐺建議

首頁右上角鈴鐺不應永遠只等於 reminders 數量。

建議未來語義改成：

- badge 顯示「未讀通知數」
- 通知來源先由以下兩類組成：
  - 活動提醒通知
  - 追蹤偶像新活動通知

在真正通知系統上線前，現況可維持：
- fallback 顯示 reminders 數量

切換時機：
- 等 `/notifications` 頁與通知資料模型 ready 後，再把首頁鈴鐺的 badge 從 `reminders` 換成 `unread notifications`

---

## `/me` 的分工建議

`/me` 不應成為完整通知列表頁，而應是「通知控制台」。

建議分工：

- `/me`
  - 顯示通知總數 / 未讀數
  - 顯示最近 2~3 則重要通知
  - 提供通知設定入口
  - 提供前往完整通知頁入口

- `/notifications`（未來）
  - 顯示完整通知 feed
  - 支援已讀 / 未讀
  - 支援依類型過濾

---

## 通知時機建議

### A. 活動提醒通知

v1 建議固定規則：
- 預設在活動開始前 24 小時送出一次

原因：
- 現有 DB `reminders` 已經有 `type` 欄位，但 UI 尚未讓使用者選提醒時間
- 先固定一種最簡單、最能理解的節奏

未來 v2 再擴充：
- 前 1 週
- 前 1 天
- 前 1 小時

### B. 追蹤偶像新活動通知

v1 建議規則：
- 當某位追蹤偶像出現新的已發布活動時，產生一則通知
- 同一活動只通知一次

---

## 是否要讓收藏變成通知來源

v1 建議：**先不要**

原因：
- 現在收藏主要語義是 archive / save，不一定代表想被打擾
- reminder 已經明確承擔「我要提醒」這件事
- 若把 favorites 也自動納入通知，容易混淆

建議保持：
- favorite = 收藏
- reminder = 主動要求提醒

---

## 未來資料模型方向（只定方向，不在這輪實作）

當通知系統正式開始做時，建議新增獨立通知表，而不是硬塞進 `reminders`。

建議方向：

- `notifications`
  - user_id
  - type
  - event_id nullable
  - idol_id nullable
  - title
  - body
  - payload jsonb
  - read_at
  - delivered_at
  - created_at

`reminders` 繼續保留成「使用者偏好 / 訂閱」，不要直接兼任「通知收件匣」。

---

## 建議拆分 PR

### PR A - 通知資料模型 + 基礎查詢

- migration：新增 `notifications`
- 前台 / server 查詢 helper
- 先不做完整 UI

### PR B - `/notifications` 頁面 + 首頁鈴鐺改讀未讀數

- 新增通知列表頁
- 首頁鈴鐺改為真正未讀數
- `/me` 增加前往通知頁入口

### PR C - reminder -> notification 產生機制

- 先做活動前 24 小時提醒
- 可以先用定時 job / server trigger 思路規劃

### PR D - following new events 通知

- 追蹤偶像的新活動通知
- 補 dedupe 規則

---

## 開放問題

1. `/notifications` 要不要放在 bottom nav？
   - v1 建議不要，先讓鈴鐺 + `/me` 承接

2. 通知是否需要「全部已讀」？
   - v1 建議要

3. 通知是否需要分類 tabs？
   - v1 建議要，但可只做兩類：
     - 提醒
     - 追蹤更新

4. 匿名使用者的 local reminders 是否要產生本地通知？
   - v1 建議先不承諾
   - 真正通知系統先以登入用戶為主

---

## 建議結論

如果下一步要實作，建議順序是：

1. 先做 `notifications` 資料模型工作單 review
2. 再做 migration + query helper
3. 再做 `/notifications` UI shell
4. 最後才接真正的通知派送

不要一開始就直接做 push。先把站內通知中心與 reminder / notification 邏輯切乾淨，後面 app 化才不會返工。
