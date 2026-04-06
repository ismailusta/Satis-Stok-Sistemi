'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'

import { listStoreProducts, submitOnlineOrder, type StoreProduct } from './actions'
import styles from './magaza.module.css'

type CartLine = {
  productId: string
  name: string
  salePrice: number
  quantity: number
  maxStock: number
  imageUrl: string | null
}

export function MagazaClient() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadProducts = useCallback(() => {
    startTransition(async () => {
      const res = await listStoreProducts()
      if (!res.ok) {
        setMessage({ type: 'err', text: res.error })
        return
      }
      setProducts(res.products)
    })
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const addToCart = (p: StoreProduct) => {
    if (p.stock < 1) return
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id)
      if (idx === -1) {
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            salePrice: p.salePrice,
            quantity: 1,
            maxStock: p.stock,
            imageUrl: p.imageUrl,
          },
        ]
      }
      const next = [...prev]
      const line = next[idx]
      if (line.quantity >= p.stock) return prev
      next[idx] = {
        ...line,
        quantity: line.quantity + 1,
        maxStock: p.stock,
        salePrice: p.salePrice,
      }
      return next
    })
    setMessage(null)
  }

  const setQty = (productId: string, quantity: number) => {
    setCart((prev) => {
      const line = prev.find((l) => l.productId === productId)
      if (!line) return prev
      if (quantity > line.maxStock) return prev
      if (quantity < 1) return prev.filter((l) => l.productId !== productId)
      return prev.map((l) =>
        l.productId === productId ? { ...l, quantity } : l,
      )
    })
  }

  const total = cart.reduce((s, l) => s + l.salePrice * l.quantity, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cart.length) {
      setMessage({ type: 'err', text: 'Sepet boş.' })
      return
    }
    startTransition(async () => {
      const res = await submitOnlineOrder({
        lines: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customerName,
        phone,
        address,
      })
      if (!res.ok) {
        setMessage({ type: 'err', text: res.error })
        return
      }
      setCart([])
      setCustomerName('')
      setPhone('')
      setAddress('')
      setMessage({
        type: 'ok',
        text: `Siparişiniz alındı: ${res.orderNumber}. Teşekkürler.`,
      })
      loadProducts()
    })
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mağaza</h1>
        <p className={styles.sub}>
          Stokta olan ürünleri sepete ekleyin; teslimat bilgileri sipariş notuna yazılır.
        </p>
      </header>

      {message && (
        <div className={message.type === 'ok' ? styles.flashOk : styles.flashErr}>
          {message.text}
        </div>
      )}

      <div className={styles.layout}>
        <section aria-label="Ürünler">
          <div className={styles.grid}>
            {products.map((p) => (
              <button
                className={styles.card}
                disabled={isPending || p.stock < 1}
                key={p.id}
                onClick={() => addToCart(p)}
                type="button"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className={styles.thumb} src={p.imageUrl} />
                ) : (
                  <div className={styles.thumbPh}>{p.name.slice(0, 1).toUpperCase()}</div>
                )}
                <span className={styles.pname}>{p.name}</span>
                <span className={styles.pmeta}>
                  {p.salePrice.toFixed(2)} ₺ · Stok {p.stock}
                </span>
              </button>
            ))}
          </div>
          {products.length === 0 && !isPending && (
            <p className={styles.empty}>Şu an listelenecek ürün yok.</p>
          )}
        </section>

        <aside className={styles.side}>
          <h2 className={styles.sideTitle}>Sepet</h2>
          {cart.length === 0 ? (
            <p className={styles.empty}>Henüz ürün seçilmedi.</p>
          ) : (
            <ul className={styles.lines}>
              {cart.map((line) => (
                <li className={styles.line} key={line.productId}>
                  <span>
                    {line.name} × {line.quantity}
                  </span>
                  <span className={styles.lineActions}>
                    <button
                      className={styles.miniBtn}
                      onClick={() => setQty(line.productId, line.quantity - 1)}
                      type="button"
                    >
                      −
                    </button>
                    <button
                      className={styles.miniBtn}
                      onClick={() => setQty(line.productId, line.quantity + 1)}
                      type="button"
                    >
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.total}>
            <span>Toplam</span>
            <strong>{total.toFixed(2)} ₺</strong>
          </div>

          <form onSubmit={handleSubmit}>
            <p className={styles.formTitle}>Teslimat</p>
            <div className={styles.field}>
              <label htmlFor="cust-name">Ad soyad</label>
              <input
                autoComplete="name"
                id="cust-name"
                onChange={(e) => setCustomerName(e.target.value)}
                required
                value={customerName}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="cust-phone">Telefon</label>
              <input
                autoComplete="tel"
                id="cust-phone"
                inputMode="tel"
                onChange={(e) => setPhone(e.target.value)}
                required
                value={phone}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="cust-addr">Adres</label>
              <textarea
                id="cust-addr"
                onChange={(e) => setAddress(e.target.value)}
                required
                value={address}
              />
            </div>
            <button className={styles.submit} disabled={isPending || cart.length === 0} type="submit">
              {isPending ? 'Gönderiliyor…' : 'Siparişi tamamla'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  )
}
