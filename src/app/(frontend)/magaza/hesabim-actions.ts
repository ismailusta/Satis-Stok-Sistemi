'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import { isStorefrontVisible } from '@/lib/product-visibility'

import { getMagazaSessionAction, requireMagazaCustomerId } from './auth-otp-actions'

function cidNum(id: string): number {
  return Number(id)
}

function normalizeCardBrand(
  raw: string | undefined,
): 'visa' | 'mastercard' | 'troy' | 'other' | undefined {
  if (!raw?.trim()) return undefined
  const s = raw.trim().toLowerCase()
  if (s.includes('visa')) return 'visa'
  if (s.includes('master')) return 'mastercard'
  if (s.includes('troy')) return 'troy'
  return 'other'
}

export type CustomerAddressRow = {
  id: string
  title: string
  fullAddress: string
  city: string | null
  district: string | null
  isDefault: boolean
}

export type PaymentMethodRow = {
  id: string
  label: string
  type: 'card' | 'other'
  last4: string | null
  cardBrand: string | null
  isDefault: boolean
}

export type MyOrderRow = {
  id: string
  orderNumber: string
  totalAmount: number
  createdAt: string
  items: Array<{
    quantity: number
    lineTotal: number
    productName: string
    productId: string
  }>
}

export async function listMyOrders(): Promise<
  { ok: true; orders: MyOrderRow[] } | { ok: false; error: string }
> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'orders',
      where: {
        and: [
          { customer: { equals: Number(auth.customerId) } },
          { source: { equals: 'online' } },
        ],
      },
      sort: '-createdAt',
      limit: 100,
      depth: 2,
      overrideAccess: true,
    })

    const orders: MyOrderRow[] = docs.map((doc) => {
      const items = Array.isArray(doc.items)
        ? doc.items.map((row: Record<string, unknown>) => {
            const product = row.product as { id?: unknown; name?: string } | undefined
            const pid =
              product && typeof product === 'object' && product.id != null
                ? String(product.id)
                : ''
            const name =
              product && typeof product.name === 'string' ? product.name : 'Ürün'
            return {
              quantity: Number(row.quantity ?? 0),
              lineTotal: Number(row.lineTotal ?? 0),
              productName: name,
              productId: pid,
            }
          })
        : []

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
        createdAt: createdAtIso,
        items,
      }
    })

    return { ok: true, orders }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Siparişler yüklenemedi.'
    return { ok: false, error: msg }
  }
}

export async function listCustomerAddresses(): Promise<
  { ok: true; addresses: CustomerAddressRow[] } | { ok: false; error: string }
> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'customer-addresses',
      where: { customer: { equals: Number(auth.customerId) } },
      sort: '-isDefault',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    const addresses: CustomerAddressRow[] = docs.map((d) => ({
      id: String(d.id),
      title: String((d as { title?: string }).title ?? ''),
      fullAddress: String((d as { fullAddress?: string }).fullAddress ?? ''),
      city: (d as { city?: string | null }).city ?? null,
      district: (d as { district?: string | null }).district ?? null,
      isDefault: Boolean((d as { isDefault?: boolean }).isDefault),
    }))

    return { ok: true, addresses }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Adresler yüklenemedi.'
    return { ok: false, error: msg }
  }
}

export async function createCustomerAddress(input: {
  title: string
  fullAddress: string
  city?: string
  district?: string
  isDefault?: boolean
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  const title = input.title.trim()
  const fullAddress = input.fullAddress.trim()
  if (title.length < 1) return { ok: false, error: 'Adres adı girin.' }
  if (fullAddress.length < 5) return { ok: false, error: 'Adres metni girin.' }

  try {
    const payload = await getPayload({ config })
    const doc = await payload.create({
      collection: 'customer-addresses',
      data: {
        customer: cidNum(auth.customerId),
        title,
        fullAddress,
        city: input.city?.trim() || undefined,
        district: input.district?.trim() || undefined,
        isDefault: Boolean(input.isDefault),
      },
      overrideAccess: true,
    })
    return { ok: true, id: String(doc.id) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Adres kaydedilemedi.'
    return { ok: false, error: msg }
  }
}

export async function updateCustomerAddress(
  id: string,
  input: {
    title: string
    fullAddress: string
    city?: string
    district?: string
    isDefault?: boolean
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  const title = input.title.trim()
  const fullAddress = input.fullAddress.trim()
  if (title.length < 1) return { ok: false, error: 'Adres adı girin.' }
  if (fullAddress.length < 5) return { ok: false, error: 'Adres metni girin.' }

  try {
    const payload = await getPayload({ config })
    const existing = await payload.findByID({
      collection: 'customer-addresses',
      id,
      depth: 0,
      overrideAccess: true,
    })
    const cid =
      typeof (existing as { customer?: unknown }).customer === 'object' &&
      (existing as { customer?: { id?: unknown } }).customer?.id != null
        ? String((existing as { customer: { id: unknown } }).customer.id)
        : String((existing as { customer?: string | number }).customer ?? '')
    if (String(cid) !== String(auth.customerId)) {
      return { ok: false, error: 'Bu adres size ait değil.' }
    }

    await payload.update({
      collection: 'customer-addresses',
      id,
      data: {
        title,
        fullAddress,
        city: input.city?.trim() || undefined,
        district: input.district?.trim() || undefined,
        ...(typeof input.isDefault === 'boolean' ? { isDefault: input.isDefault } : {}),
      },
      overrideAccess: true,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Adres güncellenemedi.'
    return { ok: false, error: msg }
  }
}

export async function deleteCustomerAddress(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const payload = await getPayload({ config })
    const existing = await payload.findByID({
      collection: 'customer-addresses',
      id,
      depth: 0,
      overrideAccess: true,
    })
    const cid =
      typeof (existing as { customer?: unknown }).customer === 'object' &&
      (existing as { customer?: { id?: unknown } }).customer?.id != null
        ? String((existing as { customer: { id: unknown } }).customer.id)
        : String((existing as { customer?: string | number }).customer ?? '')
    if (String(cid) !== String(auth.customerId)) {
      return { ok: false, error: 'Bu adres size ait değil.' }
    }

    await payload.delete({
      collection: 'customer-addresses',
      id,
      overrideAccess: true,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Adres silinemedi.'
    return { ok: false, error: msg }
  }
}

export async function getCommunicationPrefs(): Promise<
  | {
      ok: true
      marketingEmail: boolean
      marketingSms: boolean
      orderStatusSms: boolean
    }
  | { ok: false; error: string }
> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const payload = await getPayload({ config })
    const c = await payload.findByID({
      collection: 'customers',
      id: cidNum(auth.customerId),
      depth: 0,
      overrideAccess: true,
    })
    return {
      ok: true,
      marketingEmail: Boolean((c as { marketingEmail?: boolean }).marketingEmail),
      marketingSms: Boolean((c as { marketingSms?: boolean }).marketingSms),
      orderStatusSms: Boolean((c as { orderStatusSms?: boolean }).orderStatusSms ?? true),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ayarlar yüklenemedi.'
    return { ok: false, error: msg }
  }
}

export async function updateCommunicationPrefs(input: {
  marketingEmail: boolean
  marketingSms: boolean
  orderStatusSms: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'customers',
      id: cidNum(auth.customerId),
      data: {
        marketingEmail: input.marketingEmail,
        marketingSms: input.marketingSms,
        orderStatusSms: input.orderStatusSms,
      },
      overrideAccess: true,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ayarlar kaydedilemedi.'
    return { ok: false, error: msg }
  }
}

export async function listPaymentMethods(): Promise<
  { ok: true; methods: PaymentMethodRow[] } | { ok: false; error: string }
> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'customer-payment-methods',
      where: { customer: { equals: Number(auth.customerId) } },
      sort: '-isDefault',
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })

    const methods: PaymentMethodRow[] = docs.map((d) => ({
      id: String(d.id),
      label: String((d as { label?: string }).label ?? ''),
      type: ((d as { type?: string }).type === 'other' ? 'other' : 'card') as 'card' | 'other',
      last4: (d as { last4?: string | null }).last4 ?? null,
      cardBrand: (d as { cardBrand?: string | null }).cardBrand ?? null,
      isDefault: Boolean((d as { isDefault?: boolean }).isDefault),
    }))

    return { ok: true, methods }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ödeme yöntemleri yüklenemedi.'
    return { ok: false, error: msg }
  }
}

export async function createPaymentMethod(input: {
  label: string
  type: 'card' | 'other'
  last4?: string
  cardBrand?: string
  isDefault?: boolean
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  const label = input.label.trim()
  if (label.length < 1) return { ok: false, error: 'Etiket girin.' }
  const last4 = input.last4?.replace(/\D/g, '').slice(0, 4) ?? ''

  try {
    const payload = await getPayload({ config })
    const doc = await payload.create({
      collection: 'customer-payment-methods',
      data: {
        customer: cidNum(auth.customerId),
        label,
        type: input.type,
        last4: last4.length === 4 ? last4 : undefined,
        cardBrand: normalizeCardBrand(input.cardBrand),
        isDefault: Boolean(input.isDefault),
      },
      overrideAccess: true,
    })
    return { ok: true, id: String(doc.id) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Kayıt eklenemedi.'
    return { ok: false, error: msg }
  }
}

export async function deletePaymentMethod(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const payload = await getPayload({ config })
    const existing = await payload.findByID({
      collection: 'customer-payment-methods',
      id,
      depth: 0,
      overrideAccess: true,
    })
    const cid =
      typeof (existing as { customer?: unknown }).customer === 'object' &&
      (existing as { customer?: { id?: unknown } }).customer?.id != null
        ? String((existing as { customer: { id: unknown } }).customer.id)
        : String((existing as { customer?: string | number }).customer ?? '')
    if (String(cid) !== String(auth.customerId)) {
      return { ok: false, error: 'Bu kayıt size ait değil.' }
    }

    await payload.delete({
      collection: 'customer-payment-methods',
      id,
      overrideAccess: true,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Kayıt silinemedi.'
    return { ok: false, error: msg }
  }
}

export type FavoriteProductRow = {
  id: string
  name: string
  salePrice: number
  imageUrl: string | null
  slug?: string
}

export async function listFavoriteProducts(): Promise<
  { ok: true; products: FavoriteProductRow[] } | { ok: false; error: string }
> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const payload = await getPayload({ config })
    const c = await payload.findByID({
      collection: 'customers',
      id: cidNum(auth.customerId),
      depth: 2,
      overrideAccess: true,
    })

    const raw = (c as { favoriteProducts?: unknown }).favoriteProducts
    const list = Array.isArray(raw) ? raw : []
    const products: FavoriteProductRow[] = []

    for (const p of list) {
      if (!p || typeof p !== 'object') continue
      const o = p as {
        id?: unknown
        name?: string
        salePrice?: unknown
        image?: { url?: string } | unknown
      }
      let imageUrl: string | null = null
      if (o.image && typeof o.image === 'object' && o.image !== null && 'url' in o.image) {
        imageUrl = typeof (o.image as { url?: string }).url === 'string'
          ? (o.image as { url: string }).url
          : null
      }
      const category = (o as { category?: { slug?: string } }).category
      const slug =
        category && typeof category === 'object' && typeof category.slug === 'string'
          ? category.slug
          : undefined

      if (!isStorefrontVisible(o as { showInStorefront?: unknown })) {
        continue
      }

      products.push({
        id: String(o.id),
        name: String(o.name ?? ''),
        salePrice: Number(o.salePrice ?? 0),
        imageUrl,
        slug,
      })
    }

    return { ok: true, products }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Favoriler yüklenemedi.'
    return { ok: false, error: msg }
  }
}

export async function setFavoriteProductIds(
  productIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  const unique = [...new Set(productIds.map((x) => String(x).trim()).filter(Boolean))].slice(0, 200)
  const asNums = unique.map((x) => Number(x)).filter((n) => !Number.isNaN(n))

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'customers',
      id: cidNum(auth.customerId),
      data: {
        favoriteProducts: asNums,
      },
      overrideAccess: true,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Favoriler güncellenemedi.'
    return { ok: false, error: msg }
  }
}

export async function toggleFavoriteProduct(
  productId: string,
): Promise<{ ok: true; isFavorite: boolean } | { ok: false; error: string }> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return { ok: false, error: auth.error }

  const pid = String(productId).trim()
  if (!pid) return { ok: false, error: 'Ürün yok.' }

  try {
    const payload = await getPayload({ config })
    const c = await payload.findByID({
      collection: 'customers',
      id: cidNum(auth.customerId),
      depth: 0,
      overrideAccess: true,
    })

    const raw = (c as { favoriteProducts?: unknown }).favoriteProducts
    const current: string[] = Array.isArray(raw)
      ? raw.map((x) =>
          typeof x === 'object' && x && 'id' in x ? String((x as { id: unknown }).id) : String(x),
        )
      : []

    const set = new Set(current)
    let isFavorite: boolean
    if (set.has(pid)) {
      set.delete(pid)
      isFavorite = false
    } else {
      const prod = await payload.findByID({
        collection: 'products',
        id: pid,
        depth: 0,
        overrideAccess: true,
      })
      if (!isStorefrontVisible(prod as { showInStorefront?: unknown })) {
        return { ok: false, error: 'Bu ürün online mağazada satılmıyor.' }
      }
      set.add(pid)
      isFavorite = true
    }

    const nextIds = [...set].map((x) => Number(x)).filter((n) => !Number.isNaN(n))

    await payload.update({
      collection: 'customers',
      id: cidNum(auth.customerId),
      data: { favoriteProducts: nextIds },
      overrideAccess: true,
    })

    return { ok: true, isFavorite }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'İşlem başarısız.'
    return { ok: false, error: msg }
  }
}

/** Oturum yoksa boş dizi; tek seferde grid için favori id listesi. */
export async function getFavoriteProductIdsForSession(): Promise<string[]> {
  const r = await getMagazaSessionAction()
  if (!r.ok) return []
  try {
    const payload = await getPayload({ config })
    const c = await payload.findByID({
      collection: 'customers',
      id: cidNum(r.user.customerId),
      depth: 0,
      overrideAccess: true,
    })
    const raw = (c as { favoriteProducts?: unknown }).favoriteProducts
    if (!Array.isArray(raw)) return []
    return raw.map((x) =>
      typeof x === 'object' && x && 'id' in x
        ? String((x as { id: unknown }).id)
        : String(x),
    )
  } catch {
    return []
  }
}

export async function isProductFavorite(productId: string): Promise<boolean> {
  const auth = await requireMagazaCustomerId()
  if (!auth.ok) return false
  try {
    const payload = await getPayload({ config })
    const c = await payload.findByID({
      collection: 'customers',
      id: cidNum(auth.customerId),
      depth: 0,
      overrideAccess: true,
    })
    const raw = (c as { favoriteProducts?: unknown }).favoriteProducts
    if (!Array.isArray(raw)) return false
    const pid = String(productId)
    return raw.some((x) =>
      typeof x === 'object' && x && 'id' in x
        ? String((x as { id: unknown }).id) === pid
        : String(x) === pid,
    )
  } catch {
    return false
  }
}
