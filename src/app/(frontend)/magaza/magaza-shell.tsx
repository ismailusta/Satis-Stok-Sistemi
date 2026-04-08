'use client'

import { usePathname } from 'next/navigation'
import React from 'react'

import type { StoreCategoryGroup } from './actions'
import { MagazaAuthProvider } from './auth-context'
import { MagazaAuthModal } from './magaza-auth-modal'
import { MagazaCategoriesProvider } from './categories-context'
import { MagazaCartProvider } from './cart-context'
import { MagazaNav } from './magaza-nav'
import { MagazaSidebar } from './magaza-sidebar'
import styles from './magaza.module.css'

export function MagazaShell({
  categoryGroups,
  children,
}: {
  categoryGroups: StoreCategoryGroup[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const hideSidebar = pathname === '/magaza'

  return (
    <MagazaAuthProvider>
      <MagazaCartProvider>
        <MagazaCategoriesProvider categoryGroups={categoryGroups}>
          <MagazaNav />
          <div className={hideSidebar ? styles.shellFull : styles.shell}>
            {!hideSidebar ? <MagazaSidebar /> : null}
            <div className={styles.main}>{children}</div>
          </div>
          <MagazaAuthModal />
        </MagazaCategoriesProvider>
      </MagazaCartProvider>
    </MagazaAuthProvider>
  )
}
