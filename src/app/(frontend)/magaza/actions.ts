'use server'

import { getPayload } from 'payload'

import config from '@/payload.config'

import type { CartLineInput } from '../pos/actions'

function mediaUrlFromRelation(image: unknown): string | null {
  if (!image || typeof image !== 'object') return null
  const u = (image as { url?: string }).url
  return typeof u === 'string' && u.length > 0 ? u : null
}

export type StoreProduct = {
  id: string
  name: string
  salePrice: number
  stock: number
  imageUrl: string | null
}

export type ListStoreProductsResult =
  | { ok: true; products: StoreProduct[] }
  | { ok: false; error: string }

export async function listStoreProducts(): Promise<ListStoreProductsResult> {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    const { docs } = await payload.find({
      collection: 'products',
      where: { stock: { greater_than: 0 } },
      limit: 500,
      depth: 1,
      sort: 'name',
      overrideAccess: true,
    })

    return {
      ok: true,
      products: docs.map((p) => ({
        id: String(p.id),
        name: p.name,
        salePrice: Number(p.salePrice),
        stock: Number(p.stock),
        imageUrl: mediaUrlFromRelation(p.image),
      })),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ürünler yüklenemedi.'
    return { ok: false, error: message }
  }
}

export type OnlineCheckoutInput = {
  lines: CartLineInput[]
  customerName: string
  phone: string
  address: string
}

export type SubmitOnlineOrderResult =
  | { ok: true; orderNumber: string; orderId: string | number }
  | { ok: false; error: string }

const MAX_LINES = 30
const MAX_QTY_PER_LINE = 99

export async function submitOnlineOrder(input: OnlineCheckoutInput): Promise<SubmitOnlineOrderResult> {
  const name = input.customerName.trim()
  const phone = input.phone.trim()
  const address = input.address.trim()

  if (name.length < 2) {
    return { ok: false, error: 'Ad soyad girin.' }
  }
  if (phone.length < 8) {
    return { ok: false, error: 'Geçerli bir telefon girin.' }
  }
  if (address.length < 5) {
    return { ok: false, error: 'Teslimat adresi girin.' }
  }

  const lines = input.lines ?? []
  if (!lines.length) {
    return { ok: false, error: 'Sepet boş.' }
  }
  if (lines.length > MAX_LINES) {
    return { ok: false, error: 'Sepet çok fazla kalem içeriyor.' }
  }

  const merged = new Map<string, number>()
  for (const line of lines) {
    const id = line.productId
    const q = Math.floor(Number(line.quantity))
    if (!id || q < 1) continue
    if (q > MAX_QTY_PER_LINE) {
      return { ok: false, error: 'Bir ürün için adet çok yüksek.' }
    }
    merged.set(id, (merged.get(id) ?? 0) + q)
  }

  if (merged.size === 0) {
    return { ok: false, error: 'Geçerli satır yok.' }
  }

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

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
        overrideAccess: true,
      })

      if (Number(p.stock) < quantity) {
        return {
          ok: false,
          error: `Yetersiz stok: ${p.name} (kalan: ${p.stock}).`,
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

    const notes =
      `[Online mağaza]\n` +
      `Ad: ${name}\n` +
      `Tel: ${phone}\n` +
      `Adres: ${address}`

    const order = await payload.create({
      collection: 'orders',
      data: {
        source: 'online',
        status: 'completed',
        items,
        totalAmount,
        paymentMethod: 'card',
        cashReceived: null,
        changeGiven: null,
        notes,
      },
      overrideAccess: true,
    })

    return {
      ok: true,
      orderId: order.id,
      orderNumber: String(order.orderNumber),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sipariş oluşturulamadı.'
    return { ok: false, error: message }
  }
}
