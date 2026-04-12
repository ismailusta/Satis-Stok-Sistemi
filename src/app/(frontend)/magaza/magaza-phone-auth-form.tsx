'use client'

import Link from 'next/link'
import React, { useState } from 'react'

import { sendPhoneOtp, verifyPhoneOtp } from './auth-otp-actions'
import { normalizeTurkishGsm } from './phone-utils'
import styles from './magaza.module.css'

export type MagazaOtpUser = {
  phoneDisplay: string
  name: string | null
  email: string | null
}

type Props = {
  variant?: 'modal' | 'card'
  onOtpSuccess: (user: MagazaOtpUser) => void
  showFooter?: boolean
  heading?: string
  onRequestRegister?: () => void
}

export function MagazaPhoneAuthForm({
  variant = 'card',
  onOtpSuccess,
  showFooter = true,
  heading = 'Giriş yap veya kayıt ol',
  onRequestRegister,
}: Props) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const formClass =
    variant === 'modal' ? `${styles.authForm} ${styles.authFormModal}` : styles.landingAuthForm

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const n = normalizeTurkishGsm(phone)
    if (!n.ok) {
      setErr(n.error)
      return
    }
    setPending(true)
    try {
      const res = await sendPhoneOtp(phone, { flow: 'login' })
      if (!res.ok) {
        setErr(res.error)
        return
      }
      setStep('code')
      setCode('')
    } finally {
      setPending(false)
    }
  }

  const phoneNorm = normalizeTurkishGsm(phone)

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const n = normalizeTurkishGsm(phone)
    if (!n.ok) {
      setErr(n.error)
      return
    }
    const digits = code.replace(/\D/g, '').slice(0, 6)
    if (digits.length !== 6) {
      setErr('6 haneli kodu girin.')
      return
    }
    setPending(true)
    try {
      const res = await verifyPhoneOtp(phone, digits, { flow: 'login' })
      if (!res.ok) {
        setErr(res.error)
        return
      }
      onOtpSuccess({
        phoneDisplay: res.user.phoneDisplay,
        name: res.user.name,
        email: res.user.email,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <form className={formClass} onSubmit={step === 'phone' ? sendCode : verify}>
      <p className={styles.authFormTitle}>{heading}</p>

      {step === 'phone' ? (
        <>
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
          <button className={styles.authSubmitYellow} disabled={pending} type="submit">
            {pending ? 'Gönderiliyor…' : 'Kod gönder'}
          </button>
        </>
      ) : (
        <>
          <p className={styles.authOtpHint}>
            <button
              className={styles.authBackLink}
              onClick={() => {
                setStep('phone')
                setErr(null)
                setCode('')
              }}
              type="button"
            >
              ← Numarayı değiştir
            </button>
          </p>
          <p className={styles.authOtpPhoneMuted}>{phoneNorm.ok ? phoneNorm.display : phone}</p>
          <input
            autoComplete="one-time-code"
            className={styles.authOtpInput}
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="• • • • • •"
            type="text"
            value={code}
          />
          {err ? <p className={styles.authFieldErr}>{err}</p> : null}
          <button className={styles.authSubmitYellow} disabled={pending} type="submit">
            {pending ? 'Kontrol…' : 'Giriş yap'}
          </button>
        </>
      )}

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
