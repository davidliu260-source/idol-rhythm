export function isSameOriginRequest(headers: Headers, url: string): boolean {
  const fetchSite = headers.get('sec-fetch-site')
  if (fetchSite !== null && fetchSite !== 'same-origin' && fetchSite !== 'none') return false

  const origin = headers.get('origin')
  if (origin === null) return true
  try {
    return new URL(origin).host === new URL(url).host
  } catch {
    return false
  }
}
