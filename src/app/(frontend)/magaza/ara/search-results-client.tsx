'use client'

import Link from 'next/link'
import React from 'react'

import type { StoreProduct } from '../actions'
import { ProductCard } from '../product-card'
import styles from '../magaza.module.css'

export function SearchResultsClient({
  query,
  products,
  error,
}: {
  query: string
  products: StoreProduct[]
  error: string | null
}) {
  const q = query.trim()

  return (
    <div className={styles.wrap}>
      <nav className={styles.breadcrumb}>
        <Link href="/magaza">Mağaza</Link>
        {' / '}
        <span>Arama</span>
      </nav>
      <h1 className={styles.pageTitle}>
        {q ? `“${q}” için sonuçlar` : 'Ürün ara'}
      </h1>
      {error ? <div className={styles.flashErr}>{error}</div> : null}
      {!error && q.length > 0 && products.length === 0 ? (
        <p className={styles.empty}>Bu aramaya uygun ürün bulunamadı.</p>
      ) : null}
      {!error && q.length === 0 ? (
        <p className={styles.sub}>Arama kutusundan veya ana sayfadaki popüler aramalardan sorgu girin.</p>
      ) : null}
      {products.length > 0 ? (
        <>
          <p className={styles.sub}>{products.length} ürün</p>
          <div className={styles.grid}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      ) : null}
      <Link className={styles.sepetBackLink} href="/magaza">
        ← Mağazaya dön
      </Link>
    </div>
  )
}
