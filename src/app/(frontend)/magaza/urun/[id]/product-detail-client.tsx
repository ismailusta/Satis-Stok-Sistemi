'use client'

import Link from 'next/link'
import React from 'react'

import type { StoreProductDetail } from '../../actions'
import { useMagazaCart } from '../../cart-context'
import styles from '../../magaza.module.css'

export function ProductDetailClient({ product }: { product: StoreProductDetail }) {
  const { addProduct } = useMagazaCart()
  const p: StoreProductDetail = product

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
          </div>
          <div className={styles.detailNote}>
            <Link href="/magaza/sepet">Sepete git →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
