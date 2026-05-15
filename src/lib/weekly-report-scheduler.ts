import { Cron } from 'croner'

import { getTelegramConfig } from '@/lib/telegram'
import { runWeeklyTelegramReport } from '@/lib/run-weekly-telegram-report'

const globalForCron = globalThis as typeof globalThis & {
  __weeklyReportCron?: Cron
}

function isSchedulerEnabled(): boolean {
  const flag = process.env.TELEGRAM_WEEKLY_CRON_ENABLED?.trim().toLowerCase()
  if (flag === 'false' || flag === '0' || flag === 'no') return false
  return Boolean(getTelegramConfig())
}

/** Varsayılan: her Pazartesi 09:00 (Europe/Istanbul). */
export function startWeeklyReportScheduler(): void {
  if (process.env.NEXT_RUNTIME === 'edge') return
  if (!isSchedulerEnabled()) return
  if (globalForCron.__weeklyReportCron) return

  const pattern = process.env.TELEGRAM_WEEKLY_CRON?.trim() || '0 9 * * 1'
  const timezone = process.env.TELEGRAM_WEEKLY_CRON_TIMEZONE?.trim() || 'Europe/Istanbul'

  let running = false

  globalForCron.__weeklyReportCron = new Cron(
    pattern,
    { timezone, protect: true },
    async () => {
      if (running) return
      running = true
      try {
        const result = await runWeeklyTelegramReport()
        if (result.ok) {
          console.info(
            `[weekly-report] Telegram gönderildi (${result.period.from.slice(0, 10)} – ${result.period.to.slice(0, 10)})`,
          )
        } else {
          console.error('[weekly-report]', result.error)
        }
      } finally {
        running = false
      }
    },
  )

  console.info(
    `[weekly-report] Zamanlayıcı aktif: "${pattern}" (${timezone}). Sunucu açıkken otomatik gönderilir.`,
  )
}
