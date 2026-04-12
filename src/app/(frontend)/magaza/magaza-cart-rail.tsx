'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'

import { useMagazaAuth } from './auth-context'
import { useMagazaCart } from './cart-context'
import { listMyOrders, type MyOrderRow } from './hesabim-actions'
import styles from './magaza.module.css'

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function itemCount(o: MyOrderRow): number {
  return o.items.reduce((s, i) => s + i.quantity, 0)
}

export function MagazaCartRail() {
  const { isAuthenticated, sessionReady } = useMagazaAuth()
  const { lines, setQty, removeLine, total, itemCount: cartItems } = useMagazaCart()
  const [orders, setOrders] = useState<MyOrderRow[]>([])

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([])
      return
    }
    const res = await listMyOrders()
    if (res.ok) {
      setOrders(res.orders)
    } else {
      setOrders([])
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!sessionReady) return
    void loadOrders()
  }, [sessionReady, loadOrders])

  const preview = orders.slice(0, 4)

  if (!isAuthenticated) {
    return null
  }

  return (
    <>
      <aside className={styles.cartRail} aria-label="Sepet ve geçmiş siparişler">
        <div className={styles.cartRailInner}>
          <h2 className={styles.cartRailTitle}>Sepetim</h2>

          {lines.length === 0 ? (
            <p className={styles.cartRailEmpty}>Sepetin şu an boş.</p>
          ) : (
            <>
              <ul className={styles.cartRailLines}>
                {lines.map((line) => (
                  <li className={styles.cartRailLine} key={line.productId}>
                    <div className={styles.cartRailThumbWrap}>
                      {line.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className={styles.cartRailThumb} src={line.imageUrl} />
                      ) : (
                        <div className={styles.cartRailThumbPh}>
                          {line.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className={styles.cartRailLineBody}>
                      <span className={styles.cartRailLineName}>{line.name}</span>
                      <span className={styles.cartRailLinePrice}>
                        {(line.salePrice * line.quantity).toFixed(2)} ₺
                      </span>
                      <div className={styles.cartRailLineActions}>
                        <button
                          className={styles.cartRailMini}
                          onClick={() => setQty(line.productId, line.quantity - 1)}
                          type="button"
                        >
                          −
                        </button>
                        <span className={styles.cartRailQty}>{line.quantity}</span>
                        <button
                          className={styles.cartRailMini}
                          onClick={() => setQty(line.productId, line.quantity + 1)}
                          type="button"
                        >
                          +
                        </button>
                        <button
                          className={styles.cartRailRemove}
                          onClick={() => removeLine(line.productId)}
                          type="button"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className={styles.cartRailFooter}>
                <div className={styles.cartRailSumRow}>
                  <span className={styles.cartRailTotalLabel}>Ara toplam</span>
                  <strong className={styles.cartRailTotalVal}>{total.toFixed(2)} ₺</strong>
                </div>
                <Link className={styles.cartRailCta} href="/magaza/sepet">
                  <span>Sepete git</span>
                  <span className={styles.cartRailCtaPrice}>{total.toFixed(2)} ₺</span>
                </Link>
              </div>
            </>
          )}

          <section className={styles.pastOrders}>
            <h3 className={styles.pastOrdersTitle}>Geçmiş siparişlerim</h3>
            {preview.length === 0 ? (
              <p className={styles.pastOrdersEmpty}>Henüz sipariş yok.</p>
            ) : (
              <ul className={styles.pastOrdersList}>
                {preview.map((o) => (
                  <li className={styles.pastOrdersItem} key={String(o.id)}>
                    <span className={styles.pastOrdersIcon} aria-hidden>
                      🏠
                    </span>
                    <div className={styles.pastOrdersMeta}>
                      <span className={styles.pastOrdersDate}>{formatDate(o.createdAt)}</span>
                      <span className={styles.pastOrdersNo}>#{o.orderNumber}</span>
                    </div>
                    <span className={styles.pastOrdersTotal}>
                      {o.totalAmount.toFixed(2)} ₺ · {itemCount(o)} ürün
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link className={styles.pastOrdersAll} href="/magaza/siparisler">
              Tümünü gör
            </Link>
          </section>
        </div>
      </aside>

      <Link className={styles.mobileCartFab} href="/magaza/sepet">
        Sepet
        {cartItems > 0 ? <span className={styles.mobileCartFabBadge}>{cartItems}</span> : null}
      </Link>
    </>
  )
}
