# Crawler Work Order — Starship Entertainment Phase A Probe

**狀態:** Phase A 探測完成 → 建議 Google Discovery  
**日期:** 2026-05-23  
**目標藝人:** IVE / MONSTA X / CRAVITY / KiiiKiii  
**起草者:** Claude Code（自動生成）  
**授權後才執行:** 此為探測報告 + 建議，不含實作

---

## 一、目標說明

Starship Entertainment 旗下 4 個目標藝人目前均無 crawler_sources。
本文件記錄 Phase A 探測結果與建議路徑。

| 藝人 | slug | 類型 |
|---|---|---|
| IVE | `ive` | 女子團體（6人，2021） |
| MONSTA X | `monsta-x` | 男子團體（2015，現 4人） |
| CRAVITY | `cravity` | 男子團體（2020） |
| KiiiKiii | `kiikiii` 或 `kiiii-kiii` | 女子團體（2024，Starship 新晉） |

---

## 二、Phase A 探測結果

### 2-A. 候選 URL 探測

| URL | 結果 | 說明 |
|---|---|---|
| `starshipent.com` | 301 → `shopstarship.com` | 重定向到周邊商店，Cloudflare bot protection（JS challenge 403） |
| `starshipent.com/notice` | 403 Cloudflare | 同上，不可直接抓取 |
| `starshipentertainment.com` | 200 WordPress | **錯誤對象**：加拿大溫哥華「Starship Entertainment Group」舞蹈工作室，與韓國無關 |
| `starship.kr` | timeout | 域名可能停用或網路封鎖 |
| `starshipent.co.kr` | timeout | 同上 |
| `iveofficial.com` | timeout | 網路環境無法到達 |

**結論：** 韓國 Starship Entertainment 的官方通知頁面（若存在）在本環境下無法穩定 curl 到達，且主域名 `starshipent.com` 已設有 Cloudflare bot 保護。

### 2-B. 平台生態分析

Starship Entertainment 旗下藝人的主要數位管道：

1. **Weverse** — IVE、MONSTA X 均在 Weverse 有官方社群
   - ❌ 已定為 Verdict C（HYBE/Weverse 生態已排除，不做 Weverse crawler）

2. **kpopofficial.com 聚合** — 現有 `kpopofficial_concerts` source 已覆蓋 IVE 演唱會場次（codebase 中有 IVE 範例）
   - ✅ IVE 演唱會部分已間接覆蓋，但非公告型通知

3. **個別官方社群媒體** — Instagram / YouTube / X（Twitter）
   - 公告型活動通常會在這些平台發布，但不是 server-rendered 結構化頁面

4. **獨立官方站** — 部分藝人可能有獨立官方站（如 IVE）
   - 因本環境網路限制，目前無法 curl 確認

### 2-C. NCT/SM 模式適用性評估

smtown_notice / wakeone_notice 模式成立的條件：

| 條件 | Starship 符合？ |
|---|---|
| 公司有公開通知頁面（/notice/ 類） | ❓ 未確認（主站被 Cloudflare 封，找不到替代 URL） |
| 頁面 server-rendered HTML（可 curl） | ❌ 目前無法確認 |
| 頁面有穩定 DOM 結構（非 SPA/React） | ❌ 目前無法確認 |
| 通知頁面公開無登入要求 | ❓ 未確認 |

---

## 三、建議路徑

### 建議：Google Discovery（方案 B）

**理由：**
- Starship 主站有 Cloudflare 保護，v1 crawler 不使用 headless browser（工作規範明確禁止）
- Weverse 已定為 Verdict C，不再評估
- kpopofficial.com 聚合已部分覆蓋 IVE 演唱會，但不含 MONSTA X / CRAVITY / KiiiKiii 粉絲活動型通知
- Google PSE 方案（SEARCH_DISCOVERY_PROVIDER_WORK_ORDER.md）待決策後可統一覆蓋 Starship 全家族

**Google Discovery query templates（建議）：**

```
"IVE" concert OR 팬미팅 OR showcase 2026
"MONSTA X" concert OR fanmeeting 2026
"CRAVITY" concert OR showcase 2026
"KiiiKiii" concert OR fanmeeting 2026
```

**等待前提：** Google PSE runtime 需等 SEARCH_DISCOVERY_PROVIDER_WORK_ORDER.md 決策完成後才開始實作。

---

## 四、次要探測方向（若使用者希望再做 Phase B 人工確認）

若使用者能在瀏覽器手動確認以下頁面的可用性，可再評估是否回來做 Starship crawler：

1. **Starship 公告頁** — 在瀏覽器打開 `https://starshipent.com/notice` 或 `https://starshipent.com/ko/notice`
   - 若頁面是 server-rendered HTML（無 JS 才顯示）→ 可考慮加 User-Agent 後 curl（但 Cloudflare 通常仍會擋 bot）
   - 若頁面需 JS 渲染 → Google Discovery 為正確路徑

2. **IVE 官方站** — 搜尋 "IVE official site" 確認域名，查看是否有公告列表

---

## 五、現況結論

| 藝人 | 當前覆蓋 | 建議 |
|---|---|---|
| IVE | kpopofficial（演唱會部分） | 維持現狀 + 等 Google PSE 決策 |
| MONSTA X | 無 | 等 Google PSE 決策 |
| CRAVITY | 無 | 等 Google PSE 決策 |
| KiiiKiii | 無 | 等 Google PSE 決策 |

**Phase A 總結：Starship 目前無法透過低成本 server-rendered crawler 覆蓋，統一走 Google Discovery 路徑等待決策。**

---

## 六、不做的事（邊界確認）

- ❌ 不做 Starship 官方站 crawler（Cloudflare 封鎖，headless browser 不在 v1 範圍）
- ❌ 不做 Weverse crawler（Verdict C）
- ❌ 不做個人 SNS scraping（Instagram/X/YouTube 均不在現有 parser 列表）
- ❌ 不先開 Google PSE runtime（等 SEARCH_DISCOVERY_PROVIDER_WORK_ORDER.md 決策後再開）
