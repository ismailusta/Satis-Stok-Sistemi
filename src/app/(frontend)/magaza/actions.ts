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
}

export async function listStoreCategories(): Promise<
  { ok: true; categories: StoreCategory[] } | { ok: false; error: string }
> {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const { docs } = await payload.find({
      collection: 'categories',
      sort: 'name',
      limit: 200,
      depth: 1,
      overrideAccess: true,
    })

    const { docs: products } = await payload.find({
      collection: 'products',
      where: { stock: { greater_than: 0 } },
      limit: 500,
      depth: 1,
      sort: 'name',
      overrideAccess: true,
    })

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

    return {
      ok: true,
      categories: docs.map((c) => {
        const id = String(c.id)
        const fromCategory = mediaUrlFromRelation((c as { image?: unknown }).image)
        const imageUrl = fromCategory ?? fallbackImageByCategoryId.get(id) ?? null
        return {
          id,
          name: c.name,
          slug: c.slug,
          imageUrl,
        }
      }),
    }
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
          const o = c as { id?: unknown; name?: string; slug?: string; image?: unknown }
          if (!o.slug) continue
          categories.push({
            id: String(o.id),
            name: String(o.name ?? ''),
            slug: String(o.slug),
            imageUrl: mediaUrlFromRelation(o.image),
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
          }
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

    let categoryName: string | null = null
    const cat = p.category
    if (cat && typeof cat === 'object' && 'name' in cat) {
      categoryName = String((cat as { name: string }).name)
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
      where: { slug: { equals: trimmed } },
      limit: 1,
      overrideAccess: true,
    })

    if (!cats.length) {
      return { ok: false, error: 'Kategori bulunamadı.' }
    }

    const cat = cats[0]
    const catId = cat.id

    const { docs } = await payload.find({
      collection: 'products',
      where: {
        and: [{ category: { equals: catId } }, { stock: { greater_than: 0 } }],
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
