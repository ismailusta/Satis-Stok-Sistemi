'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { categoryLinksForGroup, useMagazaCategoryGroups } from './categories-context'
import styles from './magaza.module.css'

export function MagazaSidebar() {
  const categoryGroups = useMagazaCategoryGroups()
  const pathname = usePathname()
  /** Aktif olmayan gruplar: kullanıcı aç/kapa */
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  /** Aktif alt kategorideyken kullanıcı üst başlığa basıp kapattıysa */
  const [collapsedWhileActiveIds, setCollapsedWhileActiveIds] = useState<Set<string>>(
    () => new Set(),
  )

  const hasActiveInGroup = useCallback(
    (groupId: string) => {
      const g = categoryGroups.find((x) => x.id === groupId)
      if (!g) return false
      return categoryLinksForGroup(g).some(
        (c) => pathname === `/magaza/kategori/${c.slug}`,
      )
    },
    [categoryGroups, pathname],
  )

  useEffect(() => {
    setCollapsedWhileActiveIds((prev) => {
      const next = new Set<string>()
      for (const id of prev) {
        if (hasActiveInGroup(id)) next.add(id)
      }
      return next
    })
  }, [hasActiveInGroup, pathname])

  const isGroupOpen = useCallback(
    (groupId: string) => {
      if (hasActiveInGroup(groupId)) {
        return !collapsedWhileActiveIds.has(groupId)
      }
      return openIds.has(groupId)
    },
    [openIds, collapsedWhileActiveIds, hasActiveInGroup],
  )

  const toggleGroup = useCallback(
    (groupId: string) => {
      if (hasActiveInGroup(groupId)) {
        setCollapsedWhileActiveIds((prev) => {
          const next = new Set(prev)
          if (next.has(groupId)) next.delete(groupId)
          else next.add(groupId)
          return next
        })
        return
      }
      setOpenIds((prev) => {
        const next = new Set(prev)
        if (next.has(groupId)) {
          next.delete(groupId)
        } else {
          next.add(groupId)
        }
        return next
      })
    },
    [hasActiveInGroup],
  )

  const activeCategoryEntry = useMemo(() => {
    for (const g of categoryGroups) {
      for (const c of categoryLinksForGroup(g)) {
        if (pathname === `/magaza/kategori/${c.slug}`) return { group: g, category: c }
      }
    }
    return null
  }, [categoryGroups, pathname])

  const activeGroup = activeCategoryEntry?.group

  return (
    <>
      <nav aria-label="Kategoriler (mobil)" className={styles.categoryNavMobile}>
        <div className={styles.mobileCatPrimaryStrip}>
          <div className={styles.mobileCatPrimaryScroll}>
            {categoryGroups.map((group) => {
              const links = categoryLinksForGroup(group)
              const first = links[0]
              if (!first) return null
              const href = `/magaza/kategori/${first.slug}`
              const active = hasActiveInGroup(group.id)
              return (
                <Link
                  className={
                    active ? styles.mobileCatPrimaryLinkActive : styles.mobileCatPrimaryLink
                  }
                  href={href}
                  key={group.id}
                >
                  {group.name}
                </Link>
              )
            })}
          </div>
        </div>
        {activeGroup && activeGroup.children.length > 0 ? (
          <div className={styles.mobileCatSubStrip}>
            <div className={styles.mobileCatSubScroll}>
              {categoryLinksForGroup(activeGroup).map((c) => {
                const href = `/magaza/kategori/${c.slug}`
                const active = pathname === href
                return (
                  <Link
                    className={active ? styles.mobileCatPillActive : styles.mobileCatPill}
                    href={href}
                    key={c.id}
                  >
                    {c.name}
                  </Link>
                )
              })}
            </div>
          </div>
        ) : null}
        {activeCategoryEntry ? (
          <div className={styles.mobileCatCrumb}>
            {activeCategoryEntry.group.children.length > 0 ? (
              <>
                <span>{activeCategoryEntry.group.name}</span>
                <span aria-hidden className={styles.mobileCatCrumbSep}>
                  {' '}
                  ›{' '}
                </span>
                <span>{activeCategoryEntry.category.name}</span>
              </>
            ) : (
              <span>{activeCategoryEntry.category.name}</span>
            )}
          </div>
        ) : null}
      </nav>

      <aside className={`${styles.sidebar} ${styles.sidebarDesktop}`} aria-label="Kategoriler">
        <p className={styles.sidebarHeading}>Kategoriler</p>
        <nav className={`${styles.sidebarNav} ${styles.sidebarNavTree}`}>
          {categoryGroups.map((group) => {
          const links = categoryLinksForGroup(group)
          const isLeafOnly = group.children.length === 0
          const open = isGroupOpen(group.id)

          if (isLeafOnly) {
            const c = links[0]
            if (!c) return null
            const href = `/magaza/kategori/${c.slug}`
            const active = pathname === href
            return (
              <div className={styles.sidebarGroup} key={group.id}>
                <Link
                  className={active ? styles.sidebarLinkActive : styles.sidebarLink}
                  href={href}
                >
                  {c.name}
                </Link>
              </div>
            )
          }

          const panelId = `sidebar-cat-${group.id}`

          return (
            <div className={styles.sidebarGroup} key={group.id}>
              <button
                aria-controls={panelId}
                aria-expanded={open}
                className={styles.sidebarParentToggle}
                onClick={() => toggleGroup(group.id)}
                type="button"
              >
                <span aria-hidden className={styles.sidebarChevron}>
                  {open ? '▼' : '▶'}
                </span>
                <span className={styles.sidebarParentLabel}>{group.name}</span>
              </button>
              <div className={styles.sidebarSubList} hidden={!open} id={panelId}>
                {links.map((c) => {
                  const href = `/magaza/kategori/${c.slug}`
                  const active = pathname === href
                  return (
                    <Link
                      className={active ? styles.sidebarLinkActive : styles.sidebarLink}
                      href={href}
                      key={c.id}
                    >
                      {c.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
        </nav>
      </aside>
    </>
  )
}
