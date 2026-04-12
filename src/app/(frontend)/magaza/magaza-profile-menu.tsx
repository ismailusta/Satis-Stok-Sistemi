'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { useMagazaAuth } from './auth-context'
import { MAGAZA_ACCOUNT_NAV } from './magaza-hesabim-nav'
import styles from './magaza.module.css'

/** Profil dropdown menü öğeleri (`MENU` eski ad; bazı derleme senaryolarıyla uyum). */
const MENU = MAGAZA_ACCOUNT_NAV

function phoneCompact(phone: string | null): string {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('90')) return `+${d}`
  if (d.length === 10) return `+90${d}`
  return phone
}

export function MagazaProfileMenu() {
  const { name, phone, logout } = useMagazaAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const displayName = name?.trim() ? name.trim() : 'Hesabım'
  const displayPhone = phoneCompact(phone)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className={styles.navProfileWrap} ref={wrapRef}>
      <button
        aria-expanded={open}
        aria-haspopup="true"
        className={styles.navProfileTrigger}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className={styles.navProfileTriggerIcon} aria-hidden>
          <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>Profil</span>
        <span className={styles.navProfileChevron} aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open ? (
        <div className={styles.navProfileDropdown} role="menu">
          <div className={styles.navProfileHeader}>
            <div className={styles.navProfileAvatar} aria-hidden>
              <svg fill="none" height="28" viewBox="0 0 24 24" width="28">
                <path
                  d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className={styles.navProfileHeaderText}>
              <span className={styles.navProfileName}>{displayName}</span>
              {displayPhone ? (
                <span className={styles.navProfilePhone}>{displayPhone}</span>
              ) : null}
            </div>
          </div>
          <ul className={styles.navProfileList}>
            {MENU.map((item) => (
              <li key={item.href}>
                <Link
                  className={styles.navProfileLink}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.navProfileFooter}>
            <button
              className={styles.navProfileLogout}
              onClick={() => {
                setOpen(false)
                logout()
              }}
              type="button"
            >
              Çıkış yap
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
