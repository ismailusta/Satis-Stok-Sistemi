'use client'

import React, { createContext, useContext } from 'react'

import type { StoreCategory, StoreCategoryGroup } from './actions'

const CategoriesContext = createContext<StoreCategoryGroup[]>([])

export function MagazaCategoriesProvider({
  categoryGroups,
  children,
}: {
  categoryGroups: StoreCategoryGroup[]
  children: React.ReactNode
}) {
  return (
    <CategoriesContext.Provider value={categoryGroups}>{children}</CategoriesContext.Provider>
  )
}

/** Yan menü ve ana sayfa: üst kategorinin altında gösterilecek linkler (alt yoksa tek satır). */
export function categoryLinksForGroup(g: StoreCategoryGroup): StoreCategory[] {
  if (g.children.length > 0) {
    return g.children
  }
  return [
    {
      id: g.id,
      name: g.name,
      slug: g.slug,
      imageUrl: g.imageUrl,
      parentId: null,
    },
  ]
}

export function useMagazaCategoryGroups(): StoreCategoryGroup[] {
  return useContext(CategoriesContext)
}
