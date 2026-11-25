/**
 * T35 A-5：售票平台表。
 * 這張表是「連結是否在官方售票平台」與前台平台徽章的唯一來源；之後加平台只改這個檔。
 *
 * verified = true ：網域已有台灣場資料支持，會參與官方網域判斷。
 * verified = false：香港／新加坡／馬來西亞候選，**未驗證，待 HK/SG/MY 資料補齊票確認網域後
 *                   才啟用警示判斷**。未驗證的平台不算官方網域（isOfficialTicketUrl 回 false），
 *                   但也不會被標成「非已知官方售票平台」（避免對尚未查證的平台誤報）。
 *
 * prerequisite 只寫來源有明講的平台（拓元、KKTIX 手機驗證：AAA 台北場購票須知），其他留空，不要推測。
 */
export interface TicketPlatform {
  code: string
  name: string
  countries: readonly string[]
  /** 網域本身與其所有子網域都算（例：kktix.cc 涵蓋 *.kktix.cc）。 */
  domains: readonly string[]
  prerequisite?: string
  verified: boolean
}

export const TICKET_PLATFORMS: readonly TicketPlatform[] = [
  { code: 'tixcraft', name: '拓元售票', countries: ['TW'], domains: ['tixcraft.com'], prerequisite: '購票前須先完成拓元會員的手機號碼驗證。', verified: true },
  { code: 'kktix', name: 'KKTIX', countries: ['TW'], domains: ['kktix.com', 'kktix.cc'], prerequisite: '購票前須先完成 KKTIX 會員的手機號碼驗證。', verified: true },
  { code: 'ibon', name: 'ibon 售票', countries: ['TW'], domains: ['ticket.ibon.com.tw'], verified: true },
  { code: 'era', name: '年代售票', countries: ['TW'], domains: ['ticket.com.tw'], verified: true },
  { code: 'kham', name: '寬宏售票', countries: ['TW'], domains: ['kham.com.tw'], verified: true },
  { code: 'ticketplus', name: 'Ticket Plus 遠大售票', countries: ['TW'], domains: ['ticketplus.com.tw'], verified: true },
  { code: 'klook', name: 'Klook', countries: ['TW', 'HK', 'SG', 'MY'], domains: ['klook.com'], verified: true },
  { code: 'weverse', name: 'Weverse', countries: ['TW', 'HK', 'SG', 'MY'], domains: ['weverse.io'], verified: true },
  // ── 以下為候選：未驗證，待 HK/SG/MY 資料補齊票（T38）確認網域後才啟用警示判斷 ──
  { code: 'cityline', name: 'Cityline', countries: ['HK'], domains: ['cityline.com'], verified: false },
  { code: 'hkticketing', name: 'HK Ticketing 快達票', countries: ['HK'], domains: ['hkticketing.com'], verified: false },
  { code: 'urbtix', name: 'URBTIX 城市售票網', countries: ['HK'], domains: ['urbtix.hk'], verified: false },
  { code: 'sistic', name: 'SISTIC', countries: ['SG'], domains: ['sistic.com.sg'], verified: false },
  { code: 'ticketmaster', name: 'Ticketmaster', countries: ['SG', 'MY'], domains: ['ticketmaster.sg', 'ticketmaster.com.my'], verified: false },
  { code: 'ticket2u', name: 'Ticket2U', countries: ['MY'], domains: ['ticket2u.com.my'], verified: false },
]

export type TicketUrlStatus = 'official' | 'unverified_platform' | 'unknown' | 'invalid'

export function platformByCode(code: string | null | undefined): TicketPlatform | null {
  const key = code?.trim().toLowerCase()
  return key ? TICKET_PLATFORMS.find(p => p.code === key) ?? null : null
}

function hostOf(url: string | null | undefined): string | null {
  const value = url?.trim()
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.hostname.toLowerCase().replace(/\.$/, '') || null
  } catch {
    return null
  }
}

/** 只接受 http(s) 連結。 */
export function isHttpUrl(url: string | null | undefined): boolean {
  return hostOf(url) !== null
}

/**
 * 依網域找平台（含未驗證候選）。比對嚴格：必須等於平台網域，或是它的子網域
 * （以「.」為界），所以 evil-tixcraft.com、tixcraft.com.evil.io 都不會命中。
 */
export function platformForUrl(url: string | null | undefined): TicketPlatform | null {
  const host = hostOf(url)
  if (!host) return null
  return TICKET_PLATFORMS.find(p => p.domains.some(d => host === d || host.endsWith(`.${d}`))) ?? null
}

/** 只有 verified 平台的網域才算官方售票網域。 */
export function isOfficialTicketUrl(url: string | null | undefined): boolean {
  return platformForUrl(url)?.verified === true
}

export function ticketUrlStatus(url: string | null | undefined): TicketUrlStatus {
  if (!isHttpUrl(url)) return 'invalid'
  const platform = platformForUrl(url)
  return !platform ? 'unknown' : platform.verified ? 'official' : 'unverified_platform'
}

export const UNKNOWN_TICKET_PLATFORM_LABEL = '非已知官方售票平台'

/** 前台／後台共用：連結不在平台表時回傳警示文字，否則 null。未驗證候選平台不警示。 */
export function unknownTicketPlatformWarning(url: string | null | undefined): string | null {
  return ticketUrlStatus(url) === 'unknown' ? UNKNOWN_TICKET_PLATFORM_LABEL : null
}
