import type { CollectionConfig } from 'payload'

export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'email'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Ad soyad',
      defaultValue: 'Müşteri',
    },
    {
      name: 'phoneKey',
      type: 'text',
      label: 'Telefon anahtarı (90…)',
      unique: true,
      index: true,
      admin: {
        description: 'Normalize edilmiş numara; giriş eşleştirmesi için.',
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Telefon',
    },
    {
      name: 'email',
      type: 'email',
      label: 'E-posta',
    },
    {
      name: 'address',
      type: 'textarea',
      label: 'Adres (eski / tek satır)',
      admin: {
        description: 'Çoklu adres için “Müşteri adresleri” kullanın.',
      },
    },
    {
      name: 'favoriteProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      label: 'Favori ürünler',
      admin: {
        description: 'Online mağaza favorileri.',
      },
    },
    {
      name: 'marketingEmail',
      type: 'checkbox',
      label: 'E-posta ile kampanya',
      defaultValue: false,
    },
    {
      name: 'marketingSms',
      type: 'checkbox',
      label: 'SMS ile kampanya',
      defaultValue: false,
    },
    {
      name: 'orderStatusSms',
      type: 'checkbox',
      label: 'Sipariş durumu SMS',
      defaultValue: true,
    },
  ],
}
