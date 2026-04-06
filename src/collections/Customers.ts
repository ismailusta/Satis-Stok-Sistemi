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
      label: 'Adres',
    },
  ],
}
