import { createHmac, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'magaza_customer'
const MAX_AGE_SEC = 60 * 60 * 24 * 30 // 30 gün

export type MagazaSessionPayload = {
  customerId: string
  phoneKey: string
  exp: number
}

function getSecret(): string {
  const s = process.env.PAYLOAD_SECRET || process.env.MAGAZA_SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('PAYLOAD_SECRET (veya MAGAZA_SESSION_SECRET) tanımlı ve yeterince uzun olmalı.')
  }
  return s
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url')
}

/** İstemciye verilecek: payloadB64.signature */
export function encodeMagazaSessionToken(payload: MagazaSessionPayload): string {
  const json = JSON.stringify(payload)
  const body = Buffer.from(json, 'utf8').toString('base64url')
  const sig = sign(body)
  return `${body}.${sig}`
}

export function decodeMagazaSessionToken(token: string): MagazaSessionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [body, sig] = parts
    const expected = sign(body)
    const a = Buffer.from(sig, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const json = Buffer.from(body, 'base64url').toString('utf8')
    const p = JSON.parse(json) as MagazaSessionPayload
    if (!p.customerId || !p.phoneKey || typeof p.exp !== 'number') return null
    if (p.exp < Math.floor(Date.now() / 1000)) return null
    return p
  } catch {
    return null
  }
}

export { COOKIE_NAME, MAX_AGE_SEC }
