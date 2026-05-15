'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'

import {
  getSalesSummary,
  getSalesTrends,
  getTopCategories,
  getTopProducts,
  type SalesTrendPoint,
  type TopCategoryRow,
  type TopProductRow,
} from './actions'
import { RaporCharts } from './rapor-charts'
import styles from './rapor.module.css'

function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function RaporClient() {
  const [isPending, startTransition] = useTransition()
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return toDateInputValue(d)
  })
  const [to, setTo] = useState(() => toDateInputValue(new Date()))

  const [summary, setSummary] = useState<{
    orderCount: number
    revenueTotal: number
    bySource: { pos: number; online: number }
  } | null>(null)
  const [topRows, setTopRows] = useState<TopProductRow[]>([])
  const [categoryRows, setCategoryRows] = useState<TopCategoryRow[]>([])
  const [trends, setTrends] = useState<{
    byMonth: SalesTrendPoint[]
    byYear: SalesTrendPoint[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const s = await getSalesSummary(from, to)
      if (!s.ok) {
        setError(s.error)
        setSummary(null)
        setTopRows([])
        setCategoryRows([])
        setTrends(null)
        return
      }
      setSummary({
        orderCount: s.orderCount,
        revenueTotal: s.revenueTotal,
        bySource: s.bySource,
      })

      const [t, c, tr] = await Promise.all([
        getTopProducts(from, to, 15),
        getTopCategories(from, to, 15),
        getSalesTrends(from, to),
      ])

      if (!t.ok) {
        setError(t.error)
        setTopRows([])
      } else {
        setTopRows(t.rows)
      }

      if (!c.ok) {
        setError((prev) => prev ?? c.error)
        setCategoryRows([])
      } else {
        setCategoryRows(c.rows)
      }

      if (!tr.ok) {
        setTrends(null)
        setError((prev) => prev ?? tr.error)
      } else {
        setTrends({ byMonth: tr.byMonth, byYear: tr.byYear })
      }
    })
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Satış raporu</h1>
      <p className={styles.sub}>
        Tamamlanmış siparişler ve net tutarlar; POS vs online ciro (kısmi/tam iade sonrası
        toplamlar dahil).
      </p>

      {error && <div className={styles.err}>{error}</div>}

      <div className={styles.filters}>
        <div className={styles.field}>
          <label htmlFor="rapor-from">Başlangıç</label>
          <input
            id="rapor-from"
            onChange={(e) => setFrom(e.target.value)}
            type="date"
            value={from}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="rapor-to">Bitiş</label>
          <input id="rapor-to" onChange={(e) => setTo(e.target.value)} type="date" value={to} />
        </div>
        <button className={styles.btn} disabled={isPending} onClick={load} type="button">
          {isPending ? 'Yükleniyor…' : 'Yenile'}
        </button>
      </div>

      {summary && (
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Sipariş adedi</div>
            <div className={styles.cardValue}>{summary.orderCount}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Toplam ciro (₺)</div>
            <div className={styles.cardValue}>{summary.revenueTotal.toFixed(2)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>POS (₺)</div>
            <div className={styles.cardValue}>{summary.bySource.pos.toFixed(2)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Online (₺)</div>
            <div className={styles.cardValue}>{summary.bySource.online.toFixed(2)}</div>
          </div>
        </div>
      )}

      {trends && (
        <>
          <h2 className={styles.sectionTitle}>Aylık ve yıllık satış (POS / online)</h2>
          <p className={styles.sub} style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Tarih filtresine göre gruplanır; grafik üzerinde POS ve online yüzdeleri gösterilir.
          </p>
          <RaporCharts byMonth={trends.byMonth} byYear={trends.byYear} />
        </>
      )}

      <h2 className={styles.sectionTitle}>Kategoriler (net satış)</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Kategori</th>
              <th>Adet</th>
              <th>Ciro (₺)</th>
            </tr>
          </thead>
          <tbody>
            {categoryRows.length === 0 ? (
              <tr>
                <td colSpan={4}>{isPending ? '…' : 'Bu aralıkta veri yok.'}</td>
              </tr>
            ) : (
              categoryRows.map((r, i) => (
                <tr key={r.categoryId}>
                  <td>{i + 1}</td>
                  <td>{r.name}</td>
                  <td>{r.qtySold}</td>
                  <td>{r.revenue.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className={styles.sectionTitle}>En çok satan ürünler (net satış)</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Ürün</th>
              <th>Kategori</th>
              <th>Adet</th>
              <th>Ciro (₺)</th>
            </tr>
          </thead>
          <tbody>
            {topRows.length === 0 ? (
              <tr>
                <td colSpan={5}>{isPending ? '…' : 'Bu aralıkta veri yok.'}</td>
              </tr>
            ) : (
              topRows.map((r, i) => (
                <tr key={r.productId}>
                  <td>{i + 1}</td>
                  <td>{r.name}</td>
                  <td>{r.categoryName}</td>
                  <td>{r.qtySold}</td>
                  <td>{r.revenue.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
