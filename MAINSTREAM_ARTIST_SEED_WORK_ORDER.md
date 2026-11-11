# Mainstream Artist Seed Work Order

> 目的：規劃下一批「主流但目前 active idols 尚未收錄」的藝人 seed。
> 本文件只做規劃，不寫 migration、不改 DB、不改 UI、不新增 crawler。

## 1. 任務定位

- 只規劃下一批 active idol / mainstream artist seed 候選。
- 不直接新增 Supabase migration。
- 不改 schema。
- 不新增 crawler。
- 不改前台 / 後台 UI。
- 後續若要 seed，需另開 migration PR；下一個 migration 編號以當時 `supabase/migrations/` 最新狀態為準。
- 真正 seed 前要重新查證 agency / official source，避免把本工作單的研究草案當作最終 DB 事實。

## 2. 已確認不要重複列入

目前 active idols 已有 75 個。以下已存在或已由既有主流批次覆蓋，不列入本輪 seed 候選：

- ILLIT、TWS、BOYNEXTDOOR、ZICO、N.Flying、AHOF、MEOVV、KiiiKiii、ALLDAY PROJECT、Hearts2Hearts
- Rain、IU、TAEYEON、G-DRAGON、JISOO、JENNIE、ROSE、LISA
- BTS solo：RM、Jin、SUGA / Agust D、j-hope、Jimin、V、Jung Kook
- NCT 127、NCT DREAM、NCT WISH、PLAVE、(G)I-DLE、STAYC
- JYP / HYBE / SM / YG / Starship / WAKEONE 目前表內已有的主流團體與 solo

## 3. 候選藝人 Matrix

### P0：優先 seed 候選

| name | slug | agency | type | category | alt_names 建議值 | 為什麼值得補 | 可能活動類型 | 可能來源方向 | 查證來源 / 風險 |
|---|---|---|---|---|---|---|---|---|---|
| Lee Young Ji | `lee-young-ji` | MAINSTREAM | solo | kpop | `Lee Youngji`, `Youngji`, `이영지`, `李泳知` | 韓國主流 rapper / variety / festival 覆蓋高，常有巡演、節目、品牌活動 | concert, festival, broadcast, brand_event, popup | 官方 SNS、MAINSTREAM、售票頁、主辦單位、可靠媒體；聚合來源只當線索 | Wikipedia 標示 label Mainstream；Music Business Worldwide 2026 報導 Warner 與 MAINSTREAM 合作並指其為 Lee Young Ji management。seed 前需再找 MAINSTREAM 官方 profile / SNS 確認 |
| QWER | `qwer` | Tamago Production / 3Y Corporation；PRISMFILTER 參與製作需再查證 | group | kpop | `큐더블유이알`, `QWER` | 女 band 主流度高，音樂節、校園、YouTube / media 活動多 | concert, festival, broadcast, media, brand_event | 官方 SNS、Tamago / 3Y / PRISMFILTER 相關公告、售票頁、主辦單位 | Wikipedia / Kpop Wiki 指向 Tamago Production；有 2025-2026 contract / co-producer 異動訊號，真正 seed 前需再查最新 agency |
| BIBI | `bibi` | Feel Ghood Music / 88rising global partnership | solo | kpop | `비비`, `Kim Hyeong-seo`, `Kim Hyungseo`, `김형서` | 音樂、影視、festival、品牌活動都高頻；跨韓國與海外市場 | concert, festival, broadcast, brand_event, popup, media | Feel Ghood Music、官方 SNS、88rising / global partner、售票頁、主辦單位 | Wikipedia / Kprofiles 指 Feel Ghood Music；既有 M1b 曾提到 fromis_9/AKMU/Kep1er/BIBI 修正，seed 前必須確認 DB 是否真的尚未存在 |
| Jay Park | `jay-park` | MORE VISION | solo | kpop | `JAY PARK`, `박재범`, `Park Jaebeom`, `朴宰范` | 官方網站有 schedule / live / notice / tour 區塊，crawler ROI 高；演唱會與 festival 高頻 | concert, festival, broadcast, brand_event, popup, media | jaypark.com official schedule / live / notice / tour、MORE VISION、售票頁、主辦單位 | 官方網站 `jaypark.com` 顯示 MORE VISION 與 schedule/live/notice/tour；可列為後續 crawler source 候選 |
| Kwon Eunbi | `kwon-eunbi` | 需再查證；Woollim 已有離開報導，可能轉 Galaxy 或其他 | solo | kpop | `Kwon Eun-bi`, `Eunbi`, `권은비`, `權恩妃` | Waterbomb / festival / brand / broadcast 活動多，前台搜尋價值高 | concert, festival, broadcast, brand_event, popup | 官方 SNS、日本官網、最新 agency notice、售票頁、主辦單位 | Woollim official profile 仍可見，但 2026 有離開 Woollim / 新 agency 報導。agency 欄位 seed 前不可硬填，先標「需再查證」 |
| Chungha | `chungha` | MORE VISION | solo | kpop | `CHUNG HA`, `Chung Ha`, `청하`, `金請夏` | solo 活動、festival、brand、broadcast 明確，且與 MORE VISION source 可合併盤點 | concert, festival, broadcast, brand_event, media | chungha-official.com、MORE VISION official SNS、售票頁、主辦單位 | Wikipedia / Kprofiles / Bandwagon 指 2023 簽 MORE VISION；seed 前確認官方網站是否仍維護 schedule |
| Sunmi | `sunmi` | ABYSS Company | solo | kpop | `SUNMI`, `선미`, `Lee Sun-mi`, `이선미`, `李宣美` | 長期主流 solo，常有 festival、brand、broadcast、海外活動 | concert, festival, broadcast, brand_event, popup | ABYSS Company、官方 SNS、售票頁、主辦單位、可靠媒體 | Wikipedia 指 ABYSS Company；搜尋結果對 `Sunmi` 容易撞到中國硬體公司 SUNMI，後續查證需用 `선미 ABYSS` / `SUNMI official_sunmi` |
| Baekhyun | `baekhyun` | INB100（solo / CBX）；EXO group activity 仍需與 SM 區分 | solo | kpop | `BAEKHYUN`, `Byun Baek-hyun`, `변백현`, `백현`, `伯賢` | EXO solo 超高需求，world tour / album / pop-up / merch 可能性高 | concert, festival, broadcast, brand_event, popup, exhibition | INB100 official profile / notice、official SNS、ticketing、SM/EXO group source（只當 group activity） | INB100 official profile 存在；Wikipedia 指 SM + INB100。需在 notes 明確區分 solo agency 與 EXO group agency |

### P1：可補候選

| name | slug | agency | type | category | alt_names 建議值 | 為什麼值得補 | 可能活動類型 | 可能來源方向 | 查證來源 / 風險 |
|---|---|---|---|---|---|---|---|---|---|
| Lee Mujin | `lee-mujin` | 需再查證；Big Planet Made / BPM 有合約爭議訊號 | solo | kpop | `Lee Mu-jin`, `이무진`, `李茂珍` | 音源大眾度高，festival / OST / broadcast 常見 | concert, festival, broadcast, media | 官方 SNS、BPM 或新 agency notice、售票頁、主辦單位 | 既有資料多指 BPM，但 2026 有合約終止通知報導。seed 前 agency 必須重查 |
| 10CM | `10cm` | 需再查證；曾與 Magic Strawberry Sound / POCLANOS 相關 | solo | kpop | `10cm`, `십센치`, `Kwon Jung-yeol`, `권정열` | 韓國大眾歌手，OST / festival / concert 需求高 | concert, festival, broadcast, media | 官方 SNS、售票頁、主辦單位、可靠媒體 | 搜尋結果顯示 Magic Strawberry Sound 有 former artist 訊號；不可直接硬填 current agency |
| Jannabi | `jannabi` | Peponi Music | group | kpop | `잔나비`, `JANNABI`, `Band Jannabi` | band / festival / concert 需求高，台韓用戶辨識度高 | concert, festival, broadcast, media | Peponi Music、官方 SNS、售票頁、主辦單位 | Kprofiles / StarNews / Wikipedia 均指 Peponi Music 相關；仍需 official channel 確認 |
| Epik High | `epik-high` | Ours Co. | group | kpop | `에픽하이`, `EPIK HIGH`, `Tablo`, `Mithra Jin`, `DJ Tukutz` | 海外巡演、festival、official shop / membership 活動多 | concert, festival, brand_event, media | epikhigh.com、官方 SNS、售票頁、主辦單位 | 官方網站可用；Wikipedia 指離開 YG 後成立 Ours Co. |
| Dynamicduo | `dynamicduo` | Amoeba Culture | group | kpop | `Dynamic Duo`, `다이나믹듀오`, `Gaeko`, `Choiza`, `개코`, `최자` | hip-hop mainstream，festival / broadcast / concert 穩定 | concert, festival, broadcast, media | Amoeba Culture、官方 SNS、售票頁、主辦單位 | Wikipedia / Amoeba Culture 相關資料指 Amoeba Culture；official profile endpoint 需再找可爬版本 |
| Crush | `crush` | P NATION | solo | kpop | `크러쉬`, `Shin Hyo-seob`, `신효섭` | R&B mainstream，concert / festival / OST / broadcast 常見 | concert, festival, broadcast, media, brand_event | P NATION、官方 SNS、售票頁、主辦單位 | Kprofiles / Soompi 指 P NATION；需確認 P NATION official artist page 是否可爬 |
| Dean | `dean` | you.will.knovv / Universal Music | solo | kpop | `DEAN`, `딘`, `Kwon Hyuk`, `권혁` | R&B 高辨識度，release / festival / feature 需求 | concert, festival, media | you.will.knovv official profile、官方 SNS、可靠媒體、售票頁 | you.will.knovv official profile 可見；活動頻率與 agency details 需 seed 前再查 |
| Heize | `heize` | P NATION | solo | kpop | `헤이즈`, `Jang Da-hye`, `장다혜` | 大眾音源 / OST / festival / broadcast 常見 | concert, festival, broadcast, media | P NATION、官方 SNS、售票頁、主辦單位 | Wikipedia / Kprofiles 指 P NATION；需確認 official source 可爬性 |
| Paul Kim | `paul-kim` | Whyes Entertainment | solo | kpop | `Paul Kim`, `폴킴`, `Kim Tae-hyeong`, `김태형` | 大眾 ballad / OST / concert 需求高 | concert, festival, broadcast, media | Whyes Entertainment、官方 SNS、售票頁、主辦單位 | Korea JoongAng Daily 指 Whyes Entertainment；搜尋 `paulkim.com` 易撞名美國 location manager，需使用韓文 / Whyes 查證 |

### P2：觀察 / 完整度補強

| name | slug | agency | type | category | alt_names 建議值 | 為什麼值得補 | 可能活動類型 | 可能來源方向 | 查證來源 / 風險 |
|---|---|---|---|---|---|---|---|---|---|
| T.O.P | `top` | 需再查證；TOPSPOT PICTURES / one-man agency 訊號 | solo | kpop | `T.O.P`, `TOP`, `탑`, `Choi Seung-hyun`, `최승현` | BIGBANG legacy / solo comeback 可能帶來搜尋需求 | concert, festival, media, brand_event | 官方 SNS、agency notice、可靠媒體 | 2026 搜尋結果有 TOPSPOT PICTURES / comeback 訊號，但需官方確認；BIGBANG group 狀態不可混用 |
| DAESUNG | `daesung` | R&D Company / D-LABLE | solo | kpop | `Daesung`, `D-LITE`, `대성`, `Kang Dae-sung`, `강대성` | BIGBANG solo / tour / YouTube / variety 需求 | concert, festival, broadcast, media, brand_event | D-LABLE official SNS、R&D Company、售票頁、主辦單位 | Korea JoongAng Daily / Kprofiles 指 2023 起 R&D Company / D-LABLE；仍需 official profile 確認 |
| YENA | `yena` | Yuehua Entertainment / YH Entertainment 需再查證 | solo | kpop | `Choi Yena`, `Choi Ye-na`, `최예나`, `예나`, `崔叡娜` | former IZ*ONE solo，release / broadcast / fan event 需求 | concert, festival, broadcast, media, brand_event | YH/Yuehua official SNS、官方 YouTube、售票頁、主辦單位 | Kprofiles 指 Yuehua；2025 rebrand to YH 訊號，seed 前要確認 current agency naming |
| Jo Yuri | `jo-yuri` | WAKEONE | solo | kpop | `Jo Yu-ri`, `JO YURI`, `조유리`, `曺柔理` | former IZ*ONE solo + actor，broadcast / release / fan event 搜尋需求 | concert, festival, broadcast, media, brand_event | WAKEONE official profile、官方 SNS、售票頁、主辦單位 | WAKEONE official JP artist page 可見；若 DB 已有 WAKEONE 來源，可後續合併來源盤點 |

## 4. 驗證規則

- 不得只靠記憶填 agency。
- 每位藝人 seed 前至少查 1-2 個可靠來源確認目前 agency / 活動狀態。
- 優先來源順序：official profile / agency notice / official SNS / reputable news；Kprofiles、Kpop Wiki、Wikipedia 可當輔助，不可單獨作最終依據。
- 若 agency 不確定，在 migration 前標記「需再查證」，不要硬填。
- 不要靠 LLM 判斷 active / inactive。
- 找不到官方來源不代表不活躍；只代表 source confidence 低或需人工補查。
- 預設候選可以收，但真正 seed 前需再人工確認。
- 需先用現有 `idols.slug` 檢查是否已存在，避免重複 seed。

## 5. 後續拆分建議

- PR A：migration seed 10-20 位藝人。
  - 先挑 P0 中 agency 確認度高者。
  - BIBI 若 DB 已存在則跳過或只補 aliases，不重複新增。
  - Kwon Eunbi / Lee Mujin / 10CM / YENA 若 agency 尚未確認，先不進第一批 migration。
- PR B：補 alt_names。
  - 若已有藝人但 aliases 不足，獨立處理，避免 seed PR 同時做太多事。
- PR C：來源盤點 / crawler 工作單。
  - 先挑 official site / agency notice / ticketing 中免登入、格式穩定的來源。
  - Jay Park official site、INB100、WAKEONE、MORE VISION、P NATION 可列優先探測。
- PR D：popup / brand_event / exhibition 相關來源。
  - 等「中文顯示 + 快閃店資料模型」完成後再接，避免先把快閃店塞進錯誤 event type。

## 6. 與現有排程的關係

建議順序：

1. 先完成「中文標題 + 活動類型 + 快閃店資料模型」的 migration / UI 拆分。
2. 再依本工作單執行 PR A seed 第一批主流漏網藝人。
3. 再依來源可爬性拆 PR C crawler 工作單。
4. YouTube / 主流串流平台 / 快閃店 / brand collaboration 來源先進來源盤點，不急著直接接 crawler。

## 7. 本輪不做

- 不新增 migration。
- 不修改 DB。
- 不修改 UI。
- 不新增 crawler。
- 不修改 package。
- 不碰 `.env.local`。
- 不提交 `.claude/`、`.next/`、`node_modules/`。
