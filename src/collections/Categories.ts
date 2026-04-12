import type { CollectionConfig } from 'payload'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'parent', 'slug', 'showInStorefront'],
  },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (data.name && !data.slug) {
          data.slug = slugify(data.name)
        }

        const parentRef = data.parent
        if (!parentRef) {
          return data
        }

        const parentId =
          typeof parentRef === 'object' && parentRef && 'id' in parentRef
            ? (parentRef as { id: unknown }).id
            : parentRef

        const selfId = originalDoc?.id
        if (selfId != null && String(selfId) === String(parentId)) {
          throw new Error('Kategori kendi üst kategorisi olamaz.')
        }

        const parentDoc = await req.payload.findByID({
          collection: 'categories',
          id: parentId as string | number,
          depth: 0,
          overrideAccess: true,
        })

        if (parentDoc?.parent) {
          throw new Error(
            'En fazla iki seviye: alt kategorinin üstü, kök (başka alt kategori) olmalı.',
          )
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Üst kategori',
      admin: {
        position: 'sidebar',
        description:
          'Boş bırakırsanız bu bir üst kategoridir (ör. Temel Atıştırmalık). Doluysa alt kategori (ör. Cips).',
      },
      filterOptions: ({ id }) =>
        id ? ({ id: { not_equals: id } } as const) : (true as const),
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Kategori adı',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Slug',
      admin: {
        description: 'Boş bırakılırsa kategori adından üretilir.',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Vitrin görseli',
      admin: {
        description: 'Ana sayfa kategori kutularında ve vitrinde kullanılır (isteğe bağlı).',
      },
    },
    {
      name: 'showInStorefront',
      type: 'checkbox',
      label: 'Online mağazada göster',
      defaultValue: true,
      admin: {
        description:
          'Kapalıysa bu kategori (ve vitrinde bağlantıları) online mağazada listelenmez. Altında görünür ürün kalmadıysa da boş kategori gösterilmez.',
      },
    },
  ],
}
