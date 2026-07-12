/**
 * Obtém token reCAPTCHA v3 com retries — evita falha quando o script ainda não carregou
 * ou quando bloqueadores de anúncios atrasam o grecaptcha.
 */

const MAX_ATTEMPTS = 6
const RETRY_MS = 500

export async function fetchRecaptchaToken(
  executeRecaptcha: (action: string) => Promise<string | null>,
  action: string,
  options?: {
    isReady?: boolean
    cachedToken?: string | null
    waitForReadyMs?: number
  }
): Promise<string | null> {
  const { isReady = false, cachedToken, waitForReadyMs = 4000 } = options ?? {}

  const deadline = Date.now() + waitForReadyMs

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (!isReady && Date.now() < deadline) {
      await sleep(RETRY_MS)
      continue
    }

    const token = await executeRecaptcha(action)
    if (token) {
      return token
    }

    await sleep(RETRY_MS * (attempt + 1))
  }

  // Fallback: token pré-carregado na página (ex.: script demorou mas warm-up gerou token)
  if (cachedToken?.trim()) {
    return cachedToken
  }

  return null
}

export function recaptchaLoadErrorMessage(): string {
  return (
    'Não foi possível carregar a verificação de segurança. ' +
    'Desative bloqueadores de anúncios, tente outro navegador ou recarregue a página.'
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
