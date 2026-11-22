import { shareImage } from './_share/image'

export const runtime = 'nodejs'
export const alt = '星動時刻 Idol Rhythm｜韓流偶像台灣行程'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  // This static card uses fixed branding, so keep next/og's default cache policy.
  return shareImage(size)
}
