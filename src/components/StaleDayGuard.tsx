'use client'

import { useEffect } from 'react'
import { taipeiToday } from '@/lib/taipeiDate'

const RELOAD_DELAY_MS = 3000

/**
 * ISR 頁面（首頁、行事曆）的 HTML 可能是前一天產生的：Vercel 會先回舊頁面、同時在背景重新產生，
 * 所以每天台北午夜後的第一位訪客（或夜間沒流量後的第一位）會拿到舊頁面，
 * 裡面的「今天」「明天開賣」「進行中」「本週條」都是以前一天為準。
 *
 * 做法：伺服器把「這份 HTML 是哪一天產生的」傳進來；掛載後若和瀏覽器的台北今天不同，
 * 等 3 秒（讓背景重新產生完成）自動重新整理一次。同一天、同一個分頁最多重新整理一次，避免無限重載。
 * 不讀任何登入資料，不改頁面內容，只負責「過期就重整」。
 */
export default function StaleDayGuard({ generatedDayKey }: { generatedDayKey: string }) {
  useEffect(() => {
    const today = taipeiToday(new Date())
    if (today === generatedDayKey) return

    const flag = `stale-day-reloaded:${today}`
    try {
      if (window.sessionStorage.getItem(flag)) return
      window.sessionStorage.setItem(flag, '1')
    } catch {
      return
    }

    const timer = window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [generatedDayKey])

  return null
}
