'use server'

import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'

import config from '@/payload.config'
import {
  aggregateTopProductsAndCategories,
  endOfDay,
  fetchOrdersForReport,
  startOfDay,
  summarizeOrders,
  type TopCategoryRow,
  type TopProductRow,
} from '@/lib/sales-report'

export type { TopCategoryRow, TopProductRow }

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

  const orders = await fetchOrdersForReport(payload, from, to)
  const summary = summarizeOrders(orders)

  return {
    ok: true,
    from: from.toISOString(),
    to: to.toISOString(),
    ...summary,
  }
}

const MONTHS_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelTr(key: string): string {
  const [ys, ms] = key.split('-')
  const m = Number(ms) - 1
  if (m < 0 || m > 11) return key
  return `${MONTHS_TR[m]} ${ys}`
}

function eachMonthInRange(from: Date, to: Date): string[] {
  const keys: string[] = []
  const cur = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cur <= end) {
    keys.push(monthKeyFromDate(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return keys
}

function eachYearInRange(from: Date, to: Date): number[] {
  const ys: number[] = []
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) ys.push(y)
  return ys
}

export type SalesTrendPoint = {
  key: string
  label: string
  revenue: number
  pos: number
  online: number
  posPct: number
  onlinePct: number
}

export type SalesTrendsResult =
  | { ok: true; byMonth: SalesTrendPoint[]; byYear: SalesTrendPoint[] }
  | { ok: false; error: string }

/** Seçilen aralıkta aylık / yıllık ciro ve POS–online dağılımı (özet kartlarıyla aynı sipariş filtresi). */
export async function getSalesTrends(fromStr: string, toStr: string): Promise<SalesTrendsResult> {
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

  const monthKeys = eachMonthInRange(from, to)
  const monthAgg = new Map<string, { pos: number; online: number }>()
  for (const k of monthKeys) monthAgg.set(k, { pos: 0, online: 0 })

  const years = eachYearInRange(from, to)
  const yearAgg = new Map<number, { pos: number; online: number }>()
  for (const y of years) yearAgg.set(y, { pos: 0, online: 0 })

  for (const o of docs) {
    const created = new Date(String(o.createdAt))
    const mk = monthKeyFromDate(created)
    const amt = Number(o.totalAmount ?? 0)
    const isOnline = o.source === 'online'

    const mb = monthAgg.get(mk)
    if (mb) {
      if (isOnline) mb.online += amt
      else mb.pos += amt
    }

    const yb = yearAgg.get(created.getFullYear())
    if (yb) {
      if (isOnline) yb.online += amt
      else yb.pos += amt
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100

  const toPoint = (key: string, label: string, pos: number, online: number): SalesTrendPoint => {
    const revenue = round2(pos + online)
    const posR = round2(pos)
    const onlineR = round2(online)
    let posPct = 0
    let onlinePct = 0
    if (revenue > 0) {
      posPct = Math.round((posR / revenue) * 1000) / 10
      onlinePct = Math.round((onlineR / revenue) * 1000) / 10
    }
    return { key, label, revenue: revenue, pos: posR, online: onlineR, posPct, onlinePct }
  }

  const byMonth: SalesTrendPoint[] = monthKeys.map((k) => {
    const b = monthAgg.get(k) ?? { pos: 0, online: 0 }
    return toPoint(k, monthLabelTr(k), b.pos, b.online)
  })

  const byYear: SalesTrendPoint[] = years.map((y) => {
    const b = yearAgg.get(y) ?? { pos: 0, online: 0 }
    return toPoint(String(y), String(y), b.pos, b.online)
  })

  return { ok: true, byMonth, byYear }
}

export type TopProductsResult =
  | { ok: true; rows: TopProductRow[] }
  | { ok: false; error: string }

export type TopCategoriesResult =
  | { ok: true; rows: TopCategoryRow[] }
  | { ok: false; error: string }

function parseReportDateRange(
  fromStr: string,
  toStr: string,
): { from: Date; to: Date } | { error: string } {
  const from = startOfDay(new Date(fromStr))
  const to = endOfDay(new Date(toStr))
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { error: 'Geçersiz tarih.' }
  }
  if (from > to) {
    return { error: 'Başlangıç tarihi bitişten sonra olamaz.' }
  }
  return { from, to }
}

export async function getTopProducts(
  fromStr: string,
  toStr: string,
  limit = 15,
): Promise<TopProductsResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli.' }
  }

  const range = parseReportDateRange(fromStr, toStr)
  if ('error' in range) return { ok: false, error: range.error }

  const orders = await fetchOrdersForReport(payload, range.from, range.to)
  const { products } = await aggregateTopProductsAndCategories(
    payload,
    orders,
    Math.min(50, Math.max(1, limit)),
    1,
  )

  return { ok: true, rows: products }
}

export async function getTopCategories(
  fromStr: string,
  toStr: string,
  limit = 15,
): Promise<TopCategoriesResult> {
  const { payload, user } = await requireStaff()
  if (!payload || !user) {
    return { ok: false, error: 'Oturum gerekli.' }
  }

  const range = parseReportDateRange(fromStr, toStr)
  if ('error' in range) return { ok: false, error: range.error }

  const orders = await fetchOrdersForReport(payload, range.from, range.to)
  const { categories } = await aggregateTopProductsAndCategories(
    payload,
    orders,
    1,
    Math.min(50, Math.max(1, limit)),
  )

  return { ok: true, rows: categories }
}
