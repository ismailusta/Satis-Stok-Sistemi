'use server'

import { getPayload } from 'payload'

import config from '@/payload.config'

function extractAddressFromNotes(notes: string | null | undefined): string {
  if (!notes?.trim()) return '—'
  const m = notes.match(/Adres:\s*([^\n]+)/i)
  return m ? m[1].trim() : notes.trim().slice(0, 280)
}

async function getCourierIdByToken(token: string): Promise<string | null> {
  const trimmed = token.trim()
  if (!trimmed) return null
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { docs } = await payload.find({
    collection: 'couriers',
    where: { accessToken: { equals: trimmed } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (!docs.length) return null
  return String(docs[0].id)
}

export type CourierOrderRow = {
  id: string
  orderNumber: string
  totalAmount: number
  fulfillmentStatus: string
  addressLine: string
  createdAt: string
}

export type CourierSessionResult =
  | { ok: true; courierName: string; orders: CourierOrderRow[] }
  | { ok: false; error: string }

export async function loadCourierDashboard(token: string): Promise<CourierSessionResult> {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const trimmed = token.trim()
    if (!trimmed) return { ok: false, error: 'Geçersiz bağlantı.' }

    const { docs: couriers } = await payload.find({
      collection: 'couriers',
      where: { accessToken: { equals: trimmed } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!couriers.length) {
      return { ok: false, error: 'Bu bağlantı geçerli değil. Yöneticiden yeni link isteyin.' }
    }
    const c = couriers[0]
    const courierId = c.id

    const { docs: orders } = await payload.find({
      collection: 'orders',
      where: {
        and: [
          { source: { equals: 'online' } },
          { status: { equals: 'completed' } },
          { assignedCourier: { equals: courierId } },
          {
            or: [
              { fulfillmentStatus: { equals: 'preparing' } },
              { fulfillmentStatus: { equals: 'in_transit' } },
            ],
          },
        ],
      },
      sort: 'createdAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    const rows: CourierOrderRow[] = orders.map((doc) => {
      const ca = doc.createdAt as string | Date | undefined
      const createdAtIso =
        ca instanceof Date
          ? ca.toISOString()
          : typeof ca === 'string'
            ? ca
            : new Date().toISOString()
      return {
        id: String(doc.id),
        orderNumber: String(doc.orderNumber ?? ''),
        totalAmount: Number(doc.totalAmount ?? 0),
        fulfillmentStatus: String((doc as { fulfillmentStatus?: string }).fulfillmentStatus ?? ''),
        addressLine: extractAddressFromNotes(
          typeof doc.notes === 'string' ? doc.notes : null,
        ),
        createdAt: createdAtIso,
      }
    })

    return {
      ok: true,
      courierName: String(c.name ?? 'Kurye'),
      orders: rows,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Yüklenemedi.'
    return { ok: false, error: msg }
  }
}

export type CourierActionResult = { ok: true } | { ok: false; error: string }

export async function courierMarkOnTheWay(
  token: string,
  orderId: string,
): Promise<CourierActionResult> {
  const courierId = await getCourierIdByToken(token)
  if (!courierId) return { ok: false, error: 'Oturum geçersiz.' }
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const doc = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
    })
    const assigned = doc.assignedCourier
    const aid =
      assigned && typeof assigned === 'object' && assigned !== null && 'id' in assigned
        ? String((assigned as { id: unknown }).id)
        : assigned != null
          ? String(assigned)
          : null
    if (aid !== courierId) {
      return { ok: false, error: 'Bu sipariş size atanmamış.' }
    }
    if (doc.source !== 'online' || doc.status !== 'completed') {
      return { ok: false, error: 'Sipariş güncellenemez.' }
    }
    if (doc.fulfillmentStatus !== 'preparing') {
      return { ok: false, error: 'Bu sipariş hazırlanıyor durumunda değil.' }
    }
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { fulfillmentStatus: 'in_transit' },
      overrideAccess: true,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'İşlem başarısız.'
    return { ok: false, error: msg }
  }
}

export async function courierMarkDelivered(
  token: string,
  orderId: string,
): Promise<CourierActionResult> {
  const courierId = await getCourierIdByToken(token)
  if (!courierId) return { ok: false, error: 'Oturum geçersiz.' }
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const doc = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
    })
    const assigned = doc.assignedCourier
    const aid =
      assigned && typeof assigned === 'object' && assigned !== null && 'id' in assigned
        ? String((assigned as { id: unknown }).id)
        : assigned != null
          ? String(assigned)
          : null
    if (aid !== courierId) {
      return { ok: false, error: 'Bu sipariş size atanmamış.' }
    }
    if (doc.source !== 'online' || doc.status !== 'completed') {
      return { ok: false, error: 'Sipariş güncellenemez.' }
    }
    if (doc.fulfillmentStatus !== 'in_transit') {
      return { ok: false, error: 'Önce “Yola çıktım” ile yolda işaretleyin.' }
    }
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { fulfillmentStatus: 'delivered' },
      overrideAccess: true,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'İşlem başarısız.'
    return { ok: false, error: msg }
  }
}
