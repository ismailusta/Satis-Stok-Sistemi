import { getPayload } from 'payload'

import config from '@/payload.config'
import { buildWeeklyReportData, formatWeeklyReportTelegram } from '@/lib/sales-report'
import { getTelegramConfig, sendTelegramMessage } from '@/lib/telegram'

export type WeeklyTelegramReportResult =
  | {
      ok: true
      text: string
      period: { from: string; to: string }
      orderCount: number
      revenueTotal: number
    }
  | { ok: false; error: string }

export async function runWeeklyTelegramReport(): Promise<WeeklyTelegramReportResult> {
  if (!getTelegramConfig()) {
    return {
      ok: false,
      error: 'Telegram yapılandırması eksik (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).',
    }
  }

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const data = await buildWeeklyReportData(payload)
    const text = formatWeeklyReportTelegram(data)
    const sent = await sendTelegramMessage(text)
    if (!sent.ok) {
      return { ok: false, error: sent.error }
    }

    return {
      ok: true,
      text,
      period: { from: data.from.toISOString(), to: data.to.toISOString() },
      orderCount: data.orderCount,
      revenueTotal: data.revenueTotal,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Rapor oluşturulamadı.'
    return { ok: false, error: message }
  }
}
