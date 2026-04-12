import Link from 'next/link'
import React from 'react'

import styles from '../../magaza.module.css'

export default async function OdemeHataPage({
  searchParams,
}: {
  searchParams: Promise<{ neden?: string }>
}) {
  const { neden } = await searchParams
  const detail = neden?.trim()

  return (
    <div className={styles.odemeSonuc}>
      <h1 className={styles.pageTitle}>Ödeme tamamlanamadı</h1>
      <p className={styles.odemeSonucText}>
        Ödeme işlemi başarısız oldu veya iptal edildi. Siparişiniz tamamlanmadı; kartınızdan
        tahsilat yapılmamış olmalıdır.
      </p>
      {detail ? (
        <p className={styles.odemeSonucMuted}>Kod: {detail}</p>
      ) : null}
      <Link className={styles.sepetBackLink} href="/magaza/sepet">
        Sepete dön
      </Link>
    </div>
  )
}
