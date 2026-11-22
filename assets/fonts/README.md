# OG 分享圖字型

- `NotoSansTC-Bold-subset.otf`：從 Noto Sans CJK TC Bold（Debian `fonts-noto-cjk` 的 `NotoSansCJK-Bold.ttc`，第 3 個 face）取出的子集。
- 子集範圍：Big5 符號區（0xA140–0xA3FE）、Big5 常用字（0xA440–0xC67E，5,401 字）、ASCII、常見全形標點。不含 hinting 和 layout features。
- 用途：只給 `next/og` 的 `ImageResponse` 產生 OG 圖時使用，前台網頁不載入。
- 授權：SIL Open Font License 1.1，全文見 `OFL.txt`（來源：https://github.com/notofonts/noto-cjk ）。
- 重新產生的方式：先用 fontTools 把 TTC 的第 3 個 face 存成 `tc-bold.otf`，再執行
  `pyftsubset tc-bold.otf --text-file=chars.txt --output-file=NotoSansTC-Bold-subset.otf --layout-features='' --no-hinting --desubroutinize`
