import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// CommonJS paketi; sadece sunucu tarafında kullanılır.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Iyzipay = require('iyzipay') as IyzipayConstructor
// eslint-disable-next-line @typescript-eslint/no-require-imports
const iyziUtils = require('iyzipay/lib/utils') as {
  calculateHmacSHA256Signature: (params: string[], secretKey: string) => string
}

type IyzipayClient = {
  checkoutFormInitialize: {
    create: (
      request: Record<string, unknown>,
      cb: (err: Error | null, result: IyzicoApiEnvelope) => void,
    ) => void
  }
  checkoutForm: {
    retrieve: (
      request: Record<string, unknown>,
      cb: (err: Error | null, result: CheckoutFormRetrieveResult) => void,
    ) => void
  }
}

type IyzipayConstructor = {
  new (config: { uri: string; apiKey: string; secretKey: string }): IyzipayClient
  LOCALE: { TR: string }
  CURRENCY: { TRY: string }
  PAYMENT_GROUP: { PRODUCT: string }
  BASKET_ITEM_TYPE: { PHYSICAL: string; VIRTUAL: string }
}

export type IyzicoApiEnvelope = {
  status: string
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
  locale?: string
  systemTime?: number
  conversationId?: string
  token?: string
  signature?: string
  checkoutFormContent?: string
  tokenExpireTime?: number
  paymentPageUrl?: string
}

export type CheckoutFormRetrieveResult = IyzicoApiEnvelope & {
  paymentStatus?: string
  paymentId?: string
  currency?: string
  basketId?: string
  paidPrice?: string
  price?: string
}

export const Iyzico = {
  LOCALE: Iyzipay.LOCALE,
  CURRENCY: Iyzipay.CURRENCY,
  PAYMENT_GROUP: Iyzipay.PAYMENT_GROUP,
  BASKET_ITEM_TYPE: Iyzipay.BASKET_ITEM_TYPE,
}

export function getIyzipayClient(): { client: IyzipayClient; secretKey: string } {
  const uri = process.env.IYZIPAY_URI?.trim()
  const apiKey = process.env.IYZIPAY_API_KEY?.trim()
  const secretKey = process.env.IYZIPAY_SECRET_KEY?.trim()
  if (!uri || !apiKey || !secretKey) {
    throw new Error(
      'İyzico yapılandırması eksik: IYZIPAY_URI, IYZIPAY_API_KEY ve IYZIPAY_SECRET_KEY ortam değişkenlerini ayarlayın.',
    )
  }
  return { client: new Iyzipay({ uri, apiKey, secretKey }), secretKey }
}

export function checkoutFormInitializeCreate(
  request: Record<string, unknown>,
): Promise<IyzicoApiEnvelope> {
  const { client } = getIyzipayClient()
  return new Promise((resolve, reject) => {
    client.checkoutFormInitialize.create(request, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

export function checkoutFormRetrieve(
  request: Record<string, unknown>,
): Promise<CheckoutFormRetrieveResult> {
  const { client } = getIyzipayClient()
  return new Promise((resolve, reject) => {
    client.checkoutForm.retrieve(request, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

/** Checkout Form retrieve yanıt imzası (iyzipay örnekleri ile aynı sıra). */
export function verifyCheckoutFormRetrieveSignature(
  result: CheckoutFormRetrieveResult,
  secretKey: string,
): boolean {
  const sig = result.signature
  if (!sig || typeof sig !== 'string') return false
  const params = [
    result.paymentStatus,
    result.paymentId,
    result.currency,
    result.basketId,
    result.conversationId,
    result.paidPrice,
    result.price,
    result.token,
  ].map((x) => (x === undefined || x === null ? '' : String(x)))
  const calculated = iyziUtils.calculateHmacSHA256Signature(params, secretKey)
  return calculated === sig
}

/** Ödeme callback ve yönlendirmeler. APP_URL (sunucu) önce — aynı WiFi testinde 192.168.x.x kullanın. */
export function publicAppBaseUrl(): string {
  const candidates = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.LAN_DEV_ORIGIN,
  ]
  for (const c of candidates) {
    const t = c?.trim().replace(/\/+$/, '')
    if (t) return t
  }
  return 'http://localhost:3000'
}

function addOriginFromBase(set: Set<string>, raw: string | undefined) {
  const t = raw?.trim().replace(/\/+$/, '')
  if (!t) return
  try {
    set.add(new URL(t).origin)
  } catch {
    /* */
  }
}

/**
 * Ödeme sonrası tarayıcı yönlendirmesi için güvenli origin listesi (açık yönlendirme yok).
 * Geliştirmede aynı portta localhost / 127.0.0.1 de kabul edilir (APP_URL LAN iken oturum kaybı olmasın).
 */
export function getAllowedCheckoutReturnOrigins(): string[] {
  const set = new Set<string>()
  addOriginFromBase(set, process.env.APP_URL)
  addOriginFromBase(set, process.env.NEXT_PUBLIC_APP_URL)
  addOriginFromBase(set, process.env.LAN_DEV_ORIGIN)
  addOriginFromBase(set, publicAppBaseUrl())

  try {
    const u = new URL(publicAppBaseUrl())
    set.add(u.origin)
    if (process.env.NODE_ENV !== 'production') {
      const port = u.port
      if (port) {
        set.add(`http://localhost:${port}`)
        set.add(`http://127.0.0.1:${port}`)
      }
    }
  } catch {
    /* */
  }

  return [...set]
}

/** Mağaza checkout’tan gelen `window.location.origin` — yalnızca izin listesindeyse döner. */
export function validateCheckoutReturnOrigin(candidate: string | undefined | null): string | null {
  if (!candidate || typeof candidate !== 'string') return null
  const t = candidate.trim()
  if (!t) return null
  try {
    const origin = new URL(t).origin
    const allowed = getAllowedCheckoutReturnOrigins()
    return allowed.includes(origin) ? origin : null
  } catch {
    return null
  }
}

/** İyzico CF-Retrieve için conversationId ile aynı olmalı (sipariş id). */
export function iyzicoCallbackAbsoluteUrlForOrder(orderId: string): string {
  const base = publicAppBaseUrl()
  return `${base}/api/payment/iyzico/callback/${encodeURIComponent(orderId)}`
}
