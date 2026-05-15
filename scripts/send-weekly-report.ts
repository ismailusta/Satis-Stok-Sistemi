/**
 * Manuel haftalık Telegram raporu.
 * Kullanım: npm run report:telegram
 */
import 'dotenv/config'

import { runWeeklyTelegramReport } from '../src/lib/run-weekly-telegram-report'

async function main() {
  const result = await runWeeklyTelegramReport()
  if (!result.ok) {
    console.error('Hata:', result.error)
    process.exit(1)
  }

  console.log('--- Rapor önizleme ---\n')
  console.log(result.text)
  console.log('\n--- Telegram gönderildi ---')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
