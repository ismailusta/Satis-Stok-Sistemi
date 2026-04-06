'use client'

import React, { useState } from 'react'

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

export function MagazaKayitForm({ onSwitchToLogin }: Props) {
  const { finishRegisterFromModal, closeAuthModal } = useMagazaAuth()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [marketing, setMarketing] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const n = normalizeTurkishGsm(phone)
    if (!n.ok) {
      setErr(n.error)
      return
    }
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
    try {
      localStorage.setItem(MARKETING_KEY, marketing ? '1' : '0')
    } catch {
      /* ignore */
    }
    finishRegisterFromModal(n.display, { name: trimmedName, email: trimmedEmail })
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
      <form className={styles.kayitForm} onSubmit={submit}>
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

        <button className={styles.kayitSubmit} type="submit">
          Kayıt Ol
        </button>
      </form>

      <div className={styles.kayitModalFooter}>
        <span>Mağaza&apos;ya üyeysen </span>
        <button type="button" className={styles.kayitFooterBtn} onClick={onSwitchToLogin}>
          Giriş yap
        </button>
      </div>
    </>
  )
}
