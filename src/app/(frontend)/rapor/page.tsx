import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

import { RaporClient } from './rapor-client'

export const metadata = {
  title: 'Rapor — Satış özeti',
  description: 'POS ve online ciro, en çok satanlar',
}

export default async function RaporPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(`${payloadConfig.routes.admin}/login?redirect=${encodeURIComponent('/rapor')}`)
  }

  return <RaporClient />
}
