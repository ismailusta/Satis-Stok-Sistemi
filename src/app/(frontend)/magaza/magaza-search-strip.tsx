'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { useMagazaAuth } from './auth-context'
import styles from './magaza.module.css'

const POPULAR_SEARCHES = [
  'su',
  'cips',
  'süt',
  'dondurma',
  'çikolata',
  'ekmek',
  'yoğurt',
  'kola',
  'yumurta',
] as const

export function MagazaSearchStrip() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isAuthenticated, sessionReady } = useMagazaAuth()
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!pathname.startsWith('/magaza/ara')) return
    const qq = searchParams.get('q')
    if (qq != null) setQ(qq)
  }, [pathname, searchParams])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = q.trim()
    if (t.length < 1) return
    router.push(`/magaza/ara?q=${encodeURIComponent(t)}`)
  }

  const goPopular = (term: string) => {
    router.push(`/magaza/ara?q=${encodeURIComponent(term)}`)
  }

  const showPopular = pathname === '/magaza'

  if (!sessionReady) return null
  if (!isAuthenticated) return null

  return (
    <div className={styles.searchStripOuter}>
      <div className={styles.searchStripPurple}>
        <form className={styles.searchStripRow} onSubmit={onSubmit}>
          <div className={styles.searchStripWhite}>
            <span className={styles.searchStripSearchIcon} aria-hidden>
              <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm0-2a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z"
                  fill="currentColor"
                />
                <path
                  d="m20 20-4.2-4.2"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            </span>
            <input
              aria-label="Ürün ara"
              className={styles.searchStripInput}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ürün ara"
              type="search"
              value={q}
            />
          </div>
        </form>
      </div>

      {showPopular ? (
        <div className={styles.searchStripPopular}>
          <p className={styles.searchStripPopularTitle}>Popüler Aramalar</p>
          <div className={styles.searchStripChips}>
            {POPULAR_SEARCHES.map((term) => (
              <button
                className={styles.searchStripChip}
                key={term}
                onClick={() => goPopular(term)}
                type="button"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
