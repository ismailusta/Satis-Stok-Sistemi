'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'
import {
  checkoutFormInitializeCreate,
  Iyzico,
  iyzicoCallbackAbsoluteUrlForOrder,
} from '@/lib/iyzico'

import {
  isStorefrontVisible,
  storefrontVisibilityWhere,
  whereAnd,
} from '@/lib/product-visibility'

import { requireMagazaCustomerId } from './auth-otp-actions'

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
      where: whereAnd(
        { stock: { greater_than: 0 } },
        storefrontVisibilityWhere(),
      ),
      limit: 500,
      depth: 1,
      sort: 'name',
      overrideAccess: true,
    })

    return {
      ok: true,
      products: docs.map((p) => mapProductDoc(p)),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ürünler yüklenemedi.'
    return { ok: false, error: message }
  }
}

function mapProductDoc(p: {
  id: unknown
  name: string
  salePrice: unknown
  stock: unknown
  image?: unknown
}): StoreProduct {
  return {
    id: String(p.id),
    name: p.name,
    salePrice: Number(p.salePrice),
    stock: Number(p.stock),
    imageUrl: mediaUrlFromRelation(p.image),
  }
}

export type StoreCategory = {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  /** Üst kategori yoksa veya geçersiz üst referansı varsa null */
  parentId: string | null
}

/** Üst kategori + alt kategoriler (ör. Temel Atıştırmalık → Cips, Kuruyemiş) */
export type StoreCategoryGroup = {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  children: StoreCategory[]
}

function categoryParentIdFromDoc(
  cat: { parent?: unknown },
  validIds: Set<string>,
): string | null {
  const raw = cat.parent
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

export async function listStoreCategories(): Promise<
  { ok: true; groups: StoreCategoryGroup[] } | { ok: false; error: string }
> {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const { docs } = await payload.find({
      collection: 'categories',
      where: storefrontVisibilityWhere(),
      sort: 'name',
      limit: 500,
      depth: 1,
      overrideAccess: true,
    })

    const { docs: products } = await payload.find({
      collection: 'products',
      where: whereAnd(
        { stock: { greater_than: 0 } },
        storefrontVisibilityWhere(),
      ),
      limit: 500,
      depth: 1,
      sort: 'name',
      overrideAccess: true,
    })

    const productCategoryIds = new Set<string>()
    for (const p of products) {
      const raw = (p as { category?: unknown }).category
      let cid: string | null = null
      if (raw && typeof raw === 'object' && 'id' in raw) {
        cid = String((raw as { id: unknown }).id)
      } else if (raw != null && (typeof raw === 'string' || typeof raw === 'number')) {
        cid = String(raw)
      }
      if (cid) productCategoryIds.add(cid)
    }

    const fallbackImageByCategoryId = new Map<string, string>()
    for (const p of products) {
      const raw = (p as { category?: unknown }).category
      let cid: string | null = null
      if (raw && typeof raw === 'object' && 'id' in raw) {
        cid = String((raw as { id: unknown }).id)
      } else if (raw != null && (typeof raw === 'string' || typeof raw === 'number')) {
        cid = String(raw)
      }
      if (!cid || fallbackImageByCategoryId.has(cid)) continue
      const u = mediaUrlFromRelation((p as { image?: unknown }).image)
      if (u) fallbackImageByCategoryId.set(cid, u)
    }

    const ids = new Set(docs.map((d) => String(d.id)))

    const toStoreCategory = (c: (typeof docs)[0]): StoreCategory => {
      const id = String(c.id)
      const fromCategory = mediaUrlFromRelation((c as { image?: unknown }).image)
      const imageUrl = fromCategory ?? fallbackImageByCategoryId.get(id) ?? null
      return {
        id,
        name: c.name,
        slug: c.slug,
        imageUrl,
        parentId: categoryParentIdFromDoc(c as { parent?: unknown }, ids),
      }
    }

    const all = docs.map(toStoreCategory)

    function subtreeHasProducts(catId: string): boolean {
      if (productCategoryIds.has(catId)) return true
      for (const c of all) {
        if (c.parentId === catId && subtreeHasProducts(c.id)) return true
      }
      return false
    }

    const visible = all.filter((c) => subtreeHasProducts(c.id))

    const roots = visible.filter((c) => !c.parentId)

    const groups: StoreCategoryGroup[] = roots.map((root) => {
      const children = visible
        .filter((c) => c.parentId === root.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      return {
        id: root.id,
        name: root.name,
        slug: root.slug,
        imageUrl: root.imageUrl,
        children,
      }
    })

    groups.sort((a, b) => a.name.localeCompare(b.name, 'tr'))

    return { ok: true, groups }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Kategoriler yüklenemedi.'
    return { ok: false, error: message }
  }
}

export type StorefrontSection =
  | {
      blockType: 'categoryStrip'
      title: string | null
      categories: StoreCategory[]
    }
  | {
      blockType: 'productShelf'
      title: string | null
      products: StoreProduct[]
    }
  | {
      blockType: 'banner'
      title: string | null
      imageUrl: string | null
      href: string | null
    }

export type StorefrontHomeData = {
  heroTitle: string | null
  heroSubtitle: string | null
  heroImageUrl: string | null
  heroHref: string | null
  sections: StorefrontSection[]
}

export async function getStorefrontHome(): Promise<
  { ok: true; data: StorefrontHomeData } | { ok: false; error: string }
> {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const g = await payload.findGlobal({
      slug: 'storefront-home',
      depth: 2,
      overrideAccess: true,
    })

    const sections: StorefrontSection[] = []
    const rawBlocks = (g.sections ?? []) as Array<Record<string, unknown>>

    for (const block of rawBlocks) {
      const bt = String(block.blockType ?? '')
      if (bt === 'categoryStrip') {
        const catsRaw = (block.categories as unknown[]) ?? []
        const categories: StoreCategory[] = []
        for (const c of catsRaw) {
          if (!c || typeof c !== 'object') continue
          const o = c as {
            id?: unknown
            name?: string
            slug?: string
            image?: unknown
            parent?: unknown
            showInStorefront?: unknown
          }
          if (!o.slug) continue
          if (!isStorefrontVisible(o)) continue
          let parentId: string | null = null
          if (o.parent && typeof o.parent === 'object' && o.parent !== null && 'id' in o.parent) {
            parentId = String((o.parent as { id: unknown }).id)
          }
          categories.push({
            id: String(o.id),
            name: String(o.name ?? ''),
            slug: String(o.slug),
            imageUrl: mediaUrlFromRelation(o.image),
            parentId,
          })
        }
        sections.push({
          blockType: 'categoryStrip',
          title: block.title ? String(block.title) : null,
          categories,
        })
      } else if (bt === 'productShelf') {
        const prRaw = (block.products as unknown[]) ?? []
        const products: StoreProduct[] = []
        for (const p of prRaw) {
          if (!p || typeof p !== 'object') continue
          const o = p as {
            id: unknown
            name: string
            salePrice: unknown
            stock: unknown
            image?: unknown
            showInStorefront?: unknown
          }
          if (!isStorefrontVisible(o)) continue
          products.push(mapProductDoc(o))
        }
        sections.push({
          blockType: 'productShelf',
          title: block.title ? String(block.title) : null,
          products: products.filter((x) => x.stock > 0),
        })
      } else if (bt === 'banner') {
        sections.push({
          blockType: 'banner',
          title: block.title ? String(block.title) : null,
          imageUrl: mediaUrlFromRelation(block.image),
          href: block.href ? String(block.href) : null,
        })
      }
    }

    return {
      ok: true,
      data: {
        heroTitle: g.heroTitle ? String(g.heroTitle) : null,
        heroSubtitle: g.heroSubtitle ? String(g.heroSubtitle) : null,
        heroImageUrl: mediaUrlFromRelation(g.heroImage),
        heroHref: g.heroHref ? String(g.heroHref) : null,
        sections,
      },
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Vitrin yüklenemedi.'
    return { ok: false, error: message }
  }
}

export type StoreProductDetail = StoreProduct & {
  barcode: string
  categoryName: string | null
}

export async function getProductDetail(
  productId: string,
): Promise<{ ok: true; product: StoreProductDetail } | { ok: false; error: string }> {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const p = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 1,
      overrideAccess: true,
    })

    if (!isStorefrontVisible(p as { showInStorefront?: unknown })) {
      return { ok: false, error: 'Ürün bulunamadı.' }
    }

    let categoryName: string | null = null
    const cat = p.category
    if (cat && typeof cat === 'object') {
      if (!isStorefrontVisible(cat as { showInStorefront?: unknown })) {
        return { ok: false, error: 'Ürün bulunamadı.' }
      }
      if ('name' in cat) {
        categoryName = String((cat as { name: string }).name)
      }
    }

    return {
      ok: true,
      product: {
        ...mapProductDoc(p),
        barcode: String(p.barcode ?? ''),
        categoryName,
      },
    }
  } catch {
    return { ok: false, error: 'Ürün bulunamadı.' }
  }
}

export async function listProductsByCategorySlug(
  slug: string,
): Promise<
  | { ok: true; categoryName: string; products: StoreProduct[] }
  | { ok: false; error: string }
> {
  const trimmed = slug.trim()
  if (!trimmed) {
    return { ok: false, error: 'Geçersiz kategori.' }
  }

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    const { docs: cats } = await payload.find({
      collection: 'categories',
      where: {
        and: [{ slug: { equals: trimmed } }, storefrontVisibilityWhere()],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (!cats.length) {
      return { ok: false, error: 'Kategori bulunamadı.' }
    }

    const cat = cats[0]
    const catId = cat.id

    const { docs: childCats } = await payload.find({
      collection: 'categories',
      where: {
        and: [{ parent: { equals: catId } }, storefrontVisibilityWhere()],
      },
      limit: 200,
      depth: 0,
      sort: 'name',
      overrideAccess: true,
    })

    const categoryFilter =
      childCats.length > 0
        ? { category: { in: childCats.map((c) => c.id) } }
        : { category: { equals: catId } }

    const { docs } = await payload.find({
      collection: 'products',
      where: {
        and: [
          categoryFilter,
          { stock: { greater_than: 0 } },
          storefrontVisibilityWhere(),
        ],
      },
      limit: 500,
      depth: 1,
      sort: 'name',
      overrideAccess: true,
    })

    return {
      ok: true,
      categoryName: cat.name,
      products: docs.map((p) => mapProductDoc(p)),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ürünler yüklenemedi.'
    return { ok: false, error: message }
  }
}

/** Mağaza üst araması: ad veya barkodda geçen, stokta ürünler */
export async function searchStoreProducts(raw: string): Promise<ListStoreProductsResult> {
  const term = raw.trim()
  if (term.length < 1) {
    return { ok: true, products: [] }
  }

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    const { docs } = await payload.find({
      collection: 'products',
      where: {
        and: [
          { stock: { greater_than: 0 } },
          storefrontVisibilityWhere(),
          {
            or: [
              { name: { contains: term } },
              { barcode: { contains: term } },
            ],
          },
        ],
      },
      limit: 120,
      depth: 1,
      sort: 'name',
      overrideAccess: true,
    })

    return {
      ok: true,
      products: docs.map((p) => mapProductDoc(p)),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Arama yapılamadı.'
    return { ok: false, error: message }
  }
}

export type OnlineCheckoutInput = {
  lines: CartLineInput[]
  customerName: string
  phone: string
  address: string
}

export type StartOnlinePaymentResult =
  | { ok: true; paymentPageUrl: string }
  | { ok: false; error: string }

const MAX_LINES = 30
const MAX_QTY_PER_LINE = 99

async function buyerClientIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return h.get('x-real-ip') ?? '127.0.0.1'
}

function splitBuyerName(full: string): { name: string; surname: string } {
  const t = full.trim()
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: 'Müşteri', surname: 'Müşteri' }
  if (parts.length === 1) return { name: parts[0], surname: 'Müşteri' }
  return { name: parts[0], surname: parts.slice(1).join(' ') }
}

function formatGsmForIyzico(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10 && digits.startsWith('90')) return `+${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `+90${digits.slice(1)}`
  if (digits.length === 10 && digits.startsWith('5')) return `+90${digits}`
  if (digits.length > 0) return `+90${digits}`
  return '+905000000000'
}

/** İyzico sandbox test alıcıları için; canlıda gerçek müşteri bilgisi kullanılmalıdır. */
function buyerIdentityNumber(): string {
  return process.env.IYZIPAY_BUYER_IDENTITY_NUMBER?.trim() || '11111111111'
}

function isValidEmailForIyzico(raw: string | null | undefined): raw is string {
  if (!raw) return false
  const s = raw.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return false
  const domain = s.split('@')[1]?.toLowerCase() ?? ''
  if (domain.endsWith('.local')) return false
  return true
}

/**
 * İyzico geçerli alan adı ister (.local vb. reddedilir).
 * Önce IYZIPAY_BUYER_EMAIL, sonra müşteri kaydındaki e-posta; yoksa test.com yedeği.
 */
function buyerEmailForIyzico(orderIdStr: string, customerEmail: string | null | undefined): string {
  const fromEnv = process.env.IYZIPAY_BUYER_EMAIL?.trim()
  if (isValidEmailForIyzico(fromEnv)) return fromEnv

  if (isValidEmailForIyzico(customerEmail)) {
    return customerEmail.trim()
  }

  const local = `siparis.${orderIdStr.replace(/[^a-zA-Z0-9]/g, '').slice(0, 48) || '0'}`
  return `${local}@test.com`
}

/**
 * Online sipariş: önce taslak kayıt, İyzico ödeme formu HTML'i döner.
 * Ödeme başarılı olunca callback siparişi tamamlar ve stok düşer.
 */
export async function startOnlinePayment(input: OnlineCheckoutInput): Promise<StartOnlinePaymentResult> {
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

    const basketLines: Array<{ id: string; name: string; linePrice: string }> = []

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

      if (!isStorefrontVisible(p as { showInStorefront?: unknown })) {
        return {
          ok: false,
          error: `Bu ürün online satılamaz: ${p.name}.`,
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

      basketLines.push({
        id: String(p.id),
        name: String(p.name).slice(0, 240),
        linePrice: lineTotal.toFixed(2),
      })
    }

    const totalAmount = items.reduce((s, i) => s + i.lineTotal, 0)

    const notes =
      `[Online mağaza]\n` +
      `Ad: ${name}\n` +
      `Tel: ${phone}\n` +
      `Adres: ${address}`

    const session = await requireMagazaCustomerId()

    let customerEmail: string | null = null
    if (session.ok) {
      const cust = await payload.findByID({
        collection: 'customers',
        id: session.customerId,
        depth: 0,
        overrideAccess: true,
      })
      const em = (cust as { email?: string }).email
      customerEmail = typeof em === 'string' ? em : null
    }

    const order = await payload.create({
      collection: 'orders',
      data: {
        source: 'online',
        status: 'draft',
        items,
        totalAmount,
        paymentMethod: 'card',
        cashReceived: null,
        changeGiven: null,
        notes,
        ...(session.ok ? { customer: Number(session.customerId) } : {}),
      },
      overrideAccess: true,
    })

    const orderIdStr = String(order.id)
    const priceStr = totalAmount.toFixed(2)
    const ip = await buyerClientIp()
    const { name: buyerName, surname: buyerSurname } = splitBuyerName(name)
    const gsm = formatGsmForIyzico(phone)
    const emailForIyzico = buyerEmailForIyzico(orderIdStr, customerEmail)

    const addressBlock = address.replace(/\s+/g, ' ').trim()
    const cityLine = addressBlock.split(',').pop()?.trim() || 'Turkey'

    const basketItems = basketLines.map((bl) => ({
      id: bl.id,
      name: bl.name,
      category1: 'Genel',
      category2: 'Mağaza',
      itemType: Iyzico.BASKET_ITEM_TYPE.PHYSICAL,
      price: bl.linePrice,
    }))

    const initRequest = {
      locale: Iyzico.LOCALE.TR,
      conversationId: orderIdStr,
      price: priceStr,
      paidPrice: priceStr,
      currency: Iyzico.CURRENCY.TRY,
      basketId: String(order.orderNumber ?? orderIdStr),
      paymentGroup: Iyzico.PAYMENT_GROUP.PRODUCT,
      callbackUrl: iyzicoCallbackAbsoluteUrlForOrder(orderIdStr),
      buyer: {
        id: orderIdStr,
        name: buyerName,
        surname: buyerSurname,
        gsmNumber: gsm,
        email: emailForIyzico,
        identityNumber: buyerIdentityNumber(),
        registrationDate: '2016-01-01 12:00:00',
        lastLoginDate: '2016-01-01 12:00:00',
        registrationAddress: addressBlock.slice(0, 240),
        ip,
        city: cityLine.slice(0, 40),
        country: 'Turkey',
        zipCode: '34000',
      },
      shippingAddress: {
        contactName: `${buyerName} ${buyerSurname}`.slice(0, 120),
        city: cityLine.slice(0, 40),
        country: 'Turkey',
        address: addressBlock.slice(0, 240),
        zipCode: '34000',
      },
      billingAddress: {
        contactName: `${buyerName} ${buyerSurname}`.slice(0, 120),
        city: cityLine.slice(0, 40),
        country: 'Turkey',
        address: addressBlock.slice(0, 240),
        zipCode: '34000',
      },
      basketItems,
    }

    const initResult = await checkoutFormInitializeCreate(initRequest)

    if (initResult.status !== 'success') {
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: { status: 'cancelled' },
        overrideAccess: true,
      })
      const detail =
        initResult.errorMessage ||
        initResult.errorCode ||
        'Ödeme formu oluşturulamadı.'
      return { ok: false, error: detail }
    }

    const pageUrl = initResult.paymentPageUrl
    if (typeof pageUrl === 'string' && pageUrl.startsWith('http')) {
      return { ok: true, paymentPageUrl: pageUrl }
    }

    await payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'cancelled' },
      overrideAccess: true,
    })
    return {
      ok: false,
      error:
        'İyzico ödeme sayfası adresi alınamadı (paymentPageUrl). Ortam anahtarlarını ve API yanıtını kontrol edin.',
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sipariş oluşturulamadı.'
    return { ok: false, error: message }
  }
}
