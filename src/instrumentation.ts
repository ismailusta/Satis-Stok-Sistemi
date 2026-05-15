export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWeeklyReportScheduler } = await import('@/lib/weekly-report-scheduler')
    startWeeklyReportScheduler()
  }
}
