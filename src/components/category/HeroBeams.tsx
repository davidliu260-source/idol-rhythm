import clsx from 'clsx'

interface Props { className?: string; gradientId?: string }
export default function HeroBeams({ className, gradientId = 't30-hero-beam' }: Props) {
  return <svg viewBox="0 0 350 470" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false" className={clsx('pointer-events-none absolute left-0 top-0 h-full w-full', className)}>
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.42} /><stop offset="1" stopColor="#fff" stopOpacity={0} /></linearGradient></defs>
    {[[70, 70], [175, 90], [285, 70]].map(([x, w], i) => <polygon key={i} points={`${x - 6},0 ${x + 6},0 ${x + w},470 ${x - w},470`} fill={`url(#${gradientId})`} />)}
    {[[292, 128, 34, 0.95], [330, 58, 15, 0.8], [252, 218, 17, 0.75]].map(([cx, cy, s, op], i) => <path key={i} d={`M${cx},${cy - s} Q${cx},${cy} ${cx + s},${cy} Q${cx},${cy} ${cx},${cy + s} Q${cx},${cy} ${cx - s},${cy} Q${cx},${cy} ${cx},${cy - s}Z`} fill="#fff" opacity={op} />)}
  </svg>
}
