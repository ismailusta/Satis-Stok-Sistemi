'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { useMagazaCategories } from './categories-context'
import styles from './magaza.module.css'

export function MagazaSidebar() {
  const categories = useMagazaCategories()
  const pathname = usePathname()

  return (
    <aside className={styles.sidebar} aria-label="Kategoriler">
      <p className={styles.sidebarHeading}>Kategoriler</p>
      <nav className={styles.sidebarNav}>
        {categories.map((c) => {
          const href = `/magaza/kategori/${c.slug}`
          const active = pathname === href
          return (
            <Link className={active ? styles.sidebarLinkActive : styles.sidebarLink} href={href} key={c.id}>
              {c.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
