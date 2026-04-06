'use client'

import Link from 'next/link'
import React, { useState } from 'react'

import { normalizeTurkishGsm } from './phone-utils'
import styles from './magaza.module.css'

type Props = {
  variant?: 'modal' | 'card'
  onVerifiedPhone: (displayPhone: string) => void
  showFooter?: boolean
  heading?: string
  onRequestRegister?: () => void
}

export function MagazaPhoneAuthForm({
  variant = 'card',
  onVerifiedPhone,
  showFooter = true,
  heading = 'Giriş yap veya kayıt ol',
  onRequestRegister,
}: Props) {
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const n = normalizeTurkishGsm(phone)
    if (!n.ok) {
      setErr(n.error)
      return
    }
    onVerifiedPhone(n.display)
  }

  const formClass =
    variant === 'modal' ? `${styles.authForm} ${styles.authFormModal}` : styles.landingAuthForm

  return (
    <form className={formClass} onSubmit={submit}>
      <p className={styles.authFormTitle}>{heading}</p>
      <div className={styles.phoneRow}>
        <div className={styles.phoneCode}>
          <span className={styles.phoneFlag} aria-hidden>
            🇹🇷
          </span>
          <span>+90</span>
        </div>
        <input
          autoComplete="tel"
          className={styles.phoneInput}
          inputMode="numeric"
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefon Numarası"
          type="tel"
          value={phone}
        />
      </div>
      {err ? <p className={styles.authFieldErr}>{err}</p> : null}
      <button className={styles.authSubmitYellow} type="submit">
        Telefon numarası ile devam et
      </button>
      <p className={styles.authLegal}>
        Kişisel verilerine dair Aydınlatma Metni için{' '}
        <a className={styles.authLink} href="#">
          tıklayınız
        </a>
        .
      </p>
      {showFooter ? (
        <div className={styles.authFormFooter}>
          <span>Hala kayıt olmadın mı? </span>
          {onRequestRegister ? (
            <button
              className={styles.authFooterLinkBtn}
              onClick={onRequestRegister}
              type="button"
            >
              Kayıt Ol
            </button>
          ) : (
            <Link className={styles.authLinkBold} href="/magaza/kayit">
              Kayıt Ol
            </Link>
          )}
        </div>
      ) : null}
    </form>
  )
}
