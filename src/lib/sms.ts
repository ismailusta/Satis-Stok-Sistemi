/**
 * Netgsm REST (GET) — env: NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_MSGHEADER (gönderici adı onaylı)
 * https://www.netgsm.com.tr/dokuman/#sms-gönderimi
 */

function gsmDigits(phoneKey: string): string {
  return phoneKey.replace(/\D/g, '')
}

export async function sendOtpSms(phoneKey: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = process.env.NETGSM_USERCODE
  const pass = process.env.NETGSM_PASSWORD
  const header = process.env.NETGSM_MSGHEADER || ''

  const message = `Giris kodunuz: ${code} (3 dk gecerlidir)`

  if (process.env.NODE_ENV === 'development' && (!user || !pass)) {
    console.info(`[SMS dev] ${phoneKey} -> ${message}`)
    return { ok: true }
  }

  if (!user || !pass) {
    return { ok: false, error: 'SMS servisi yapılandırılmamış (NETGSM_USERCODE / NETGSM_PASSWORD).' }
  }

  const no = gsmDigits(phoneKey)
  if (no.length < 10) {
    return { ok: false, error: 'Geçersiz numara.' }
  }

  const params = new URLSearchParams({
    usercode: user,
    password: pass,
    gsmno: no,
    message,
    msgheader: header,
    dil: 'TR',
  })

  const url = `https://api.netgsm.com.tr/sms/send/get?${params.toString()}`

  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    const text = await res.text()
    const codeNum = parseInt(text.trim().split(' ')[0] ?? '', 10)
    if (!res.ok) {
      return { ok: false, error: `SMS gönderilemedi (${res.status}).` }
    }
    if (Number.isFinite(codeNum) && codeNum < 0) {
      return { ok: false, error: `Netgsm hata kodu: ${text.trim()}` }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'SMS isteği başarısız.'
    return { ok: false, error: msg }
  }
}
