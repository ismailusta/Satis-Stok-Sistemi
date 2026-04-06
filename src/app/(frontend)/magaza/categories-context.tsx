'use client'

import React, { createContext, useContext } from 'react'

import type { StoreCategory } from './actions'

const CategoriesContext = createContext<StoreCategory[]>([])

export function MagazaCategoriesProvider({
  categories,
  children,
}: {
  categories: StoreCategory[]
  children: React.ReactNode
}) {
  return (
    <CategoriesContext.Provider value={categories}>{children}</CategoriesContext.Provider>
  )
}

export function useMagazaCategories(): StoreCategory[] {
  return useContext(CategoriesContext)
}
