/** Basit TR cep doğrulaması — format kontrolü */
export function normalizeTurkishGsm(
  input: string,
): { ok: true; display: string } | { ok: false; error: string } {
  const digits = input.replace(/\D/g, '')
  let rest = digits
  if (rest.startsWith('90')) rest = rest.slice(2)
  if (rest.startsWith('0')) rest = rest.slice(1)
  if (rest.length !== 10 || !rest.startsWith('5')) {
    return { ok: false, error: 'Geçerli bir 10 haneli cep numarası girin (5xx xxx xx xx).' }
  }
  const display = `+90 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 8)} ${rest.slice(8, 10)}`
  return { ok: true, display }
}

/** Veritabanı eşlemesi: `90` + 10 hane */
export function toPhoneKey(input: string): string | null {
  const n = normalizeTurkishGsm(input)
  if (!n.ok) return null
  const digits = input.replace(/\D/g, '')
  let rest = digits
  if (rest.startsWith('90')) rest = rest.slice(2)
  if (rest.startsWith('0')) rest = rest.slice(1)
  if (rest.length !== 10) return null
  return `90${rest}`
}
