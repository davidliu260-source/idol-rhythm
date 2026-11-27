import Link from 'next/link'
import type { ReactNode } from 'react'
import { isLegalPlaceholder, type LegalDoc } from '@/lib/legal'
import { parseLegalBlocks, splitLegalInline, type LegalInlinePart, type LegalListItem } from '@/lib/legalMarkdown'

function InlineText({ text }: { text: string }) {
  return (
    <>
      {splitLegalInline(text).map((part, index) => (
        <InlinePartView key={index} part={part} />
      ))}
    </>
  )
}

function InlinePartView({ part }: { part: LegalInlinePart }) {
  if (part.type === 'link') {
    if (part.href.startsWith('/')) {
      return (
        <Link href={part.href} className="text-primary-light underline underline-offset-2">
          {part.text}
        </Link>
      )
    }
    return (
      <a href={part.href} className="text-primary-light underline underline-offset-2" rel="noopener noreferrer">
        {part.text}
      </a>
    )
  }
  if (part.type === 'strong') {
    return (
      <strong className="font-semibold text-text-base">
        <InlineText text={part.text} />
      </strong>
    )
  }
  if (part.type === 'placeholder') {
    return (
      <span className="rounded-sm bg-warn/15 px-0.5 font-medium text-warn" data-legal-placeholder="true">
        {part.text}
      </span>
    )
  }
  return <>{part.text}</>
}

const listClass = {
  ol: 'list-decimal space-y-2 pl-5 text-sm leading-7 text-text-base/80',
  ul: 'list-disc space-y-2 pl-5 text-sm leading-7 text-text-base/80',
} as const

function ListBlock({
  ordered, items, className = '',
}: {
  ordered: boolean
  items: LegalListItem[]
  className?: string
}) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`${ordered ? listClass.ol : listClass.ul} ${className}`.trim()}>
      {items.map((item, itemIndex) => (
        <li key={itemIndex} className={isLegalPlaceholder(item.text) ? 'text-warn' : undefined}>
          <InlineText text={item.text} />
          {item.children?.length ? <ListBlock ordered={false} items={item.children} className="mt-2" /> : null}
        </li>
      ))}
    </Tag>
  )
}

const headingClass = {
  1: 'text-2xl font-bold tracking-tight text-text-base',
  2: 'mt-8 text-lg font-semibold text-text-base',
  3: 'mt-8 text-base font-semibold text-text-base',
} as const

export default function LegalDocument({ document }: { document: LegalDoc }) {
  const nodes: ReactNode[] = parseLegalBlocks(document.markdown).map((block, index) => {
    if (block.type === 'heading') {
      const Tag = (`h${block.level}` as 'h1' | 'h2' | 'h3')
      return (
        <Tag key={index} className={headingClass[block.level]}>
          <InlineText text={block.text} />
        </Tag>
      )
    }
    if (block.type === 'list') {
      return <ListBlock key={index} ordered={block.ordered} items={block.items} className="mt-3" />
    }
    return (
      <p
        key={index}
        className={`mt-3 text-sm leading-7 text-text-base/80 first:mt-0 ${isLegalPlaceholder(block.text) ? 'text-warn' : ''}`}
      >
        <InlineText text={block.text} />
      </p>
    )
  })

  return <article className="legal-document">{nodes}</article>
}
