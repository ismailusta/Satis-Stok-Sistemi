'use server'

import { createHash, randomInt } from 'crypto'
import { cookies } from 'next/headers'

import config from '@payload-config'
import {
  COOKIE_NAME,
  decodeMagazaSessionToken,
  encodeMagazaSessionToken,
  MAX_AGE_SEC,
} from '@/lib/magaza-session'
import { sendOtpSms } from '@/lib/sms'
import type { Payload } from 'payload'
import { getPayload } from 'payload'

import { normalizeTurkishGsm, toPhoneKey } from './phone-utils'

const OTP_TTL_MS = 3 * 60 * 1000
const SEND_COOLDOWN_MS = 60 * 1000
const MAX_VERIFY_ATTEMPTS = 8

function hashOtp(code: string): string {
  const pepper = process.env.OTP_PEPPER || process.env.PAYLOAD_SECRET || 'pepper'
  return createHash('sha256').update(`${code}:${pepper}`).digest('hex')
}

function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

async function getCookieStore() {
  return cookies()
}

export type MagazaSessionUser = {
  phoneDisplay: string
  name: string | null
  email: string | null
  customerId: string
}

export type OtpFlow = 'login' | 'register'

async function findCustomerByPhone(
  payload: Payload,
  phoneKey: string,
  display: string,
): Promise<{
  id: string | number
  name?: string | null
  phone?: string | null
  email?: string | null
  phoneKey?: string | null
} | null> {
  const byKey = await payload.find({
    collection: 'customers',
    where: { phoneKey: { equals: phoneKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (byKey.docs[0]) return byKey.docs[0] as (typeof byKey.docs)[0]

  const byPhone = await payload.find({
    collection: 'customers',
    where: { phone: { equals: display } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (byPhone.docs[0]) return byPhone.docs[0] as (typeof byPhone.docs)[0]
  return null
}

export async function sendPhoneOtp(
  phoneRaw: string,
  options?: { flow: OtpFlow },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const flow: OtpFlow = options?.flow ?? 'login'

  const n = normalizeTurkishGsm(phoneRaw)
  if (!n.ok) return { ok: false, error: n.error }
  const phoneKey = toPhoneKey(phoneRaw)
  if (!phoneKey) return { ok: false, error: 'Geçersiz numara.' }

  const payload = await getPayload({ config })
  const display = n.display

  const existingCustomer = await findCustomerByPhone(payload, phoneKey, display)

  if (flow === 'login') {
    if (!existingCustomer) {
      return {
        ok: false,
        error: 'Bu telefon numarası ile kayıtlı hesap yok. Önce kayıt olun.',
      }
    }
  } else {
    if (existingCustomer) {
      return {
        ok: false,
        error: 'Bu numara zaten kayıtlı. Giriş yapabilirsiniz.',
      }
    }
  }

  const existing = await payload.find({
    collection: 'phone-otps',
    where: { phoneKey: { equals: phoneKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const now = Date.now()
  const doc = existing.docs[0] as
    | {
        id: string | number
        lastSentAt?: string | null
      }
    | undefined

  if (doc?.lastSentAt) {
    const last = new Date(doc.lastSentAt).getTime()
    if (now - last < SEND_COOLDOWN_MS) {
      return { ok: false, error: 'Lütfen bir dakika bekleyip tekrar deneyin.' }
    }
  }

  const code = generateSixDigitCode()
  const codeHash = hashOtp(code)
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString()
  const lastSentAt = new Date(now).toISOString()

  if (doc) {
    await payload.update({
      collection: 'phone-otps',
      id: doc.id,
      data: {
        codeHash,
        expiresAt,
        lastSentAt,
        verifyAttempts: 0,
      },
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'phone-otps',
      data: {
        phoneKey,
        codeHash,
        expiresAt,
        lastSentAt,
        verifyAttempts: 0,
      },
      overrideAccess: true,
    })
  }

  const sms = await sendOtpSms(phoneKey, code)
  if (!sms.ok) {
    return { ok: false, error: sms.error }
  }

  return { ok: true }
}

export type VerifyPhoneOtpOptions =
  | { flow: 'login' }
  | { flow: 'register'; registerProfile: { name: string; email: string } }

export async function verifyPhoneOtp(
  phoneRaw: string,
  codeRaw: string,
  options?: VerifyPhoneOtpOptions,
): Promise<
  | { ok: true; user: MagazaSessionUser }
  | { ok: false; error: string }
> {
  const flow: OtpFlow = options?.flow ?? 'login'
  const n = normalizeTurkishGsm(phoneRaw)
  if (!n.ok) return { ok: false, error: n.error }
  const phoneKey = toPhoneKey(phoneRaw)
  if (!phoneKey) return { ok: false, error: 'Geçersiz numara.' }

  const code = codeRaw.replace(/\D/g, '').slice(0, 6)
  if (code.length !== 6) {
    return { ok: false, error: '6 haneli kodu girin.' }
  }

  const payload = await getPayload({ config })

  const found = await payload.find({
    collection: 'phone-otps',
    where: { phoneKey: { equals: phoneKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const row = found.docs[0] as
    | {
        id: string | number
        codeHash: string
        expiresAt: string
        verifyAttempts?: number | null
      }
    | undefined

  if (!row) {
    return { ok: false, error: 'Önce kod isteyin veya süresi doldu.' }
  }

  const exp = new Date(row.expiresAt).getTime()
  if (Date.now() > exp) {
    await payload.delete({ collection: 'phone-otps', id: row.id, overrideAccess: true })
    return { ok: false, error: 'Kodun süresi doldu. Yeni kod isteyin.' }
  }

  const attempts = Number(row.verifyAttempts ?? 0)
  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    await payload.delete({ collection: 'phone-otps', id: row.id, overrideAccess: true })
    return { ok: false, error: 'Çok fazla hatalı deneme. Yeni kod isteyin.' }
  }

  if (hashOtp(code) !== row.codeHash) {
    await payload.update({
      collection: 'phone-otps',
      id: row.id,
      data: { verifyAttempts: attempts + 1 },
      overrideAccess: true,
    })
    return { ok: false, error: 'Kod hatalı.' }
  }

  await payload.delete({ collection: 'phone-otps', id: row.id, overrideAccess: true })

  const display = n.display

  if (flow === 'register') {
    if (!options || options.flow !== 'register') {
      return { ok: false, error: 'Kayıt bilgileri eksik.' }
    }
    const regName = options.registerProfile.name.trim()
    const regEmail = options.registerProfile.email.trim()
    if (regName.length < 2) {
      return { ok: false, error: 'Ad soyad en az 2 karakter olmalı.' }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      return { ok: false, error: 'Geçerli bir e-posta girin.' }
    }

    const taken = await findCustomerByPhone(payload, phoneKey, display)
    if (taken) {
      return { ok: false, error: 'Bu numara ile kayıt zaten var. Giriş yapın.' }
    }

    const customer = await payload.create({
      collection: 'customers',
      data: {
        name: regName,
        email: regEmail,
        phone: display,
        phoneKey,
      },
      overrideAccess: true,
    })

    const customerId = String(customer.id)
    const expSec = Math.floor(Date.now() / 1000) + MAX_AGE_SEC
    const token = encodeMagazaSessionToken({
      customerId,
      phoneKey,
      exp: expSec,
    })

    const store = await getCookieStore()
    store.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE_SEC,
    })

    const user: MagazaSessionUser = {
      customerId,
      phoneDisplay: display,
      name: regName,
      email: regEmail,
    }

    return { ok: true, user }
  }

  // flow === 'login'
  let customer = await findCustomerByPhone(payload, phoneKey, display)

  if (!customer) {
    return {
      ok: false,
      error: 'Bu telefon ile kayıtlı hesap bulunamadı. Önce kayıt olun.',
    }
  }

  if (!customer.phoneKey) {
    await payload.update({
      collection: 'customers',
      id: customer.id,
      data: { phoneKey, phone: display },
      overrideAccess: true,
    })
  } else if (!customer.phone || String(customer.phone).length < 8) {
    await payload.update({
      collection: 'customers',
      id: customer.id,
      data: { phone: display, phoneKey },
      overrideAccess: true,
    })
  }

  const customerId = String(customer.id)
  const expSec = Math.floor(Date.now() / 1000) + MAX_AGE_SEC
  const token = encodeMagazaSessionToken({
    customerId,
    phoneKey,
    exp: expSec,
  })

  const store = await getCookieStore()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEC,
  })

  const user: MagazaSessionUser = {
    customerId,
    phoneDisplay: display,
    name: typeof customer.name === 'string' ? customer.name : null,
    email: typeof customer.email === 'string' ? customer.email : null,
  }

  return { ok: true, user }
}

export async function getMagazaSessionAction(): Promise<
  { ok: true; user: MagazaSessionUser } | { ok: false }
> {
  const store = await getCookieStore()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return { ok: false }

  const decoded = decodeMagazaSessionToken(raw)
  if (!decoded) return { ok: false }

  const payload = await getPayload({ config })
  const c = await payload.findByID({
    collection: 'customers',
    id: decoded.customerId,
    depth: 0,
    overrideAccess: true,
  })

  if (!c || (c as { phoneKey?: string }).phoneKey !== decoded.phoneKey) {
    store.delete(COOKIE_NAME)
    return { ok: false }
  }

  const display =
    typeof (c as { phone?: string }).phone === 'string' && (c as { phone: string }).phone.length > 5
      ? (c as { phone: string }).phone
      : formatDisplayFromPhoneKey(decoded.phoneKey)

  return {
    ok: true,
    user: {
      customerId: String(c.id),
      phoneDisplay: display,
      name: typeof (c as { name?: string }).name === 'string' ? (c as { name: string }).name : null,
      email:
        typeof (c as { email?: string }).email === 'string' ? (c as { email: string }).email : null,
    },
  }
}

function formatDisplayFromPhoneKey(phoneKey: string): string {
  const d = phoneKey.replace(/\D/g, '')
  const rest = d.startsWith('90') ? d.slice(2) : d
  if (rest.length !== 10) return `+${d}`
  return `+90 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 8)} ${rest.slice(8, 10)}`
}

/** Server actions: oturum yoksa hata döner */
export async function requireMagazaCustomerId(): Promise<
  { ok: true; customerId: string } | { ok: false; error: string }
> {
  const r = await getMagazaSessionAction()
  if (!r.ok) return { ok: false, error: 'Giriş yapmanız gerekiyor.' }
  return { ok: true, customerId: r.user.customerId }
}

export async function logoutMagazaAction(): Promise<void> {
  const store = await getCookieStore()
  store.delete(COOKIE_NAME)
}

export async function updateMagazaProfileAction(input: {
  name: string
  email: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim()
  const email = input.email.trim()
  if (name.length < 2) return { ok: false, error: 'Ad soyad en az 2 karakter olmalı.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Geçerli bir e-posta girin.' }
  }

  const store = await getCookieStore()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return { ok: false, error: 'Oturum yok.' }
  const decoded = decodeMagazaSessionToken(raw)
  if (!decoded) return { ok: false, error: 'Oturum geçersiz.' }

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'customers',
    id: decoded.customerId,
    data: { name, email },
    overrideAccess: true,
  })

  return { ok: true }
}
