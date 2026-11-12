import type { CSSProperties, ReactNode } from 'react'
import type { CategoryGlyphId } from '@/lib/eventCategory'

interface Props {
  category: CategoryGlyphId
  size?: number
  className?: string
  style?: CSSProperties
  title?: never
}
const GLYPHS: Record<CategoryGlyphId, ReactNode> = {
  concert: <><rect x="22" y="5" width="20" height="33" rx="10"/><path fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" d="M13 29a19 19 0 0 0 38 0"/><rect x="30" y="49" width="4" height="8"/><rect x="20" y="56" width="24" height="4" rx="2"/><rect fill="#000" opacity={0.24} x="27" y="12" width="10" height="3" rx="1.5"/><rect fill="#000" opacity={0.24} x="27" y="19" width="10" height="3" rx="1.5"/></>,
  popup: <><path fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" d="M21 22a11 11 0 0 1 22 0"/><path d="M9 22h46l-3 36H12z"/><path fill="#000" opacity={0.24} d="M32 31l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></>,
  fanmeet: <><path d="M9 8h46a5 5 0 0 1 5 5v25a5 5 0 0 1-5 5H31L18 55V43H9a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z"/><path fill="#000" opacity={0.24} d="M32 36S19 28.5 19 20.5a6.5 6.5 0 0 1 13-2 6.5 6.5 0 0 1 13 2C45 28.5 32 36 32 36z"/></>,
  cafe: <><path fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" d="M44 27h4a7 7 0 0 1 0 14h-5"/><path d="M8 22h38v14a17 17 0 0 1-17 17h-4A17 17 0 0 1 8 36z"/><rect x="6" y="55" width="44" height="5" rx="2.5"/><path fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" d="M19 5v8M27 8v6M35 5v8"/><path fill="#000" opacity={0.24} d="M27 44S18 38.5 18 32.5a4.5 4.5 0 0 1 9-1.5 4.5 4.5 0 0 1 9 1.5C36 38.5 27 44 27 44z"/></>,
  exhibition: <><rect x="6" y="6" width="52" height="40" rx="5"/><circle fill="#000" opacity={0.24} cx="21" cy="19" r="5"/><path fill="#000" opacity={0.24} d="M10 40l14-15 9 9 8-8 13 14z"/><path fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" d="M22 46l-6 14M42 46l6 14"/></>,
  ticket: <><path d="M5 14a4 4 0 0 1 4-4h46a4 4 0 0 1 4 4v10a8 8 0 0 0 0 16v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V40a8 8 0 0 0 0-16z"/><path fill="none" opacity={0.24} d="M42 14v36" stroke="#000" strokeWidth={3} strokeDasharray="4 4"/><path fill="#000" opacity={0.24} d="M23 24l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></>,
  all: <><rect x="6" y="6" width="23" height="23" rx="7"/><rect x="35" y="6" width="23" height="23" rx="7" opacity={0.5}/><rect x="6" y="35" width="23" height="23" rx="7" opacity={0.5}/><rect x="35" y="35" width="23" height="23" rx="7"/></>,
  other: <><rect x="6" y="11" width="52" height="42" rx="12" /><circle cx="20" cy="32" r="5" fill="#000" opacity={0.24} /><circle cx="32" cy="32" r="5" fill="#000" opacity={0.24} /><circle cx="44" cy="32" r="5" fill="#000" opacity={0.24} /></>,
}
export default function CategoryGlyph({ category, size = 48, className, style }: Props) {
  return <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" className={className} style={style}>{GLYPHS[category]}</svg>
}
