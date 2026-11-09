import type { Event } from '@/lib/types'

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

function foldLine(line: string): string {
  const chunks: string[] = []
  let chunk = ''
  let octets = 0

  for (const character of line) {
    const size = new TextEncoder().encode(character).length
    if (octets + size > 75) {
      chunks.push(chunk)
      chunk = ` ${character}`
      octets = 1 + size
    } else {
      chunk += character
      octets += size
    }
  }
  chunks.push(chunk)
  return chunks.join('\r\n')
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10).replace(/-/g, '')
}

export function buildIcs(idolName: string, events: Event[], origin: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Idol Rhythm//ZH-TW',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`${idolName} 行程｜星動時刻`)}`,
  ]

  for (const event of events) {
    const start = event.startDate ?? event.date
    const end = addDays(event.endDate ?? start, 1)
    const location = [event.venueName, event.location, event.city]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' / ')
    const description = [
      event.time ? `時間（當地時間）：${event.time}` : undefined,
      location ? `地點：${location}` : undefined,
      `來源等級：${event.source.level === 'official' ? '官方' : '媒體'}`,
      `來源名稱：${event.source.label}`,
      `活動頁：${origin}/events/${event.id}`,
    ]
      .filter(Boolean)
      .join('\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@idol-rhythm`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeText(event.title)}`,
      ...(location ? [`LOCATION:${escapeText(location)}`] : []),
      `DESCRIPTION:${escapeText(description)}`,
      `URL:${origin}/events/${event.id}`,
      `STATUS:${event.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
