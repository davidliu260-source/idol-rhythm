export const LOCATION_PENDING_LABEL = '地點待公布'
type EventLocation = { venueName?: string | null; city?: string | null; address?: string | null; location?: string | null }
export function hasAnyEventLocation(e: EventLocation): boolean {
  return [e.venueName, e.location, e.city, e.address].some(v => !!v?.trim())
}
export function getEventLocationLabel(e: EventLocation): string {
  return [e.venueName, e.location, e.city, e.address].map(v => v?.trim()).find(Boolean) || LOCATION_PENDING_LABEL
}
