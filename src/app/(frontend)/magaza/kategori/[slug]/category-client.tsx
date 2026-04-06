'use client'

import React from 'react'

import type { StoreProduct } from '../../actions'
import { ProductCard } from '../../product-card'
import styles from '../../magaza.module.css'

export function CategoryClient({
  categoryName,
  products,
}: {
  categoryName: string
  products: StoreProduct[]
}) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>{categoryName}</h1>
      <p className={styles.sub}>{products.length} ürün</p>
      <div className={styles.grid}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {products.length === 0 && (
        <p className={styles.empty}>Bu kategoride stokta ürün yok.</p>
      )}
    </div>
  )
}
