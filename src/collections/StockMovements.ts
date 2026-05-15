import type { CollectionConfig } from 'payload'

export const stockMovementTypeOptions = [
  { label: 'Satın alma / giriş', value: 'purchase' },
  { label: 'Satış (sipariş)', value: 'sale' },
  { label: 'İade (satır)', value: 'refund' },
  { label: 'Sipariş iptal / kapanış (kalan stok)', value: 'order_release' },
  { label: 'Düzeltme / sayım', value: 'adjustment' },
] as const

export type StockMovementType = (typeof stockMovementTypeOptions)[number]['value']

export const StockMovements: CollectionConfig = {
  slug: 'stock-movements',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['product', 'delta', 'type', 'order', 'createdAt'],
    description:
      'Her stok değişimi bir kayıt olarak tutulur. Aynı işlem iki kez tetiklenirse idempotency anahtarı ikinci kaydı engeller.',
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      label: 'Ürün',
      index: true,
    },
    {
      name: 'delta',
      type: 'number',
      required: true,
      label: 'Adet değişimi',
      admin: {
        description: 'Pozitif: stok artar, negatif: stok azalır.',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Tür',
      options: [...stockMovementTypeOptions],
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      label: 'İlgili sipariş',
      admin: {
        description: 'Satış, iade ve sipariş kapanışı hareketlerinde doldurulur.',
      },
    },
    {
      name: 'orderLineId',
      type: 'text',
      label: 'Sipariş satır id',
      admin: {
        description: 'Payload array satırının id değeri (siparişe bağlı hareketlerde).',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Not',
    },
    {
      name: 'idempotencyKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Idempotency anahtarı',
      admin: {
        readOnly: true,
        description: 'Aynı anahtarla ikinci kayıt oluşturulmaz; stok iki kez değişmez.',
      },
    },
    {
      name: 'recordedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Kaydeden',
      admin: {
        readOnly: true,
      },
    },
  ],
}
