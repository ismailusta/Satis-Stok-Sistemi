import { notFound } from 'next/navigation'
import React from 'react'

import { getProductDetail } from '../../actions'
import { ProductDetailClient } from './product-detail-client'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const res = await getProductDetail(id)
  if (!res.ok) {
    return { title: 'Ürün' }
  }
  return { title: `${res.product.name} — Mağaza` }
}

export default async function UrunPage({ params }: Props) {
  const { id } = await params
  const res = await getProductDetail(id)
  if (!res.ok) {
    notFound()
  }

  return <ProductDetailClient product={res.product} />
}
