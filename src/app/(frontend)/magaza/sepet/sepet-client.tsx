'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { startOnlinePayment } from '../actions'
import { useMagazaAuth } from '../auth-context'
import { useMagazaCart } from '../cart-context'
import { listCustomerAddresses, type CustomerAddressRow } from '../hesabim-actions'
import styles from '../magaza.module.css'

function formatCheckoutAddress(a: CustomerAddressRow): string {
  const main = a.fullAddress.trim()
  const line2 = [a.district, a.city].filter(Boolean).join(' / ')
  if (line2) return `${main}\n${line2}`
  return main
}

export function SepetClient() {
  const {
    isAuthenticated,
    sessionReady,
    openAuthModal,
    name: profileName,
    phone: profilePhone,
  } = useMagazaAuth()
  const { lines, setQty, removeLine, total, clear } = useMagazaCart()
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const [defaultAddress, setDefaultAddress] = useState<CustomerAddressRow | null>(null)
  const [savedLoading, setSavedLoading] = useState(false)
  const filledFromDefaultRef = useRef(false)

  const applyDefaultAddress = useCallback(
    (def: CustomerAddressRow) => {
      setAddress(formatCheckoutAddress(def))
      setCustomerName(profileName?.trim() ?? '')
      setPhone(profilePhone ?? '')
    },
    [profileName, profilePhone],
  )

  useEffect(() => {
    if (!sessionReady || !isAuthenticated) {
      setDefaultAddress(null)
      setSavedLoading(false)
      return
    }
    let cancelled = false
    setSavedLoading(true)
    ;(async () => {
      const res = await listCustomerAddresses()
      if (cancelled) return
      setSavedLoading(false)
      if (!res.ok) {
        setDefaultAddress(null)
        return
      }
      const def = res.addresses.find((a) => a.isDefault) ?? null
      setDefaultAddress(def)
    })()
    return () => {
      cancelled = true
    }
  }, [sessionReady, isAuthenticated])

  /** Sadece varsayılan adres — yüklendiğinde veya sipariş sonrası formu doldurur */
  useEffect(() => {
    if (!isAuthenticated || !sessionReady || savedLoading || !defaultAddress) {
      return
    }
    if (filledFromDefaultRef.current) return
    filledFromDefaultRef.current = true
    applyDefaultAddress(defaultAddress)
  }, [isAuthenticated, sessionReady, savedLoading, defaultAddress, applyDefaultAddress])

  /** Oturum ad/e-posta yüklendikten sonra alanlar boşsa doldur (varsayılan adres modunda) */
  useEffect(() => {
    if (!defaultAddress) return
    setCustomerName((prev) => prev.trim() || (profileName?.trim() ?? ''))
    setPhone((prev) => prev.trim() || (profilePhone ?? ''))
  }, [profileName, profilePhone, defaultAddress])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!lines.length) {
      setMessage({ type: 'err', text: 'Sepet boş.' })
      return
    }
    if (!isAuthenticated) {
      openAuthModal()
      setMessage({ type: 'err', text: 'Sipariş için önce telefon numaranızla giriş yapın.' })
      return
    }
    startTransition(async () => {
      const res = await startOnlinePayment({
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customerName,
        phone,
        address,
      })
      if (!res.ok) {
        setMessage({ type: 'err', text: res.error })
        return
      }
      setMessage(null)
      window.location.assign(res.paymentPageUrl)
    })
  }

  return (
    <div className={styles.sepetPage}>
      <h1 className={styles.pageTitle}>Sepetim</h1>

      {message && (
        <div className={message.type === 'ok' ? styles.flashOk : styles.flashErr}>
          {message.text}
        </div>
      )}

      {lines.length === 0 ? (
        <p className={styles.empty}>Sepetiniz boş.</p>
      ) : (
        <div className={styles.sepetLayout}>
          <div className={styles.sepetMain}>
            <div className={styles.sepetToolbar}>
              <button
                className={styles.sepetClearBtn}
                onClick={() => clear()}
                type="button"
              >
                <span className={styles.sepetClearIcon} aria-hidden>
                  🗑
                </span>
                Sepeti temizle
              </button>
            </div>
            <ul className={styles.sepetLineList}>
              {lines.map((line) => (
                <li className={styles.sepetLineCard} key={line.productId}>
                  <div className={styles.sepetLineThumbWrap}>
                    {line.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className={styles.sepetLineThumb}
                        src={line.imageUrl}
                      />
                    ) : (
                      <div className={styles.sepetLineThumbPh}>
                        {line.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className={styles.sepetLineInfo}>
                    <span className={styles.sepetLineName}>{line.name}</span>
                    <span className={styles.sepetLineUnit}>
                      {line.salePrice.toFixed(2)} ₺ / adet
                    </span>
                    <div className={styles.sepetLineBottom}>
                      <span className={styles.sepetLinePrice}>
                        {(line.salePrice * line.quantity).toFixed(2)} ₺
                      </span>
                      <div className={styles.sepetQtyWrap}>
                        <button
                          className={styles.sepetQtyBtn}
                          onClick={() => setQty(line.productId, line.quantity - 1)}
                          type="button"
                        >
                          −
                        </button>
                        <span className={styles.sepetQtyVal}>{line.quantity}</span>
                        <button
                          className={styles.sepetQtyBtn}
                          onClick={() => setQty(line.productId, line.quantity + 1)}
                          type="button"
                        >
                          +
                        </button>
                        <button
                          className={styles.sepetTrash}
                          onClick={() => removeLine(line.productId)}
                          type="button"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <aside className={styles.sepetAside}>
            <div className={styles.sepetAsideCard}>
              <div className={styles.asideCardHead}>
                <span className={styles.asidePin} aria-hidden>
                  📍
                </span>
                <span className={styles.asideCardTitle}>Teslimat adresi</span>
              </div>

              {sessionReady && isAuthenticated && !savedLoading && defaultAddress ? (
                <p className={styles.sepetDefaultHint}>
                  Varsayılan adresiniz ve hesap bilgileriniz kullanılıyor; isterseniz aşağıdan
                  değiştirebilirsiniz.
                </p>
              ) : null}
              {sessionReady && isAuthenticated && !savedLoading && !defaultAddress ? (
                <p className={styles.sepetDefaultHintMuted}>
                  Henüz varsayılan adres yok.{' '}
                  <Link href="/magaza/hesabim/adresler">Adreslerim</Link> sayfasından bir adres
                  ekleyip &quot;Varsayılan adres&quot; işaretleyin veya buraya elle yazın.
                </p>
              ) : null}
              {savedLoading && isAuthenticated ? (
                <p className={styles.sepetDefaultHintMuted}>Adres bilgisi yükleniyor…</p>
              ) : null}

              <form className={styles.sepetAsideForm} onSubmit={handleSubmit}>
                <div className={styles.field}>
                  <label htmlFor="sp-name">Ad soyad</label>
                  <input
                    autoComplete="name"
                    id="sp-name"
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    value={customerName}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="sp-phone">Telefon</label>
                  <input
                    autoComplete="tel"
                    id="sp-phone"
                    inputMode="tel"
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    value={phone}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="sp-addr">Adres</label>
                  <textarea
                    id="sp-addr"
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    value={address}
                  />
                </div>
                <div className={styles.sepetSumRow}>
                  <span>Sepet tutarı</span>
                  <strong>{total.toFixed(2)} ₺</strong>
                </div>
                <button className={styles.submitPay} disabled={isPending} type="submit">
                  {isPending ? 'Hazırlanıyor…' : 'Ödemeye geç'}
                </button>
                <p className={styles.sepetNote}>
                  Güvenli ödeme İyzico ile yapılır. Onay sonrası sipariş tamamlanır ve stok
                  düşer; yarım kalan ödemelerde sipariş iptal edilir.
                </p>
              </form>
            </div>
            <Link className={styles.sepetBackLink} href="/magaza">
              ← Alışverişe devam
            </Link>
          </aside>
        </div>
      )}
    </div>
  )
}
