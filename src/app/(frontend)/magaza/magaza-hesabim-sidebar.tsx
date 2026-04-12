'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState, useTransition } from 'react'

import { getMagazaSessionAction, updateMagazaProfileAction } from './auth-otp-actions'
import { useMagazaAuth } from './auth-context'
import { MAGAZA_ACCOUNT_NAV } from './magaza-hesabim-nav'
import styles from './magaza.module.css'

function phoneCompact(phone: string | null): string {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('90')) return `+${d}`
  if (d.length === 10) return `+90${d}`
  return phone
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/magaza/siparisler') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MagazaHesabimSidebar() {
  const pathname = usePathname()
  const { isAuthenticated, sessionReady, name, phone, email, login, openAuthModal } = useMagazaAuth()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!editing) {
      setEditName(name?.trim() ?? '')
      setEditEmail(email?.trim() ?? '')
    }
  }, [name, email, editing])

  const displayName = name?.trim() ? name.trim() : 'Hesabım'
  const displayPhone = phoneCompact(phone)
  const displayEmail = email?.trim() ?? ''

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMsg(null)
    startTransition(async () => {
      const res = await updateMagazaProfileAction({ name: editName, email: editEmail })
      if (!res.ok) {
        setProfileMsg({ type: 'err', text: res.error })
        return
      }
      const s = await getMagazaSessionAction()
      if (s.ok) {
        login(s.user.phoneDisplay, {
          name: s.user.name ?? undefined,
          email: s.user.email ?? undefined,
        })
      }
      setProfileMsg({ type: 'ok', text: 'Bilgileriniz güncellendi.' })
      setEditing(false)
    })
  }

  return (
    <>
      <nav aria-label="Hesabım (mobil)" className={styles.accountNavMobile}>
        <div className={styles.accountNavMobileScroll}>
          {MAGAZA_ACCOUNT_NAV.map((item) => {
            const active = isActivePath(pathname, item.href)
            return (
              <Link
                className={active ? styles.accountNavPillActive : styles.accountNavPill}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <aside
        className={`${styles.sidebar} ${styles.sidebarAccount} ${styles.sidebarAccountDesktop}`}
        aria-label="Hesabım"
      >
        <div className={styles.accountSidebarStack}>
          <div className={styles.accountProfileCard}>
            <div className={styles.accountProfileCardHead}>
              <p className={styles.accountProfileName}>{displayName}</p>
              {isAuthenticated && sessionReady ? (
                <button
                  aria-label="Profili düzenle"
                  className={styles.accountProfileEditBtn}
                  onClick={() => {
                    setProfileMsg(null)
                    setEditing((v) => !v)
                  }}
                  type="button"
                >
                  <svg aria-hidden fill="none" height="18" viewBox="0 0 24 24" width="18">
                    <path
                      d="M4 21h4l10.5-10.5-4-4L4 17v4Zm15-13a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0l-1 1 4 4 1-1Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              ) : null}
            </div>

            {!sessionReady ? (
              <p className={styles.accountProfileMuted}>Yükleniyor…</p>
            ) : !isAuthenticated ? (
              <div className={styles.accountProfileGuest}>
                <p className={styles.accountProfileMuted}>Hesap özellikleri için giriş yapın.</p>
                <button
                  className={styles.accountLoginBtn}
                  onClick={() => openAuthModal()}
                  type="button"
                >
                  Giriş yap
                </button>
              </div>
            ) : (
              <>
                <ul className={styles.accountProfileLines}>
                  <li className={styles.accountProfileLine}>
                    <span className={styles.accountProfileIcon} aria-hidden>
                      ✉
                    </span>
                    <span className={styles.accountProfileLineText}>
                      {displayEmail || 'E-posta eklenmedi'}
                    </span>
                    {displayEmail ? (
                      <span className={styles.accountVerified} title="Doğrulanmış hesap">
                        ✓
                      </span>
                    ) : null}
                  </li>
                  <li className={styles.accountProfileLine}>
                    <span className={styles.accountProfileIcon} aria-hidden>
                      ☎
                    </span>
                    <span className={styles.accountProfileLineText}>
                      {displayPhone || 'Telefon yok'}
                    </span>
                    {displayPhone ? (
                      <span className={styles.accountVerified} title="Doğrulanmış telefon">
                        ✓
                      </span>
                    ) : null}
                  </li>
                </ul>

                {editing ? (
                  <form className={styles.accountProfileForm} onSubmit={saveProfile}>
                    {profileMsg ? (
                      <div
                        className={
                          profileMsg.type === 'ok' ? styles.accountProfileFlashOk : styles.accountProfileFlashErr
                        }
                      >
                        {profileMsg.text}
                      </div>
                    ) : null}
                    <div className={styles.field}>
                      <label htmlFor="acc-name">Ad soyad</label>
                      <input
                        id="acc-name"
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        value={editName}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="acc-email">E-posta</label>
                      <input
                        id="acc-email"
                        onChange={(e) => setEditEmail(e.target.value)}
                        required
                        type="email"
                        value={editEmail}
                      />
                    </div>
                    <div className={styles.accountProfileFormActions}>
                      <button className={styles.accountSaveBtn} disabled={pending} type="submit">
                        {pending ? 'Kaydediliyor…' : 'Kaydet'}
                      </button>
                      <button
                        className={styles.accountCancelBtn}
                        onClick={() => {
                          setEditing(false)
                          setProfileMsg(null)
                        }}
                        type="button"
                      >
                        İptal
                      </button>
                    </div>
                  </form>
                ) : null}
              </>
            )}
          </div>

          <nav className={styles.accountNavCard}>
            <p className={styles.accountNavCardTitle}>Hesabım</p>
            <div className={styles.accountNavList}>
              {MAGAZA_ACCOUNT_NAV.map((item) => {
                const active = isActivePath(pathname, item.href)
                return (
                  <Link
                    className={active ? styles.accountNavLinkActive : styles.accountNavLink}
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </nav>
        </div>
      </aside>
    </>
  )
}
