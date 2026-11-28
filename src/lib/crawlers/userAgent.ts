/**
 * 對外抓取時使用的 User-Agent。
 *
 * 一律表明是星動時刻的爬蟲，並附上正式網域，方便來源站識別與聯絡。
 * 場館行事曆（高雄巨蛋等）先前使用 Mozilla/5.0 compatible 形式；
 * 為降低被當成異常請求擋住的風險，該來源沿用相容寫法，但仍附上同一組識別。
 */

export const CRAWLER_USER_AGENT_TOKEN = 'idolrhythm-bot'

export const CRAWLER_USER_AGENT = 'idolrhythm-bot/1.0 (+https://idolrhythm.com)'

/** 給需要瀏覽器相容 UA 的來源（目前：場館行事曆）。 */
export const CRAWLER_USER_AGENT_COMPAT =
  `Mozilla/5.0 (compatible; ${CRAWLER_USER_AGENT_TOKEN}/1.0; +https://idolrhythm.com)`
