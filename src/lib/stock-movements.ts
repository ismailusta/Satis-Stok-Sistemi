import type { Payload, PayloadRequest } from 'payload'

import type { StockMovementType } from '@/collections/StockMovements'

export type ApplyProductStockChangeArgs = {
  productId: string | number
  delta: number
  type: StockMovementType
  idempotencyKey: string
  orderId?: string | number | null
  orderLineId?: string | null
  note?: string | null
  req?: PayloadRequest
}

/**
 * Stok değişimini tek kapıdan uygular: idempotency kontrolü, hareket kaydı, ürün stoğu güncelleme.
 */
export async function applyProductStockChange(
  payload: Payload,
  args: ApplyProductStockChangeArgs,
): Promise<void> {
  const delta = Number(args.delta)
  if (!Number.isFinite(delta) || delta === 0) {
    return
  }

  const key = String(args.idempotencyKey).trim()
  if (!key) {
    throw new Error('Stok hareketi için idempotency anahtarı gerekli.')
  }

  const dup = await payload.find({
    collection: 'stock-movements',
    where: { idempotencyKey: { equals: key } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req: args.req,
  })
  if (dup.docs.length > 0) {
    return
  }

  const pid = String(args.productId)
  const product = await payload.findByID({
    collection: 'products',
    id: pid,
    depth: 0,
    overrideAccess: true,
    req: args.req,
  })

  const current = Number(product.stock)
  const next = current + delta
  if (next < 0) {
    throw new Error(`Stok yetersiz veya tutarsız: ${product.name}`)
  }

  const user = args.req?.user
  let recordedByNum: number | undefined
  if (user && typeof user === 'object' && 'id' in user && user.id != null) {
    const uid = Number((user as { id: string | number }).id)
    if (Number.isFinite(uid)) recordedByNum = uid
  }

  const productNum = Number(pid)
  if (!Number.isFinite(productNum)) {
    throw new Error('Geçersiz ürün id.')
  }

  let orderNum: number | undefined
  if (args.orderId != null && args.orderId !== '') {
    const n = Number(args.orderId)
    if (Number.isFinite(n)) orderNum = n
  }

  await payload.create({
    collection: 'stock-movements',
    data: {
      product: productNum,
      delta,
      type: args.type,
      ...(orderNum != null ? { order: orderNum } : {}),
      orderLineId: args.orderLineId?.trim() || undefined,
      note: args.note?.trim() || undefined,
      idempotencyKey: key,
      ...(recordedByNum != null ? { recordedBy: recordedByNum } : {}),
    },
    overrideAccess: true,
    req: args.req,
  })

  await payload.update({
    collection: 'products',
    id: product.id,
    data: { stock: next },
    overrideAccess: true,
    req: args.req,
  })
}
