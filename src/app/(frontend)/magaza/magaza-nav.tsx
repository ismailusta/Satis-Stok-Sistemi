'use client'

import Link from 'next/link'
import React from 'react'

import { usePathname } from 'next/navigation'

import { useMagazaAuth } from './auth-context'
import { useMagazaCart } from './cart-context'
import styles from './magaza.module.css'

export function MagazaNav() {
  const pathname = usePathname()
  const { isAuthenticated, openAuthModal, logout, phone } = useMagazaAuth()
  const { itemCount } = useMagazaCart()

  return (
    <header className={styles.topNav}>
      <div className={styles.topNavInner}>
        <Link className={styles.brand} href="/magaza">
          <span className={styles.brandGlyph} aria-hidden>
            W
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Westcoast Corner Shop</span>
          </span>
        </Link>
        <div className={styles.navRight}>
          <label className={styles.langWrap}>
            <span className={styles.srOnly}>Dil</span>
            <select className={styles.langSelect} defaultValue="tr">
              <option value="tr">Türkçe (TR)</option>
              <option value="en">English</option>
            </select>
          </label>
          {isAuthenticated ? (
            <>
              <Link
                className={
                  pathname === '/magaza/sepet' ? styles.navSepetActive : styles.navSepet
                }
                href="/magaza/sepet"
              >
                Sepet
                {itemCount > 0 ? (
                  <span className={styles.navSepetBadge}>{itemCount}</span>
                ) : null}
              </Link>
              <span className={styles.navPhone} title={phone ?? undefined}>
                {phone}
              </span>
              <button className={styles.navGhost} onClick={() => logout()} type="button">
                Çıkış
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.navGhost}
                onClick={() => openAuthModal()}
                type="button"
              >
                Giriş yap
              </button>
              <button
                className={styles.navPrimary}
                onClick={() => openAuthModal({ mode: 'register' })}
                type="button"
              >
                Kayıt ol
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
