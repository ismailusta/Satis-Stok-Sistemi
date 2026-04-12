'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import type { StoreProductDetail } from '../../actions'
import { useMagazaCart } from '../../cart-context'
import { useMagazaAuth } from '../../auth-context'
import { isProductFavorite, toggleFavoriteProduct } from '../../hesabim-actions'
import styles from '../../magaza.module.css'

export function ProductDetailClient({ product }: { product: StoreProductDetail }) {
  const { addProduct } = useMagazaCart()
  const { isAuthenticated, sessionReady } = useMagazaAuth()
  const p: StoreProductDetail = product
  const [fav, setFav] = useState<boolean | null>(null)
  const [favBusy, setFavBusy] = useState(false)

  useEffect(() => {
    if (!sessionReady || !isAuthenticated) {
      setFav(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const v = await isProductFavorite(p.id)
      if (!cancelled) setFav(v)
    })()
    return () => {
      cancelled = true
    }
  }, [sessionReady, isAuthenticated, p.id])

  const onFav = async () => {
    if (!isAuthenticated || favBusy) return
    setFavBusy(true)
    try {
      const res = await toggleFavoriteProduct(p.id)
      if (res.ok) setFav(res.isFavorite)
    } finally {
      setFavBusy(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <nav className={styles.breadcrumb}>
        <Link href="/magaza">Mağaza</Link>
        {p.categoryName && (
          <>
            {' / '}
            <span>{p.categoryName}</span>
          </>
        )}
      </nav>

      <div className={styles.detailGrid}>
        <div className={styles.detailMedia}>
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className={styles.detailImg} src={p.imageUrl} />
          ) : (
            <div className={styles.detailImgPh}>{p.name.slice(0, 1).toUpperCase()}</div>
          )}
        </div>
        <div className={styles.detailInfo}>
          <h1 className={styles.detailTitle}>{p.name}</h1>
          <p className={styles.detailPrice}>{p.salePrice.toFixed(2)} ₺</p>
          <p className={styles.detailMeta}>
            Barkod: {p.barcode} · Stok: {p.stock}
          </p>
          <div className={styles.detailActions}>
            <button
              className={styles.detailAddBtn}
              disabled={p.stock < 1}
              onClick={() => addProduct(p, 1)}
              type="button"
            >
              {p.stock < 1 ? 'Stok yok' : 'Sepete ekle'}
            </button>
            {isAuthenticated && sessionReady && fav !== null ? (
              <div className={styles.detailFavRow}>
                <button
                  className={`${styles.detailFavBtn} ${fav ? styles.detailFavBtnActive : ''}`}
                  disabled={favBusy}
                  onClick={() => void onFav()}
                  type="button"
                >
                  {fav ? '♥ Favorilerde' : '♡ Favorilere ekle'}
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.detailNote}>
            <Link href="/magaza/sepet">Sepete git →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
