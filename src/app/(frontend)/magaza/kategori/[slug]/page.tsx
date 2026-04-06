import { notFound } from 'next/navigation'
import React from 'react'

import { listProductsByCategorySlug } from '../../actions'
import { CategoryClient } from './category-client'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const res = await listProductsByCategorySlug(slug)
  if (!res.ok) {
    return { title: 'Kategori' }
  }
  return { title: `${res.categoryName} — Mağaza` }
}

export default async function KategoriPage({ params }: Props) {
  const { slug } = await params
  const res = await listProductsByCategorySlug(slug)
  if (!res.ok) {
    notFound()
  }

  return <CategoryClient categoryName={res.categoryName} products={res.products} />
}
