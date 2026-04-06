import type { GlobalConfig } from 'payload'

export const StorefrontHome: GlobalConfig = {
  slug: 'storefront-home',
  label: 'Mağaza vitrin (ana sayfa)',
  admin: {
    group: 'Mağaza',
    description:
      'Ana sayfa hero ve sıralı bölümler (kategori şeridi, ürün rafları, banner). Boş bölüm bırakılabilir.',
  },
  fields: [
    {
      name: 'heroTitle',
      type: 'text',
      label: 'Hero başlık',
    },
    {
      name: 'heroSubtitle',
      type: 'textarea',
      label: 'Hero alt metin',
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Hero görsel',
    },
    {
      name: 'heroHref',
      type: 'text',
      label: 'Hero bağlantı (opsiyonel URL)',
    },
    {
      name: 'sections',
      type: 'blocks',
      label: 'Ana sayfa bölümleri',
      blocks: [
        {
          slug: 'categoryStrip',
          labels: { singular: 'Kategori şeridi', plural: 'Kategori şeritleri' },
          fields: [
            {
              name: 'title',
              type: 'text',
              label: 'Başlık',
            },
            {
              name: 'categories',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
              label: 'Kategoriler',
              required: true,
            },
          ],
        },
        {
          slug: 'productShelf',
          labels: { singular: 'Ürün rafı', plural: 'Ürün rafları' },
          fields: [
            {
              name: 'title',
              type: 'text',
              label: 'Başlık',
            },
            {
              name: 'products',
              type: 'relationship',
              relationTo: 'products',
              hasMany: true,
              label: 'Ürünler',
              required: true,
            },
          ],
        },
        {
          slug: 'banner',
          labels: { singular: 'Banner', plural: 'Bannerlar' },
          fields: [
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              required: true,
              label: 'Görsel',
            },
            {
              name: 'title',
              type: 'text',
              label: 'Başlık',
            },
            {
              name: 'href',
              type: 'text',
              label: 'Bağlantı (URL)',
            },
          ],
        },
      ],
    },
  ],
}
