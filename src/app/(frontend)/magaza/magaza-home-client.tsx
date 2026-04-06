'use client'

import Link from 'next/link'
import React from 'react'

import type { StorefrontHomeData } from './actions'
import { useMagazaAuth } from './auth-context'
import { useMagazaCategories } from './categories-context'
import { MagazaPhoneAuthForm } from './magaza-phone-auth-form'
import styles from './magaza.module.css'

type Props = {
  storefront: StorefrontHomeData
  loadError: string | null
}

export function MagazaHomeClient({ storefront, loadError }: Props) {
  const categories = useMagazaCategories()
  const { isAuthenticated, login, phone } = useMagazaAuth()
  const { heroTitle, heroSubtitle, heroImageUrl, heroHref } = storefront

  const title = heroTitle?.trim() || 'Dakikalar içinde kapında'
  const subtitle =
    heroSubtitle?.trim() || 'İhtiyacın olan ürünler, birkaç tıkla sepetinde — hızlı teslimat.'

  return (
    <div className={styles.homeRoot}>
      {loadError && <div className={styles.flashErr}>{loadError}</div>}

      <section className={`${styles.landingHero} ${styles.heroEnter}`}>
        {heroImageUrl ? (
          <div className={styles.heroBg}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className={styles.heroBgImg} src={heroImageUrl} />
          </div>
        ) : null}
        <div className={styles.landingHeroInner}>
          <div className={styles.landingLeft}>
            <div className={styles.landingLogoCircle} aria-hidden>
              g
            </div>
            <p className={styles.landingTagline}>bi mutluluk</p>
            <h1 className={styles.landingTitle}>{title}</h1>
            <p className={styles.landingSub}>{subtitle}</p>
            {heroHref ? (
              <a className={styles.heroCta} href={heroHref}>
                İncele
              </a>
            ) : null}
          </div>
          <div className={styles.landingRight}>
            {isAuthenticated ? (
              <div className={styles.landingAuthCardMuted}>
                <p className={styles.loggedInLead}>Giriş yapıldı</p>
                <p className={styles.loggedInPhone}>{phone}</p>
                <Link className={styles.landingCatCta} href="#kategoriler">
                  Kategorilere git
                </Link>
              </div>
            ) : (
              <div className={styles.landingAuthCard}>
                <MagazaPhoneAuthForm
                  onVerifiedPhone={(p) => login(p)}
                  showFooter
                  variant="card"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={styles.homeBelow}>
        <section className={styles.homeCategorySection} id="kategoriler">
          <h2 className={styles.homeCategoryHeading}>Kategoriler</h2>
          <div className={styles.categoryGrid}>
            {categories.map((c) => (
              <Link className={styles.categoryTile} href={`/magaza/kategori/${c.slug}`} key={c.id}>
                <div className={styles.categoryTileImgWrap}>
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className={styles.categoryTileImg} src={c.imageUrl} />
                  ) : (
                    <div className={styles.categoryTilePh}>{c.name.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <span className={styles.categoryTileLabel}>{c.name}</span>
              </Link>
            ))}
          </div>
          {categories.length === 0 && (
            <p className={styles.empty}>Henüz kategori yok. Panelden kategori ekleyin.</p>
          )}
        </section>
      </div>
    </div>
  )
}
