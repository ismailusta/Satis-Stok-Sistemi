'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { useMagazaAuth } from '../../auth-context'
import {
  createCustomerAddress,
  deleteCustomerAddress,
  listCustomerAddresses,
  updateCustomerAddress,
  type CustomerAddressRow,
} from '../../hesabim-actions'
import styles from '../../magaza.module.css'

export function AdreslerClient() {
  const { isAuthenticated, sessionReady, openAuthModal } = useMagazaAuth()
  const [rows, setRows] = useState<CustomerAddressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [fullAddress, setFullAddress] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await listCustomerAddresses()
    if (!res.ok) {
      setMsg({ type: 'err', text: res.error })
      setRows([])
    } else {
      setRows(res.addresses)
    }
    setLoading(false)
  }, [isAuthenticated])

  useEffect(() => {
    if (!sessionReady) return
    void load()
  }, [sessionReady, load])

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setFullAddress('')
    setCity('')
    setDistrict('')
    setIsDefault(false)
  }

  const startEdit = (a: CustomerAddressRow) => {
    setEditingId(a.id)
    setTitle(a.title)
    setFullAddress(a.fullAddress)
    setCity(a.city ?? '')
    setDistrict(a.district ?? '')
    setIsDefault(a.isDefault)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setSaving(true)
    try {
      if (editingId) {
        const res = await updateCustomerAddress(editingId, {
          title,
          fullAddress,
          city: city || undefined,
          district: district || undefined,
          isDefault,
        })
        if (!res.ok) setMsg({ type: 'err', text: res.error })
        else {
          setMsg({ type: 'ok', text: 'Adres güncellendi.' })
          resetForm()
          await load()
        }
      } else {
        const res = await createCustomerAddress({
          title,
          fullAddress,
          city: city || undefined,
          district: district || undefined,
          isDefault,
        })
        if (!res.ok) setMsg({ type: 'err', text: res.error })
        else {
          setMsg({ type: 'ok', text: 'Adres eklendi.' })
          resetForm()
          await load()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!window.confirm('Bu adresi silmek istediğinize emin misiniz?')) return
    setMsg(null)
    const res = await deleteCustomerAddress(id)
    if (!res.ok) setMsg({ type: 'err', text: res.error })
    else {
      setMsg({ type: 'ok', text: 'Adres silindi.' })
      if (editingId === id) resetForm()
      await load()
    }
  }

  if (!sessionReady) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>Adreslerim</h1>
        <p className={styles.sub}>Yükleniyor…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.pageTitle}>Adreslerim</h1>
        <p className={styles.sub}>Adres eklemek için giriş yapın.</p>
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
      <h1 className={styles.pageTitle}>Adreslerim</h1>
      <p className={styles.sub}>Teslimat için kayıtlı adresleriniz.</p>
      {msg ? (
        <div className={msg.type === 'ok' ? styles.flashOk : styles.flashErr}>{msg.text}</div>
      ) : null}

      {loading ? <p className={styles.empty}>Yükleniyor…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className={styles.empty}>Henüz kayıtlı adres yok.</p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <ul className={styles.hesabimList}>
          {rows.map((a) => (
            <li className={styles.hesabimListItem} key={a.id}>
              <div>
                <strong>{a.title}</strong>
                {a.isDefault ? <span className={styles.hesabimBadge}>Varsayılan</span> : null}
                <p className={styles.hesabimAddrText}>{a.fullAddress}</p>
                {(a.city || a.district) && (
                  <p className={styles.hesabimMeta}>
                    {[a.district, a.city].filter(Boolean).join(' / ')}
                  </p>
                )}
              </div>
              <div className={styles.hesabimItemActions}>
                <button
                  className={styles.hesabimLinkBtn}
                  onClick={() => startEdit(a)}
                  type="button"
                >
                  Düzenle
                </button>
                <button
                  className={styles.hesabimDangerBtn}
                  onClick={() => void onDelete(a.id)}
                  type="button"
                >
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form className={styles.hesabimFormCard} onSubmit={onSubmit}>
        <h2 className={styles.hesabimFormTitle}>{editingId ? 'Adresi düzenle' : 'Yeni adres'}</h2>
        <div className={styles.field}>
          <label htmlFor="addr-title">Adres adı</label>
          <input
            id="addr-title"
            onChange={(e) => setTitle(e.target.value)}
            required
            value={title}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="addr-full">Açık adres</label>
          <textarea
            id="addr-full"
            onChange={(e) => setFullAddress(e.target.value)}
            required
            rows={3}
            value={fullAddress}
          />
        </div>
        <div className={styles.hesabimTwoCol}>
          <div className={styles.field}>
            <label htmlFor="addr-city">İl (isteğe bağlı)</label>
            <input id="addr-city" onChange={(e) => setCity(e.target.value)} value={city} />
          </div>
          <div className={styles.field}>
            <label htmlFor="addr-dist">İlçe (isteğe bağlı)</label>
            <input id="addr-dist" onChange={(e) => setDistrict(e.target.value)} value={district} />
          </div>
        </div>
        <label className={styles.hesabimCheck}>
          <input
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            type="checkbox"
          />
          Varsayılan adres
        </label>
        <div className={styles.hesabimBtnRow}>
          <button className={styles.submitPay} disabled={saving} type="submit">
            {saving ? 'Kaydediliyor…' : editingId ? 'Güncelle' : 'Kaydet'}
          </button>
          {editingId ? (
            <button
              className={styles.hesabimGhostBtn}
              onClick={() => resetForm()}
              type="button"
            >
              İptal
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
