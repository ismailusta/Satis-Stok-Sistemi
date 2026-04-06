const STORAGE_KEY = 'magaza-order-history-v1'
const MAX = 25

export type MagazaOrderSummary = {
  orderId: string | number
  orderNumber: string
  total: number
  createdAt: string
  itemCount: number
}

export function getOrderHistory(): MagazaOrderSummary[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MagazaOrderSummary[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendOrderHistory(entry: MagazaOrderSummary): void {
  if (typeof window === 'undefined') return
  try {
    const prev = getOrderHistory()
    const next = [entry, ...prev.filter((o) => String(o.orderId) !== String(entry.orderId))].slice(
      0,
      MAX,
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('magaza-orders-updated'))
  } catch {
    /* ignore */
  }
}
