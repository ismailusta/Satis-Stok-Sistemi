'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'

import { useMagazaAuth } from '../auth-context'
import { listMyOrders, type MyOrderRow } from '../hesabim-actions'
import styles from '../magaza.module.css'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'long',
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

export function SiparislerClient() {
  const { isAuthenticated, sessionReady, openAuthModal } = useMagazaAuth()
  const [orders, setOrders] = useState<MyOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const res = await listMyOrders()
    if (!res.ok) {
      setError(res.error)
      setOrders([])
    } else {
      setOrders(res.orders)
    }
    setLoading(false)
  }, [isAuthenticated])

  useEffect(() => {
    if (!sessionReady) return
    void load()
  }, [sessionReady, load])

  if (!sessionReady) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>Geçmiş siparişlerim</h1>
        <p className={styles.sub}>Yükleniyor…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>Geçmiş siparişlerim</h1>
        <p className={styles.sub}>
          Sipariş geçmişinizi görmek için telefon numaranızla giriş yapın.
        </p>
        <button
          className={styles.submitPay}
          onClick={() => openAuthModal()}
          style={{ marginTop: '1rem', maxWidth: '220px' }}
          type="button"
        >
          Giriş yap
        </button>
        <Link className={styles.sepetBackLink} href="/magaza">
          ← Mağazaya dön
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>Geçmiş siparişlerim</h1>
      <p className={styles.sub}>Hesabınıza bağlı online siparişleriniz.</p>
      {error ? <div className={styles.flashErr}>{error}</div> : null}
      {loading ? (
        <p className={styles.empty}>Yükleniyor…</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>Henüz kayıtlı sipariş yok.</p>
      ) : (
        <ul className={styles.orderHistoryFull}>
          {orders.map((o) => (
            <li className={styles.orderHistoryCard} key={o.id}>
              <div className={styles.orderHistoryTop}>
                <div>
                  <strong>#{o.orderNumber}</strong>
                  <span className={styles.orderHistoryDate}>{formatDate(o.createdAt)}</span>
                </div>
                <div className={styles.orderHistoryRight}>
                  <span>{itemCount(o)} ürün</span>
                  <strong>{o.totalAmount.toFixed(2)} ₺</strong>
                </div>
              </div>
              {o.items.length > 0 ? (
                <ul className={styles.orderLineMini}>
                  {o.items.map((row, idx) => (
                    <li key={`${o.id}-${idx}`}>
                      {row.productName} × {row.quantity}
                      {row.productId ? (
                        <>
                          {' '}
                          <Link href={`/magaza/urun/${row.productId}`}>Ürün</Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Link className={styles.sepetBackLink} href="/magaza">
        ← Mağazaya dön
      </Link>
    </div>
  )
}
