import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'
import { getTermsDocument } from '@/lib/legal'
import { pageMetadata } from '@/lib/seo/metadata'

const document = getTermsDocument()

export const metadata: Metadata = pageMetadata(document.path, document.title, document.description)

export default function Page() {
  return <LegalPage document={document} />
}
