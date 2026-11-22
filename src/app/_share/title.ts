// Two lines of 14 full-width characters at 65px within 910px.
const TITLE_WIDTH = 28

export function truncateShareTitle(title: string): string {
  let width = 0
  let ellipsisIndex = 0
  let index = 0
  for (const character of title) {
    width += /[\x20-\x7E\uFF61-\uFFDC\uFFE8-\uFFEE]/u.test(character) ? 0.5 : 1
    index += character.length
    if (width > TITLE_WIDTH) return `${title.slice(0, ellipsisIndex).trimEnd()}…`
    if (width <= TITLE_WIDTH - 1) ellipsisIndex = index
  }
  return title
}
