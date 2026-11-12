import type { CSSProperties } from 'react'
import type { CategoryGlyphId } from '@/lib/eventCategory'

interface Props { category: CategoryGlyphId; className?: string; style?: CSSProperties }
export default function CategoryMotif({ category, className, style }: Props) {
  if (category === 'other' || category === 'all') return null
  return <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true" focusable="false" className={className} style={{ WebkitMaskImage: 'linear-gradient(225deg, #000 25%, transparent 80%)', maskImage: 'linear-gradient(225deg, #000 25%, transparent 80%)', ...style }}>
    {category === 'concert' && [18, 38, 58, 78, 98, 118].map((r, i) => <circle key={i} cx="150" cy="60" r={r} />)}
    {category === 'popup' && Array.from({ length: 10 }, (_, k) => <path key={k} d={`M${k * 26 - 30} 200L${k * 26 + 170} 0`} />)}
    {category === 'fanmeet' && <><circle cx="85" cy="105" r="62" /><circle cx="135" cy="105" r="62" /><circle cx="110" cy="105" r="6" fill="currentColor" stroke="none" /></>}
    {category === 'cafe' && <>{[86, 62, 38, 14].map((r, i) => <path key={i} d={`M${100 - r} 95A${r} ${r} 0 0 0 ${100 + r} 95`} />)}<path d="M14 95H186" /></>}
    {category === 'exhibition' && [22, 52, 82].map((s, i) => <rect key={i} x={s} y={s} width={200 - 2 * s} height={200 - 2 * s} rx="3" />)}
    {category === 'ticket' && <><path d="M20 55h160v36a9 9 0 0 0 0 18v36H20v-36a9 9 0 0 0 0-18Z" /><path d="M132 55v90" strokeDasharray="4 6" /></>}
  </svg>
}
