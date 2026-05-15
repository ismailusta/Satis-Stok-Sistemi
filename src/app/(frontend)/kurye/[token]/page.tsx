import { notFound } from 'next/navigation'
import React from 'react'

import { KuryeClient } from './kurye-client'

type Props = { params: Promise<{ token: string }> }

export default async function KuryeTokenPage({ params }: Props) {
  const { token } = await params
  const t = decodeURIComponent(token ?? '').trim()
  if (!t || t.length < 8) {
    notFound()
  }
  return <KuryeClient token={t} />
}
