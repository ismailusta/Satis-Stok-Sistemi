import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

import { PosClient } from './pos-client'

export const metadata = {
  title: 'POS — Satış',
  description: 'Fiziki kasa ekranı',
}

export default async function PosPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect(`${payloadConfig.routes.admin}/login?redirect=${encodeURIComponent('/pos')}`)
  }

  return <PosClient />
}
