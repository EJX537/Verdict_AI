import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

// PNG file signature — first 8 bytes of any valid PNG.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const MAX_BYTES = 5_000_000 // 5 MB — bounds hosting abuse while allowing full verdict screenshots

// NOTE: This endpoint is currently unauthenticated because the app has no auth
// system yet. Once InsForge auth lands (Plan 2), require a session here and add
// per-user rate limiting. Until then, the validation below limits abuse to
// small, genuine PNGs only.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Declared type + size gate (cheap checks first).
    if (file.type !== 'image/png') {
      return NextResponse.json({ error: 'Only PNG images are accepted' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large' }, { status: 400 })
    }

    // Verify the bytes really are a PNG (defends against a spoofed Content-Type).
    const bytes = new Uint8Array(await file.arrayBuffer())
    const isPng =
      bytes.length >= PNG_SIGNATURE.length &&
      PNG_SIGNATURE.every((b, i) => bytes[i] === b)
    if (!isPng) {
      return NextResponse.json({ error: 'File is not a valid PNG' }, { status: 400 })
    }

    const filename = `verdict-${Date.now()}.png`
    const blob = await put(filename, Buffer.from(bytes), {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: true,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('Share image upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
