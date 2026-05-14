'use client'

import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_SUBTYPE_LABELS,
  type EventType,
  type EventSubType,
} from '@/lib/mockEvents'
import clsx from 'clsx'

interface EventTypeBadgeProps {
  type: EventType
  subType?: EventSubType
  size?: 'sm' | 'md'
}

export default function EventTypeBadge({ type, subType, size = 'sm' }: EventTypeBadgeProps) {
  const label = subType ? EVENT_SUBTYPE_LABELS[subType] : EVENT_TYPE_LABELS[type]

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 font-medium',
        EVENT_TYPE_COLORS[type],
        size === 'sm' ? 'py-0.5 text-xs' : 'py-1 text-sm',
      )}
    >
      {label}
    </span>
  )
}
