import { validateVisitorIp } from '@/utils/live2dCompanion'

export const VISITOR_IP_URL = 'https://api64.ipify.org?format=json'

export async function fetchVisitorIp(
  fetcher: typeof fetch = fetch,
  timeoutMs = 2500,
  ownerSignal?: AbortSignal,
): Promise<string | null> {
  const controller = new AbortController()
  const abortFromOwner = () => controller.abort()
  ownerSignal?.addEventListener('abort', abortFromOwner, { once: true })
  if (ownerSignal?.aborted)
    controller.abort()
  const timeout = setTimeout(() => controller.abort(), Math.max(0, timeoutMs))

  try {
    const response = await fetcher(VISITOR_IP_URL, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok)
      return null
    const body = await response.json() as { ip?: unknown }
    return validateVisitorIp(body.ip)
  }
  catch {
    return null
  }
  finally {
    clearTimeout(timeout)
    ownerSignal?.removeEventListener('abort', abortFromOwner)
  }
}

export function buildWelcomeMessage(ip: string | null): string {
  return ip ? `欢迎来自 ${ip} 的朋友` : '欢迎远道而来的朋友'
}
