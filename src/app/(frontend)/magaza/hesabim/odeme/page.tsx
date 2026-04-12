import React from 'react'

import { OdemeClient } from './odeme-client'

export const metadata = {
  title: 'Ödeme yöntemlerim — Mağaza',
  description: 'Kayıtlı ödeme yöntemleri',
}

export default function OdemePage() {
  return <OdemeClient />
}
