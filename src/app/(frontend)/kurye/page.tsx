import Link from 'next/link'
import React from 'react'

import styles from './kurye.module.css'

export default function KuryeLandingPage() {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1>Kurye girişi</h1>
        <p>
          Teslimat ekranına yöneticinin verdiği özel bağlantıyla girin. Adres şu formdadır:{' '}
          <strong>/kurye/[erişim anahtarı]</strong>
        </p>
      </header>
      <p className={styles.hint}>
        Anahtar, Payload admin panelinde <strong>Kuryeler</strong> kaydında &quot;Mobil erişim
        anahtarı&quot; alanındadır.
      </p>
      <p className={styles.hint}>
        <Link href="/magaza" style={{ color: '#8ab4f8' }}>
          Mağazaya dön
        </Link>
      </p>
    </div>
  )
}
