import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { getPrivacyDocument } from '@/lib/legal'
import { pageMetadata } from '@/lib/seo/metadata'

const document = getPrivacyDocument()

export const metadata: Metadata = pageMetadata(document.path, document.title, document.description)

export default function Page() {
  return <LegalPage document={document} />
}
