import Link from 'next/link'
import React from 'react'

import styles from '../../magaza.module.css'

import { ClearCartOnSuccess } from './clear-cart-on-success'

export default async function OdemeBasariliPage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>
}) {
  const { no } = await searchParams
  const orderNo = no?.trim() || ''

  return (
    <div className={styles.odemeSonuc}>
      <ClearCartOnSuccess />
      <h1 className={styles.pageTitle}>Ödeme tamamlandı</h1>
      <p className={styles.odemeSonucText}>
        {orderNo
          ? `Siparişiniz kaydedildi: ${orderNo}. Teşekkür ederiz.`
          : 'Ödemeniz alındı. Teşekkür ederiz.'}
      </p>
      <Link className={styles.sepetBackLink} href="/magaza">
        Mağazaya dön
      </Link>
    </div>
  )
}
