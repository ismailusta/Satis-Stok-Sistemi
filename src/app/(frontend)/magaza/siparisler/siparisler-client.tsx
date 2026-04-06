'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { getOrderHistory, type MagazaOrderSummary } from '../order-history'
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

export function SiparislerClient() {
  const [orders, setOrders] = useState<MagazaOrderSummary[]>([])

  useEffect(() => {
    setOrders(getOrderHistory())
    const onUpd = () => setOrders(getOrderHistory())
    window.addEventListener('magaza-orders-updated', onUpd)
    return () => window.removeEventListener('magaza-orders-updated', onUpd)
  }, [])

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>Geçmiş siparişlerim</h1>
      <p className={styles.sub}>
        Bu cihazda tamamladığınız siparişler (tarayıcıda saklanır).
      </p>
      {orders.length === 0 ? (
        <p className={styles.empty}>Henüz kayıtlı sipariş yok.</p>
      ) : (
        <ul className={styles.orderHistoryFull}>
          {orders.map((o) => (
            <li className={styles.orderHistoryCard} key={String(o.orderId)}>
              <div>
                <strong>#{o.orderNumber}</strong>
                <span className={styles.orderHistoryDate}>{formatDate(o.createdAt)}</span>
              </div>
              <div className={styles.orderHistoryRight}>
                <span>{o.itemCount} ürün</span>
                <strong>{o.total.toFixed(2)} ₺</strong>
              </div>
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
