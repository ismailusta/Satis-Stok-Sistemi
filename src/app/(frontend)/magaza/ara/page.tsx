import React from 'react'

import { searchStoreProducts } from '../actions'
import { SearchResultsClient } from './search-results-client'

export const metadata = {
  title: 'Ürün ara — Mağaza',
  description: 'Mağazada ürün arayın',
}

type Props = { searchParams: Promise<{ q?: string }> }

export default async function MagazaAraPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  const res = await searchStoreProducts(q)
  const products = res.ok ? res.products : []
  const error = res.ok ? null : res.error

  return <SearchResultsClient error={error} products={products} query={q} />
}
