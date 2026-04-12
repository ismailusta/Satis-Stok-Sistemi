'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { useMagazaAuth } from '../../auth-context'
import { getCommunicationPrefs, updateCommunicationPrefs } from '../../hesabim-actions'
import styles from '../../magaza.module.css'

export function IletisimClient() {
  const { isAuthenticated, sessionReady, openAuthModal } = useMagazaAuth()
  const [marketingEmail, setMarketingEmail] = useState(false)
  const [marketingSms, setMarketingSms] = useState(false)
  const [orderStatusSms, setOrderStatusSms] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await getCommunicationPrefs()
    if (!res.ok) {
      setMsg({ type: 'err', text: res.error })
    } else {
      setMarketingEmail(res.marketingEmail)
      setMarketingSms(res.marketingSms)
      setOrderStatusSms(res.orderStatusSms)
    }
    setLoading(false)
  }, [isAuthenticated])

  useEffect(() => {
    if (!sessionReady) return
    void load()
  }, [sessionReady, load])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setSaving(true)
    try {
      const res = await updateCommunicationPrefs({
        marketingEmail,
        marketingSms,
        orderStatusSms,
      })
      if (!res.ok) setMsg({ type: 'err', text: res.error })
      else setMsg({ type: 'ok', text: 'Tercihleriniz kaydedildi.' })
    } finally {
      setSaving(false)
    }
  }

  if (!sessionReady) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>İletişim tercihlerim</h1>
        <p className={styles.sub}>Yükleniyor…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>İletişim tercihlerim</h1>
        <p className={styles.sub}>Ayarları değiştirmek için giriş yapın.</p>
        <button
          className={styles.submitPay}
          onClick={() => openAuthModal()}
          style={{ marginTop: '1rem', maxWidth: '220px' }}
          type="button"
        >
          Giriş yap
        </button>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>İletişim tercihlerim</h1>
      <p className={styles.sub}>Kampanya ve sipariş bildirimleri.</p>
      {msg ? (
        <div className={msg.type === 'ok' ? styles.flashOk : styles.flashErr}>{msg.text}</div>
      ) : null}

      {loading ? (
        <p className={styles.empty}>Yükleniyor…</p>
      ) : (
        <form className={styles.hesabimFormCard} onSubmit={onSubmit}>
          <label className={styles.hesabimCheck}>
            <input
              checked={marketingEmail}
              onChange={(e) => setMarketingEmail(e.target.checked)}
              type="checkbox"
            />
            Kampanya ve yenilikler hakkında e-posta almak istiyorum
          </label>
          <label className={styles.hesabimCheck}>
            <input
              checked={marketingSms}
              onChange={(e) => setMarketingSms(e.target.checked)}
              type="checkbox"
            />
            Kampanya mesajları için SMS almak istiyorum
          </label>
          <label className={styles.hesabimCheck}>
            <input
              checked={orderStatusSms}
              onChange={(e) => setOrderStatusSms(e.target.checked)}
              type="checkbox"
            />
            Sipariş durumu için SMS bildirimi
          </label>
          <button className={styles.submitPay} disabled={saving} type="submit">
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </form>
      )}
    </div>
  )
}
