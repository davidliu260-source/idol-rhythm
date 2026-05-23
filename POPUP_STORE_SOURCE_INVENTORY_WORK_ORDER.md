# 快閃店來源盤點工作單 — Popup Store Source Inventory

> **版本**：v1 — 2026-05-23
> **範圍**：只做來源盤點與策略規劃，不寫 crawler runtime、不新增 parser_type、不 seed `crawler_sources`、不改 schema、不接 API key、不碰前台 UI。
> **用途**：為 `popup_store` / `exhibition` / `brand_event` 三類活動建立可靠的資料來源策略，決定哪些來源可爬、哪些人工候選、哪些需要 Google Discovery 補洞。
> **上游**：前台三類 chip 已完成（PR #137 merged）；本工作單是資料端的補充。
> **下游**：本工作單通過後，再依結論開各別 crawler 工作單 或 Google Discovery Provider 工作單（P1）。

---

## 一、背景與目標

`/schedule` 前台已有三個子類 filter chip：
- **快閃店**（`popup_store`）：實體限期品牌快閃店、pop-up shop
- **展覽**（`exhibition`）：藝術展、攝影展、IP 展、主題展
- **品牌活動**（`brand_event`）：品牌合作活動、發布會、快閃活動（非店鋪形式）

目前 `events` 資料庫對這三類的覆蓋幾乎為零，因為：
1. 現有爬蟲（SMTOWN notice、WAKEONE notice、YG schedule、JYP schedule）以演唱會 / 音樂節目 / 팬簽 / 線上活動為主。
2. 這三類活動的主要來源是品牌、場館、電商平台，而非藝人官方 notice feed。
3. `kpopofficial.com` 聚合站偶有覆蓋，但零散且延遲。

**本工作單目標**：
- 盤點每個來源的技術特性（rendering / login / 結構）
- 決定每個來源的策略（可爬 → 開 crawler 工作單 / 人工候選 → 建立人工輸入指引 / Discovery 補洞 → P1 工作單）
- 確認 `event_sub_type` 在各來源的對應關係
- 列出所有候選都必須走 `event_candidates` → 後台審核才能 publish（既有政策不變）

---

## 二、範圍邊界（本工作單不做）

| 禁止 | 原因 |
|---|---|
| 寫任何 crawler runtime / fetcher / parser | 工作單先行，等 GPT audit 後再開 runtime PR |
| 新增 `parser_type` enum | 需 migration，本輪不動 schema |
| seed `crawler_sources` 資料 | 需 SQL，本輪不執行 |
| 接 API key（Google PSE / SerpAPI / YouTube Data API） | P1 / P2 工作單的範疇 |
| 改 `event_candidates` 或 `events` schema | 本輪不動 |
| 直接 publish 任何活動 | 永遠走候選審核流程 |
| 評估串流平台（YouTube / Netflix / Disney+） | P2 工作單的範疇 |

---

## 三、來源盤點矩陣

每個來源評估六個維度：
- **rendering**：server-rendered（可直接 curl 取內容）/ SPA（JS rendering，需 headless）/ 混合
- **login required**：是否需要帳號才能看活動資訊
- **結構**：HTML list / JSON endpoint / RSS / 無固定格式
- **sub-type 對應**：主要產出哪個 event_sub_type
- **爬蟲可行性**：高 / 中 / 低 / 不可
- **建議策略**：`crawler`（可開 runtime 工作單）/ `manual`（人工輸入）/ `discovery`（需 Google Discovery 補洞）/ `defer`（暫緩）

### 3.1 電商 / 活動票務平台

| 來源 | URL | rendering | login | 結構 | sub-type 對應 | 爬蟲可行性 | 建議策略 | 備註 |
|---|---|---|---|---|---|---|---|---|
| **Ktown4u** | ktown4u.com/event | 待探測（疑似 SPA） | no（瀏覽）/ yes（購買） | 疑似 JSON API | `popup_store` / `brand_event` | 中 | `discovery` 優先 | K-pop 最大票務 + 周邊電商；有「EVENT」分頁，但列表結構未確認；無公開 RSS；官方活動資訊密度高，值得深入探測 |
| **Soundwave** | soundwavekorea.com | 待探測（疑似混合） | no（瀏覽） | 待確認 | `brand_event`（팬簽 / 팬사인회）| 中 | `discovery` 優先 | 以 K-pop 팬簽 / 팬미팅為主；與 `brand_event` 對應；非快閃店類；探測需確認活動列表是否有固定 URL pattern |
| **Music Plant** | musicplant.co.kr | 待探測（疑似混合） | no（瀏覽） | 待確認 | `brand_event`（팬簽）| 中 | `discovery` 優先 | 與 Soundwave 類似，K-pop 唱片行 팬簽活動；探測重點同上 |

### 3.2 品牌 / IP 官方場館

| 來源 | URL | rendering | login | 結構 | sub-type 對應 | 爬蟲可行性 | 建議策略 | 備註 |
|---|---|---|---|---|---|---|---|---|
| **LINE FRIENDS SQUARE** | linefriendssquare.com | 待探測（疑似 SPA） | no | 待確認 | `popup_store` / `exhibition` | 低–中 | `discovery` 優先 | LINE Friends IP 官方快閃 / 展覽旗艦；BTS / SEVENTEEN 等聯名常在此；韓國首爾 + 日本 + 中國多點；無確認的 RSS 或公開 JSON；活動頻率低但單次曝光大 |
| **NOL World** | nolworld.com | 待探測 | no | 待確認 | `exhibition` / `brand_event` | 低 | `manual` | 首爾新興複合文化空間；K-pop 展覽 / 合作空間；官網規模小，更新頻率不確定；人工監控優於自動爬蟲 |
| **SM Town Coex Artium** | smtown.com（已有來源）| server-rendered（已確認）| no | Notice feed（已爬）| `exhibition` / `popup_store`（SM 藝人快閃 / 展覽）| 高（已有爬蟲）| **現有 crawler 擴充** | SMTOWN notice 爬蟲（migration 045）已覆蓋；需確認 SM 快閃 / 展覽類 notice 是否有固定關鍵字可過濾（如「팝업」「전시」） |
| **HYBE Insight** | hybe.com / weverse.io | SPA（Verdict C）| yes（Weverse）| 無公開 feed | `exhibition` / `popup_store`（HYBE 藝人展覽）| 不可 | `discovery` / `manual` | HYBE Insight 首爾常設 + 巡迴展；Weverse 已確認 Verdict C（PR #131）；只能靠媒體報導或人工輸入 |

### 3.3 百貨 / 商場

| 來源 | URL | rendering | login | 結構 | sub-type 對應 | 爬蟲可行性 | 建議策略 | 備註 |
|---|---|---|---|---|---|---|---|---|
| **The Hyundai** | thehyundai.com | 待探測（疑似 SPA） | no（瀏覽）| 待確認 | `popup_store` / `brand_event` | 低–中 | `discovery` 優先 | 現代百貨旗艦（The Hyundai Seoul 汝矣島）是 K-pop 聯名快閃最熱門場地；官網有活動頁但 JS 渲染可能性高；無公開 RSS；搜尋「The Hyundai 快閃」命中率高，適合 Google Discovery |
| **Lotte Department Store** | lotteshopping.com | 待探測 | no | 待確認 | `popup_store` | 低 | `discovery` | 롯데百貨也是常見快閃場地，但官網爬蟲可行性未確認；納入 Discovery 候選 |
| **Starfield / Shinsegae** | starfield.co.kr / shinsegae.com | 待探測 | no | 待確認 | `popup_store` | 低 | `discovery` | 其他主要百貨集團；快閃活動頻繁；爬蟲可行性未確認 |

### 3.4 旅遊 / 文化機構

| 來源 | URL | rendering | login | 結構 | sub-type 對應 | 爬蟲可行性 | 建議策略 | 備註 |
|---|---|---|---|---|---|---|---|---|
| **Visit Seoul** | visitseoul.net | 疑似 server-rendered（政府站）| no | 可能有結構化列表 | `exhibition` / `brand_event` / `popup_store` | 中 | `crawler` 候選（探測後決定）| 首爾市政府旅遊官網；有「K-culture」/ 活動分頁；政府站通常 server-rendered，值得優先探測；如有固定 JSON endpoint 可直接爬 |
| **Musinsa** | musinsa.com | SPA | no（瀏覽）| JSON API（未公開）| `popup_store` / `brand_event`（時尚 × K-pop 聯名）| 低 | `discovery` | 韓國最大時尚電商；K-pop 聯名快閃密度高（BLACKPINK / NewJeans × 品牌）；SPA 渲染 + 無公開 API；Google Discovery 適合補洞 |

### 3.5 既有 Agency Notice 爬蟲（延伸評估）

以下來源已有爬蟲，評估是否需要擴充覆蓋快閃 / 展覽類 notice：

| 來源 | 既有狀態 | 快閃 / 展覽覆蓋現況 | 建議動作 |
|---|---|---|---|
| **SMTOWN notice** | ✅ 已爬（migration 045，5 個 idol 的 crawler_sources）| Notice 可能包含快閃 / 展覽公告（如 SM Town Coex Artium 活動）；目前 AI 解析器會將其分類為哪個 type 未確認 | 確認 AI 解析是否能正確辨識 `popup_store` / `exhibition` 關鍵字（「팝업」「전시」「팝업스토어」）；若需要，可在 Claude 解析 prompt 中強化 sub-type 判斷 |
| **WAKEONE notice** | ✅ 已爬（PR #126，migration 044）| WAKEONE 偶有快閃合作公告 | 同上；確認解析器對快閃 notice 的 sub-type 分類 |
| **YG artist schedule** | ✅ 已爬（BLACKPINK / 部分 YG 藝人）| YG 藝人快閃 / 品牌合作頻繁（YG 藝人 × 品牌）| 確認 YG schedule 資料結構中是否有 event category 欄位可對應 sub-type |
| **JYP artist schedule** | ✅ 已爬（多個 JYP 藝人）| JYP 藝人品牌合作活動（ITZY × 品牌等）| 同上 |
| **kpopofficial.com** | ✅ 已爬（聚合站）| 偶有快閃店 / 展覽，但延遲且不完整 | 維持現狀，不作為主力快閃 / 展覽來源 |

---

## 四、策略分類與優先順序

### 4.1 可立即推進的方向

| 優先 | 方向 | 說明 |
|---|---|---|
| **P0** | 現有爬蟲擴充：強化 sub-type 解析 | 修改 Claude AI 解析 prompt，確保 SMTOWN / WAKEONE / YG / JYP notice 中的快閃 / 展覽關鍵字能正確對應 `event_sub_type`。**不需新 migration / 新 crawler_sources / 不動 parser_type**；只需更新 prompt 邏輯。|
| **P0** | Visit Seoul 技術探測 | 優先探測 visitseoul.net 是否 server-rendered + 有結構化列表；若可行，開 crawler 工作單（類似 WAKEONE / SMTOWN pattern）|
| **P1** | Google Discovery 策略 | 針對 Ktown4u / LINE FRIENDS SQUARE / The Hyundai / Musinsa / Soundwave / Music Plant 這類 SPA 重度站點，透過 P1 Search Discovery Provider 工作單決定搜尋策略；不為每個站點單獨開爬蟲 |
| **P2** | 人工候選補洞 | HYBE Insight / NOL World / 各百貨特定快閃：後台提供「快速新增候選」UI，由人工輸入 → 走 `event_candidates` 審核流程 |

### 4.2 各來源最終策略總表

| 來源 | 最終策略 | 下一步 |
|---|---|---|
| SMTOWN notice（既有）| crawler + 強化 sub-type 解析 | 更新 AI prompt（P0） |
| WAKEONE notice（既有）| crawler + 強化 sub-type 解析 | 更新 AI prompt（P0） |
| YG artist schedule（既有）| crawler + 強化 sub-type 解析 | 確認 YG schedule 有無 event category（P0） |
| JYP artist schedule（既有）| crawler + 強化 sub-type 解析 | 確認 JYP schedule 有無 event category（P0） |
| Visit Seoul | crawler 候選（探測後決定）| 技術探測 → 若可行開 crawler 工作單（P0） |
| Ktown4u | discovery | P1 Search Discovery Provider |
| Soundwave | discovery | P1 Search Discovery Provider |
| Music Plant | discovery | P1 Search Discovery Provider |
| LINE FRIENDS SQUARE | discovery | P1 Search Discovery Provider |
| The Hyundai | discovery | P1 Search Discovery Provider |
| Musinsa | discovery | P1 Search Discovery Provider |
| Lotte / Starfield / Shinsegae | discovery | P1 Search Discovery Provider |
| HYBE Insight | manual + discovery | 人工輸入為主；P1 補洞 |
| NOL World | manual | 人工輸入（頻率低，規模小） |
| SM Town Coex Artium notice（SMTOWN 既有）| crawler（已覆蓋）| 確認 notice 包含快閃 / 展覽公告 |

---

## 五、Sub-type 對應指引

下一輪 AI 解析 prompt 更新時的分類規則草案：

| 判斷條件 | `event_sub_type` |
|---|---|
| 關鍵字含「팝업」「팝업스토어」「pop-up」「popup」「pop up」「limited store」「팝업샵」 | `popup_store` |
| 關鍵字含「전시」「전시회」「exhibition」「展示」「갤러리」「gallery」 | `exhibition` |
| 關鍵字含「팬사인회」「팬미팅」「사인회」「fansign」「fan sign」「brand event」「브랜드」（不含 popup / 전시）| `brand_event` |
| 關鍵字含「콘서트」「concert」「투어」「tour」「공연」「live」 | → `event type = concert`（不是 brand 子類）|
| 以上均不符 + 來源為品牌 / 商場 | `brand_event`（保守分類） |

> 注意：以上為草案規則，實際 AI prompt 更新需在 AI 解析器工作單中細化與測試。

---

## 六、資料政策（不得變更）

以下政策繼承自 `CLAUDE.md` 與既有系統設計，本工作單不更動：

1. **所有候選必須進 `event_candidates`**，不得直接 INSERT 到 `events`。
2. **所有候選需後台 admin 審核**（approve / reject），才能 publish 到前台。
3. **前台只顯示 `trust_level = official` 或 `media`**，`pending` 資料不出現在使用者可見頁面。
4. **爬蟲只負責 discovery + 初步欄位提取**；最終 trust_level 由 admin 審核時決定。
5. **不得爬需要登入的頁面**（Weverse Verdict C，不例外）。
6. **不得違反 robots.txt** 或明示禁止爬取的條款。

---

## 七、待探測的開放問題

在開各別爬蟲工作單前，需先實地探測以下問題（類似 Weverse Phase A 探測 PR #131 的方式）：

| # | 問題 | 影響的來源 | 探測方式 |
|---|---|---|---|
| Q1 | Visit Seoul 活動頁是否 server-rendered？是否有結構化 JSON endpoint？ | visitseoul.net | `curl -A "Mozilla/5.0..."` + 觀察 HTML 是否包含 inline 活動資料 |
| Q2 | Ktown4u 活動列表是否有公開 API 或固定 URL pattern？ | ktown4u.com/event | DevTools Network 觀察，curl 嘗試 |
| Q3 | LINE FRIENDS SQUARE 活動頁 rendering 類型？ | linefriendssquare.com | curl + HTML 觀察 |
| Q4 | The Hyundai 活動頁是否有 JSON API？ | thehyundai.com | DevTools Network 觀察 |
| Q5 | Soundwave / Music Plant 各自的팬簽活動列表 URL pattern？ | soundwavekorea.com / musicplant.co.kr | curl + HTML 觀察 |
| Q6 | SMTOWN notice AI 解析結果中，快閃 / 展覽 notice 目前被分類為哪個 `event_type`？ | 已有爬蟲 | 查 `event_candidates` 中 source 含 smtown 的資料，看 type 欄位分佈 |
| Q7 | YG / JYP schedule 資料結構中，是否有 event category / type 欄位可對應 sub-type？ | 已有爬蟲 | 查 `raw` 欄位 JSON 結構 |

---

## 八、實作順序建議（給未來 runtime PR）

依本工作單盤點結果，建議的實作順序：

1. **AI 解析 prompt 強化**（不需 migration / 不新增 parser_type）
   - 更新 Claude 解析 prompt，加入快閃 / 展覽關鍵字識別規則
   - 目標：SMTOWN / WAKEONE / YG / JYP 的既有 notice 開始正確標 `event_sub_type`
   - 這是 zero-cost 增量：不動 crawler 架構，只更新 prompt 字串

2. **Visit Seoul 技術探測 PR**（類似 Weverse Phase A）
   - 若探測成功（server-rendered + 結構化）→ 開 `crawler_sources` seed + parser 工作單
   - 若失敗 → 進 Google Discovery 清單

3. **AI sub-type 解析回測**
   - 跑既有 `event_candidates` 資料，確認 prompt 強化後 sub-type 命中率

4. **P1 Search Discovery Provider 工作單**
   - 決定 Google PSE / SerpAPI / Brave 策略後，針對 SPA 重度站點（Ktown4u / LINE FRIENDS SQUARE / The Hyundai / Musinsa）設計定向搜尋 query

---

## 九、Acceptance Criteria（未來 runtime PR 的驗收標準）

本工作單本身的驗收：
- [ ] 所有計劃盤點的來源（9 類以上）皆有技術特性評估
- [ ] 每個來源有明確的建議策略（crawler / manual / discovery / defer）
- [ ] `event_sub_type` 對應規則草案完整
- [ ] 既有爬蟲的快閃 / 展覽覆蓋缺口已識別
- [ ] 開放問題清單已列出，可作為下一輪探測 PR 的 checklist
- [ ] 資料政策章節確認所有候選仍走 `event_candidates` 審核流程

未來爬蟲 runtime PR 的驗收（各別工作單再細化）：
- [ ] 每新增一個爬蟲來源，至少有 3 筆 `event_sub_type` 正確標記的候選進入 `event_candidates`
- [ ] 候選不直接 publish，後台 admin 可 approve / reject
- [ ] 快閃 / 展覽候選的 `trust_level` 初始為 `pending`
- [ ] 前台三個 chip（快閃店 / 展覽 / 品牌活動）能正確顯示 approved 後的活動

---

*只做工作單，不寫 runtime、不改 schema、不新增 migration、不 seed `crawler_sources`、不接 API key。*
*下一步：GPT audit 通過後，依 §八 建議順序開各別實作 PR。*
