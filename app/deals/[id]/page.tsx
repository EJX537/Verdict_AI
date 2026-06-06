import { DealDetailClient } from './deal-detail-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params
  return <DealDetailClient dealId={id} />
}
