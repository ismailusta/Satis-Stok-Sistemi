import type { Order, Product } from '@/payload-types'
import type { Payload } from 'payload'

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Haftanın pazartesi günü 00:00 (yerel saat). */
export function getMonday(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return startOfDay(x)
}

/** Referans tarihten önceki tam takvim haftası (Pzt–Paz). */
export function getPreviousCalendarWeekRange(ref = new Date()): { from: Date; to: Date } {
  const thisMonday = getMonday(ref)
  const from = new Date(thisMonday)
  from.setDate(from.getDate() - 7)
  const to = new Date(thisMonday)
  to.setDate(to.getDate() - 1)
  return { from: startOfDay(from), to: endOfDay(to) }
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateTr(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatMoneyTr(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getRelationshipId(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw === 'object' && 'id' in raw) return String((raw as { id: string | number }).id)
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
  return undefined
}

const REPORT_ORDER_STATUSES = ['completed', 'partially_refunded', 'refunded'] as const

export async function fetchOrdersForReport(
  payload: Payload,
  from: Date,
  to: Date,
): Promise<Order[]> {
  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [
        {
          or: REPORT_ORDER_STATUSES.map((status) => ({ status: { equals: status } })),
        },
        { createdAt: { greater_than_equal: from.toISOString() } },
        { createdAt: { less_than_equal: to.toISOString() } },
      ],
    },
    limit: 10000,
    depth: 0,
    overrideAccess: true,
  })
  return docs as Order[]
}

export type SalesSummaryData = {
  from: Date
  to: Date
  orderCount: number
  revenueTotal: number
  bySource: { pos: number; online: number }
}

export function summarizeOrders(orders: Order[]): Omit<SalesSummaryData, 'from' | 'to'> {
  let revenueTotal = 0
  const bySource = { pos: 0, online: 0 }

  for (const o of orders) {
    const amt = Number(o.totalAmount ?? 0)
    revenueTotal += amt
    if (o.source === 'online') bySource.online += amt
    else bySource.pos += amt
  }

  const round2 = (n: number) => Math.round(n * 100) / 100

  return {
    orderCount: orders.length,
    revenueTotal: round2(revenueTotal),
    bySource: { pos: round2(bySource.pos), online: round2(bySource.online) },
  }
}

export type TopProductRow = {
  productId: string
  name: string
  categoryId: string
  categoryName: string
  qtySold: number
  revenue: number
}

export type TopCategoryRow = {
  categoryId: string
  name: string
  qtySold: number
  revenue: number
}

type LineAgg = { qty: number; revenue: number }

function netLineQty(item: Record<string, unknown>): number {
  const q = Math.floor(Number(item.quantity ?? 0))
  const refunded = Math.floor(Number(item.quantityRefunded ?? 0))
  return Math.max(0, q - refunded)
}

function lineRevenue(item: Record<string, unknown>, netQty: number): number {
  if (item.lineTotal !== undefined && item.lineTotal !== null) {
    return Number(item.lineTotal)
  }
  return netQty * Number(item.unitPrice ?? 0)
}

export async function aggregateTopProductsAndCategories(
  payload: Payload,
  orders: Order[],
  productLimit = 15,
  categoryLimit = 10,
): Promise<{ products: TopProductRow[]; categories: TopCategoryRow[] }> {
  const productAgg = new Map<string, LineAgg>()
  const productIds = new Set<string>()

  for (const o of orders) {
    for (const item of (o.items as Array<Record<string, unknown>> | undefined) ?? []) {
      const pid = getRelationshipId(item.product)
      if (!pid) continue
      const netQty = netLineQty(item)
      if (netQty < 1) continue
      const rev = Math.round(lineRevenue(item, netQty) * 100) / 100
      const cur = productAgg.get(pid) ?? { qty: 0, revenue: 0 }
      cur.qty += netQty
      cur.revenue += rev
      productAgg.set(pid, cur)
      productIds.add(pid)
    }
  }

  const productMeta = new Map<string, { name: string; categoryId: string }>()
  const categoryIds = new Set<string>()

  for (const id of productIds) {
    try {
      const p = (await payload.findByID({
        collection: 'products',
        id,
        depth: 0,
        overrideAccess: true,
      })) as Product
      const categoryId = getRelationshipId(p.category)
      if (!categoryId) continue
      productMeta.set(id, { name: String(p.name), categoryId })
      categoryIds.add(categoryId)
    } catch {
      productMeta.set(id, { name: `Ürün #${id}`, categoryId: '' })
    }
  }

  const categoryNames = new Map<string, string>()
  for (const cid of categoryIds) {
    try {
      const c = await payload.findByID({
        collection: 'categories',
        id: cid,
        depth: 0,
        overrideAccess: true,
      })
      categoryNames.set(cid, String(c.name))
    } catch {
      categoryNames.set(cid, `Kategori #${cid}`)
    }
  }

  const categoryAgg = new Map<string, LineAgg>()
  for (const [pid, v] of productAgg) {
    const meta = productMeta.get(pid)
    if (!meta?.categoryId) continue
    const cur = categoryAgg.get(meta.categoryId) ?? { qty: 0, revenue: 0 }
    cur.qty += v.qty
    cur.revenue += v.revenue
    categoryAgg.set(meta.categoryId, cur)
  }

  const round2 = (n: number) => Math.round(n * 100) / 100

  const products: TopProductRow[] = [...productAgg.entries()]
    .map(([productId, v]) => {
      const meta = productMeta.get(productId)
      const categoryId = meta?.categoryId ?? ''
      return {
        productId,
        name: meta?.name ?? `Ürün #${productId}`,
        categoryId,
        categoryName: categoryId ? (categoryNames.get(categoryId) ?? categoryId) : '—',
        qtySold: v.qty,
        revenue: round2(v.revenue),
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, Math.max(1, productLimit))

  const categories: TopCategoryRow[] = [...categoryAgg.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      name: categoryNames.get(categoryId) ?? categoryId,
      qtySold: v.qty,
      revenue: round2(v.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, Math.max(1, categoryLimit))

  return { products, categories }
}

export type WeeklyReportData = SalesSummaryData & {
  products: TopProductRow[]
  categories: TopCategoryRow[]
}

export async function buildWeeklyReportData(
  payload: Payload,
  refDate = new Date(),
): Promise<WeeklyReportData> {
  const { from, to } = getPreviousCalendarWeekRange(refDate)
  const orders = await fetchOrdersForReport(payload, from, to)
  const summary = summarizeOrders(orders)
  const { products, categories } = await aggregateTopProductsAndCategories(
    payload,
    orders,
    10,
    8,
  )

  return { from, to, ...summary, products, categories }
}

export function formatWeeklyReportTelegram(data: WeeklyReportData): string {
  const lines: string[] = [
    '📊 Haftalık satış raporu',
    `${formatDateTr(data.from)} – ${formatDateTr(data.to)}`,
    '',
    `📦 Sipariş: ${data.orderCount}`,
    `💰 Toplam ciro: ${formatMoneyTr(data.revenueTotal)} ₺`,
    `   • POS: ${formatMoneyTr(data.bySource.pos)} ₺`,
    `   • Online: ${formatMoneyTr(data.bySource.online)} ₺`,
    '',
  ]

  if (data.products.length > 0) {
    lines.push('🏆 En çok satan ürünler')
    data.products.forEach((p, i) => {
      lines.push(
        `${i + 1}. ${p.name} — ${p.qtySold} adet, ${formatMoneyTr(p.revenue)} ₺ (${p.categoryName})`,
      )
    })
    lines.push('')
  } else {
    lines.push('🏆 Bu hafta satış kalemi yok.', '')
  }

  if (data.categories.length > 0) {
    lines.push('📂 Kategoriler (ciro)')
    data.categories.forEach((c, i) => {
      lines.push(
        `${i + 1}. ${c.name} — ${formatMoneyTr(c.revenue)} ₺ (${c.qtySold} adet)`,
      )
    })
  }

  return lines.join('\n')
}
