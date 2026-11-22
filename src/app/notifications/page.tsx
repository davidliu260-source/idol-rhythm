export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

import NotificationsClient from './NotificationsClient'

export default function NotificationsPage() {
  return <NotificationsClient />
}
