'use client'

import { SOURCE_CONFIG, type TrustLevel } from '@/lib/mockEvents'
import clsx from 'clsx'

interface SourceBadgeProps {
  source: TrustLevel
  label?: string
  showDesc?: boolean
  size?: 'sm' | 'md'
}

export default function SourceBadge({
  source,
  label,
  showDesc = false,
  size = 'sm',
}: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source]

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span
          className={clsx(
            'inline-block rounded-full flex-shrink-0',
            cfg.dot,
            size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
          )}
        />
        <span
          className={clsx(cfg.color, 'font-medium', size === 'sm' ? 'text-xs' : 'text-sm')}
        >
          {cfg.label}
        </span>
        {label && (
          <span
            className={clsx('text-muted truncate max-w-[120px]', size === 'sm' ? 'text-xs' : 'text-sm')}
          >
            · {label}
          </span>
        )}
      </div>
      {showDesc && <p className="text-xs text-muted pl-3">{cfg.desc}</p>}
    </div>
  )
}
