import React from 'react'

import { SiparislerClient } from './siparisler-client'

export const metadata = {
  title: 'Geçmiş siparişler — Mağaza',
  description: 'Sipariş geçmişi',
}

export default function SiparislerPage() {
  return <SiparislerClient />
}
