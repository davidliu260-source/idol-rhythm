export interface DetectedLocation { detected_city: string | null; detected_venue_name: string | null; detected_address: string | null }
export interface LocationParts { city?: string | null; venueName?: string | null; address?: string | null; freeText?: string | null }
const clean = (v: unknown): string | null => typeof v === 'string' ? v.trim() || null : null
export function toDetectedLocation(parts: LocationParts): DetectedLocation {
  return { detected_city: clean(parts.city), detected_venue_name: clean(parts.venueName) ?? clean(parts.freeText), detected_address: clean(parts.address) }
}
export function hasAnyLocation(loc: DetectedLocation | null | undefined): boolean {
  return !!loc && Object.values(loc).some(v => clean(v) !== null)
}
export function locationFromRawData(rawData: unknown): DetectedLocation | null {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return null
  const r = rawData as Record<string, unknown>
  const loc = toDetectedLocation({ city: clean(r.city), venueName: clean(r.venue) ?? clean(r.place) ?? clean(r.location) ?? clean(r.locationHint), address: clean(r.address) })
  return hasAnyLocation(loc) ? loc : null
}
export function locationFromRawContent(rawContent: string | null | undefined): DetectedLocation | null {
  const parts: LocationParts = {}
  for (const line of (rawContent ?? '').split(/\r?\n/)) {
    const match = /^(City|Venue|Place|Location|Address):\s*(.*)$/.exec(line)
    if (!match) continue
    const key = match[1] === 'City' ? 'city' : match[1] === 'Address' ? 'address' : 'venueName'
    if (!parts[key]) parts[key] = clean(match[2])
  }
  const loc = toDetectedLocation(parts)
  return hasAnyLocation(loc) ? loc : null
}
