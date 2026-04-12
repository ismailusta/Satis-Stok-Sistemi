'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { useMagazaAuth } from '../../auth-context'
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  type PaymentMethodRow,
} from '../../hesabim-actions'
import styles from '../../magaza.module.css'

export function OdemeClient() {
  const { isAuthenticated, sessionReady, openAuthModal } = useMagazaAuth()
  const [methods, setMethods] = useState<PaymentMethodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const [label, setLabel] = useState('')
  const [type, setType] = useState<'card' | 'other'>('card')
  const [last4, setLast4] = useState('')
  const [cardBrand, setCardBrand] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setMethods([])
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await listPaymentMethods()
    if (!res.ok) {
      setMsg({ type: 'err', text: res.error })
      setMethods([])
    } else {
      setMethods(res.methods)
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
      const res = await createPaymentMethod({
        label,
        type,
        last4: last4 || undefined,
        cardBrand: cardBrand || undefined,
        isDefault,
      })
      if (!res.ok) setMsg({ type: 'err', text: res.error })
      else {
        setMsg({ type: 'ok', text: 'Kayıt eklendi.' })
        setLabel('')
        setLast4('')
        setCardBrand('')
        setIsDefault(false)
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    setMsg(null)
    const res = await deletePaymentMethod(id)
    if (!res.ok) setMsg({ type: 'err', text: res.error })
    else {
      setMsg({ type: 'ok', text: 'Kayıt silindi.' })
      await load()
    }
  }

  if (!sessionReady) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>Ödeme yöntemlerim</h1>
        <p className={styles.sub}>Yükleniyor…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>Ödeme yöntemlerim</h1>
        <p className={styles.sub}>Kayıt eklemek için giriş yapın.</p>
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
      <h1 className={styles.pageTitle}>Ödeme yöntemlerim</h1>
      <p className={styles.sub}>
        Kart numarası saklanmaz; yalnızca tanıma yardımcı olacak son 4 hane ve etiket
        kaydedilir.
      </p>
      {msg ? (
        <div className={msg.type === 'ok' ? styles.flashOk : styles.flashErr}>{msg.text}</div>
      ) : null}

      <form className={styles.hesabimFormCard} onSubmit={onSubmit}>
        <h2 className={styles.hesabimFormTitle}>Yeni kayıt</h2>
        <div className={styles.field}>
          <label htmlFor="pm-label">Etiket</label>
          <input
            id="pm-label"
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Örn. İş kartım"
            required
            value={label}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="pm-type">Tür</label>
          <select
            id="pm-type"
            onChange={(e) => setType(e.target.value === 'other' ? 'other' : 'card')}
            value={type}
          >
            <option value="card">Kart</option>
            <option value="other">Diğer</option>
          </select>
        </div>
        {type === 'card' ? (
          <>
            <div className={styles.hesabimTwoCol}>
              <div className={styles.field}>
                <label htmlFor="pm-last4">Son 4 hane</label>
                <input
                  id="pm-last4"
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  value={last4}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="pm-brand">Marka (isteğe bağlı)</label>
                <input
                  id="pm-brand"
                  onChange={(e) => setCardBrand(e.target.value)}
                  placeholder="Visa, Mastercard…"
                  value={cardBrand}
                />
              </div>
            </div>
          </>
        ) : null}
        <label className={styles.hesabimCheck}>
          <input
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            type="checkbox"
          />
          Varsayılan yöntem
        </label>
        <button className={styles.submitPay} disabled={saving} type="submit">
          {saving ? 'Kaydediliyor…' : 'Ekle'}
        </button>
      </form>

      {loading ? (
        <p className={styles.empty}>Yükleniyor…</p>
      ) : methods.length === 0 ? (
        <p className={styles.empty}>Henüz kayıtlı yöntem yok.</p>
      ) : (
        <ul className={styles.hesabimList}>
          {methods.map((m) => (
            <li className={styles.hesabimListItem} key={m.id}>
              <div>
                <strong>{m.label}</strong>
                {m.isDefault ? <span className={styles.hesabimBadge}>Varsayılan</span> : null}
                <p className={styles.hesabimMeta}>
                  {m.type === 'card' ? 'Kart' : 'Diğer'}
                  {m.last4 ? ` · •••• ${m.last4}` : ''}
                  {m.cardBrand ? ` · ${m.cardBrand}` : ''}
                </p>
              </div>
              <button
                className={styles.hesabimDangerBtn}
                onClick={() => void onDelete(m.id)}
                type="button"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
