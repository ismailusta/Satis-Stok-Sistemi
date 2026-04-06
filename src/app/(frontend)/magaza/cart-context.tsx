'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useMagazaAuth } from './auth-context'
import type { StoreProduct } from './actions'

export type CartLine = {
  productId: string
  name: string
  salePrice: number
  quantity: number
  maxStock: number
  imageUrl: string | null
}

const STORAGE_KEY = 'magaza-cart-v1'

type CartContextValue = {
  lines: CartLine[]
  addProduct: (p: StoreProduct, qty?: number) => void
  setQty: (productId: string, quantity: number) => void
  removeLine: (productId: string) => void
  clear: () => void
  total: number
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

export function MagazaCartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, openAuthModal } = useMagazaAuth()
  const [lines, setLines] = useState<CartLine[]>([])
  const prevAuth = useRef(isAuthenticated)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as CartLine[]
      if (Array.isArray(parsed)) setLines(parsed)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* ignore */
    }
  }, [lines])

  useEffect(() => {
    if (prevAuth.current && !isAuthenticated) {
      setLines([])
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
    prevAuth.current = isAuthenticated
  }, [isAuthenticated])

  const addProductInternal = useCallback((p: StoreProduct, qty: number) => {
    const q = Math.floor(qty)
    if (!Number.isFinite(q) || q < 1) return
    if (p.stock < 1) return
    if (q > p.stock) return
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id)
      if (idx === -1) {
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            salePrice: p.salePrice,
            quantity: Math.min(q, p.stock),
            maxStock: p.stock,
            imageUrl: p.imageUrl,
          },
        ]
      }
      const next = [...prev]
      const line = next[idx]
      const newQty = line.quantity + q
      if (newQty > p.stock) return prev
      next[idx] = {
        ...line,
        quantity: newQty,
        maxStock: p.stock,
        salePrice: p.salePrice,
        imageUrl: p.imageUrl ?? line.imageUrl,
      }
      return next
    })
  }, [])

  const addProduct = useCallback(
    (p: StoreProduct, qty = 1) => {
      const q = Math.floor(qty)
      if (!Number.isFinite(q) || q < 1) return
      if (!isAuthenticated) {
        openAuthModal(() => {
          addProductInternal(p, q)
        })
        return
      }
      addProductInternal(p, q)
    },
    [isAuthenticated, openAuthModal, addProductInternal],
  )

  const setQty = useCallback((productId: string, quantity: number) => {
    setLines((prev) => {
      const line = prev.find((l) => l.productId === productId)
      if (!line) return prev
      if (quantity > line.maxStock) return prev
      if (quantity < 1) return prev.filter((l) => l.productId !== productId)
      return prev.map((l) =>
        l.productId === productId ? { ...l, quantity } : l,
      )
    })
  }, [])

  const removeLine = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.salePrice * l.quantity, 0),
    [lines],
  )

  const itemCount = useMemo(
    () => lines.reduce((s, l) => s + l.quantity, 0),
    [lines],
  )

  const value = useMemo(
    () => ({
      lines,
      addProduct,
      setQty,
      removeLine,
      clear,
      total,
      itemCount,
    }),
    [lines, addProduct, setQty, removeLine, clear, total, itemCount],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useMagazaCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useMagazaCart must be used within MagazaCartProvider')
  }
  return ctx
}
