const TELEGRAM_MAX_MESSAGE = 4096

/** Virgül / noktalı virgül / boşluk ile ayrılmış chat id listesi (grup id’leri eksi sayıdır). */
export function getTelegramChatIds(): string[] {
  const raw = process.env.TELEGRAM_CHAT_ID?.trim()
  if (!raw) return []
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function getTelegramConfig(): { botToken: string; chatIds: string[] } | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatIds = getTelegramChatIds()
  if (!botToken || chatIds.length === 0) return null
  return { botToken, chatIds }
}

function splitMessage(text: string, maxLen = TELEGRAM_MAX_MESSAGE): string[] {
  if (text.length <= maxLen) return [text]
  const parts: string[] = []
  let rest = text
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('\n', maxLen)
    if (cut < maxLen * 0.5) cut = maxLen
    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
  }
  if (rest) parts.push(rest)
  return parts
}

async function sendToChat(
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const chunks = splitMessage(text)
  for (const chunk of chunks) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
    })
    const body = (await res.json()) as { ok?: boolean; description?: string }
    if (!res.ok || !body.ok) {
      return {
        ok: false,
        error: `chat ${chatId}: ${body.description ?? `HTTP ${res.status}`}`,
      }
    }
  }
  return { ok: true }
}

export async function sendTelegramMessage(
  text: string,
  config?: { botToken: string; chatIds: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = config ?? getTelegramConfig()
  if (!cfg) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID tanımlı değil.' }
  }

  for (const chatId of cfg.chatIds) {
    const result = await sendToChat(cfg.botToken, chatId, text)
    if (!result.ok) return result
  }

  return { ok: true }
}
