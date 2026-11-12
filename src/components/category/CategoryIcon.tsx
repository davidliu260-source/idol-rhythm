import { Mic, Heart, ShoppingBag, Coffee, Image as ImageIcon, Ticket, Ellipsis, LayoutGrid, type LucideIcon } from 'lucide-react'
import type { CategoryGlyphId } from '@/lib/eventCategory'

interface Props {
  category: CategoryGlyphId
  size?: number
  strokeWidth?: number
  className?: string
}
const ICONS: Record<CategoryGlyphId, LucideIcon> = {
  concert: Mic, fanmeet: Heart, popup: ShoppingBag, cafe: Coffee,
  exhibition: ImageIcon, ticket: Ticket, other: Ellipsis, all: LayoutGrid,
}
export default function CategoryIcon({ category, size = 16, strokeWidth = 1.9, className }: Props) {
  const Icon = ICONS[category]
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" focusable="false" />
}
