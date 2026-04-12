'use client'

import Link from 'next/link'
import React from 'react'

import type { StoreProduct } from './actions'
import { useMagazaCart } from './cart-context'
import styles from './magaza.module.css'

export function ProductCard({
  product,
  compact = false,
  isFavorite = false,
  showFavorite = false,
  favoriteBusy = false,
  onFavoriteClick,
}: {
  product: StoreProduct
  compact?: boolean
  /** Girişli kullanıcı + favori id listesi yüklendiyse */
  isFavorite?: boolean
  showFavorite?: boolean
  favoriteBusy?: boolean
  onFavoriteClick?: () => void
}) {
  const { addProduct } = useMagazaCart()
  const href = `/magaza/urun/${product.id}`

  return (
    <div className={compact ? styles.cardCompact : styles.card}>
      <div className={styles.cardMediaWrap}>
        <Link className={styles.cardImageLink} href={href}>
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className={styles.thumb} src={product.imageUrl} />
          ) : (
            <div className={styles.thumbPh}>{product.name.slice(0, 1).toUpperCase()}</div>
          )}
        </Link>
        {showFavorite && onFavoriteClick ? (
          <button
            aria-label={isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            className={isFavorite ? styles.cardFavFabActive : styles.cardFavFab}
            disabled={favoriteBusy}
            onClick={(e) => {
              e.preventDefault()
              onFavoriteClick()
            }}
            type="button"
          >
            {isFavorite ? '♥' : '♡'}
          </button>
        ) : null}
        <button
          aria-label="Sepete ekle"
          className={styles.cardAddFab}
          disabled={product.stock < 1}
          onClick={(e) => {
            e.preventDefault()
            addProduct(product, 1)
          }}
          type="button"
        >
          +
        </button>
      </div>
      <Link className={styles.cardTextLink} href={href}>
        <span className={styles.pname}>{product.name}</span>
        <span className={styles.cardPrice}>{product.salePrice.toFixed(2)} ₺</span>
        <span className={styles.pmeta}>Stok {product.stock}</span>
      </Link>
    </div>
  )
}
