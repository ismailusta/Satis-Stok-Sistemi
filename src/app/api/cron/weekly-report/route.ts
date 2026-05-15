import { NextResponse } from 'next/server'

import { runWeeklyTelegramReport } from '@/lib/run-weekly-telegram-report'
import { getTelegramConfig } from '@/lib/telegram'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const headerSecret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    request.headers.get('x-cron-secret')

  return querySecret === secret || headerSecret === secret
}

/** Haftalık raporu Telegram'a gönderir. Zamanlayıcı: her Pazartesi GET + CRON_SECRET. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Yetkisiz.' }, { status: 401 })
  }

  if (!getTelegramConfig()) {
    return NextResponse.json(
      { ok: false, error: 'Telegram yapılandırması eksik (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).' },
      { status: 503 },
    )
  }

  const result = await runWeeklyTelegramReport()
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    period: result.period,
    orderCount: result.orderCount,
    revenueTotal: result.revenueTotal,
  })
}
