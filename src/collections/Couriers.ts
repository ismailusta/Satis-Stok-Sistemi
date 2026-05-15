import type { CollectionConfig } from 'payload'
import { randomUUID } from 'node:crypto'

export const Couriers: CollectionConfig = {
  slug: 'couriers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'plate', 'isAvailable', 'accessToken'],
    description:
      'Kurye kaydı. Mobil ekran adresi: /kurye/[erişim anahtarı]. Yeni kayıtta anahtar otomatik üretilir.',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Ad Soyad',
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      label: 'Telefon',
    },
    {
      name: 'plate',
      type: 'text',
      label: 'Plaka',
      admin: {
        description: 'İsteğe bağlı (motosiklet plakası vb.).',
      },
    },
    {
      name: 'isAvailable',
      type: 'checkbox',
      label: 'Şu an boşta',
      defaultValue: true,
      admin: {
        description:
          'Atanmış aktif teslimat (hazırlanıyor / yolda) varken otomatik kapanır; teslimde tekrar açılır.',
      },
    },
    {
      name: 'accessToken',
      type: 'text',
      required: false,
      unique: true,
      index: true,
      label: 'Mobil erişim anahtarı',
      admin: {
        readOnly: true,
        description:
          'Kurye telefonundan açılacak adres: /kurye/[bu değer]. Güvenlik için paylaşmayın.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && (!data.accessToken || String(data.accessToken).trim() === '')) {
          data.accessToken = randomUUID()
        }
        return data
      },
    ],
  },
}
