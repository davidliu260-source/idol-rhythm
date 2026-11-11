# 聚合源自動求證 B 線彙整報告（B-1 → B-7c）

> **日期**：2026-11-11（彙整）；原始探測期間 2026-07-15 ～ 2026-07-16
>
> **性質**：純文件彙整，research-only。未修改 DB、`src/`、schema、migration、RLS、發布邏輯或前台。
>
> **本文件不是新的探測**，不產生新結論；所有數字與判定均取自下列七個 PR 的報告與 PR 說明（PM review）。

---

## 0. 本文件的範圍與來源

這是七張仍 OPEN 的 B 線探測 PR 的報告彙整。**原始完整報告與 raw JSON 仍保留在對應 PR 的分支上**，本文件只收結論、關鍵數字與限制，**不收 raw JSON**。

| PR | 代號 | 原始報告檔（在該 PR 分支） | raw JSON |
|---|---|---|---|
| [#189](https://github.com/davidliu260-source/idol-rhythm/pull/189) | B-1 spike ＋ 封鎖站真瀏覽器探測 | `AGGREGATOR_VERIFICATION_B1_SPIKE_REPORT.md`、`BLOCKED_SITE_BROWSER_PROBE_REPORT.md` | 未入版控（只在當時的 `/tmp`） |
| [#190](https://github.com/davidliu260-source/idol-rhythm/pull/190) | B-1a negative control | `AGGREGATOR_VERIFICATION_B1A_NEGATIVE_CONTROL_REPORT.md` | `AGGREGATOR_VERIFICATION_B1A_RAW/` |
| [#192](https://github.com/davidliu260-source/idol-rhythm/pull/192) | B-6 discovery | `AGGREGATOR_VERIFICATION_B6_DISCOVERY_PROBE_REPORT.md` | `AGGREGATOR_VERIFICATION_B6_RAW/` |
| [#193](https://github.com/davidliu260-source/idol-rhythm/pull/193) | B-6b discovery 重跑 | `AGGREGATOR_VERIFICATION_B6B_DISCOVERY_RERUN_REPORT.md` | `AGGREGATOR_VERIFICATION_B6B_RAW/` |
| [#194](https://github.com/davidliu260-source/idol-rhythm/pull/194) | B-7 兩階段探測 | `AGGREGATOR_VERIFICATION_B7_TWO_STAGE_PROBE_REPORT.md` | `AGGREGATOR_VERIFICATION_B7_RAW/` |
| [#195](https://github.com/davidliu260-source/idol-rhythm/pull/195) | B-7b binding 規則修正 | `AGGREGATOR_VERIFICATION_B7B_BINDING_RULES_FIX_REPORT.md` | `AGGREGATOR_VERIFICATION_B7B_RAW/` |
| [#196](https://github.com/davidliu260-source/idol-rhythm/pull/196) | B-7c 變異量測 | `AGGREGATOR_VERIFICATION_B7C_VARIANCE_REPORT.md` | `AGGREGATOR_VERIFICATION_B7C_RAW/` |

**PR 處理順序**：這七個 PR **先不關閉**。等本文件 PR 合併進 main 後，再逐一關閉（分支保留，作為原始報告與 raw JSON 的查閱來源）。

**背景**：main 已有 `AGGREGATOR_VERIFICATION_B0_PROBE_REPORT.md`、`AGGREGATOR_VERIFICATION_B0C_PROBE_REPORT.md`（#187／#188 已合併）。本文件從 B-1 起接續。

**安全**：本文件不含任何 API key、token 或 `.env` 內容。各輪報告皆聲明 `ANTHROPIC_API_KEY` 只由 `.env.local` server-side 載入，未寫入腳本、報告、raw JSON、console 或 Git；raw JSON 已移除 `encrypted_content`／`encrypted_index`。

---

## 1. 結論先行

1. **整體**：依 #196 PM review，B 線「聚合源自動求證」在**正確性（0 假陽性）與安全性（fail-closed）上已充分驗證，可以有條件進入 B-2 runtime 設計**。剩下的是工程問題（query 聚焦、re-query 策略），不是可行性問題。⚠️ 但 **#196 報告本身明言「不直接授權 runtime」**；PM 的判定是「可進 runtime **設計**」，不是可直接上線。
2. **安全 gate／假陽性**：所有負向樣本都被擋下 —
   - B-1a：5 筆偽造全拒（其中 2 筆有洩題，乾淨戰績 3/5，見 §3）。
   - B-6／B-6b：3 個預期無行程藝人皆回 `NO_EVENTS_FOUND`，未硬掰場次。
   - B-7／B-7b：F1／F2 偽造場次 0/2 放行。
   - B-7c：F1／F2 各跑 3 次，**0/6 放行**；重試不破防。
3. **yield 範圍**（兩階段、單場 verification，12 個真場次）：B-7 8/12 → B-7b 10/12 → B-7c 固定候選三次 **9/12、9/12、7/12**；三次全過的穩定核心 **7/12**，至少一次通過 **9/12**。B-7 與 B-7b 的數字不是對照實驗（檢索非確定性，見 §7），**以 B-7c 的 7–9/12 為準**。
4. **重試效益**：B-7c 三次 union = 9/12 = 單次最佳，**重試救回 0 筆**。主因是死案多為結構性截斷，重試同一 query 必然同樣截斷；runtime 的正解是**針對截斷改 query（聚焦單場）**，不是盲目重試。報告建議 runtime 最多 3 次獨立 verification；更高次數未量測，不能推導其安全性。
5. **主要限制**：
   - **`cited_text` 約 153 字元硬上限**（#193 PM 發現）：長巡演清單型證據物理上裝不下多場日期，整份清單頁的 snippet 只能綁到前一兩場。
   - **檢索非確定性**：同一 query 每次抽到的 citation／domain 不同（B-7c pairwise Jaccard 最低 0.444）。
   - **`max_tokens`**：B-6 的截斷是 config artifact（未記錄的過小上限），B-6b 設 `16384` 後解決；但 discovery 回傳的是可變長度清單，**completeness gate 無論 `max_tokens` 多大都必須保留**。
   - **dynamic filtering 會斷 citation binding**：`web_search_20260209` 預設 caller 0/5 structured citation；必須 `allowed_callers:["direct"]`。
6. **方向**：資料主要在**場館／售票／主辦端**（公開、無封鎖），不在經紀公司官網（#189 真瀏覽器探測）。Scrapling 線建議不投。

---

## 2. #189 B-1 citation binding spike（2026-07-15）

**Verdict**：可進 B-1b migration（條件式），**只採 B-direct evidence contract**；A dynamic 不可作 runtime binding；C basic 作 fallback。

設定：同 B-0c 的 5 筆 candidate（BTS×2、ENHYPEN×2、i-dle×1），三組各 5 request 共 15 個；`claude-sonnet-4-6`、`max_uses=3`、`blocked_domains=["kpopofficial.com"]`。

| 組別 | 設定 | structured citations | cited_text 非空 | 命中 | 假陽性 | 總成本／平均 | 平均 latency |
|---|---|---:|---:|---:|---:|---:|---:|
| A_dynamic | `web_search_20260209` 預設 caller | **0/5** | 0/5 | 5/5 | 0/5 | $0.509239／$0.101848 | 28.731s |
| B_direct | 同上 + `allowed_callers:["direct"]` | **5/5** | 5/5 | 5/5 | 0/5 | **$0.245621／$0.049124** | 9.508s |
| C_basic | `web_search_20250305` | 5/5 | 5/5 | 5/5 | 0/5 | $0.248879／$0.049776 | 9.034s |

- 假設成立：dynamic filtering 的 code-execution caller 是 citation binding 斷裂主因（A、B 只差 `allowed_callers`）。
- B-direct 相較 B-0c：成本 −73.5%、latency −79.6%、searches −64.3%。
- 報告提出 evidence contract 草案（evidence object、source class 規則、deterministic re-check 六項、fail closed 狀態分離、confidence 由 deterministic 計算）。`encrypted_index` 不落庫。

**不可省略的限制／PM 不同意點**：
- ⚠️ **「假陽性 0/5」是空指標**：三輪都用同一批 5 筆真實大型巡演，正確答案本來就全是 CONFIRMED，結構上不可能出現假陽性；fail closed 從未被考驗 → 因此加開 B-1a negative control。
- ⚠️ citation-level 已出現問題：BTS Foxborough 的 Ticketmaster artist landing page snippet 指向 East Rutherford；C-basic Hong Kong 的模型 `SOURCE_URLS` path 與 structured citation 不一致 → 必須 deterministic re-check、canonical URL check。
- ⚠️ 報告 §2.3 Los Angeles 註記寫「第三個 BIGHIT tour URL」，但 §2.5 列的是 SoFi／SoFi／Live Nation，兩處必有一錯（PM 指出，未更正）。
- raw JSON 未入版控（只在 `/tmp`），不可複查。

### 2.1 #189 附加：封鎖站真瀏覽器探測（2026-07-15）

**Verdict**：「封鎖清單」的框架是錯的 → **建議 Scrapling 線（PR #185 工作單）不投**。

| 站 | 結果 | 資料可用性 |
|---|---|---|
| `weverse.io/enhypen/notice` | 導向登入 | ❌ 登入牆 |
| `gidle.cubeent.jp/schedule/` | HTTP 200、完整渲染 | ❌ 最新 2025.04.05，無 2026 行程 |
| `theblacklabel.com` | 載入 | ❌ 維護模式 |
| `ibighit.com/bts/eng/schedule/` | 內建瀏覽器拒絕；Owner 的 Chrome 可進 | ❌ 導向 `/ko/main`，schedule 頁已不存在 |
| `cubeent.co.kr/artist/schedule` | 內建瀏覽器拒絕 | — |

- 核心結論：**進得去也沒用——經紀公司官網自己就沒有這些資料**。63 個零候選黑洞的成因是「官網沒資料」，不是「爬不到官網」。資料在場館／售票／主辦端。
- **真瀏覽器不可作 runtime**：不可自動化、不可部署（Vercel cron 無法驅動桌面瀏覽器）；只是探測／一次性補資料工具。
- 本結論只否決 Scrapling 技術路線，不否決 `SCRAPLING_PROBE_WORK_ORDER.md` 文件本身（保留為歷史紀錄）。
- 下一步建議 B-6 discovery 探測；並強調 **求證 ≠ 發現**：發現無候選可對照、假陽性更危險，必須先探測再實作。
- 註：此報告引用「B-1a 的 17 個 citation … 5/5 精準」；B-1a 實際是 3 真＋5 偽造、17 個 citation，「5/5」應指偽造全拒，以 B-1a 原報告為準。

---

## 3. #190 B-1a negative control（2026-07-15）

**Verdict**：**PASS（contract 會拒絕壞資料）**，可放行 B-1b（PM 判定通過，但附 caveat）。

設定與 B-1 B 組完全相同；3 真 ＋ 5 偽造（記憶體 clone 後改欄位，無 DB 寫入），共 8 request。

| case | 預期 | model verdict |
|---|---|---|
| T1 BTS SoFi／T2 ENHYPEN Macau／T3 i-dle Kai Tak | CONFIRMED | 3/3 CONFIRMED |
| N1 日期偏移／N2 場館置換／N3 藝人置換 | REJECT | CONTRADICTED |
| N4 憑空捏造／N5 日期集合灌水 | REJECT | UNCONFIRMED |

- 8/8 符合預期；17/17 citation `cited_text` 非空；8/8 `completed_with_results`。
- input 131,158／output 3,156／10 searches／**US$0.540814**（平均 $0.067602／candidate）。PM 重算全對。
- N2／N3 用了 2 次搜尋與高 input token → runtime 必須設上限並記錄 provider usage。

**不可省略的限制／PM 不同意點**：
- ⚠️ **N3／N4 洩題，報告未揭露**：兩者的 `raw_title` 仍是原始真事件（N3 寫 i-dle 但 artist 改 aespa；N4 寫 ENHYPEN Macau 但 artist 改 TWICE），候選自相矛盾，模型不需外部求證即可識破 → **乾淨戰績是 3/5（N1／N2／N5），不是 5/5**。這 3 筆恰是最貼近真實失誤型態者，故仍判 PASS。
- ⚠️ **「deterministic 層能獨立擋下每一筆」是論證不是測試**：§3 表是人工比對 cited_text 推理，該層當時**尚無程式碼**。
- ⚠️ N2 唯一佐證是 `onlyhit.us`（可靠度可疑）；本次方向安全（拒絕＝fail-safe），但 source-class allowlist 是關鍵，此類站不可當唯一證據。
- ✅ PM 以唯讀 SELECT 覆核：三筆真候選 `updated_at` 早於探測，確認未寫入 DB。

---

## 4. #192 B-6 discovery probe（2026-07-15）

**Verdict（報告）**：否決進 runtime（discovery contract 不夠安全）。**PM 認為否決過早**。

設定：B-direct、`max_uses=3`、5 個藝人各一 request（不 bundle）、cutoff 2026-07-15 之後；DB 全程零操作。樣本：Red Velvet、MONSTA X（預期有行程）；tripleS、PENTAGON、N.Flying（預期無行程）。

- Red Velvet：1 場 fan-con 核對通過。MONSTA X：前 7 場核對通過，但 `stop_reason=max_tokens` 截斷，模型自稱 10 場、第 8 場只輸出到城市。
- 三個預期無行程藝人皆 `NO_EVENTS_FOUND`，且有可核對的負向證據（Ticketmaster／Live Nation／Songkick 無場次文字）。
- 假陽性 **0/8 個可完整解析場次**。
- input 117,247／output 3,963／11 searches／**US$0.521186**（平均 $0.104237／藝人）；63 黑洞線性估 ≈ US$6.57。

**不可省略的限制／PM 不同意點**：
- ⚠️ **`max_tokens` 實際設定值完全沒有被記錄**（config 區塊缺、raw 只存 response、腳本未入版控）。從 output 1,522 截斷反推約 1.5K，而模型上限遠高於此 → 比較像 config artifact，但無法證實也無法反駁。建議記錄並提高後重跑（→ B-6b）。
- ✅ 報告從截斷得到的結構性洞見是對的：discovery 回傳**可變長度清單**，runtime 需 completeness gate（`stop_reason` 必須 `end_turn`、宣稱場次數等於完整事件陣列長度，不一致 → `provider_error`／fail closed，不得部分落庫）。這條無論 `max_tokens` 多大都成立。
- `NO_EVENTS_FOUND` ≠「世界上沒有活動」，UI 不可顯示成確定無活動。
- 聚合站污染風險仍在（PENTAGON 搜到 Festivaly.eu 但未採信）→ 必須保留 source allowlist／blocklist。
- PM 註記：MONSTA X 是 63 個零候選黑洞之一，本輪找到其 2026-10 北美巡演，佐證「官網沒有、售票端有」。

---

## 5. #193 B-6b discovery 重跑（2026-07-15）

**Verdict（報告）**：通過本輪 probe，建議進下一輪 contract／runtime 設計。**PM 不同意「通過」**。

設定同 B-6，唯一變更：明確 `max_tokens=16384`、prompt 加 `EVENT_COUNT: <n>`；raw 同時保存 request ＋ response。

- 5/5 `stop_reason=end_turn`；MONSTA X `EVENT_COUNT=10`＝parsed＝complete。三個負向控制仍 `NO_EVENTS_FOUND`。
- 報告自報假陽性 0/11。
- input 138,975／output 4,544／12 searches／**US$0.605085**（平均 $0.121017／藝人）；63 黑洞線性估 US$7.624071。
- ✅ 證實 B-6 截斷是 config artifact。

**不可省略的限制／PM 不同意點（本線最關鍵的發現）**：
- ❌ **`cited_text` 有約 153 字元硬上限**：raw 中 13 個 `cited_text` 長度精確為 153、皆以 `...` 截斷。MONSTA X 全部 11 個 citation 中，`San Francisco`、`Seattle`、`Bill Graham`、`Oct. 22`／`10/22` 出現 0 次。
- ❌ 7 個 Ticketmaster citation 中有 6 個是同一段 Fairfax 文字，卻被掛給 Boston、Rosemont、Irving、洛杉磯、舊金山等場次——**該證據完全沒提到這些場次**。違反 B-1 contract §4.2「artist landing page 只有在 cited text 能定位完整場次時才可用」。
- ❌ **報告 evidence 表引用了 raw payload 裡不存在的文字**（Seattle、Toronto 兩列的 cited_text 被補完句子；raw 實際在 153 字元處截斷）。PM 不主張虛構場次（大概率真實存在），但 `cited_text` 正是要落庫的證據欄位，不可補字。
- ❌ **completeness gate 檢查錯了東西**：只驗「每個宣稱場次是否都有 citation」，沒驗「該 citation 的 cited_text 是否真的支持這一場的日期與場館」→ `complete_event_count: 10` 是假的通過；「假陽性 0/11」無法從 payload 佐證。
- 這是結構性限制，與 `max_tokens` 無關。
- **PM 建議方向：兩階段**——階段一 discovery 只找線索（tour-level，**不落庫**）；階段二把每一個日期當成單一 candidate，送進已驗證的 B-direct verification 路徑逐場取證（→ B-7）。

---

## 6. #194 B-7 兩階段探測（2026-07-15）

**Verdict（報告）**：需調整，不進 runtime。**PM 不同意，且指出 4 筆失敗中 2 筆是 PM 規則設計錯誤**。

設定：B-direct、`max_tokens=16384`；階段一沿用 B-6b prompt（discovery citation 只作線索，不作證據）；階段二逐字沿用 B-1／B-1a verification prompt，逐場一 request。階段二 14 筆＝12 真日期 ＋ F1（MONSTA X 10/25 Moda Center）／F2（Red Velvet 8/15 Olympic Hall）偽造。程式化 citation binding assertion：A 日期字面、B 場館字面、C 不得共享 snippet、D A 與 B 由同一 cited_text 完成。

- 階段一：Red Velvet 1 個兩日活動、MONSTA X 10 個日期；三個負向控制 `NO_EVENTS_FOUND`，未進階段二。
- 階段二：模型對 12 真日期皆回 CONFIRMED，但 **A–D 只有 8/12 通過**；4 筆被程式改判 `citation_unbound`、fail closed。
- F1／F2 皆被模型判 CONTRADICTED 且 A–D 擋下，**假陽性 0/2**。
- 引文 raw 完全比對 32/32。
- 成本：階段一 US$0.663712；階段二 14 requests US$0.790503（平均 $0.056464／場）；合計 19 requests、28 searches、**US$1.454215**。63 藝人粗估：只 discovery $8.36；每藝人 1 場 verification ≈ $11.92；6 場 ≈ $29.71（未計 retry）。

**PM 逐筆判讀（不同意點）**：

| 場次 | 失敗原因（PM） |
|---|---|
| Red Velvet 8/1 | **規則 C 誤殺**：中央日報一句話合法涵蓋兩夜連演，A／B／D 全過只掛在 C |
| MONSTA X 10/10 Toronto | **規則 B 過嚴**：證據是場館官網 `greatcanadian.com`（藝人＋精確日期），snippet 不含場館自己的名字 |
| MONSTA X 10/8 Boston | 真失敗：153 字元截斷（snippet 截在 Oct 6） |
| Red Velvet 8/2 | 真失敗：retrieval variance |

- 規則 C 邏輯上多餘：A ∧ B 已要求字面包含這一場的日期與場館；B-6b 那種爛綁定會被 A 直接擋掉 → 建議刪除。
- 規則 B：場館官方 domain 本身即確立場館身分 → 建議 venue-domain 自證（連 B-1 contract §4.2「Venue 必須看到 artist + exact date + venue」一起修）。
- A／B 當時連動評估、失去診斷力 → 建議改為獨立評估後再由 D 檢查同源。
- PM 估修掉兩條規則後 yield ≈ 10/12；剩下的損失是**產出率問題，不是正確性問題**。

---

## 7. #195 B-7b binding 規則修正（2026-07-16）

**Verdict（報告）**：真實 yield 10/12；安全 gate 通過，仍不進 runtime。**PM：10/12 這個數字不成立——本輪不是對照實驗**。

規則變更：刪除 C；A／B 獨立；B 允許保守 venue-domain 自證（allowlist 僅 `greatcanadian.com`，需 URL title 含場館識別詞；Ticketmaster、媒體、主辦 domain 不享豁免）；D 為唯一通過條件。

- F1／F2 仍被拒，**假陽性 0/2**——放寬規則沒有讓偽造場次通過（本票最重要的驗收條件）。
- 三個負向控制仍 `NO_EVENTS_FOUND`；引文 raw 比對 34/34。
- 合計 19 requests、27 searches、**US$1.414530**（verification 平均 $0.056938／場）。

**不可省略的限制／PM 不同意點**：
- ❌ **階段一被重跑，而檢索是非確定性的**：幾乎每一場的 citation 都與 B-7 不同。決定性證據：MONSTA X 10/8 在 B-7 A=False、B-7b A=True，而 **A 是本票完全沒動過的規則** → 8/12 → 10/12 的提升**無法歸因於規則修正**。Red Velvet 8/1、8/2 結果直接對調，也不是規則造成。
- ❌ **venue-domain 自證從未在目標案例上測到**：本輪 Toronto 10/10 整個消失（discovery 重跑後產出畸形候選）。
- ✅ 正面證據：階段一產出畸形候選（venue 欄位塞入括號註解、Toronto 被挪到 10/13 與 Rosemont 撞期），**階段二正確判 CONTRADICTED**——兩階段設計的價值。
- ❌ `failure_classification` 不可信：4 筆失敗全歸 `153_char_truncation`，但 F2 是偽造場次、畸形 Toronto 是 discovery 錯誤，皆與截斷無關。
- 真正發現：**B-7 的 8/12 與 B-7b 的 10/12 都是同一雜訊分布的單次抽樣，不是可比的量測值**；PM 先前預估 ≈10/12 命中是巧合。
- 建議 B-7c：跳過階段一固定候選、同批跑 3 次量變異、補測 Toronto／`greatcanadian.com`、修正失敗分類。

---

## 8. #196 B-7c 變異量測（2026-07-16）

**Verdict**：沿用 B-7b assertion 原封不動、跳過 discovery；14 筆固定候選 × 3 次＝42 個獨立 verification request。安全 gate 通過。**PM：B 線可進 runtime 設計（有條件）**；報告本身不放寬任何規則、不直接授權 runtime。

| run | 真 yield | F1／F2 放行 | provider_error | 成本 USD |
|---:|---:|---:|---:|---:|
| 1 | 9/12 | 0/2 | 0 | 0.801159 |
| 2 | 9/12 | 0/2 | 0 | 0.801207 |
| 3 | 7/12 | 0/2 | 0 | 0.796029 |

- 三次全過（穩定核心）**7/12**；至少一次通過 **9/12**；union＝單次最佳 → **重試救回 0 筆**。
- F1／F2 **0/6 放行**（六次皆 CONTRADICTED）。
- Toronto 10/10：三次皆靠 `greatcanadian.com` venue-domain 自證通過 → **該規則在目標案例上已驗證**。
- 三場三次全敗：MONSTA X 10/8 Fenway、Red Velvet 8/1、8/2。10/22、10/24 為 2/3（retrieval variance）。
- Citation domain 變異：pairwise Jaccard 平均 0.444–1.000。
- 引文 raw 比對 98/98；42 requests、45 searches、**US$2.398395**（$0.057105／run、$0.171314／場三次）。63 藝人各 1 場 × 三次 verification 粗估 US$10.79（未含 discovery）。

**不可省略的限制／PM 判讀**：
- `no_qualifying_source`（9 筆）實際混了兩種病：
  - **153 字元截斷**（MONSTA X 10/8：三次都只撈到 Ticketmaster 清單 `Oct 3…Oct 6 -` 片段，Fenway 永遠被擠出 snippet）→ 結構性，**重試無效**。
  - **同源不同片段**（Red Velvet 8/1、8/2：三次都撈到中央日報，但回的是不含日期的片段）→ retrieval variance，重試理論可救、這輪沒中。
  - 建議 runtime 分開對待。
- 重試在本樣本無效，**不代表策略無用**：runtime 正解是針對截斷改 query（帶入單一場次城市／場館，讓 snippet 聚焦該場），而非撈整份巡演清單；對 `citation_unbound` 可考慮 targeted re-query 或 page fetch（B-2 範疇）。
- 報告建議 runtime 最多 3 次獨立 verification；更高次數未量測，不能推導安全性；每次仍須完整通過 B-7b gate，不能因 retry 放寬規則。
- ⚠️ 報告內部不一致：§9 結論寫「單次 yield 9–10/12」，與 §1／§3 的 9／9／7 不符；PM 逐場重算確認 **9／9／7**，以此為準。
- **前置未解項（PM）**：B-2 寫 `event_sources` 的 service_role 403 權限問題（見 migration 060 檔頭），需先查證 admin 發布路徑用哪個 role。

---

## 9. 保留的 runtime 原則

以下皆取自上述報告原文與 PM review，不新增結論：

1. **Provider 設定**：`web_search_20260209` ＋ `allowed_callers:["direct"]`（B-direct）；dynamic filtering 不可用於 citation binding；`web_search_20250305` basic 僅作 fallback。`blocked_domains` 含 `kpopofficial.com`。
2. **兩階段**：discovery 只產生線索（tour-level），**不落庫**；每一個日期當成單一 candidate 送 verification 逐場取證。
3. **模型 verdict 永遠不是充分條件**：只有 raw `CONFIRMED` 且 deterministic binding 通過（D=true）才算 effective CONFIRMED。
4. **Deterministic re-check**（B-1 contract ＋ B-7b 規則）：artist alias normalization；完整 date set 相符（只容許時區 ±1 日）；venue／city 不衝突；source class 分類與 allowlist；canonical URL；以 canonical URL ＋ normalized cited text 去重。
5. **B-7b binding 規則**：A（日期字面）與 B（場館字面或保守 venue-domain 自證）**獨立評估**；D 要求**同一段 cited_text** 同時滿足 A 與 B；規則 C 已刪除。venue-domain 自證只限保守 allowlist，Ticketmaster／媒體／主辦 domain 不享豁免。
6. **Fail closed**：沒有 structured citation、`cited_text` 空、URL 不可 canonicalize、任一欄位 mismatch、D=false → `citation_unbound`／`field_mismatch`，**維持草稿、不產生 evidence proposal**。
7. **Completeness gate**：`stop_reason` 必須 `end_turn`；`EVENT_COUNT` 必須等於完整解析事件數；任何不一致整筆 `provider_error`／incomplete，不部分採計。此 gate 不可因 `max_tokens` 調大而移除。
8. **狀態分離**：`provider_error`（保存 error code 與 metadata）、`no_match_empty_results`、`pause_turn`／`continuation_failed`、`UNCONFIRMED`／`CONTRADICTED` 各自分開記錄，不可混為 no-match。
9. **失敗分類分開計**：153 字元截斷／檢索變異／事件不存在／discovery 錯誤／無合格來源，不可全部倒進同一桶。
10. **重試**：最多 3 次獨立 verification，每次完整通過 gate；未通過則 fail closed。截斷型失敗應改 query 聚焦單場，而非原樣重試。
11. **可複查**：保留 request ＋ response raw（含 `max_tokens` 等完整 config）、`stop_reason`、`EVENT_COUNT`、逐場 citation；記錄 provider usage 並設上限。
12. **`NO_EVENTS_FOUND` 是保守語義**：只代表「允許來源與 cutoff 下無合格公開場次」，UI 不可顯示成確定沒有活動。

---

## 10. 不要做什麼

- **不要把 discovery citation 當落庫證據**；discovery 只產生候選線索。
- **不要把模型 `CONFIRMED` 直接升 trust 或發布**；必須經 deterministic re-check。
- **不要用人工瀏覽網頁補救** `citation_unbound`，也**不要在報告或落庫欄位中補完被截斷的 `cited_text`**——`cited_text` 必須與 raw 完全相等。
- **不要部分落庫**截斷或不完整的 response。
- **不要讓 artist landing page／整份巡演清單的 snippet 綁定它沒提到的場次**（B-6b Fairfax snippet 掛給舊金山的失敗模式）。
- **不要放寬日期規則 A 或同源規則 D**；不可因 retry 放寬任何規則。
- **不要把聚合站、fan wiki、社群轉貼當唯一證據**；可疑度高的站（如 `onlyhit.us`）也不可單獨採信。
- **不要把單次 yield 當可比量測**；比較規則修正效果必須固定候選、多次量測。
- **不要用 dynamic filtering（預設 caller）做 citation binding**。
- **不要把 `encrypted_index`／`encrypted_content` 落庫或入版控**。
- **不要把真瀏覽器當 runtime**；也**不要再投資源突破經紀公司官網**（Scrapling 線不投）。
- **不要在 UI 把 `NO_EVENTS_FOUND` 顯示成「沒有活動」**。
- 超過 3 次重試的安全性未量測，**不要推導**。
- 本文件與各探測**不授權直接上線 runtime**；B-2 runtime 屬高風險任務，需另寫工作單，並先解決 `event_sources` service_role 權限前置項。
