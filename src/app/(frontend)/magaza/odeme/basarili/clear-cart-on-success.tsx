'use client'

import { useEffect } from 'react'

import { useMagazaCart } from '../../cart-context'

/** Ödeme sonrası dönüşte sepeti temizler (aynı tarayıcı oturumu). */
export function ClearCartOnSuccess() {
  const { clear } = useMagazaCart()
  useEffect(() => {
    clear()
  }, [clear])
  return null
}
