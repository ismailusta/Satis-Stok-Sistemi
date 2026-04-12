import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'barcode',
      'category',
      'showInStorefront',
      'showInPos',
      'salePrice',
      'stock',
    ],
    listSearchableFields: ['name', 'barcode'],
  },
  fields: [
    {
      name: 'barcode',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Barkod',
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Ürün adı',
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      label: 'Kategori',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Ürün görseli',
      admin: {
        description: 'Online mağaza ve ürün listeleri için kapak görseli.',
      },
    },
    {
      name: 'description',
      type: 'richText',
      editor: lexicalEditor(),
      label: 'Ürün açıklaması (online mağaza)',
    },
    {
      name: 'purchasePrice',
      type: 'number',
      required: true,
      min: 0,
      label: 'Alış fiyatı',
    },
    {
      name: 'salePrice',
      type: 'number',
      required: true,
      min: 0,
      label: 'Satış fiyatı',
    },
    {
      name: 'vatRate',
      type: 'number',
      required: true,
      defaultValue: 20,
      min: 0,
      max: 100,
      label: 'KDV (%)',
    },
    {
      name: 'stock',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      label: 'Mevcut stok',
    },
    {
      name: 'showInStorefront',
      type: 'checkbox',
      label: 'Online mağazada göster',
      defaultValue: true,
      admin: {
        description:
          'Kapalıysa ürün internet mağazasında listelenmez (ör. alkollü içecekler). Kasada satış ayrıca “POS’ta sat” ile yönetilir.',
      },
    },
    {
      name: 'showInPos',
      type: 'checkbox',
      label: 'POS / kasada sat',
      defaultValue: true,
      admin: {
        description: 'Kapalıysa barkod ile kasada bu ürün satılamaz.',
      },
    },
  ],
}
