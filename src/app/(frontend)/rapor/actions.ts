'use server'

import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'

import config from '@/payload.config'

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

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function getProductId(product: unknown): string | undefined {
  if (product === null || product === undefined) return undefined
  if (typeof product === 'object' && 'id' in product) {
    return String((product as { id: string | number }).id)
  }
  if (typeof product === 'string' || typeof product === 'number') return String(product)
  return undefined
}

export type SalesSummaryResult =
  | {
      ok: true
      from: string
      to: string
      orderCount: number
      revenueTotal: number
      bySource: { pos: number; online: number }
    }
  | { ok: false; error: string }

export async function getSalesSummary(fromStr: string, toStr: string): Promise<SalesSummaryResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli.' }
  }

  const from = startOfDay(new Date(fromStr))
  const to = endOfDay(new Date(toStr))
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: 'Geçersiz tarih.' }
  }
  if (from > to) {
    return { ok: false, error: 'Başlangıç tarihi bitişten sonra olamaz.' }
  }

  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [
        {
          or: [
            { status: { equals: 'completed' } },
            { status: { equals: 'partially_refunded' } },
            { status: { equals: 'refunded' } },
          ],
        },
        { createdAt: { greater_than_equal: from.toISOString() } },
        { createdAt: { less_than_equal: to.toISOString() } },
      ],
    },
    limit: 10000,
    depth: 0,
    overrideAccess: true,
  })

  let revenueTotal = 0
  const bySource = { pos: 0, online: 0 }

  for (const o of docs) {
    const amt = Number(o.totalAmount ?? 0)
    revenueTotal += amt
    if (o.source === 'online') {
      bySource.online += amt
    } else {
      bySource.pos += amt
    }
  }

  return {
    ok: true,
    from: from.toISOString(),
    to: to.toISOString(),
    orderCount: docs.length,
    revenueTotal: Math.round(revenueTotal * 100) / 100,
    bySource: {
      pos: Math.round(bySource.pos * 100) / 100,
      online: Math.round(bySource.online * 100) / 100,
    },
  }
}

export type TopProductRow = {
  productId: string
  name: string
  qtySold: number
  revenue: number
}

export type TopProductsResult =
  | { ok: true; rows: TopProductRow[] }
  | { ok: false; error: string }

export async function getTopProducts(
  fromStr: string,
  toStr: string,
  limit = 15,
): Promise<TopProductsResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli.' }
  }

  const from = startOfDay(new Date(fromStr))
  const to = endOfDay(new Date(toStr))
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: 'Geçersiz tarih.' }
  }
  if (from > to) {
    return { ok: false, error: 'Başlangıç tarihi bitişten sonra olamaz.' }
  }

  const { docs: orders } = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { status: { equals: 'completed' } },
        { createdAt: { greater_than_equal: from.toISOString() } },
        { createdAt: { less_than_equal: to.toISOString() } },
      ],
    },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })

  const agg = new Map<string, { qty: number; revenue: number }>()

  for (const o of orders) {
    for (const item of (o.items as Array<Record<string, unknown>> | undefined) ?? []) {
      const pid = getProductId(item.product)
      if (!pid) continue
      const q = Number(item.quantity ?? 0)
      const lineTotal =
        item.lineTotal !== undefined && item.lineTotal !== null
          ? Number(item.lineTotal)
          : q * Number(item.unitPrice ?? 0)
      if (q < 1) continue
      const cur = agg.get(pid) ?? { qty: 0, revenue: 0 }
      cur.qty += q
      cur.revenue += Math.round(lineTotal * 100) / 100
      agg.set(pid, cur)
    }
  }

  const ids = [...agg.keys()]
  const names = new Map<string, string>()
  for (const id of ids) {
    try {
      const p = await payload.findByID({
        collection: 'products',
        id,
        depth: 0,
        overrideAccess: true,
      })
      names.set(id, String(p.name))
    } catch {
      names.set(id, `Ürün #${id}`)
    }
  }

  const rows: TopProductRow[] = [...agg.entries()]
    .map(([productId, v]) => ({
      productId,
      name: names.get(productId) ?? productId,
      qtySold: v.qty,
      revenue: Math.round(v.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, Math.min(50, Math.max(1, limit)))

  return { ok: true, rows }
}
