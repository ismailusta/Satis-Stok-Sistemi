'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'

import { useMagazaAuth } from '../auth-context'
import styles from '../magaza.module.css'

/** Eski /magaza/giris linki: giriş popup’ını açıp mağaza ana sayfaya yönlendirir. */
export function GirisClient() {
  const router = useRouter()
  const { openAuthModal } = useMagazaAuth()

  useEffect(() => {
    openAuthModal({ mode: 'login' })
    router.replace('/magaza')
  }, [openAuthModal, router])

  return <div className={styles.authRoutePlaceholder} aria-busy="true" />
}
