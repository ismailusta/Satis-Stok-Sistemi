'use client'

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import {
  applyLineRefunds,
  getOrderForRefund,
  listCategoriesForPos,
  listProductsForPos,
  lookupProductByBarcode,
  refreshCartStock,
  submitOrderRefund,
  submitPosSale,
  type PosCategory,
  type PosPaymentMethod,
  type PosProduct,
  type StockSnapshot,
} from './actions'
import styles from './pos.module.css'

type CartLine = {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  maxStock: number
  imageUrl: string | null
}

const STOCK_POLL_MS = 6000

function mergeCartWithStock(
  cart: CartLine[],
  snapshots: StockSnapshot[],
): { cart: CartLine[]; adjusted: boolean } {
  const map = new Map(snapshots.map((s) => [s.productId, s]))
  let adjusted = false
  const next: CartLine[] = []

  for (const line of cart) {
    const snap = map.get(line.productId)
    if (!snap) {
      next.push(line)
      continue
    }
    if (snap.stock < 1) {
      adjusted = true
      continue
    }
    let qty = line.quantity
    if (qty > snap.stock) {
      qty = snap.stock
      adjusted = true
    }
    if (
      snap.stock !== line.maxStock ||
      snap.salePrice !== line.unitPrice ||
      snap.name !== line.name
    ) {
      adjusted = true
    }
    next.push({
      productId: line.productId,
      name: snap.name,
      unitPrice: snap.salePrice,
      quantity: qty,
      maxStock: snap.stock,
      imageUrl: snap.imageUrl ?? line.imageUrl ?? null,
    })
  }

  if (next.length !== cart.length) {
    adjusted = true
  }

  return { cart: next, adjusted }
}

type Mode = 'sale' | 'refund'

function orderStatusLabelTr(status: string): string {
  switch (status) {
    case 'completed':
      return 'Tamamlandı'
    case 'partially_refunded':
      return 'Kısmi iade'
    case 'refunded':
      return 'İade (kapatıldı)'
    case 'cancelled':
      return 'İptal'
    case 'draft':
      return 'Taslak'
    default:
      return status
  }
}

type RefundPreview = {
  id: string | number
  orderNumber: string
  status: string
  totalAmount: number
  source: string
  items: Array<{
    lineId: string
    name: string
    quantity: number
    quantityRefunded: number
    unitPrice: number
    lineTotal: number
  }>
}

export function PosClient() {
  const [mode, setMode] = useState<Mode>('sale')
  const [cart, setCart] = useState<CartLine[]>([])
  const [barcode, setBarcode] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const cashInputRef = useRef<HTMLInputElement>(null)
  const cartRef = useRef<CartLine[]>([])

  const [categories, setCategories] = useState<PosCategory[]>([])
  const [categoryId, setCategoryId] = useState<string>('all')
  const [catalogProducts, setCatalogProducts] = useState<PosProduct[]>([])
  const [productSearch, setProductSearch] = useState('')

  const [refundInput, setRefundInput] = useState('')
  const [refundPreview, setRefundPreview] = useState<RefundPreview | null>(null)
  const [refundQtyByLine, setRefundQtyByLine] = useState<Record<string, string>>({})

  /** null = kapalı; method = yöntem seçimi; cash = nakit alındı girişi */
  const [paymentStep, setPaymentStep] = useState<'method' | 'cash' | null>(null)
  const [cashReceivedStr, setCashReceivedStr] = useState('')

  cartRef.current = cart

  const focusBarcode = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const runStockSync = useCallback((opts?: { silent?: boolean }) => {
    if (cartRef.current.length === 0) return

    startTransition(async () => {
      const ids = cartRef.current.map((l) => l.productId)
      const res = await refreshCartStock(ids)
      if (!res.ok) {
        if (!opts?.silent) setMessage({ type: 'err', text: res.error })
        return
      }
      const latest = cartRef.current
      const { cart: merged, adjusted } = mergeCartWithStock(latest, res.lines)
      setCart(merged)
      if (adjusted && !opts?.silent) {
        setMessage({
          type: 'info',
          text: 'Stok güncellendi (başka satış veya online sipariş olmuş olabilir).',
        })
      }
    })
  }, [])

  useEffect(() => {
    startTransition(async () => {
      const res = await listCategoriesForPos()
      if (res.ok) setCategories(res.categories)
    })
  }, [])

  useEffect(() => {
    if (mode !== 'sale') return
    startTransition(async () => {
      const res = await listProductsForPos(categoryId)
      if (res.ok) setCatalogProducts(res.products)
    })
  }, [categoryId, mode])

  useEffect(() => {
    if (mode === 'sale') focusBarcode()
  }, [mode, focusBarcode])

  useEffect(() => {
    if (paymentStep === 'cash') {
      const t = window.setTimeout(() => cashInputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [paymentStep])

  useEffect(() => {
    if (cart.length === 0 || mode !== 'sale') return
    const t = window.setInterval(() => runStockSync({ silent: true }), STOCK_POLL_MS)
    return () => window.clearInterval(t)
  }, [cart.length, mode, runStockSync])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (cartRef.current.length === 0 || mode !== 'sale') return
      runStockSync({ silent: true })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [runStockSync, mode])

  const addToCart = (product: PosProduct, addQty = 1) => {
    const q = Math.floor(Number(addQty))
    if (!Number.isFinite(q) || q < 1) {
      setMessage({ type: 'err', text: 'Geçersiz adet.' })
      return
    }
    if (product.stock < 1) {
      setMessage({ type: 'err', text: 'Bu ürünün stoğu yok.' })
      return
    }
    if (q > product.stock) {
      setMessage({
        type: 'err',
        text: `Bu üründen en fazla ${product.stock} adet ekleyebilirsiniz.`,
      })
      return
    }
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id)
      if (idx === -1) {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unitPrice: product.salePrice,
            quantity: q,
            maxStock: product.stock,
            imageUrl: product.imageUrl ?? null,
          },
        ]
      }
      const next = [...prev]
      const line = next[idx]
      const newQty = line.quantity + q
      if (newQty > product.stock) {
        setMessage({ type: 'err', text: `Stokta en fazla ${product.stock} adet var.` })
        return prev
      }
      next[idx] = {
        ...line,
        quantity: newQty,
        maxStock: product.stock,
        imageUrl: product.imageUrl ?? line.imageUrl ?? null,
      }
      return next
    })
    setMessage(null)
  }

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = barcode.trim()
    if (!raw) return

    const mult = raw.match(/^(\d+)\s*\*\s*(.+)$/)
    const qty = mult ? Math.floor(Number(mult[1])) : 1
    const code = mult ? mult[2].trim() : raw

    if (mult && (!Number.isFinite(qty) || qty < 1)) {
      setMessage({ type: 'err', text: 'Geçersiz adet (ör. 5*barkod).' })
      return
    }
    if (mult && qty > 99999) {
      setMessage({ type: 'err', text: 'Adet çok büyük.' })
      return
    }

    startTransition(async () => {
      const res = await lookupProductByBarcode(code)
      setBarcode('')
      if (!res.ok) {
        setMessage({ type: 'err', text: res.error })
        focusBarcode()
        return
      }
      addToCart(res.product, qty)
      focusBarcode()
    })
  }

  const setQty = (productId: string, quantity: number) => {
    setCart((prev) => {
      const line = prev.find((l) => l.productId === productId)
      if (!line) return prev
      if (quantity > line.maxStock) {
        setMessage({ type: 'err', text: `Stokta en fazla ${line.maxStock} adet var.` })
        return prev
      }
      if (quantity < 1) {
        return prev.filter((l) => l.productId !== productId)
      }
      setMessage(null)
      return prev.map((l) =>
        l.productId === productId ? { ...l, quantity } : l,
      )
    })
  }

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)

  const closePaymentModal = useCallback(() => {
    setPaymentStep(null)
    setCashReceivedStr('')
  }, [])

  const openPaymentModal = useCallback(() => {
    if (!cart.length) {
      setMessage({ type: 'err', text: 'Sepet boş.' })
      return
    }
    setCashReceivedStr('')
    setPaymentStep('method')
  }, [cart.length])

  const finalizeSale = useCallback(
    (payment: { method: PosPaymentMethod; cashReceived?: number }) => {
      startTransition(async () => {
        const refresh = await refreshCartStock(cart.map((l) => l.productId))
        if (!refresh.ok) {
          setMessage({ type: 'err', text: refresh.error })
          closePaymentModal()
          return
        }

        const { cart: merged, adjusted } = mergeCartWithStock(cart, refresh.lines)
        setCart(merged)

        if (merged.length === 0) {
          setMessage({
            type: 'err',
            text: 'Sepetteki ürünlerin stoğu kalmadı veya güncellendi.',
          })
          closePaymentModal()
          return
        }

        if (adjusted) {
          setMessage({
            type: 'info',
            text: 'Sepet güncel stoka göre ayarlandı. Kontrol edip tekrar Ödeme Al deyin.',
          })
          closePaymentModal()
          return
        }

        const res = await submitPosSale(
          merged.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          payment,
        )
        if (!res.ok) {
          setMessage({ type: 'err', text: res.error })
          runStockSync({ silent: true })
          closePaymentModal()
          return
        }
        closePaymentModal()
        setCart([])
        setMessage({
          type: 'ok',
          text: `Satış tamam: ${res.orderNumber}`,
        })
        listProductsForPos(categoryId).then((r) => {
          if (r.ok) setCatalogProducts(r.products)
        })
        focusBarcode()
      })
    },
    [cart, categoryId, closePaymentModal, focusBarcode, runStockSync],
  )

  const handleSelectPaymentMethod = (method: PosPaymentMethod) => {
    if (method === 'cash') {
      setCashReceivedStr('')
      setPaymentStep('cash')
      return
    }
    finalizeSale({ method })
  }

  const handleConfirmCash = () => {
    const received = parseFloat(cashReceivedStr.replace(',', '.'))
    if (!Number.isFinite(received) || received < total) {
      setMessage({
        type: 'err',
        text: `En az ${total.toFixed(2)} ₺ girin.`,
      })
      return
    }
    finalizeSale({ method: 'cash', cashReceived: received })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (paymentStep !== null) {
          e.preventDefault()
          closePaymentModal()
          return
        }
        if (mode === 'sale' && cartRef.current.length > 0) {
          e.preventDefault()
          setCart([])
          setMessage({ type: 'info', text: 'Sepet temizlendi.' })
        }
        return
      }
      if (e.key === 'F9') {
        e.preventDefault()
        if (mode !== 'sale' || paymentStep !== null || isPending) return
        if (cartRef.current.length === 0) return
        openPaymentModal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePaymentModal, mode, openPaymentModal, paymentStep, isPending])

  const handleLoadRefund = (e: React.FormEvent) => {
    e.preventDefault()
    const q = refundInput.trim()
    if (!q) return
    startTransition(async () => {
      const res = await getOrderForRefund(q)
      if (!res.ok) {
        setRefundPreview(null)
        setMessage({ type: 'err', text: res.error })
        return
      }
      setMessage(null)
      setRefundPreview({
        id: res.order.id,
        orderNumber: res.order.orderNumber,
        status: res.order.status,
        totalAmount: res.order.totalAmount,
        source: res.order.source,
        items: res.order.items,
      })
    })
  }

  const reloadRefundOrder = async (orderNumber: string) => {
    const res = await getOrderForRefund(orderNumber)
    if (res.ok) {
      setRefundPreview({
        id: res.order.id,
        orderNumber: res.order.orderNumber,
        status: res.order.status,
        totalAmount: res.order.totalAmount,
        source: res.order.source,
        items: res.order.items,
      })
    }
  }

  const handleLineRefund = (lineId: string) => {
    if (!refundPreview) return
    const raw = refundQtyByLine[lineId] ?? '1'
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1) {
      setMessage({ type: 'err', text: 'Geçerli bir adet girin (en az 1).' })
      return
    }
    const line = refundPreview.items.find((i) => i.lineId === lineId)
    if (!line) return
    const remaining = line.quantity - line.quantityRefunded
    if (n > remaining) {
      setMessage({ type: 'err', text: `Bu satırda en fazla ${remaining} adet iade edilebilir.` })
      return
    }
    startTransition(async () => {
      const res = await applyLineRefunds(refundPreview.id, [{ lineId, addQuantity: n }])
      if (!res.ok) {
        setMessage({ type: 'err', text: res.error })
        return
      }
      setMessage({ type: 'ok', text: 'Satır iadesi uygulandı; stok güncellendi.' })
      setRefundQtyByLine((prev) => ({ ...prev, [lineId]: '' }))
      await reloadRefundOrder(refundPreview.orderNumber)
    })
  }

  const handleFullOrderRefund = () => {
    if (!refundPreview) return
    const hasRemaining = refundPreview.items.some(
      (it) => it.quantity > it.quantityRefunded,
    )
    if (!hasRemaining) return
    const ok = window.confirm(
      'Bu işlem siparişi panelde "İade (kapatıldı)" durumuna alır ve POS kapatma bayrağını set eder.\n\n' +
        'Kısmi / satır iade için bu butonu kullanmayın; sadece her satırda "Satır iade" ile ilerleyin.\n\n' +
        'Satıştan kalan tüm ürünleri stoka döndürüp siparişi tamamen kapatmak istediğinize emin misiniz?',
    )
    if (!ok) return
    startTransition(async () => {
      const res = await submitOrderRefund(refundPreview.id)
      if (!res.ok) {
        setMessage({ type: 'err', text: res.error })
        return
      }
      setRefundPreview(null)
      setRefundInput('')
      setRefundQtyByLine({})
      setMessage({
        type: 'ok',
        text: `Sipariş iade kapatıldı: ${res.orderNumber} — kalan tutarlar stoka döndü.`,
      })
    })
  }

  const filteredCatalog = catalogProducts.filter((p) =>
    productSearch.trim()
      ? p.name.toLowerCase().includes(productSearch.trim().toLowerCase()) ||
        p.barcode.includes(productSearch.trim())
      : true,
  )

  const switchMode = (next: Mode) => {
    setMode(next)
    setMessage(null)
    if (next === 'refund') {
      setRefundPreview(null)
      setRefundQtyByLine({})
    }
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>POS</h1>
        <div className={styles.tabs} role="tablist">
          <button
            className={mode === 'sale' ? styles.tabActive : styles.tab}
            onClick={() => switchMode('sale')}
            type="button"
          >
            Satış
          </button>
          <button
            className={mode === 'refund' ? styles.tabActive : styles.tab}
            onClick={() => switchMode('refund')}
            type="button"
          >
            İade
          </button>
        </div>
        {mode === 'sale' && (
          <p className={styles.hint}>
            Katalog veya barkod (çoklu: 5×barkod) · <strong>F9</strong> ödeme ·{' '}
            <strong>ESC</strong> sepeti temizle.
          </p>
        )}
        {mode === 'refund' && (
          <p className={styles.hint}>
            Tamamlanmış veya kısmi iade sipariş numarasını girin (ör. ORD-…).
          </p>
        )}
      </header>

      {message && (
        <div
          className={
            message.type === 'ok'
              ? styles.flashOk
              : message.type === 'info'
                ? styles.flashInfo
                : styles.flashErr
          }
          role="status"
        >
          {message.text}
        </div>
      )}

      {mode === 'sale' ? (
        <>
          <div className={styles.saleLayout}>
            <section className={styles.catalog} aria-label="Ürün kataloğu">
              <h2 className={styles.catalogTitle}>Katalog</h2>
              <div className={styles.chips}>
                <button
                  className={categoryId === 'all' ? styles.chipActive : styles.chip}
                  onClick={() => setCategoryId('all')}
                  type="button"
                >
                  Tümü
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className={categoryId === c.id ? styles.chipActive : styles.chip}
                    onClick={() => setCategoryId(c.id)}
                    type="button"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <input
                className={styles.searchInput}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Ürün veya barkod ara…"
                type="search"
                value={productSearch}
              />
              <div className={styles.productGrid}>
                {filteredCatalog.map((p) => (
                  <button
                    className={styles.productCard}
                    disabled={isPending || p.stock < 1}
                    key={p.id}
                    onClick={() => addToCart(p)}
                    type="button"
                  >
                    <div className={styles.productThumbWrap}>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className={styles.productThumb} src={p.imageUrl} />
                      ) : (
                        <div className={styles.productThumbPlaceholder}>
                          {p.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className={styles.productName}>{p.name}</span>
                    <span className={styles.productMeta}>
                      {p.salePrice.toFixed(2)} ₺ · Stok {p.stock}
                    </span>
                  </button>
                ))}
              </div>
              {filteredCatalog.length === 0 && (
                <p className={styles.empty}>Bu filtreye uygun ürün yok.</p>
              )}
            </section>

            <div className={styles.saleCol}>
              <form className={styles.scan} onSubmit={handleBarcodeSubmit}>
                <input
                  ref={inputRef}
                  autoComplete="off"
                  className={styles.barcodeInput}
                  inputMode="numeric"
                  name="barcode"
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Barkod veya 5×barkod…"
                  value={barcode}
                />
                <button className={styles.btnSecondary} disabled={isPending} type="submit">
                  Ekle
                </button>
              </form>

              <section className={styles.cart}>
                <h2 className={styles.cartTitle}>Sepet</h2>
                {cart.length === 0 ? (
                  <p className={styles.empty}>Henüz ürün yok.</p>
                ) : (
                  <ul className={styles.lines}>
                    {cart.map((line) => (
                      <li className={styles.line} key={line.productId}>
                        <div className={styles.lineRow}>
                          {line.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt="" className={styles.cartThumb} src={line.imageUrl} />
                          ) : (
                            <div className={styles.cartThumbPlaceholder}>
                              {line.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className={styles.lineInfo}>
                            <span className={styles.lineName}>{line.name}</span>
                          <span className={styles.linePrice}>
                            {line.unitPrice.toFixed(2)} ₺ × {line.quantity} ={' '}
                            {(line.unitPrice * line.quantity).toFixed(2)} ₺
                            <span className={styles.stockHint}> · Stok: {line.maxStock}</span>
                          </span>
                          </div>
                        </div>
                        <div className={styles.lineActions}>
                          <button
                            className={styles.iconBtn}
                            onClick={() => setQty(line.productId, line.quantity - 1)}
                            type="button"
                          >
                            −
                          </button>
                          <span className={styles.qty}>{line.quantity}</span>
                          <button
                            className={styles.iconBtn}
                            onClick={() => setQty(line.productId, line.quantity + 1)}
                            type="button"
                          >
                            +
                          </button>
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeLine(line.productId)}
                            type="button"
                          >
                            Kaldır
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <footer className={styles.footer}>
            <div className={styles.totalRow}>
              <span>Toplam</span>
              <strong className={styles.total}>{total.toFixed(2)} ₺</strong>
            </div>
            <button
              className={styles.payBtn}
              disabled={isPending || cart.length === 0}
              onClick={openPaymentModal}
              type="button"
            >
              {isPending ? 'İşleniyor…' : 'Ödeme Al'}
            </button>
          </footer>

          {paymentStep !== null && (
            <div
              className={styles.payModalBackdrop}
              onClick={closePaymentModal}
              onKeyDown={(e) => e.key === 'Escape' && closePaymentModal()}
              role="presentation"
            >
              <div
                className={styles.payModal}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby="pay-modal-title"
              >
                <h3 className={styles.payModalTitle} id="pay-modal-title">
                  Ödeme
                </h3>
                <p className={styles.payModalTotal}>
                  Tutar: <strong>{total.toFixed(2)} ₺</strong>
                </p>

                {paymentStep === 'method' && (
                  <div className={styles.payMethodGrid}>
                    <button
                      className={styles.payMethodBtn}
                      disabled={isPending}
                      onClick={() => handleSelectPaymentMethod('cash')}
                      type="button"
                    >
                      Nakit
                    </button>
                    <button
                      className={styles.payMethodBtn}
                      disabled={isPending}
                      onClick={() => handleSelectPaymentMethod('card')}
                      type="button"
                    >
                      Kredi kartı
                    </button>
                    <button
                      className={styles.payMethodBtn}
                      disabled={isPending}
                      onClick={() => handleSelectPaymentMethod('credit')}
                      type="button"
                    >
                      Veresiye
                    </button>
                  </div>
                )}

                {paymentStep === 'cash' && (
                  <div className={styles.payCash}>
                    <label className={styles.payCashLabel} htmlFor="cash-received">
                      Müşterinin verdiği (₺)
                    </label>
                    <input
                      ref={cashInputRef}
                      autoCapitalize="off"
                      autoComplete="off"
                      className={styles.payCashInput}
                      id="cash-received"
                      inputMode="decimal"
                      onChange={(e) => setCashReceivedStr(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleConfirmCash()
                        }
                      }}
                      placeholder="0"
                      type="text"
                      value={cashReceivedStr}
                    />
                    {(() => {
                      const received = parseFloat(cashReceivedStr.replace(',', '.'))
                      const ch =
                        Number.isFinite(received) && received >= total
                          ? Math.round((received - total) * 100) / 100
                          : null
                      return (
                        <div
                          className={
                            ch !== null ? styles.payChangeBox : styles.payChangeBoxMuted
                          }
                        >
                          {ch !== null ? (
                            <>
                              <span className={styles.payChangeLabel}>Para üstü</span>
                              <span className={styles.payChangeAmount}>{ch.toFixed(2)} ₺</span>
                            </>
                          ) : (
                            <span className={styles.payChangeHint}>
                              Tutarı girin (en az {total.toFixed(2)} ₺)
                            </span>
                          )}
                        </div>
                      )
                    })()}
                    <div className={styles.payModalActions}>
                      <button
                        className={styles.btnSecondary}
                        type="button"
                        onClick={() => setPaymentStep('method')}
                      >
                        Geri
                      </button>
                      <button
                        className={styles.payConfirmBtn}
                        disabled={isPending}
                        type="button"
                        onClick={handleConfirmCash}
                      >
                        Onayla
                      </button>
                    </div>
                  </div>
                )}

                {paymentStep === 'method' && (
                  <button
                    className={styles.payModalClose}
                    onClick={closePaymentModal}
                    type="button"
                  >
                    Vazgeç
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <section className={styles.refundPanel}>
          <form className={styles.refundForm} onSubmit={handleLoadRefund}>
            <input
              className={styles.barcodeInput}
              onChange={(e) => setRefundInput(e.target.value)}
              placeholder="Sipariş numarası"
              value={refundInput}
            />
            <button className={styles.btnSecondary} disabled={isPending} type="submit">
              Getir
            </button>
          </form>

          {refundPreview && (
            <div className={styles.refundCard}>
              <div className={styles.refundHead}>
                <strong>{refundPreview.orderNumber}</strong>
                <span className={styles.refundSource}>
                  {orderStatusLabelTr(refundPreview.status)} ·{' '}
                  {refundPreview.source === 'pos' ? 'POS' : 'Online'} ·{' '}
                  {refundPreview.totalAmount.toFixed(2)} ₺
                </span>
              </div>
              <p className={styles.refundHelp}>
                <strong>Kısmi iade:</strong> Her ürün için adet yazıp &quot;Satır iade&quot; kullanın.{' '}
                <strong>Kırmızı buton</strong> yalnızca siparişi tamamen kapatıp (liste: İade kapatıldı)
                kalan stoku döndürmek içindir — satır iadesiyle karıştırmayın.
              </p>
              <ul className={styles.refundLineList}>
                {refundPreview.items.map((it) => {
                  const remaining = it.quantity - it.quantityRefunded
                  return (
                    <li className={styles.refundLineRow} key={it.lineId}>
                      <div className={styles.refundLineInfo}>
                        <span className={styles.refundLineName}>{it.name}</span>
                        <span className={styles.refundLineMeta}>
                          Satılan: {it.quantity} · İade edilen: {it.quantityRefunded} · Kalan:{' '}
                          {remaining}
                        </span>
                      </div>
                      {remaining > 0 ? (
                        <div className={styles.refundLineActions}>
                          <input
                            className={styles.refundQtyInput}
                            inputMode="numeric"
                            min={1}
                            max={remaining}
                            onChange={(e) =>
                              setRefundQtyByLine((prev) => ({
                                ...prev,
                                [it.lineId]: e.target.value,
                              }))
                            }
                            placeholder="Adet"
                            type="number"
                            value={refundQtyByLine[it.lineId] ?? ''}
                          />
                          <button
                            className={styles.refundLineBtn}
                            disabled={isPending}
                            onClick={() => handleLineRefund(it.lineId)}
                            type="button"
                          >
                            Satır iade
                          </button>
                        </div>
                      ) : (
                        <span className={styles.refundDone}>Satır tamam</span>
                      )}
                    </li>
                  )
                })}
              </ul>
              {refundPreview.items.some((it) => it.quantity > it.quantityRefunded) ? (
                <button
                  className={styles.refundConfirmBtn}
                  disabled={isPending}
                  onClick={handleFullOrderRefund}
                  type="button"
                >
                  Siparişi tamamen kapat (panel: İade kapatıldı — kalan stok)
                </button>
              ) : null}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
