import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<{ id?: string; ogImage?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { id, ogImage } = await searchParams
  const company = id ? decodeURIComponent(id) : 'Company'
  const title = `The Verdict — ${company}`
  const description = `Company health intelligence report for ${company}. Investigated by four AI agents.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage,
                width: 1200,
                height: 760,
                alt: `The Verdict — ${company}`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

export default async function VerdictSharePage({ searchParams }: Props) {
  const { id } = await searchParams
  // Redirect to home — the actual app lives there
  // The OG tags above are what Twitter/LinkedIn crawlers read
  redirect(`/?id=${id ?? ''}`)
}
