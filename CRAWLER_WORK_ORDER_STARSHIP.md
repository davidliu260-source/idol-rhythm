# Crawler Work Order — Starship Entertainment Phase A Probe

**狀態:** Phase A 初探完成 → v1 暫不開官方 crawler（非永久放棄）  
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

**本輪 probe 結果：** 韓國 Starship Entertainment 的官方通知頁面在本環境下無法穩定 curl 到達，主域名 `starshipent.com` 在本次探測中設有 Cloudflare bot 保護。這是 Phase A 初探的觀察結果，非對這些 domain 的永久定論；若未來使用者在瀏覽器確認到可存取的公告頁，可以重新啟動 Phase B 評估。

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

### v1 決策：暫不開 Starship 官方 crawler

**理由：**
- Phase A 初探未找到穩定 no-login server-rendered notice feed（主站在本輪探測中有 Cloudflare 保護、個別藝人站 timeout）
- v1 crawler 不使用 headless browser、不繞 Cloudflare（工作規範明確禁止）
- Weverse 已定為 Verdict C，不再評估
- kpopofficial.com 聚合已部分覆蓋 IVE 演唱會，但不含 MONSTA X / CRAVITY / KiiiKiii 粉絲活動型通知

**v1 暫定覆蓋方式：Google Discovery + manual candidate**

IVE / MONSTA X / CRAVITY / KiiiKiii 在 v1 走以下路徑：
- **Google Discovery**：Google PSE 方案（SEARCH_DISCOVERY_PROVIDER_WORK_ORDER.md）待決策後可統一覆蓋 Starship 全家族
- **manual candidate**：後台手動匯入工作單，維持候選審核流程

**Google Discovery query templates（建議，供 PSE 決策後參考）：**

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

**Phase A 總結：本輪初探未找到穩定 no-login server-rendered notice feed，v1 暫不開 Starship 官方 crawler。IVE / MONSTA X / CRAVITY / KiiiKiii 暫走 Google Discovery + manual candidate 路徑，等待 SEARCH_DISCOVERY_PROVIDER_WORK_ORDER.md 決策。**

> **注意：** 「v1 暫不開」≠「永久放棄 Starship 官方來源」。若未來 Google Discovery 找到穩定的 Starship 官方公告頁（server-rendered、無登入要求），可重新開 Starship crawler 工作單評估 Phase B。

---

## 六、不做的事（邊界確認）

- ❌ v1 不開 Starship 官方站 crawler（Phase A 初探未找到穩定 no-login feed；非永久放棄，未來可重新評估）
- ❌ 不使用 headless browser（v1 工作規範明確禁止）
- ❌ 不繞過 Cloudflare bot protection（不用任何 bypass 手段）
- ❌ 不做 Weverse crawler（Verdict C，不抓 Weverse 登入內容）
- ❌ 不使用 cookie / token / app API / login session
- ❌ 不做個人 SNS scraping（Instagram/X/YouTube 均不在現有 parser 列表）
- ❌ 不新增 parser_type（現有 parser 不擴充）
- ❌ 不新增 crawler_sources（本工作單不 seed 任何 source）
- ❌ 不新增 migration（本工作單不改 schema）
- ❌ 不先開 Google PSE runtime（等 SEARCH_DISCOVERY_PROVIDER_WORK_ORDER.md 決策後再開）
