import React from 'react'

import styles from './magaza.module.css'

type Props = {
  title: string
  description?: string
}

/** Hesap alt sayfaları için geçici kabuk — içerik sonra doldurulur */
export function HesabimYakinda({ title, description = 'Bu bölüm yakında.' }: Props) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>{title}</h1>
      <p className={styles.sub}>{description}</p>
    </div>
  )
}
