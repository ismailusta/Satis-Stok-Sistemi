'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'

import {
  applyLineRefunds,
  applyManualStockDelta,
  getOrderForRefund,
  listCategoriesForPos,
  listCriticalStockForPos,
  listProductsForPos,
  lookupProductByBarcode,
  lookupProductForStockAdjust,
  refreshCartStock,
  submitOrderRefund,
  submitPosSale,
  type PosCategoryGroup,
  type CriticalStockRow,
  type PosPaymentMethod,
  type PosProduct,
  type StockSnapshot,
} from './actions'
import styles from './pos.module.css'
import { toast } from 'sonner'

type CartLine = {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  maxStock: number
  /** 0 = POS kritik stok uyarısı kapalı */
  lowStockThreshold: number
  imageUrl: string | null
  barcode: string
}

const STOCK_POLL_MS = 6000
const CRITICAL_STOCK_POLL_MS = 5 * 60 * 1000

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
      snap.name !== line.name ||
      snap.lowStockThreshold !== line.lowStockThreshold
    ) {
      adjusted = true
    }
    next.push({
      productId: line.productId,
      name: snap.name,
      unitPrice: snap.salePrice,
      quantity: qty,
      maxStock: snap.stock,
      lowStockThreshold: snap.lowStockThreshold,
      imageUrl: snap.imageUrl ?? line.imageUrl ?? null,
      barcode: line.barcode,
    })
  }

  if (next.length !== cart.length) {
    adjusted = true
  }

  return { cart: next, adjusted }
}

type Mode = 'sale' | 'refund' | 'stock'

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
  const stockBarcodeRef = useRef<HTMLInputElement>(null)
  const cashInputRef = useRef<HTMLInputElement>(null)
  const cartRef = useRef<CartLine[]>([])

  const [categoryGroups, setCategoryGroups] = useState<PosCategoryGroup[]>([])
  const [categoryId, setCategoryId] = useState<string>('all')
  const [catalogProducts, setCatalogProducts] = useState<PosProduct[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const [refundInput, setRefundInput] = useState('')
  const [refundPreview, setRefundPreview] = useState<RefundPreview | null>(null)
  const [refundQtyByLine, setRefundQtyByLine] = useState<Record<string, string>>({})

  /** null = kapalı; method = yöntem seçimi; cash = nakit alındı girişi */
  const [paymentStep, setPaymentStep] = useState<'method' | 'cash' | null>(null)
  const [cashReceivedStr, setCashReceivedStr] = useState('')

  const [criticalStockItems, setCriticalStockItems] = useState<CriticalStockRow[]>([])
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false)

  const [stockBarcodeInp, setStockBarcodeInp] = useState('')
  const [stockDeltaStr, setStockDeltaStr] = useState('')
  const [stockNote, setStockNote] = useState('')
  const [stockPreview, setStockPreview] = useState<PosProduct | null>(null)

  cartRef.current = cart

  const focusBarcode = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const refreshCriticalStock = useCallback(() => {
    startTransition(async () => {
      const res = await listCriticalStockForPos()
      if (res.ok) setCriticalStockItems(res.items)
    })
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
      if (res.ok) setCategoryGroups(res.groups)
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
    if (mode !== 'sale') return
    refreshCriticalStock()
    const t = window.setInterval(refreshCriticalStock, CRITICAL_STOCK_POLL_MS)
    return () => window.clearInterval(t)
  }, [mode, refreshCriticalStock])

  useEffect(() => {
    if (!notifDrawerOpen) return
    refreshCriticalStock()
  }, [notifDrawerOpen, refreshCriticalStock])

  useEffect(() => {
    if (mode === 'sale') focusBarcode()
  }, [mode, focusBarcode])

  useEffect(() => {
    if (mode !== 'stock') return
    const t = window.setTimeout(() => stockBarcodeRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [mode])

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

    const prev = cartRef.current
    const idx = prev.findIndex((l) => l.productId === product.id)
    const newQty = idx === -1 ? q : prev[idx].quantity + q
    if (newQty > product.stock) {
      setMessage({ type: 'err', text: `Stokta en fazla ${product.stock} adet var.` })
      return
    }

    const th = product.lowStockThreshold
    if (th > 0 && product.stock <= th) {
      toast.warning(
        `⚠️ Kritik stok: ${product.name} — depoda ${product.stock} adet (limit ≤${th})`,
        {
          duration: 4500,
          id: `low-stock-${product.id}`,
        },
      )
    }

    setCart((prevCart) => {
      const i = prevCart.findIndex((l) => l.productId === product.id)
      if (i === -1) {
        return [
          ...prevCart,
          {
            productId: product.id,
            name: product.name,
            unitPrice: product.salePrice,
            quantity: q,
            maxStock: product.stock,
            lowStockThreshold: product.lowStockThreshold,
            imageUrl: product.imageUrl ?? null,
            barcode: product.barcode,
          },
        ]
      }
      const next = [...prevCart]
      const line = next[i]
      next[i] = {
        ...line,
        quantity: line.quantity + q,
        name: product.name,
        unitPrice: product.salePrice,
        maxStock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        imageUrl: product.imageUrl ?? line.imageUrl ?? null,
        barcode: product.barcode,
      }
      return next
    })
    setMessage(null)
    setSelectedProductId(product.id)
  }

  useEffect(() => {
    if (!selectedProductId) return
    if (!cart.some((l) => l.productId === selectedProductId)) {
      setSelectedProductId(null)
    }
  }, [cart, selectedProductId])

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
        setSelectedProductId(null)
        setMessage({
          type: 'ok',
          text: `Satış tamam: ${res.orderNumber}`,
        })
        listProductsForPos(categoryId).then((r) => {
          if (r.ok) setCatalogProducts(r.products)
        })
        refreshCriticalStock()
        focusBarcode()
      })
    },
    [cart, categoryId, closePaymentModal, focusBarcode, refreshCriticalStock, runStockSync],
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
        if (notifDrawerOpen) {
          e.preventDefault()
          setNotifDrawerOpen(false)
          return
        }
        if (paymentStep !== null) {
          e.preventDefault()
          closePaymentModal()
          return
        }
        if (mode === 'sale' && cartRef.current.length > 0) {
          e.preventDefault()
          setCart([])
          setSelectedProductId(null)
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
  }, [closePaymentModal, mode, notifDrawerOpen, openPaymentModal, paymentStep, isPending])

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

  const handleStockLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = stockBarcodeInp.trim()
    if (!code) return
    startTransition(async () => {
      const res = await lookupProductForStockAdjust(code)
      if (!res.ok) {
        setMessage({ type: 'err', text: res.error })
        setStockPreview(null)
        return
      }
      setStockPreview(res.product)
      setMessage(null)
    })
  }

  const handleStockApplySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockPreview) {
      setMessage({ type: 'err', text: 'Önce barkodu yazıp «Bul» deyin.' })
      return
    }
    const raw = stockDeltaStr.trim().replace(',', '.')
    if (!raw) {
      setMessage({ type: 'err', text: 'Adet girin (+ giriş, − çıkış; tam sayı).' })
      return
    }
    const delta = Math.trunc(Number(raw))
    if (!Number.isFinite(delta) || delta === 0) {
      setMessage({ type: 'err', text: 'Geçerli tam sayı girin (sıfır olamaz).' })
      return
    }
    startTransition(async () => {
      const res = await applyManualStockDelta(stockPreview.barcode, delta, stockNote || null)
      if (!res.ok) {
        setMessage({ type: 'err', text: res.error })
        return
      }
      setMessage({
        type: 'ok',
        text: `${res.productName}: güncel stok ${res.newStock} adet.`,
      })
      toast.success(`Stok güncellendi: ${res.productName} → ${res.newStock} adet`)
      setStockPreview((prev) => (prev ? { ...prev, stock: res.newStock } : null))
      setStockDeltaStr('')
      setStockNote('')
      refreshCriticalStock()
    })
  }

  const filteredCatalog = catalogProducts.filter((p) =>
    productSearch.trim()
      ? p.name.toLowerCase().includes(productSearch.trim().toLowerCase()) ||
        p.barcode.includes(productSearch.trim())
      : true,
  )

  const selectedLine = useMemo(() => {
    if (!selectedProductId) return null
    return cart.find((l) => l.productId === selectedProductId) ?? null
  }, [cart, selectedProductId])

  const activeRootGroupId = useMemo(() => {
    if (categoryId === 'all') return 'all'
    for (const g of categoryGroups) {
      if (g.id === categoryId || g.chips.some((c) => c.id === categoryId)) {
        return g.id
      }
    }
    return 'all'
  }, [categoryId, categoryGroups])

  const switchMode = (next: Mode) => {
    if (next === 'stock') {
      setStockBarcodeInp('')
      setStockDeltaStr('')
      setStockNote('')
      setStockPreview(null)
    }
    setMode(next)
    setMessage(null)
    setNotifDrawerOpen(false)
    if (next === 'refund') {
      setRefundPreview(null)
      setRefundQtyByLine({})
    }
  }

  const criticalCount = criticalStockItems.length

  const toggleNotifDrawer = useCallback(() => {
    setNotifDrawerOpen((prev) => !prev)
  }, [])

  return (
    <div className={styles.wrap}>
      {mode === 'refund' || mode === 'stock' ? (
        <header className={styles.header}>
          <h1 className={styles.title}>POS</h1>
          <div className={styles.tabs} role="tablist">
            <button
              className={styles.tab}
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
            <button
              className={mode === 'stock' ? styles.tabActive : styles.tab}
              onClick={() => switchMode('stock')}
              type="button"
            >
              Stok
            </button>
          </div>
          <p className={styles.hint}>
            {mode === 'refund'
              ? 'Tamamlanmış veya kısmi iade sipariş numarasını girin (ör. ORD-…).'
              : 'Barkodu yazın veya okutun; «Bul» ile ürünü seçip adet ile stok ekleyin veya düşürün.'}
          </p>
        </header>
      ) : null}

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

      {mode === 'sale' && (
        <>
          <div className={styles.posSaleShell}>
            <div className={styles.posTopBand}>
              <div className={styles.posTopBandLeft}>
                <span className={styles.posBrand}>POS</span>
                <div className={styles.tabs} role="tablist">
                  <button className={styles.tabActive} type="button">
                    Satış
                  </button>
                  <button
                    className={styles.tab}
                    onClick={() => switchMode('refund')}
                    type="button"
                  >
                    İade
                  </button>
                  <button
                    className={styles.tab}
                    onClick={() => switchMode('stock')}
                    type="button"
                  >
                    Stok
                  </button>
                </div>
              </div>
              <div className={styles.posTopBandRight}>
                <button
                  aria-expanded={notifDrawerOpen}
                  aria-label="Kritik stok bildirimleri"
                  className={styles.posNotifyBell}
                  onClick={toggleNotifDrawer}
                  type="button"
                >
                  <span aria-hidden="true">🔔</span>
                  {criticalCount > 0 ? (
                    <span className={styles.posNotifyBadge}>
                      {criticalCount > 99 ? '99+' : criticalCount}
                    </span>
                  ) : null}
                </button>
                <div aria-live="polite" className={styles.posTotalBoard}>
                  <span className={styles.posTotalBoardLabel}>TOPLAM</span>
                  <span className={styles.posTotalBoardValue}>{total.toFixed(2)}</span>
                  <span className={styles.posTotalBoardCur}>₺</span>
                </div>
              </div>
            </div>
            <p className={styles.posMicroHint}>
              Barkod (5×barkod) · <strong>F9</strong> ödeme · <strong>ESC</strong> sepet temizle
            </p>

            <form className={styles.posBarcodeBand} onSubmit={handleBarcodeSubmit}>
              <label className={styles.posBarcodeLbl} htmlFor="pos-bc-inp">
                BARKOD
              </label>
              <div className={styles.posBarcodeTrack}>
                <input
                  ref={inputRef}
                  autoComplete="off"
                  className={styles.posBarcodeInput}
                  id="pos-bc-inp"
                  inputMode="numeric"
                  name="barcode"
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="barkodu girin"
                  value={barcode}
                />
                <button className={styles.btnSecondary} disabled={isPending} type="submit">
                  Ekle
                </button>
              </div>
            </form>

            <div className={styles.posDesk}>
              <section className={styles.posPaneLeft} aria-label="Sepet">
                <h2 className={styles.posPaneTitle}>Sepet</h2>
                <div className={styles.cartTableWrap}>
                  {cart.length === 0 ? (
                    <p className={styles.empty}>Henüz ürün yok.</p>
                  ) : (
                    <table className={styles.cartTable}>
                      <thead>
                        <tr>
                          <th>Barkod</th>
                          <th>Ürün</th>
                          <th className={styles.colNum}>Birim</th>
                          <th className={styles.colNum}>Adet</th>
                          <th className={styles.colNum}>Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((line) => (
                          <tr
                            className={
                              selectedProductId === line.productId
                                ? styles.cartRowActive
                                : undefined
                            }
                            key={line.productId}
                            onClick={() => setSelectedProductId(line.productId)}
                          >
                            <td className={styles.cellMuted}>{line.barcode || '—'}</td>
                            <td>{line.name}</td>
                            <td className={styles.colNum}>{line.unitPrice.toFixed(2)}</td>
                            <td className={styles.colNum}>{line.quantity}</td>
                            <td className={styles.colNum}>
                              <strong>
                                {(line.unitPrice * line.quantity).toFixed(2)}
                              </strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section className={styles.posPaneMid} aria-label="Seçili ürün">
                <div className={styles.posPreviewBox}>
                  {selectedLine ? (
                    selectedLine.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className={styles.posPreviewImg}
                        src={selectedLine.imageUrl}
                      />
                    ) : (
                      <div className={styles.posPreviewPh}>
                        {selectedLine.name.slice(0, 1).toUpperCase()}
                      </div>
                    )
                  ) : (
                    <span className={styles.posPreviewEmpty}>Satır seçin</span>
                  )}
                </div>
                <div className={styles.posMidActions}>
                  <button
                    className={styles.posMidBtn}
                    disabled={!selectedLine || isPending}
                    onClick={() =>
                      selectedLine &&
                      setQty(selectedLine.productId, selectedLine.quantity + 1)
                    }
                    type="button"
                  >
                    Artır
                  </button>
                  <button
                    className={styles.posMidBtn}
                    disabled={!selectedLine || isPending}
                    onClick={() =>
                      selectedLine &&
                      setQty(selectedLine.productId, selectedLine.quantity - 1)
                    }
                    type="button"
                  >
                    Azalt
                  </button>
                  <button
                    className={styles.posMidBtnDanger}
                    disabled={!selectedLine || isPending}
                    onClick={() =>
                      selectedLine && removeLine(selectedLine.productId)
                    }
                    type="button"
                  >
                    Sil
                  </button>
                </div>
              </section>

              <section className={styles.posPaneRight} aria-label="Ürün kataloğu">
                <h2 className={styles.posPaneTitle}>Ürünler</h2>
                <div className={styles.posRootTabs}>
                  <button
                    className={
                      activeRootGroupId === 'all' ? styles.posRootTabOn : styles.posRootTab
                    }
                    onClick={() => setCategoryId('all')}
                    type="button"
                  >
                    TÜMÜ
                  </button>
                  {categoryGroups.map((g) => (
                    <button
                      className={
                        activeRootGroupId === g.id ? styles.posRootTabOn : styles.posRootTab
                      }
                      key={g.id}
                      onClick={() => setCategoryId(g.chips[0].id)}
                      type="button"
                    >
                      {(g.title ?? g.chips[0]?.label ?? '—').toLocaleUpperCase('tr')}
                    </button>
                  ))}
                </div>
                {activeRootGroupId !== 'all' ? (
                  <div className={styles.posSubChips}>
                    {categoryGroups
                      .find((g) => g.id === activeRootGroupId)
                      ?.chips.map((c) => (
                        <button
                          className={categoryId === c.id ? styles.chipActive : styles.chip}
                          key={`${activeRootGroupId}-${c.id}`}
                          onClick={() => setCategoryId(c.id)}
                          type="button"
                        >
                          {c.label}
                        </button>
                      ))}
                  </div>
                ) : null}
                <input
                  className={styles.searchInput}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Ürün veya barkod ara…"
                  type="search"
                  value={productSearch}
                />
                <div className={styles.posProductGrid}>
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
                      <span className={styles.productNameKiosk}>{p.name}</span>
                      <span className={styles.productMeta}>
                        {p.salePrice.toFixed(2)} ₺ · Stok {p.stock}
                      </span>
                    </button>
                  ))}
                </div>
                {filteredCatalog.length === 0 ? (
                  <p className={styles.empty}>Bu filtreye uygun ürün yok.</p>
                ) : null}
              </section>
            </div>
          </div>

          {notifDrawerOpen ? (
            <>
              <div
                className={styles.posNotifyBackdrop}
                onClick={() => setNotifDrawerOpen(false)}
                role="presentation"
              />
              <aside
                aria-labelledby="pos-notif-title"
                aria-modal="true"
                className={styles.posNotifyDrawer}
                role="dialog"
              >
                <div className={styles.posNotifyDrawerHead}>
                  <h2 className={styles.posNotifyDrawerTitle} id="pos-notif-title">
                    Kritik stok
                  </h2>
                  <button
                    aria-label="Kapat"
                    className={styles.posNotifyClose}
                    onClick={() => setNotifDrawerOpen(false)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
                <p className={styles.posNotifySub}>
                  Mevcut stok, ürünün kritik eşiğine eşit veya altında (POS’ta satışa açık
                  ürünler).
                </p>
                <ul className={styles.posNotifyList}>
                  {criticalStockItems.length === 0 ? (
                    <li className={styles.posNotifyEmpty}>Şu an kritik ürün yok.</li>
                  ) : (
                    criticalStockItems.map((it) => (
                      <li className={styles.posNotifyItem} key={it.id}>
                        <span className={styles.posNotifyItemName}>{it.name}</span>
                        <span className={styles.posNotifyItemMeta}>
                          Stok {it.stock} · Eşik ≤{it.lowStockThreshold}
                        </span>
                        <span className={styles.posNotifyItemBc}>{it.barcode}</span>
                      </li>
                    ))
                  )}
                </ul>
              </aside>
            </>
          ) : null}

          <footer className={styles.footer}>
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
      )}

      {mode === 'refund' && (
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

      {mode === 'stock' && (
        <section className={styles.stockPanel}>
          <form className={styles.stockLookupForm} onSubmit={handleStockLookupSubmit}>
            <label className={styles.stockLbl} htmlFor="pos-stock-bc">
              Barkod
            </label>
            <div className={styles.stockRow}>
              <input
                ref={stockBarcodeRef}
                autoComplete="off"
                className={styles.barcodeInput}
                id="pos-stock-bc"
                inputMode="numeric"
                onChange={(e) => setStockBarcodeInp(e.target.value)}
                placeholder="Yazın veya okutun"
                value={stockBarcodeInp}
              />
              <button className={styles.btnSecondary} disabled={isPending} type="submit">
                Bul
              </button>
            </div>
          </form>

          {stockPreview ? (
            <div className={styles.stockCard}>
              <div className={styles.stockCardHead}>
                <strong>{stockPreview.name}</strong>
                <span className={styles.stockCardMeta}>
                  Mevcut stok: <strong>{stockPreview.stock}</strong> · Kritik eşik:{' '}
                  {stockPreview.lowStockThreshold}
                </span>
              </div>
              <form className={styles.stockApplyForm} onSubmit={handleStockApplySubmit}>
                <label className={styles.stockLbl} htmlFor="pos-stock-delta">
                  Adet değişimi (+ giriş, − çıkış)
                </label>
                <p className={styles.stockHelp}>
                  Pozitif sayı mal girişi (hareket: satın alma), negatif düzeltme / düşüm (hareket:
                  düzeltme).
                </p>
                <input
                  className={styles.stockDeltaInput}
                  id="pos-stock-delta"
                  inputMode="text"
                  onChange={(e) => setStockDeltaStr(e.target.value)}
                  placeholder="örn. 24 veya −3"
                  type="text"
                  value={stockDeltaStr}
                />
                <label className={styles.stockLbl} htmlFor="pos-stock-note">
                  Not (isteğe bağlı)
                </label>
                <textarea
                  className={styles.stockNoteInput}
                  id="pos-stock-note"
                  onChange={(e) => setStockNote(e.target.value)}
                  placeholder="Tedarik, fire, sayım…"
                  rows={2}
                  value={stockNote}
                />
                <button className={styles.stockApplyBtn} disabled={isPending} type="submit">
                  Stoğu güncelle
                </button>
              </form>
            </div>
          ) : (
            <p className={styles.stockEmptyHint}>Barkod girip «Bul» ile ürün seçin.</p>
          )}
        </section>
      )}
    </div>
  )
}
