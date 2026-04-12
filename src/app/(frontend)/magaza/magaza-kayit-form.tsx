'use client'

import React, { useState } from 'react'

import { sendPhoneOtp, verifyPhoneOtp } from './auth-otp-actions'
import { useMagazaAuth } from './auth-context'
import { normalizeTurkishGsm } from './phone-utils'
import styles from './magaza.module.css'

const MARKETING_KEY = 'magaza-marketing-opt-in-v1'

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

type Props = {
  onSwitchToLogin: () => void
}

type Step = 'details' | 'code' | 'success'

export function MagazaKayitForm({ onSwitchToLogin }: Props) {
  const { finishRegisterFromModal, closeAuthModal } = useMagazaAuth()
  const [step, setStep] = useState<Step>('details')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [marketing, setMarketing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const phoneNorm = normalizeTurkishGsm(phone)

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setErr('Ad soyad en az 2 karakter olmalı.')
      return
    }
    const trimmedEmail = email.trim()
    if (!isValidEmail(trimmedEmail)) {
      setErr('Geçerli bir e-posta girin.')
      return
    }
    const n = normalizeTurkishGsm(phone)
    if (!n.ok) {
      setErr(n.error)
      return
    }
    setPending(true)
    try {
      const res = await sendPhoneOtp(phone, { flow: 'register' })
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

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
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
      const res = await verifyPhoneOtp(phone, digits, {
        flow: 'register',
        registerProfile: { name: trimmedName, email: trimmedEmail },
      })
      if (!res.ok) {
        setErr(res.error)
        return
      }
      try {
        localStorage.setItem(MARKETING_KEY, marketing ? '1' : '0')
      } catch {
        /* ignore */
      }
      setStep('success')
    } finally {
      setPending(false)
    }
  }

  const completeSuccess = () => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const display = phoneNorm.ok ? phoneNorm.display : phone
    finishRegisterFromModal(display, { name: trimmedName, email: trimmedEmail })
  }

  return (
    <>
      <button
        aria-label="Kapat"
        className={styles.kayitClose}
        onClick={closeAuthModal}
        type="button"
      >
        ×
      </button>
      <h1 className={styles.kayitTitle}>Kayıt Ol</h1>

      {step === 'details' ? (
        <form className={styles.kayitForm} onSubmit={sendCode}>
          <input
            autoComplete="name"
            className={styles.kayitInputFull}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ad Soyad"
            type="text"
            value={name}
          />
          <input
            autoComplete="email"
            className={styles.kayitInputFull}
            inputMode="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Posta"
            type="email"
            value={email}
          />
          <div className={styles.kayitPhoneRow}>
            <div className={styles.kayitPhoneCode}>
              <span aria-hidden>🇹🇷</span>
              <span>+90</span>
            </div>
            <input
              autoComplete="tel"
              className={styles.kayitInput}
              inputMode="numeric"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefon Numarası"
              type="tel"
              value={phone}
            />
          </div>

          <label className={styles.kayitCheckRow}>
            <input
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              type="checkbox"
            />
            <span>
              Mağaza&apos;nın bana özel kampanya, tanıtım ve fırsatlarından haberdar olmak istiyorum.
            </span>
          </label>

          <p className={styles.kayitLegal}>
            Kişisel verilere dair Aydınlatma Metni için{' '}
            <a className={styles.kayitLink} href="#">
              tıkla
            </a>
            . Üye olmakla,{' '}
            <a className={styles.kayitLink} href="#">
              Kullanım Koşulları
            </a>{' '}
            hükümlerini kabul etmektesin.
          </p>

          {err ? <p className={styles.authFieldErr}>{err}</p> : null}
          <button className={styles.kayitSubmit} disabled={pending} type="submit">
            {pending ? 'Gönderiliyor…' : 'Onay kodu gönder'}
          </button>
        </form>
      ) : null}

      {step === 'code' ? (
        <form className={styles.kayitForm} onSubmit={verify}>
          <p className={styles.kayitOtpLead}>
            <strong>{phoneNorm.ok ? phoneNorm.display : phone}</strong> numarasına gönderilen 6 haneli kodu
            girin.
          </p>
          <p className={styles.authOtpHint}>
            <button
              className={styles.authBackLink}
              onClick={() => {
                setStep('details')
                setErr(null)
                setCode('')
              }}
              type="button"
            >
              ← Bilgileri düzenle
            </button>
          </p>
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
          <button className={styles.kayitSubmit} disabled={pending} type="submit">
            {pending ? 'Kontrol…' : 'Kaydı tamamla'}
          </button>
        </form>
      ) : null}

      {step === 'success' ? (
        <div className={styles.kayitSuccess}>
          <p className={styles.kayitSuccessIcon} aria-hidden>
            ✓
          </p>
          <p className={styles.kayitSuccessTitle}>Kayıt başarılı</p>
          <p className={styles.kayitSuccessSub}>Hesabın hazır. Alışverişe başlayabilirsin.</p>
          <button className={styles.kayitSubmit} onClick={completeSuccess} type="button">
            Devam
          </button>
        </div>
      ) : null}

      {step !== 'success' ? (
        <div className={styles.kayitModalFooter}>
          <span>Zaten üye misin? </span>
          <button type="button" className={styles.kayitFooterBtn} onClick={onSwitchToLogin}>
            Giriş yap
          </button>
        </div>
      ) : null}
    </>
  )
}
