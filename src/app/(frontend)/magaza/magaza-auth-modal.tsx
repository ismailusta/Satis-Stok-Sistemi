'use client'

import React from 'react'

import { useMagazaAuth } from './auth-context'
import { MagazaKayitForm } from './magaza-kayit-form'
import { MagazaPhoneAuthForm } from './magaza-phone-auth-form'
import styles from './magaza.module.css'

export function MagazaAuthModal() {
  const {
    showAuthModal,
    authModalMode,
    closeAuthModal,
    finishLoginFromModal,
    switchAuthModalMode,
  } = useMagazaAuth()

  if (!showAuthModal) return null

  return (
    <div
      aria-modal
      className={styles.authOverlay}
      onClick={closeAuthModal}
      onKeyDown={(e) => e.key === 'Escape' && closeAuthModal()}
      role="dialog"
    >
      <div
        className={authModalMode === 'register' ? styles.kayitModal : styles.authModal}
        onClick={(e) => e.stopPropagation()}
      >
        {authModalMode === 'login' ? (
          <>
            <button
              aria-label="Kapat"
              className={styles.authModalClose}
              onClick={closeAuthModal}
              type="button"
            >
              ×
            </button>
            <MagazaPhoneAuthForm
              heading="Giriş yap"
              onRequestRegister={() => switchAuthModalMode('register')}
              onVerifiedPhone={finishLoginFromModal}
              showFooter
              variant="modal"
            />
          </>
        ) : (
          <MagazaKayitForm onSwitchToLogin={() => switchAuthModalMode('login')} />
        )}
      </div>
    </div>
  )
}
