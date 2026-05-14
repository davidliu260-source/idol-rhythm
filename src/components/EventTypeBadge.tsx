'use client'

import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  type EventType,
} from '@/lib/mockEvents'
import clsx from 'clsx'

interface EventTypeBadgeProps {
  type: EventType
  size?: 'sm' | 'md'
}

export default function EventTypeBadge({ type, size = 'sm' }: EventTypeBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 font-medium',
        EVENT_TYPE_COLORS[type],
        size === 'sm' ? 'py-0.5 text-xs' : 'py-1 text-sm',
      )}
    >
      {EVENT_TYPE_LABELS[type]}
    </span>
  )
}
