'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'

import {
  courierMarkDelivered,
  courierMarkOnTheWay,
  loadCourierDashboard,
  type CourierOrderRow,
} from '../actions'
import styles from '../kurye.module.css'

function statusLabel(fs: string): string {
  if (fs === 'preparing') return 'Hazırlanıyor'
  if (fs === 'in_transit') return 'Yolda'
  return fs || '—'
}

export function KuryeClient({ token }: { token: string }) {
  const [name, setName] = useState<string | null>(null)
  const [orders, setOrders] = useState<CourierOrderRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(() => {
    startTransition(async () => {
      setError(null)
      const res = await loadCourierDashboard(token)
      if (!res.ok) {
        setError(res.error)
        setName(null)
        setOrders([])
        return
      }
      setName(res.courierName)
      setOrders(res.orders)
    })
  }, [token])

  useEffect(() => {
    refresh()
  }, [refresh])

  const onWay = (orderId: string) => {
    startTransition(async () => {
      setFlash(null)
      const r = await courierMarkOnTheWay(token, orderId)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setError(null)
      setFlash('Yoldasınız. Müşteri bilgilenecek.')
      refresh()
    })
  }

  const delivered = (orderId: string) => {
    startTransition(async () => {
      setFlash(null)
      const r = await courierMarkDelivered(token, orderId)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setError(null)
      setFlash('Teslim kaydedildi.')
      refresh()
    })
  }

  if (error && !name && orders.length === 0 && !pending) {
    return (
      <div className={styles.wrap}>
        <div className={styles.invalid}>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1>Merhaba{name ? `, ${name}` : ''}</h1>
        <p>Atanan siparişleriniz</p>
      </header>

      {error ? <div className={styles.err}>{error}</div> : null}
      {flash ? <div className={styles.okFlash}>{flash}</div> : null}

      {pending && !name ? <p className={styles.empty}>Yükleniyor…</p> : null}

      {!pending && name && orders.length === 0 ? (
        <p className={styles.empty}>Şu an bekleyen sipariş yok.</p>
      ) : null}

      {orders.map((o) => (
        <article className={styles.card} key={o.id}>
          <div className={styles.cardTop}>
            <span className={styles.orderNo}>#{o.orderNumber}</span>
            <span
              className={
                o.fulfillmentStatus === 'in_transit' ? styles.badgeTransit : styles.badge
              }
            >
              {statusLabel(o.fulfillmentStatus)}
            </span>
          </div>
          <div className={styles.addr}>
            <strong>Teslimat adresi</strong>
            {o.addressLine}
          </div>
          <p className={styles.meta}>
            Tutar: <strong>{o.totalAmount.toFixed(2)} ₺</strong>
          </p>
          <div className={styles.actions}>
            {o.fulfillmentStatus === 'preparing' ? (
              <button
                className={styles.btnPrimary}
                disabled={pending}
                onClick={() => onWay(o.id)}
                type="button"
              >
                Yola çıktım
              </button>
            ) : null}
            {o.fulfillmentStatus === 'in_transit' ? (
              <button
                className={styles.btnPrimary}
                disabled={pending}
                onClick={() => delivered(o.id)}
                type="button"
              >
                Teslim ettim
              </button>
            ) : null}
          </div>
        </article>
      ))}

      <p className={styles.hint}>
        Bu sayfa size özel bağlantıdır; başkalarıyla paylaşmayın. Sorun olursa yöneticiden yeni link
        isteyin.
      </p>
    </div>
  )
}
