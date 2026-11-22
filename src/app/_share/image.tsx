import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { truncateText } from '../../lib/seo/metadata'
import { truncateShareTitle } from './title'

type ShareCard = {
  title: string
  subtitle?: string
  date?: string
  place?: string
  accent: string
}

let font: Promise<Buffer> | undefined

export const dynamicShareImageHeaders = {
  'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
}

const brandCard: ShareCard = {
  title: '星動時刻',
  subtitle: 'Idol Rhythm',
  date: '韓流偶像台灣行程',
  accent: '#F36FB9',
}

function cleanImageText(value: string) {
  // next/og otherwise renders emoji as remotely loaded SVGs.
  return value
    .replace(/[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200D\uFE0F]/gu, '')
    .replace(/\s+/g, ' ').trim()
}

function imageText(value: string, limit: number) {
  return truncateText(cleanImageText(value), limit)
}

export async function shareImage(size: { width: number; height: number }, card = brandCard, headers?: HeadersInit) {
  font ??= readFile(join(process.cwd(), 'assets/fonts/NotoSansTC-Bold-subset.otf')).catch(error => {
    font = undefined
    throw error
  })
  const data = await font
  const { accent } = card
  return new ImageResponse(
    (
      <div lang="zh-TW" style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        width: '100%', height: '100%', position: 'relative', padding: '76px 88px',
        color: '#fff', backgroundColor: '#07070f', fontFamily: 'Noto Sans TC', fontWeight: 700,
        backgroundImage: `radial-gradient(circle at 89% 37%, ${accent}55, transparent 49%), radial-gradient(circle at 98% 100%, #7541BC70, transparent 58%)`,
      }}>
        <div style={{ display: 'flex', position: 'absolute', right: -92, top: 69, width: 454, height: 454, borderRadius: 227, border: `3px solid ${accent}75` }} />
        <div style={{ display: 'flex', position: 'absolute', right: -48, top: 114, width: 364, height: 364, borderRadius: 182, border: `2px solid ${accent}50` }} />
        <div style={{ display: 'flex', position: 'absolute', right: 134, top: 96, width: 26, height: 26, transform: 'rotate(45deg)', backgroundColor: accent }} />
        <div style={{ display: 'flex', width: 76, height: 6, backgroundColor: accent, borderRadius: 3, marginBottom: 24 }} />
        <div style={{
          fontSize: card === brandCard ? 100 : 65, maxWidth: 910, lineHeight: 1.16,
          lineClamp: 2, overflow: 'hidden', wordBreak: 'break-word',
        }}>{truncateShareTitle(cleanImageText(card.title))}</div>
        {card.subtitle && <div style={{ fontSize: 43, marginTop: 16, color: '#F7DDEF', maxWidth: 900, lineClamp: 1, overflow: 'hidden' }}>{imageText(card.subtitle, 68)}</div>}
        {card.date && <div style={{ fontSize: 30, marginTop: 20 }}>{imageText(card.date, 34)}</div>}
        {card.place && <div style={{ fontSize: 28, marginTop: 6, maxWidth: 900, lineClamp: 1, overflow: 'hidden' }}>{imageText(card.place, 64)}</div>}
        {card !== brandCard && <div style={{ position: 'absolute', right: 82, bottom: 49, fontSize: 23, color: '#F7DDEF' }}>星動時刻 Idol Rhythm</div>}
      </div>
    ),
    { ...size, fonts: [{ name: 'Noto Sans TC', data, weight: 700 }], headers },
  )
}
