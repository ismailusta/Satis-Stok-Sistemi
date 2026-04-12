import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import {
  checkoutFormRetrieve,
  getIyzipayClient,
  Iyzico,
  publicAppBaseUrl,
  verifyCheckoutFormRetrieveSignature,
} from '@/lib/iyzico'
import config from '@/payload.config'

function redirect(path: string) {
  return NextResponse.redirect(new URL(path, publicAppBaseUrl()))
}

async function parseTokenFromBody(request: NextRequest): Promise<string | null> {
  const ct = request.headers.get('content-type') ?? ''
  try {
    if (ct.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      return new URLSearchParams(text).get('token')
    }
    if (ct.includes('multipart/form-data')) {
      const fd = await request.formData()
      return fd.get('token')?.toString() ?? null
    }
    if (ct.includes('application/json')) {
      const body = (await request.json()) as { token?: string }
      return body.token ?? null
    }
    const fd = await request.formData()
    return fd.get('token')?.toString() ?? null
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await ctx.params
  const token = request.nextUrl.searchParams.get('token')
  return handleCallback(orderId, token)
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await ctx.params
  const token =
    request.nextUrl.searchParams.get('token') ?? (await parseTokenFromBody(request))
  return handleCallback(orderId, token)
}

async function handleCallback(orderId: string, token: string | null) {
  if (!token) {
    return redirect('/magaza/odeme/hata?neden=token')
  }

  const { secretKey } = getIyzipayClient()

  let result
  try {
    result = await checkoutFormRetrieve({
      locale: Iyzico.LOCALE.TR,
      conversationId: orderId,
      token,
    })
  } catch {
    return redirect('/magaza/odeme/hata?neden=istek')
  }

  if (result.status !== 'success') {
    const msg = result.errorMessage || result.errorCode || 'api'
    return redirect(`/magaza/odeme/hata?neden=${encodeURIComponent(msg)}`)
  }

  if (!verifyCheckoutFormRetrieveSignature(result, secretKey)) {
    return redirect('/magaza/odeme/hata?neden=imza')
  }

  if (String(result.conversationId ?? '') !== orderId) {
    return redirect('/magaza/odeme/hata?neden=oturum')
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  let order: {
    id: string | number
    source?: string
    status?: string
    totalAmount?: number
    orderNumber?: string | null
    notes?: string | null
  }

  try {
    order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return redirect('/magaza/odeme/hata?neden=siparis')
  }

  if (order.source !== 'online') {
    return redirect('/magaza/odeme/hata?neden=kaynak')
  }

  if (order.status === 'completed') {
    return redirect(
      `/magaza/odeme/basarili?no=${encodeURIComponent(String(order.orderNumber ?? ''))}`,
    )
  }

  if (order.status !== 'draft') {
    return redirect('/magaza/odeme/hata?neden=durum')
  }

  const expected = Number(order.totalAmount)
  const paid = Number(result.paidPrice ?? result.price)
  if (!Number.isFinite(paid) || Math.abs(paid - expected) > 0.02) {
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'cancelled' },
      overrideAccess: true,
    })
    return redirect('/magaza/odeme/hata?neden=tutar')
  }

  if (result.paymentStatus !== 'SUCCESS') {
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'cancelled' },
      overrideAccess: true,
    })
    return redirect('/magaza/odeme/hata?neden=odeme')
  }

  const payNote = result.paymentId ? `\n[iyzico] paymentId: ${result.paymentId}` : ''
  const nextNotes = [order.notes?.trim() || '', payNote.trim()].filter(Boolean).join('\n')

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      status: 'completed',
      ...(nextNotes ? { notes: nextNotes } : {}),
    },
    overrideAccess: true,
  })

  return redirect(
    `/magaza/odeme/basarili?no=${encodeURIComponent(String(order.orderNumber ?? ''))}`,
  )
}
