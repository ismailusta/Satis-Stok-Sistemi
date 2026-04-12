'use client'

import { usePathname } from 'next/navigation'
import React, { Suspense } from 'react'

import type { StoreCategoryGroup } from './actions'
import { MagazaAuthProvider } from './auth-context'
import { MagazaAuthModal } from './magaza-auth-modal'
import { MagazaCategoriesProvider } from './categories-context'
import { MagazaCartProvider } from './cart-context'
import { MagazaNav } from './magaza-nav'
import { MagazaSearchStrip } from './magaza-search-strip'
import { MagazaHesabimSidebar } from './magaza-hesabim-sidebar'
import { MagazaSidebar } from './magaza-sidebar'
import styles from './magaza.module.css'

function isAccountSectionPath(pathname: string): boolean {
  return (
    pathname.startsWith('/magaza/hesabim') ||
    pathname === '/magaza/siparisler' ||
    pathname.startsWith('/magaza/siparisler/')
  )
}

export function MagazaShell({
  categoryGroups,
  children,
}: {
  categoryGroups: StoreCategoryGroup[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const hideSidebar = pathname === '/magaza'
  const accountSidebar = isAccountSectionPath(pathname)
  const showSearchStrip = !accountSidebar

  return (
    <MagazaAuthProvider>
      <MagazaCartProvider>
        <MagazaCategoriesProvider categoryGroups={categoryGroups}>
          <MagazaNav />
          {showSearchStrip ? (
            <Suspense fallback={<div aria-hidden className={styles.searchStripSuspense} />}>
              <MagazaSearchStrip />
            </Suspense>
          ) : null}
          <div className={hideSidebar ? styles.shellFull : styles.shell}>
            {!hideSidebar ? (
              accountSidebar ? <MagazaHesabimSidebar /> : <MagazaSidebar />
            ) : null}
            <div className={styles.main}>{children}</div>
          </div>
          <MagazaAuthModal />
        </MagazaCategoriesProvider>
      </MagazaCartProvider>
    </MagazaAuthProvider>
  )
}
