'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { StoreProduct } from '../../actions'
import { useMagazaAuth } from '../../auth-context'
import { getFavoriteProductIdsForSession, toggleFavoriteProduct } from '../../hesabim-actions'
import { ProductCard } from '../../product-card'
import styles from '../../magaza.module.css'

export function CategoryClient({
  categoryName,
  products,
}: {
  categoryName: string
  products: StoreProduct[]
}) {
  const { isAuthenticated, sessionReady } = useMagazaAuth()
  const [favIds, setFavIds] = useState<Set<string> | null>(null)

  const loadFavs = useCallback(async () => {
    if (!isAuthenticated) {
      setFavIds(new Set())
      return
    }
    const ids = await getFavoriteProductIdsForSession()
    setFavIds(new Set(ids))
  }, [isAuthenticated])

  useEffect(() => {
    if (!sessionReady) return
    void loadFavs()
  }, [sessionReady, loadFavs])

  const onFavToggle = async (productId: string) => {
    const res = await toggleFavoriteProduct(productId)
    if (!res.ok) return
    setFavIds((prev) => {
      const next = new Set(prev ?? [])
      if (res.isFavorite) next.add(productId)
      else next.delete(productId)
      return next
    })
  }

  const favReady = !isAuthenticated || favIds !== null

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>{categoryName}</h1>
      <p className={styles.sub}>{products.length} ürün</p>
      <div className={styles.grid}>
        {products.map((p) => (
          <ProductCard
            favoriteBusy={isAuthenticated && !favReady}
            isFavorite={favIds?.has(p.id) ?? false}
            key={p.id}
            onFavoriteClick={() => void onFavToggle(p.id)}
            product={p}
            showFavorite={isAuthenticated}
          />
        ))}
      </div>
      {products.length === 0 && (
        <p className={styles.empty}>Bu kategoride stokta ürün yok.</p>
      )}
    </div>
  )
}
