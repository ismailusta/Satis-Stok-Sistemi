import type { CollectionConfig, Payload, PayloadRequest } from 'payload'

type OrderLine = {
  id?: string | null
  product: unknown
  quantity: number
  unitPrice?: number
  lineTotal?: number
  quantityRefunded?: number
}

function getProductId(product: unknown): string | number | undefined {
  if (product === null || product === undefined) return undefined
  if (typeof product === 'object' && 'id' in product) {
    return (product as { id: string | number }).id
  }
  if (typeof product === 'string' || typeof product === 'number') return product
  return undefined
}

/** Satırda değişmeyecek alanlar (iade sonrası lineTotal/totalAmount yeniden hesaplanır). */
function itemCoreSignature(item: OrderLine): string {
  return JSON.stringify({
    id: item.id ?? null,
    product: getProductId(item.product),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
  })
}

/** Satış kilitli: tamamlandı veya kısmi iade (satır düzenleme kuralları aynı). */
function isSaleLockedStatus(status: string | undefined): boolean {
  return status === 'completed' || status === 'partially_refunded'
}

function assertCompletedOrderItemsOnlyRefunds(
  originalItems: OrderLine[] | undefined,
  nextItems: OrderLine[] | undefined,
): void {
  const prev = originalItems ?? []
  const next = nextItems ?? []
  if (prev.length !== next.length) {
    throw new Error('Tamamlanmış siparişte satır eklenemez veya silinemez.')
  }
  for (const p of prev) {
    const n = next.find((x) => x.id === p.id)
    if (!n) {
      throw new Error('Tamamlanmış siparişte satır eklenemez veya silinemez.')
    }
    if (itemCoreSignature(p as OrderLine) !== itemCoreSignature(n as OrderLine)) {
      throw new Error(
        'Tamamlanmış siparişte ürün, adet veya fiyat değiştirilemez. Sadece iade adedi güncellenebilir.',
      )
    }
    const qr = Number(n.quantityRefunded ?? 0)
    const q = Number(n.quantity)
    if (qr < 0 || qr > q) {
      throw new Error(`İade adedi 0 ile ${q} arasında olmalı (${n.id}).`)
    }
  }
}

async function applyStockDelta(
  payload: Payload,
  lines: OrderLine[] | undefined | null,
  sign: -1 | 1,
  req: PayloadRequest,
) {
  for (const line of lines || []) {
    const pid = getProductId(line.product)
    if (pid === undefined) continue

    const product = await payload.findByID({
      collection: 'products',
      id: String(pid),
      depth: 0,
      req,
    })

    const next = product.stock + sign * line.quantity
    if (next < 0) {
      throw new Error(`Stok yetersiz veya tutarsız: ${product.name}`)
    }

    await payload.update({
      collection: 'products',
      id: product.id,
      data: { stock: next },
      req,
    })
  }
}

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'source', 'status', 'paymentMethod', 'totalAmount', 'createdAt'],
    description:
      'Tamamlanan satış stoktan düşer. Satır iadesi (İade edilen adet) stoku geri verir. Tam iptal/iade durumunda kalan adetler geri yüklenir.',
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      unique: true,
      index: true,
      label: 'Sipariş no',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'pos',
      label: 'Kaynak',
      options: [
        { label: 'Fiziki (POS)', value: 'pos' },
        { label: 'Online', value: 'online' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      label: 'Durum',
      options: [
        { label: 'Taslak', value: 'draft' },
        { label: 'Tamamlandı', value: 'completed' },
        { label: 'Kısmi iade', value: 'partially_refunded' },
        { label: 'İptal', value: 'cancelled' },
        { label: 'İade (kapatıldı)', value: 'refunded' },
      ],
    },
    {
      name: 'refundClosed',
      type: 'checkbox',
      label: 'İade POS ile kapatıldı',
      defaultValue: false,
      admin: {
        hidden: true,
        description:
          'POS üzerinden "Sipariş iade kapat" ile true olur; kısmi iade varken listede yanlışlıkla tam iade görünmesini engeller.',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      label: 'Müşteri',
      admin: {
        description: 'İsteğe bağlı (kayıtlı müşteri veya online sipariş)',
      },
    },
    {
      name: 'items',
      type: 'array',
      label: 'Satır kalemleri',
      minRows: 0,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
          label: 'Ürün',
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
          label: 'Adet',
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
          label: 'Birim fiyat (satış anı)',
        },
        {
          name: 'lineTotal',
          type: 'number',
          required: true,
          min: 0,
          label: 'Satır tutarı (kalan)',
          admin: {
            readOnly: true,
            description:
              'İade edilmemiş adet × birim fiyat. Kısmi iade sonrası otomatik güncellenir.',
          },
        },
        {
          name: 'quantityRefunded',
          type: 'number',
          required: true,
          defaultValue: 0,
          min: 0,
          label: 'İade edilen adet',
          admin: {
            description: 'Bu satırdan depoya geri dönen adet (satır bazlı iade).',
          },
        },
      ],
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      min: 0,
      label: 'Toplam tutar (kalan)',
      admin: {
        readOnly: true,
        description: 'Satır kalan tutarlarının toplamı; iade sonrası düşer.',
      },
    },
    {
      name: 'paymentMethod',
      type: 'select',
      label: 'Ödeme',
      options: [
        { label: 'Nakit', value: 'cash' },
        { label: 'Kredi kartı', value: 'card' },
        { label: 'Veresiye', value: 'credit' },
      ],
      admin: {
        position: 'sidebar',
        description: 'POS satışlarında kaydedilir.',
      },
    },
    {
      name: 'cashReceived',
      type: 'number',
      min: 0,
      label: 'Alınan nakit',
      admin: {
        position: 'sidebar',
        description: 'Sadece nakit ödemede.',
      },
    },
    {
      name: 'changeGiven',
      type: 'number',
      min: 0,
      label: 'Para üstü',
      admin: {
        position: 'sidebar',
        description: 'Nakit ödemede hesaplanan para üstü.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notlar',
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (operation === 'update' && isSaleLockedStatus(originalDoc?.status)) {
          const nextStatus = data.status ?? originalDoc.status
          const nextItems = (data.items ?? originalDoc.items) as OrderLine[] | undefined

          if (nextStatus === 'completed' || nextStatus === 'partially_refunded') {
            assertCompletedOrderItemsOnlyRefunds(
              originalDoc.items as OrderLine[] | undefined,
              nextItems,
            )
          } else if (nextStatus === 'refunded' || nextStatus === 'cancelled') {
            assertCompletedOrderItemsOnlyRefunds(
              originalDoc.items as OrderLine[] | undefined,
              nextItems,
            )
          } else {
            throw new Error(
              'Tamamlanmış / kısmi iade siparişi sadece İade (kapatıldı) veya İptal durumuna alınabilir.',
            )
          }
        }

        if (operation === 'create' && !data.orderNumber) {
          data.orderNumber = `ORD-${Date.now()}`
        }

        // Güncellemede admin/API bazen sadece birkaç alan gönderir; items gelmezse önceki satırlarla birleştir.
        const itemsSource = (data.items ?? originalDoc?.items) as OrderLine[] | undefined
        if (itemsSource?.length) {
          const items = itemsSource.map((row) => ({ ...row }))
          for (const item of items) {
            const qty = Number(item.quantity)
            const unit = Number(item.unitPrice)
            if (item.quantityRefunded === undefined || item.quantityRefunded === null) {
              item.quantityRefunded = 0
            }
            const qr = Number(item.quantityRefunded)
            if (qr < 0 || qr > qty) {
              throw new Error('İade adedi satır adedinden fazla olamaz.')
            }
            const remainingQty = qty - qr
            item.lineTotal = Math.round(remainingQty * unit * 100) / 100
          }
          data.items = items
          data.totalAmount = items.reduce(
            (sum: number, item: { lineTotal?: number }) => sum + (item.lineTotal ?? 0),
            0,
          )
        } else {
          data.totalAmount = 0
        }

        // Satır iadesine göre durum: sadece tüm satırlar tam iadeyse "İade (kapatıldı)".
        // refundClosed: POS "kapat" ile set; not kaydında gerçekten kapatılmış siparişi bozmamak için.
        if (data.items?.length) {
          const incomingStatus = data.status
          const skipStatusSyncFromItems =
            incomingStatus === undefined &&
            originalDoc?.status === 'refunded' &&
            originalDoc?.refundClosed === true

          if (
            !skipStatusSyncFromItems &&
            incomingStatus !== 'refunded' &&
            incomingStatus !== 'cancelled'
          ) {
            const base = (incomingStatus ?? originalDoc?.status) as string | undefined
            if (
              base === 'completed' ||
              base === 'partially_refunded' ||
              base === 'refunded'
            ) {
              let anyRef = false
              let allFull = true
              for (const item of data.items) {
                const q = Number(item.quantity)
                const r = Number(item.quantityRefunded ?? 0)
                if (r > 0) anyRef = true
                if (r < q) allFull = false
              }
              if (!anyRef) {
                data.status = 'completed'
                data.refundClosed = false
              } else if (allFull) {
                data.status = 'refunded'
              } else {
                data.status = 'partially_refunded'
                data.refundClosed = false
              }
            }
          }
        }

        const nextStatus = data.status
        const prevStatus = originalDoc?.status
        const becomesCompleted =
          nextStatus === 'completed' && (operation === 'create' || prevStatus !== 'completed')

        if (becomesCompleted && (!data.items || data.items.length === 0)) {
          throw new Error('Tamamlanmış siparişte en az bir ürün satırı olmalıdır.')
        }

        if (becomesCompleted && data.items?.length) {
          for (const item of data.items) {
            const pid = getProductId(item.product)
            if (pid === undefined) continue
            const product = await req.payload.findByID({
              collection: 'products',
              id: String(pid),
              depth: 0,
              req,
            })
            if (product.stock < item.quantity) {
              throw new Error(
                `Yetersiz stok: ${product.name} (mevcut: ${product.stock}, istenen: ${item.quantity})`,
              )
            }
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'create' && doc.status === 'completed') {
          await applyStockDelta(req.payload, doc.items as OrderLine[], -1, req)
          return
        }

        if (
          operation === 'update' &&
          previousDoc?.status === 'draft' &&
          doc.status === 'completed'
        ) {
          await applyStockDelta(req.payload, doc.items as OrderLine[], -1, req)
        }

        if (operation !== 'update' || !previousDoc) {
          return
        }

        const prevItems = (previousDoc.items ?? []) as OrderLine[]
        const docItems = (doc.items ?? []) as OrderLine[]

        for (const item of docItems) {
          const prev = prevItems.find((p) => p.id === item.id)
          const oldR = Number(prev?.quantityRefunded ?? 0)
          const newR = Number(item.quantityRefunded ?? 0)
          const delta = newR - oldR
          if (delta > 0) {
            await applyStockDelta(
              req.payload,
              [{ ...item, quantity: delta } as OrderLine],
              1,
              req,
            )
          }
        }

        if (
          isSaleLockedStatus(previousDoc.status) &&
          (doc.status === 'cancelled' || doc.status === 'refunded')
        ) {
          for (const item of docItems) {
            const qty = Number(item.quantity)
            const ref = Number(item.quantityRefunded ?? 0)
            const remainder = qty - ref
            if (remainder > 0) {
              await applyStockDelta(
                req.payload,
                [{ ...item, quantity: remainder } as OrderLine],
                1,
                req,
              )
            }
          }
        }
      },
    ],
  },
}
