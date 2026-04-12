import type { CollectionConfig } from 'payload'

export const CustomerPaymentMethods: CollectionConfig = {
  slug: 'customer-payment-methods',
  labels: { singular: 'Ödeme yöntemi', plural: 'Ödeme yöntemleri' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'customer', 'type', 'last4', 'isDefault'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
      label: 'Müşteri',
    },
    {
      name: 'label',
      type: 'text',
      required: true,
      label: 'Görünen ad',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'card',
      label: 'Tür',
      options: [
        { label: 'Kart', value: 'card' },
        { label: 'Diğer', value: 'other' },
      ],
    },
    {
      name: 'last4',
      type: 'text',
      label: 'Son 4 hane',
      admin: {
        description: 'Sadece gösterim; tam kart numarası saklanmaz.',
      },
    },
    {
      name: 'cardBrand',
      type: 'select',
      label: 'Kart markası',
      options: [
        { label: 'Visa', value: 'visa' },
        { label: 'Mastercard', value: 'mastercard' },
        { label: 'Troy', value: 'troy' },
        { label: 'Diğer', value: 'other' },
      ],
    },
    {
      name: 'isDefault',
      type: 'checkbox',
      label: 'Varsayılan',
      defaultValue: false,
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (!data?.isDefault) return data
        const customerId =
          typeof data.customer === 'object' && data.customer && 'id' in data.customer
            ? (data.customer as { id: string }).id
            : data.customer
        if (!customerId || !req.payload) return data

        const payload = req.payload
        const { docs } = await payload.find({
          collection: 'customer-payment-methods',
          where: { customer: { equals: String(customerId) } },
          limit: 100,
          depth: 0,
          overrideAccess: true,
        })
        const skipId = originalDoc?.id != null ? String(originalDoc.id) : null
        for (const d of docs) {
          if (skipId && String(d.id) === skipId) continue
          await payload.update({
            collection: 'customer-payment-methods',
            id: d.id,
            data: { isDefault: false },
            overrideAccess: true,
          })
        }
        return data
      },
    ],
  },
}
