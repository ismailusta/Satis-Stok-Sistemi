'use server'

import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'

import { isPosVisible, posVisibilityWhere, whereAnd } from '@/lib/product-visibility'

import config from '@/payload.config'

function mediaUrlFromRelation(image: unknown): string | null {
  if (!image || typeof image !== 'object') return null
  const u = (image as { url?: string }).url
  return typeof u === 'string' && u.length > 0 ? u : null
}

export type LookupResult =
  | { ok: true; product: PosProduct }
  | { ok: false; error: string }

export type PosProduct = {
  id: string
  name: string
  salePrice: number
  stock: number
  barcode: string
  /** Payload media URL (relative veya mutlak) */
  imageUrl: string | null
}

async function requireStaff() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  if (!user) {
    return { payload: null as Awaited<ReturnType<typeof getPayload>> | null, user: null }
  }
  return { payload, user }
}

export async function lookupProductByBarcode(barcode: string): Promise<LookupResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli. Admin panelinden giriş yapın.' }
  }

  const trimmed = barcode.trim()
  if (!trimmed) {
    return { ok: false, error: 'Barkod boş olamaz.' }
  }

  const { docs } = await payload.find({
    collection: 'products',
    where: { barcode: { equals: trimmed } },
    limit: 1,
    depth: 1,
  })

  if (!docs.length) {
    return { ok: false, error: 'Bu barkoda ait ürün yok.' }
  }

  const p = docs[0]
  if (!isPosVisible(p as { showInPos?: unknown })) {
    return { ok: false, error: 'Bu ürün kasada satışa kapalı.' }
  }
  return {
    ok: true,
    product: {
      id: String(p.id),
      name: p.name,
      salePrice: Number(p.salePrice),
      stock: Number(p.stock),
      barcode: String(p.barcode),
      imageUrl: mediaUrlFromRelation(p.image),
    },
  }
}

/** Sepetteki ürünlerin güncel stok / fiyat bilgisini getirir (online satış vb. sonrası senkron için). */
export type StockSnapshot = {
  productId: string
  stock: number
  name: string
  salePrice: number
  imageUrl: string | null
}

export type StockRefreshResult =
  | { ok: true; lines: StockSnapshot[] }
  | { ok: false; error: string }

export async function refreshCartStock(productIds: string[]): Promise<StockRefreshResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli. Admin panelinden giriş yapın.' }
  }

  const unique = [...new Set(productIds.filter(Boolean))]
  if (unique.length === 0) {
    return { ok: true, lines: [] }
  }

  const lines: StockSnapshot[] = []

  for (const id of unique) {
    try {
      const p = await payload.findByID({
        collection: 'products',
        id,
        depth: 1,
      })
      lines.push({
        productId: String(p.id),
        stock: Number(p.stock),
        name: p.name,
        salePrice: Number(p.salePrice),
        imageUrl: mediaUrlFromRelation(p.image),
      })
    } catch {
      lines.push({
        productId: id,
        stock: 0,
        name: 'Ürün',
        salePrice: 0,
        imageUrl: null,
      })
    }
  }

  return { ok: true, lines }
}

/** POS katalog filtresi: üst kategori başlığı + chip’ler (Tümü + alt kategoriler veya tek kök). */
export type PosCategoryChip = { id: string; label: string }

export type PosCategoryGroup = {
  id: string
  /** Alt kategori varsa üst adı; yoksa başlık gösterilmez */
  title: string | null
  chips: PosCategoryChip[]
}

export type CategoriesResult =
  | { ok: true; groups: PosCategoryGroup[] }
  | { ok: false; error: string }

function categoryParentIdRaw(
  c: { parent?: unknown },
  validIds: Set<string>,
): string | null {
  const raw = c.parent
  if (raw == null || raw === false) return null
  let pid: string | null = null
  if (typeof raw === 'object' && raw && 'id' in raw) {
    pid = String((raw as { id: unknown }).id)
  } else if (typeof raw === 'string' || typeof raw === 'number') {
    pid = String(raw)
  }
  if (!pid || !validIds.has(pid)) return null
  return pid
}

export async function listCategoriesForPos(): Promise<CategoriesResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli.' }
  }
  const { docs } = await payload.find({
    collection: 'categories',
    sort: 'name',
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  const ids = new Set(docs.map((d) => String(d.id)))

  type Row = { id: string; name: string; pid: string | null }
  const all: Row[] = docs.map((c) => ({
    id: String(c.id),
    name: c.name,
    pid: categoryParentIdRaw(c as { parent?: unknown }, ids),
  }))

  const roots = all.filter((x) => !x.pid).sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  const childrenOf = (rootId: string) =>
    all.filter((x) => x.pid === rootId).sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  const groups: PosCategoryGroup[] = roots.map((root) => {
    const kids = childrenOf(root.id)
    if (kids.length > 0) {
      return {
        id: root.id,
        title: root.name,
        chips: [
          { id: root.id, label: 'Tümü' },
          ...kids.map((k) => ({ id: k.id, label: k.name })),
        ],
      }
    }
    return {
      id: root.id,
      title: null,
      chips: [{ id: root.id, label: root.name }],
    }
  })

  return { ok: true, groups }
}

export type ProductsListResult =
  | { ok: true; products: PosProduct[] }
  | { ok: false; error: string }

/** Kategoriye göre ürünler (tümü: categoryId = 'all' veya boş). Üst kategori = altlarındaki ürünler (online mağaza ile aynı). */
export async function listProductsForPos(categoryId?: string | null): Promise<ProductsListResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli.' }
  }

  if (!categoryId || categoryId === 'all') {
    const { docs } = await payload.find({
      collection: 'products',
      where: posVisibilityWhere(),
      sort: 'name',
      limit: 1000,
      depth: 1,
      overrideAccess: true,
    })
    return {
      ok: true,
      products: docs.map((p) => ({
        id: String(p.id),
        name: p.name,
        salePrice: Number(p.salePrice),
        stock: Number(p.stock),
        barcode: String(p.barcode),
        imageUrl: mediaUrlFromRelation(p.image),
      })),
    }
  }

  const cat = await payload.findByID({
    collection: 'categories',
    id: categoryId,
    depth: 0,
    overrideAccess: true,
  })

  const { docs: childCats } = await payload.find({
    collection: 'categories',
    where: { parent: { equals: cat.id } },
    limit: 200,
    depth: 0,
    sort: 'name',
    overrideAccess: true,
  })

  const categoryFilter =
    childCats.length > 0
      ? { category: { in: childCats.map((c) => c.id) } }
      : { category: { equals: cat.id } }

  const { docs } = await payload.find({
    collection: 'products',
    where: whereAnd(categoryFilter, posVisibilityWhere()),
    sort: 'name',
    limit: 1000,
    depth: 1,
    overrideAccess: true,
  })

  return {
    ok: true,
    products: docs.map((p) => ({
      id: String(p.id),
      name: p.name,
      salePrice: Number(p.salePrice),
      stock: Number(p.stock),
      barcode: String(p.barcode),
      imageUrl: mediaUrlFromRelation(p.image),
    })),
  }
}

export type RefundLine = {
  lineId: string
  name: string
  quantity: number
  quantityRefunded: number
  unitPrice: number
  lineTotal: number
}

export type OrderForRefundResult =
  | {
      ok: true
      order: {
        id: string | number
        orderNumber: string
        status: string
        totalAmount: number
        source: string
        items: RefundLine[]
      }
    }
  | { ok: false; error: string }

function lineProductName(item: {
  product: unknown
  quantity: number
  unitPrice?: number
  lineTotal?: number
}): string {
  const rel = item.product
  if (rel && typeof rel === 'object' && 'name' in rel) {
    return String((rel as { name: string }).name)
  }
  return 'Ürün'
}

export async function getOrderForRefund(orderNumber: string): Promise<OrderForRefundResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli.' }
  }

  const trimmed = orderNumber.trim()
  if (!trimmed) {
    return { ok: false, error: 'Sipariş numarası girin.' }
  }

  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: trimmed } },
    limit: 1,
    depth: 2,
  })

  if (!docs.length) {
    return { ok: false, error: 'Bu numaraya ait sipariş yok.' }
  }

  const order = docs[0]
  if (order.status !== 'completed' && order.status !== 'partially_refunded') {
    return {
      ok: false,
      error: `Bu sipariş iade için uygun değil (durum: ${order.status}). Sadece tamamlanmış veya kısmi iade siparişleri işlenebilir.`,
    }
  }

  const items = (order.items ?? []).map((item) => ({
    lineId: String(item.id),
    name: lineProductName(item),
    quantity: Number(item.quantity),
    quantityRefunded: Number(item.quantityRefunded ?? 0),
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal),
  }))

  return {
    ok: true,
    order: {
      id: order.id,
      orderNumber: String(order.orderNumber),
      status: order.status,
      totalAmount: Number(order.totalAmount),
      source: order.source,
      items,
    },
  }
}

export type RefundSubmitResult = { ok: true; orderNumber: string } | { ok: false; error: string }

export async function submitOrderRefund(orderId: string | number): Promise<RefundSubmitResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli.' }
  }

  const existing = await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
  })
  if (
    existing.status !== 'completed' &&
    existing.status !== 'partially_refunded'
  ) {
    return {
      ok: false,
      error: `Bu sipariş iade kapatma için uygun değil (durum: ${existing.status}).`,
    }
  }

  try {
    const updated = await payload.update({
      collection: 'orders',
      id: orderId,
      data: { status: 'refunded', refundClosed: true },
      overrideAccess: true,
    })
    return { ok: true, orderNumber: String(updated.orderNumber) }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'İade kaydedilemedi.'
    return { ok: false, error: message }
  }
}

export type LineRefundResult = { ok: true } | { ok: false; error: string }

/** Satır bazlı iade: her satıra eklenecek iade adedi. Stok hook’ları otomatik güncellenir. */
export async function applyLineRefunds(
  orderId: string | number,
  refunds: { lineId: string; addQuantity: number }[],
): Promise<LineRefundResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli.' }
  }

  if (!refunds.length) {
    return { ok: false, error: 'İade satırı seçin.' }
  }

  const order = await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
  })

  if (order.status !== 'completed' && order.status !== 'partially_refunded') {
    return {
      ok: false,
      error: 'Sadece tamamlanmış veya kısmi iade siparişine satır iadesi yapılabilir.',
    }
  }

  const baseItems = order.items ?? []
  for (const r of refunds) {
    const add = Math.floor(Number(r.addQuantity))
    if (add < 1) continue
    const row = baseItems.find((i) => String(i.id) === r.lineId)
    if (!row) {
      return { ok: false, error: `Satır bulunamadı: ${r.lineId}` }
    }
    const qty = Number(row.quantity)
    const current = Number(row.quantityRefunded ?? 0)
    if (current + add > qty) {
      return {
        ok: false,
        error: `İade adedi satır adedini aşamaz (${row.id}).`,
      }
    }
  }

  const items = baseItems.map((item) => {
    const r = refunds.find((x) => x.lineId === String(item.id))
    if (!r || r.addQuantity <= 0) return item
    const add = Math.floor(Number(r.addQuantity))
    if (add < 1) return item
    const current = Number(item.quantityRefunded ?? 0)
    return { ...item, quantityRefunded: current + add }
  })

  try {
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { items },
      overrideAccess: true,
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'İade uygulanamadı.'
    return { ok: false, error: message }
  }
}

export type CartLineInput = { productId: string; quantity: number }

export type PosPaymentMethod = 'cash' | 'card' | 'credit'

export type PosSalePayment = {
  method: PosPaymentMethod
  /** Nakit: müşterinin verdiği tutar (para üstü sunucuda hesaplanır). */
  cashReceived?: number
}

export type SubmitSaleResult =
  | { ok: true; orderNumber: string; orderId: string | number }
  | { ok: false; error: string }

export async function submitPosSale(
  lines: CartLineInput[],
  payment: PosSalePayment,
): Promise<SubmitSaleResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli. Admin panelinden giriş yapın.' }
  }

  if (!lines.length) {
    return { ok: false, error: 'Sepet boş.' }
  }

  if (!payment?.method) {
    return { ok: false, error: 'Ödeme yöntemi gerekli.' }
  }

  const merged = new Map<string, number>()
  for (const line of lines) {
    const id = line.productId
    const q = Math.floor(Number(line.quantity))
    if (!id || q < 1) continue
    merged.set(id, (merged.get(id) ?? 0) + q)
  }

  if (merged.size === 0) {
    return { ok: false, error: 'Geçerli satır yok.' }
  }

  const items: Array<{
    product: number
    quantity: number
    unitPrice: number
    lineTotal: number
    quantityRefunded: number
  }> = []

  for (const [productId, quantity] of merged) {
    const p = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
    })

    if (!isPosVisible(p as { showInPos?: unknown })) {
      return {
        ok: false,
        error: `Bu ürün kasada satılamaz: ${p.name}`,
      }
    }

    const unitPrice = Number(p.salePrice)
    const lineTotal = Math.round(quantity * unitPrice * 100) / 100

    items.push({
      product: p.id as number,
      quantity,
      unitPrice,
      lineTotal,
      quantityRefunded: 0,
    })
  }

  const totalAmount = items.reduce((s, i) => s + i.lineTotal, 0)

  let cashReceived: number | undefined
  let changeGiven: number | undefined

  if (payment.method === 'cash') {
    const received = Number(payment.cashReceived)
    if (!Number.isFinite(received) || received < totalAmount) {
      return {
        ok: false,
        error: `Nakit tutarı yetersiz veya geçersiz (en az ${totalAmount.toFixed(2)} ₺).`,
      }
    }
    cashReceived = Math.round(received * 100) / 100
    changeGiven = Math.round((cashReceived - totalAmount) * 100) / 100
  }

  try {
    const order = await payload.create({
      collection: 'orders',
      data: {
        source: 'pos',
        status: 'completed',
        items,
        totalAmount,
        paymentMethod: payment.method,
        cashReceived: cashReceived ?? null,
        changeGiven: changeGiven ?? null,
      },
      overrideAccess: true,
    })

    return {
      ok: true,
      orderId: order.id,
      orderNumber: String(order.orderNumber),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Satış kaydedilemedi.'
    return { ok: false, error: message }
  }
}
