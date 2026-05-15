import React from 'react'

import { SonnerToaster } from '@/components/sonner-toaster'

import './styles.css'

export const metadata = {
  description: 'A blank template using Payload in a Next.js app.',
  title: 'Payload Blank Template',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <SonnerToaster />
        <main>{children}</main>
      </body>
    </html>
  )
}
