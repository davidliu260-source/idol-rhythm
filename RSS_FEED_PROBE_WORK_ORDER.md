# RSS Feed Probe Work Order

> **狀態**：📋 工作單（research-only）
> **建立**：2026-05-25
> **作者**：Claude（與使用者 + Gemini 討論後）
> **產出**：本文件為**只研究**規劃，產出 `RSS_FEED_PROBE_REPORT.md`（下一個 PR）；不寫 runtime、不新增 parser_type、不新增 migration、不改 schema / RLS / GRANT、不 seed crawler_sources。

---

## 1. 動機（Why RSS）

`generic_webpage` parser 目前對所有來源都走「fetch HTML → cheerio 清理 → Claude Haiku 解析」路徑。這條路對 Verdict A 來源能用，但有兩個結構性成本：

1. **Token 成本**：每次 fetch 都送 ~8000 字進 Claude，maxHtmlBytes=500KB 上限下平均一次 query 落在 $0.001–0.003 之間（Haiku）。8 個 generic_webpage active source × 每日 cron = 240 calls/月 = 不大但會累積。
2. **DOM 脆弱性**：站方改 layout（HTML class / wrapper / spinner timing）會直接讓 Claude 解析變差，沒明顯錯誤訊號，需要 drift diff 才看得出。

**RSS / Atom feed 的吸引力：**
- **結構化 XML**：title / link / pubDate / description 都在固定欄位，不需 AI 推論
- **token 零成本**：xml2js / fast-xml-parser 純解析
- **DOM 變動免疫**：feed schema 是 spec（RSS 2.0 / Atom 1.0），站方換 theme 不會破壞 feed
- **WordPress 預設開啟**：`/feed/` 或 `/?feed=rss2` 幾乎所有 WP 站都有（除非站長手動關閉）
- **rate limit 友善**：CDN 通常會 cache feed 路徑

如果 80% 的 WordPress 來源都有可用 feed，我們可以把這些來源的 `parser_type` 從 `generic_webpage` 切到 `wordpress_rss`（新建），節省 token 成本 + 提高穩定性。

---

## 2. 目標與範圍

### 2.1 目標
- **驗證假設**：「我們目前依賴的 WordPress 系 generic_webpage 來源，多數有可用 RSS feed」
- **產出證據**：每個來源的 feed URL 是否存在、回應大小、含活動數量、與 generic_webpage Preview 結果對比
- **決策輸入**：是否值得開發 `wordpress_rss` parser_type 與 runtime（**不在本工作單範圍**）

### 2.2 範圍（要做）

| # | 內容 |
|---|---|
| A | 對既有 crawler_sources（is_active 與否皆可）的 WordPress / 疑似 WordPress 站點，curl 探測常見 feed 路徑 |
| B | 對命中的 feed 抽樣解析 5 筆 item，比對 title / link / pubDate 是否乾淨 |
| C | 對非 WordPress 但 server-rendered 的站，順便探測 RSS / Atom 是否被站長自製（例如 Next.js + custom `/feed.xml`）|
| D | 產出 `RSS_FEED_PROBE_REPORT.md`：每來源一行，verdict A/B/C |
| E | 結論：「值得 / 不值得開 wordpress_rss parser」+ 若值得，列出 v1 應收的來源清單 |

### 2.3 範圍（不做）

| 不做 | 原因 |
|---|---|
| 寫 `wordpress_rss` parser | 等本探測 verdict 通過後另開 runtime 工作單 |
| 新增 parser_type enum / migration | 同上 |
| 接 cron / sync-all | 同上 |
| seed 新 crawler_sources | 同上；本工作單只探測既有來源 + 少量新候選 |
| 修改既有 generic_webpage 行為 | 探測結果不影響現有 runtime |
| 探測登入後 feed（如 Patreon、Weverse fanclub）| 違反「不繞 auth」原則 |
| 研究 social feed（Twitter / Instagram RSS）| 帶反爬 + ToS 問題，另開工作單 |

---

## 3. 探測目標清單

### 3.1 高優先（既有 generic_webpage / WordPress 已確認）

| 來源 | source_key | Domain | 已知狀態 |
|---|---|---|---|
| WAKEONE（共享 notice）| `*-wakeone-notice` (×4) | wake-one.com | WordPress 確認；目前 `wakeone_notice` HTML parser |
| (G)I-DLE Cube News | `generic-gidle-cube-news` | cube-ent.com/en/news | 疑似 WP/CMS |
| Dynamicduo / Amoeba | `generic-dynamicduo-amoeba` | amoebaculture.com | 疑似 PHP/CMS |
| YG notice | `generic-blackpink-yg-notice` | ygfamily.com | 疑似 CMS |
| N.Flying JP | `generic-nflying-jp` | nflying.jp 或類似 | 待確認平台 |
| BLISSOO (JISOO) | `generic-jisoo-blissoo` | blissoo.com | PHP/WordPress 確認 |
| VLAST (PLAVE) | `generic-plave-vlast` | vlast.com/plave | WordPress 確認 |

### 3.2 中優先（其他既有來源，順便探測）

| 來源 | Domain | 預期 |
|---|---|---|
| Jay Park | jaypark.com | Next.js — 可能無 RSS，但有些 Next.js 站有 `/feed.xml` |
| Dean (you.will.knovv) | youwillknovv.com | imweb — imweb 是否有 RSS？未知 |
| SMTOWN notice | smtown.com/notice | 自製平台 — 不太可能有 RSS |
| JYP schedule | jyp.com（已走 JSON API）| 不適用，已有更好的 endpoint |

### 3.3 低優先 / 候選新來源（順手探測，不寫入工作單範圍）

| 來源 | Domain | 目的 |
|---|---|---|
| kpopofficial.com | kpopofficial.com | 已是 active 聚合來源；如有 RSS 可降低 cost |
| K-pop label WP 標準站 | mystic89.kr / pnation 等 | 確認 WP 站 default feed 存在性 |

---

## 4. 探測路徑（每個 domain 嘗試的 URL）

### 4.1 WordPress 標準路徑

| Path | 命中時意義 |
|---|---|
| `/feed/` | WP 預設 RSS 2.0 feed |
| `/feed/atom/` | WP 預設 Atom feed |
| `/?feed=rss2` | WP 預設（permalink 關閉時）|
| `/comments/feed/` | 評論 feed（不要）|
| `/category/{slug}/feed/` | 分類 feed（更精準，需先知道分類 slug）|

### 4.2 Custom / Non-WP 常見路徑

| Path | 命中時意義 |
|---|---|
| `/rss` `/rss.xml` `/feed.xml` `/atom.xml` | 自製 feed 常見命名 |
| `/news/feed` `/notice/feed` | 子路徑 feed（例如 WAKEONE 可能有）|
| `/sitemap.xml` | 不是 feed 但可看 site 結構 |
| `<link rel="alternate" type="application/rss+xml">` 在首頁 `<head>` | 自動探測：解析首頁 HTML 找這個 link tag |

### 4.3 探測順序（每個 domain）

1. 先 curl 首頁，grep `application/rss+xml` 與 `application/atom+xml` 在 `<head>`（最權威）
2. 若無發現，按 4.1 → 4.2 順序試
3. 每個 URL 間 sleep 2s，避免被當作壓力測試

---

## 5. 探測方法（Methodology）

### 5.1 工具

- `curl`（透過 `rtk proxy` 繞過本機 hook）
- `grep` / `sed` 抽取
- 不寫 Node script，shell 即可

### 5.2 抽樣解析

對每個命中的 feed：
- 用 `curl` 抓全文存 `/tmp/rss_{slug}.xml`
- 觀察 `<item>` 數量
- 抽 5 筆，列 title / link / pubDate
- 評估標題是否含活動關鍵字（tour / concert / live / 콘서트 / 공연 / show / event / fan meeting / 팬미팅）

### 5.3 Verdict 標準

| Verdict | 條件 | 行動 |
|---|---|---|
| **A — 可用** | feed 存在 + 內容含活動 + ≥5 items + pubDate 格式合規 | 列入 v1 `wordpress_rss` 來源候選 |
| **B — 部分可用** | feed 存在但內容稀疏（<5 items）或多為 MV / 一般公告 | 標註後續觀察；不列 v1 |
| **C — 不可用** | feed 不存在 / 回 404 / 回 SPA shell / 回非 XML | 排除，保留 generic_webpage |
| **D — Auth 需求** | feed 需登入 / cookie / token | 排除，違反原則 |

---

## 6. 探測腳本範例（給下一個 PR 參考）

```bash
rtk proxy bash <<'EOF'
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

probe_feed() {
  local label="$1"
  local domain="$2"

  echo "=== $label ($domain) ==="

  # Step 1: detect <link rel="alternate" type="application/rss+xml">
  curl -sSL -A "$UA" --max-time 10 "$domain" -o /tmp/rss_home.html
  echo "Auto-discovery links in <head>:"
  grep -iE 'rel="alternate"[^>]*(rss|atom)' /tmp/rss_home.html | head -5

  # Step 2: try standard WP feed paths
  for path in "/feed/" "/feed/atom/" "/?feed=rss2" "/rss" "/rss.xml" "/feed.xml" "/atom.xml"; do
    url="${domain}${path}"
    result=$(curl -sSL -A "$UA" -o /tmp/rss_test.xml -w "%{http_code} %{size_download}" --max-time 10 "$url" 2>&1)
    content_type=$(curl -sI -A "$UA" --max-time 10 "$url" | grep -i "content-type" | tr -d '\r')
    is_xml=$(head -c 200 /tmp/rss_test.xml | grep -ciE "<rss|<feed|<\?xml" || echo 0)
    items=$(grep -c "<item>" /tmp/rss_test.xml 2>/dev/null || echo 0)
    printf "  %-20s → %s | xml=%s items=%s | %s\n" "$path" "$result" "$is_xml" "$items" "$content_type"
    sleep 2
  done
  echo
}

probe_feed "WAKEONE"       "https://wake-one.com"
probe_feed "BLISSOO"       "https://blissoo.com"
probe_feed "VLAST"         "https://vlast.com"
probe_feed "Cube"          "https://www.cube-ent.com"
probe_feed "Amoeba"        "https://www.amoebaculture.com"
probe_feed "YG"            "https://www.ygfamily.com"
probe_feed "Jay Park"      "https://www.jaypark.com"
probe_feed "you.will.knovv" "https://www.youwillknovv.com"
EOF
```

---

## 7. 預期成果（給下一個 PR 的 Report Template）

`RSS_FEED_PROBE_REPORT.md` 應該包含：

```markdown
# RSS Feed Probe Report

## Summary
- N domains probed
- A: X (good RSS available)
- B: Y (partial / sparse)
- C: Z (no usable RSS)

## Per-Source Findings

### WAKEONE (wake-one.com)
- **Verdict**: A
- Feed URL: https://wake-one.com/feed/
- HTTP 200, 45KB, 10 items
- Sample items:
  1. "ZEROBASEONE [TIMELESS WORLD] in Manila announcement" (2026-05-20)
  2. ...
- Recommendation: 列入 v1 wordpress_rss

### BLISSOO (blissoo.com)
- ...

## V1 Recommended Sources (Verdict A only)
| source_key | current parser | proposed parser | feed URL |
|---|---|---|---|
| ...

## V1 Rejection List (Verdict C/D)
| source_key | reason |
|---|---|
| ...

## Cost-Benefit Analysis
- Estimated monthly Claude tokens saved: ~X
- Maintenance reduction: Y
- New code surface: parser ~150 LOC + tests
```

---

## 8. Acceptance Criteria（給 GPT audit 的 checklist）

- [ ] 工作單**只研究**，明確聲明不寫 runtime / parser / migration / seed
- [ ] 範圍清楚：哪些來源探、哪些不探
- [ ] 方法可重現：腳本可直接複製貼上跑
- [ ] Verdict 標準明確：A/B/C/D 各有量化條件
- [ ] 後續路徑清楚：probe report → 下一個 runtime 工作單 → 實作 PR
- [ ] 安全邊界：不繞 auth、不爬登入後內容、不壓測（2s sleep）
- [ ] 對既有 architecture 無侵入性：generic_webpage runtime / cron / event_candidates / RLS 完全不動

---

## 9. 風險與不確定性

| 風險 | 緩解 |
|---|---|
| 部分 WP 站長手動關閉 `/feed/` | 探測後 verdict C，不勉強 |
| Feed 內容是「全文 RSS」過大（>500KB）| 增加 `MAX_FEED_BYTES` 上限 + truncate（runtime 階段處理）|
| Feed 命中但內容是「最近 10 篇」而非「最近 10 場活動」 | 由 idolMatcher + event keyword filter 處理（沿用 generic_webpage 的策略），不在本工作單範圍 |
| RSS 標準有 RSS 0.91 / 1.0 / 2.0 / Atom 1.0 變體 | runtime 用 fast-xml-parser 抽 title/link/pubDate 通吃；本工作單只要驗證 XML 是 valid feed |
| 站方 feed 內容只有 metadata 沒有 description | 接受；至少 title + link + date 即可進 event_candidates |

---

## 10. 後續路徑（Probe 通過後）

1. **本工作單 PR merge** → 探測 PR（report）寫出
2. **若 ≥3 Verdict A**：開 `WORDPRESS_RSS_RUNTIME_WORK_ORDER.md` 規劃 parser
3. **若 0 Verdict A**：放棄此方向，記錄到「不要重複嘗試」清單
4. **若 1–2 Verdict A**：判斷值不值得為這幾個來源單獨開 runtime；可能改成「sample-of-one」實驗

---

## 11. 與其他工作單的關係

| 工作單 | 關係 |
|---|---|
| `CLAUDE_WEBPAGE_DISCOVERY_WORK_ORDER.md` | RSS 是它的補集；同來源若 RSS 可用，優先 RSS（cheaper） |
| `SEARCH_DISCOVERY_WORK_ORDER.md` | 無關；Search Discovery 是發現 URL，RSS 是抓內容 |
| `STREAMING_VIDEO_SOURCE_WORK_ORDER.md` | 無關；YouTube 有自己的 API |
| 未來的 `WORDPRESS_RSS_RUNTIME_WORK_ORDER.md` | 本工作單通過後才會出現 |

---

**End of work order. Next PR: `RSS_FEED_PROBE_REPORT.md` (curl 實測 + verdict)。**
