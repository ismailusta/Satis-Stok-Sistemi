'use client'

import React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { SalesTrendPoint } from './actions'
import styles from './rapor.module.css'

const TL = '\u20BA'

const POS_COLOR = '#81c995'
const ONLINE_COLOR = '#8ab4f8'

type TooltipPayloadItem = {
  dataKey?: string
  name?: string
  value?: number
  color?: string
  payload?: SalesTrendPoint
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className={styles.chartTooltip}>
      <div className={styles.chartTooltipTitle}>{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} style={{ color: p.color }}>
          {p.name}: {Number(p.value ?? 0).toFixed(2)} {TL}
        </div>
      ))}
      {row && row.revenue > 0 ? (
        <div className={styles.chartTooltipRatios}>
          Oran: POS %{row.posPct} · Online %{row.onlinePct}
        </div>
      ) : null}
    </div>
  )
}

function TrendChart({
  title,
  data,
  emptyHint,
}: {
  title: string
  data: SalesTrendPoint[]
  emptyHint: string
}) {
  const hasData = data.some((d) => d.revenue > 0)

  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>{title}</h3>
      {!hasData ? (
        <p className={styles.chartEmpty}>{emptyHint}</p>
      ) : (
        <div className={styles.chartPlot}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: data.length > 8 ? 24 : 8 }}
            >
              <CartesianGrid stroke="#3c4043" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                stroke="#9aa0a6"
                tick={{ fill: '#9aa0a6', fontSize: 11 }}
                interval={0}
                angle={data.length > 6 ? -35 : 0}
                textAnchor={data.length > 6 ? 'end' : 'middle'}
                height={data.length > 6 ? 56 : 28}
              />
              <YAxis
                stroke="#9aa0a6"
                tick={{ fill: '#9aa0a6', fontSize: 11 }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
              />
              <Tooltip content={<TrendTooltip />} />
              <Legend wrapperStyle={{ color: '#e8eaed' }} />
              <Bar
                dataKey="pos"
                stackId="src"
                fill={POS_COLOR}
                name={`POS (${TL})`}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="online"
                stackId="src"
                fill={ONLINE_COLOR}
                name={`Online (${TL})`}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function RaporCharts({
  byMonth,
  byYear,
}: {
  byMonth: SalesTrendPoint[]
  byYear: SalesTrendPoint[]
}) {
  return (
    <div className={styles.chartsGrid}>
      <TrendChart
        title="Aylık ciro ve kaynak dağılımı"
        data={byMonth}
        emptyHint="Bu aralıkta aylık satış yok."
      />
      <TrendChart
        title="Yıllık ciro ve kaynak dağılımı"
        data={byYear}
        emptyHint="Bu aralıkta yıllık satış yok."
      />
    </div>
  )
}
