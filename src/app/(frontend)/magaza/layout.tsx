import { Plus_Jakarta_Sans } from 'next/font/google'
import React from 'react'

import { listStoreCategories } from './actions'
import { MagazaShell } from './magaza-shell'
import styles from './magaza.module.css'

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-magaza-sans',
})

export default async function MagazaLayout({ children }: { children: React.ReactNode }) {
  const cats = await listStoreCategories()
  const categories = cats.ok ? cats.categories : []

  return (
    <div className={`${fontSans.variable} ${styles.magazaRoot}`}>
      <MagazaShell categories={categories}>{children}</MagazaShell>
    </div>
  )
}
