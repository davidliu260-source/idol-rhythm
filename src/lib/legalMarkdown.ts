export type LegalInlinePart =
  | { type: 'text'; text: string }
  | { type: 'link'; href: string; text: string }
  | { type: 'strong'; text: string }
  | { type: 'placeholder'; text: string }

export type LegalListItem = {
  text: string
  children?: LegalListItem[]
}

export type LegalBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: LegalListItem[] }

const STANDALONE_LINE = /^(?:\*\*.+\*\*|經營者：.+|聯絡信箱：.+)$/
const TOP_UNORDERED = /^[-*]\s+(.+)$/
const NESTED_UNORDERED = /^[ \t]{2,}[-*]\s+(.+)$/
const TOP_ORDERED = /^\d+\.\s+(.+)$/

export function splitLegalInline(text: string): LegalInlinePart[] {
  const parts: LegalInlinePart[] = []
  const pattern = /(\[([^\]]+)\]\((\/[^)]+|https?:\/\/[^)]+)\))|(\*\*([^*]+)\*\*)|(【待 Dave[^】]*】)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push({ type: 'text', text: text.slice(last, match.index) })
    if (match[1]) parts.push({ type: 'link', href: match[3], text: match[2] })
    else if (match[4]) parts.push({ type: 'strong', text: match[5] })
    else parts.push({ type: 'placeholder', text: match[6] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts.length ? parts : [{ type: 'text', text }]
}

export function parseLegalBlocks(markdown: string): LegalBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: LegalBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim() || line.trim() === '---') {
      index += 1
      continue
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() })
      index += 1
      continue
    }
    if (TOP_UNORDERED.test(line) || TOP_ORDERED.test(line)) {
      const isOrdered = TOP_ORDERED.test(line)
      const items: LegalListItem[] = []
      while (index < lines.length) {
        const current = lines[index]
        const top = (isOrdered ? TOP_ORDERED : TOP_UNORDERED).exec(current)
        const nested = !isOrdered ? NESTED_UNORDERED.exec(current) : null
        if (top) {
          items.push({ text: top[1] })
          index += 1
          continue
        }
        if (nested && items.length > 0) {
          const last = items[items.length - 1]
          last.children = last.children ?? []
          last.children.push({ text: nested[1] })
          index += 1
          continue
        }
        break
      }
      blocks.push({ type: 'list', ordered: isOrdered, items })
      continue
    }
    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length) {
      const next = lines[index]
      if (
        !next.trim() ||
        next.trim() === '---' ||
        /^(#{1,3})\s+/.test(next) ||
        TOP_UNORDERED.test(next) ||
        TOP_ORDERED.test(next) ||
        STANDALONE_LINE.test(paragraph[0]) ||
        STANDALONE_LINE.test(next)
      ) {
        break
      }
      paragraph.push(next)
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
  }
  return blocks
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderInline(text: string): string {
  return splitLegalInline(text).map((part) => {
    if (part.type === 'link') {
      return `<a href="${escapeHtml(part.href)}">${escapeHtml(part.text)}</a>`
    }
    if (part.type === 'strong') return `<strong>${renderInline(part.text)}</strong>`
    if (part.type === 'placeholder') {
      return `<span data-legal-placeholder="true">${escapeHtml(part.text)}</span>`
    }
    return escapeHtml(part.text)
  }).join('')
}

function renderList(ordered: boolean, items: LegalListItem[]): string {
  const tag = ordered ? 'ol' : 'ul'
  const lis = items.map((item) => {
    const nested = item.children?.length ? renderList(false, item.children) : ''
    return `<li>${renderInline(item.text)}${nested}</li>`
  }).join('')
  return `<${tag}>${lis}</${tag}>`
}

/** Deterministic HTML for checks. The page component renders the same blocks. */

export function renderLegalMarkdown(markdown: string): string {
  return parseLegalBlocks(markdown).map((block) => {
    if (block.type === 'heading') {
      return `<h${block.level}>${renderInline(block.text)}</h${block.level}>`
    }
    if (block.type === 'list') {
      return renderList(block.ordered, block.items)
    }
    return `<p>${renderInline(block.text)}</p>`
  }).join('')
}
