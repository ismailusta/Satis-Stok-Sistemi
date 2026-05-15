import { type NextRequest, NextResponse } from 'next/server'

import { publicAppBaseUrl } from '@/lib/iyzico'

/** LAN / İyzico callback öncesi: telefondan http://<IP>:3000/api/ping açılıyorsa sunucu erişilebilir. ?diag=1 ile env özeti. */
export async function GET(req: NextRequest) {
  const base = { ok: true as const, t: Date.now() }
  if (req.nextUrl.searchParams.get('diag') === '1') {
    return NextResponse.json({
      ...base,
      appUrl: process.env.APP_URL ?? null,
      nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
      lanDevOrigin: process.env.LAN_DEV_ORIGIN ?? null,
      effectiveBase: publicAppBaseUrl(),
      hint:
        'Aynı WiFi’deki telefon: bilgisayarda ipconfig → kablosuz IPv4 (192.168.x.x). Dış IP (176…) ile içeriden çoğu modemde bağlanılamaz; APP_URL ve NEXT_PUBLIC_APP_URL’i bu yerel adrese yazıp dev’i yeniden başlat.',
    })
  }
  return NextResponse.json(base)
}
