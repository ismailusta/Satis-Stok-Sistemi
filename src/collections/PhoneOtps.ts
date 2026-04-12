import type { CollectionConfig } from 'payload'

/** Tek kullanımlık SMS OTP — sadece sunucu `overrideAccess` ile yazar; admin panelden okunabilir. */
export const PhoneOtps: CollectionConfig = {
  slug: 'phone-otps',
  labels: { singular: 'Telefon OTP', plural: 'Telefon OTP kayıtları' },
  admin: {
    useAsTitle: 'phoneKey',
    defaultColumns: ['phoneKey', 'expiresAt', 'updatedAt'],
    description: 'Geçici doğrulama kodları. Üretimde düzenlemeyin.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'phoneKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Telefon anahtarı (90XXXXXXXXXX)',
    },
    {
      name: 'codeHash',
      type: 'text',
      required: true,
      label: 'Kod özeti (SHA-256)',
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      label: 'Son geçerlilik',
    },
    {
      name: 'lastSentAt',
      type: 'date',
      label: 'Son gönderim',
    },
    {
      name: 'verifyAttempts',
      type: 'number',
      defaultValue: 0,
      label: 'Yanlış deneme',
    },
  ],
}
