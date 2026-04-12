'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'

import { useMagazaAuth } from '../../auth-context'
import {
  listFavoriteProducts,
  toggleFavoriteProduct,
  type FavoriteProductRow,
} from '../../hesabim-actions'
import styles from '../../magaza.module.css'

export function FavorilerClient() {
  const { isAuthenticated, sessionReady, openAuthModal } = useMagazaAuth()
  const [products, setProducts] = useState<FavoriteProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setProducts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await listFavoriteProducts()
    if (!res.ok) {
      setMsg(res.error)
      setProducts([])
    } else {
      setMsg(null)
      setProducts(res.products)
    }
    setLoading(false)
  }, [isAuthenticated])

  useEffect(() => {
    if (!sessionReady) return
    void load()
  }, [sessionReady, load])

  const remove = async (id: string) => {
    setMsg(null)
    const res = await toggleFavoriteProduct(id)
    if (!res.ok) {
      setMsg(res.error)
      return
    }
    await load()
  }

  if (!sessionReady) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>Favori ürünlerim</h1>
        <p className={styles.sub}>Yükleniyor…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>Favori ürünlerim</h1>
        <p className={styles.sub}>Favorilerinizi görmek için giriş yapın.</p>
        <button
          className={styles.submitPay}
          onClick={() => openAuthModal()}
          style={{ marginTop: '1rem', maxWidth: '220px' }}
          type="button"
        >
          Giriş yap
        </button>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>Favori ürünlerim</h1>
      <p className={styles.sub}>Beğendiğiniz ürünler.</p>
      {msg ? <div className={styles.flashErr}>{msg}</div> : null}
      {loading ? (
        <p className={styles.empty}>Yükleniyor…</p>
      ) : products.length === 0 ? (
        <p className={styles.empty}>Henüz favori ürün yok.</p>
      ) : (
        <div className={styles.grid}>
          {products.map((p) => (
            <div className={styles.card} key={p.id}>
              <div className={styles.cardMediaWrap}>
                <Link className={styles.cardImageLink} href={`/magaza/urun/${p.id}`}>
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className={styles.thumb} src={p.imageUrl} />
                  ) : (
                    <div className={styles.thumbPh}>{p.name.slice(0, 1).toUpperCase()}</div>
                  )}
                </Link>
                <button
                  aria-label="Favorilerden çıkar"
                  className={styles.cardFavFabActive}
                  onClick={(e) => {
                    e.preventDefault()
                    void remove(p.id)
                  }}
                  title="Favorilerden çıkar"
                  type="button"
                >
                  ♥
                </button>
              </div>
              <Link className={styles.cardTextLink} href={`/magaza/urun/${p.id}`}>
                <span className={styles.pname}>{p.name}</span>
                <span className={styles.cardPrice}>{p.salePrice.toFixed(2)} ₺</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
