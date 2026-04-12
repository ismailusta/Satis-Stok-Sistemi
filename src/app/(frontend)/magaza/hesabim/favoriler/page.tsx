import React from 'react'

import { FavorilerClient } from './favoriler-client'

export const metadata = {
  title: 'Favori ürünlerim — Mağaza',
  description: 'Favori ürünler',
}

export default function FavorilerPage() {
  return <FavorilerClient />
}
