import React from 'react'

export const metadata = {
  title: 'Kurye',
  description: 'Teslimat ekranı',
  robots: { index: false, follow: false },
}

export default function KuryeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0f1419',
        color: '#e8eaed',
        fontFamily: 'system-ui, "Segoe UI", sans-serif',
      }}
    >
      {children}
    </div>
  )
}
