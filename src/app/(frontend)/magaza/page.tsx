import React from 'react'

import { getStorefrontHome } from './actions'
import { MagazaHomeClient } from './magaza-home-client'

export const metadata = {
  title: 'Westcoast Corner Shop',
  description: 'Online alışveriş',
}

export default async function MagazaHomePage() {
  const home = await getStorefrontHome()

  const storefront = home.ok
    ? home.data
    : {
        heroTitle: null,
        heroSubtitle: null,
        heroImageUrl: null,
        heroHref: null,
        sections: [],
      }

  return (
    <MagazaHomeClient loadError={home.ok ? null : home.error} storefront={storefront} />
  )
}
