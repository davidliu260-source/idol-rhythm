'use client'

import { useEffect, useState } from 'react'
import { formatTaipeiDateLabel } from '@/lib/taipeiDate'

/**
 * 首頁日期標籤。首頁改 ISR 後，HTML 是最多 5 分鐘前（冷門時段可能更久）產生的，
 * 所以伺服器算好的日期可能是昨天。第一次繪製沿用伺服器文字（避免 hydration 不一致），
 * 掛載後立刻改成瀏覽器當下的台北日期。
 */
export default function HomeDateLabel({ initialLabel }: { initialLabel: string }) {
  const [label, setLabel] = useState(initialLabel)
  useEffect(() => {
    setLabel(formatTaipeiDateLabel(new Date()))
  }, [])
  return <p className="text-[14px] leading-[1.5] text-[#a09db4]">{label}</p>
}
