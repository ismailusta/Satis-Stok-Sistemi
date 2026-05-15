/** Senkron yardımcı; 'use server' dosyalarından ayrı (Next.js Server Actions kuralları). */

export type OnlineOrderStatusFields = {
  orderStatus: string
  fulfillmentStatus: string | null
}

export function formatOnlineOrderStatus(o: OnlineOrderStatusFields): string {
  const st = o.orderStatus
  if (st === 'draft') return 'Ödeme bekleniyor'
  if (st === 'cancelled') return 'Sipariş iptal'
  if (st === 'refunded') return 'İade tamamlandı'
  if (st === 'partially_refunded') return 'Kısmi iade'
  if (st !== 'completed') return st || '—'
  const f = o.fulfillmentStatus
  if (f === 'in_transit') return 'Yolda (kurye çıktı)'
  if (f === 'delivered') return 'Teslim edildi'
  if (f === 'preparing' || !f || f === 'na') return 'Hazırlanıyor'
  return 'Hazırlanıyor'
}
