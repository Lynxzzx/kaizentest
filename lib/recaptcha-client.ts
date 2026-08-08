/**
 * Obtém token reCAPTCHA v3 com retries — evita falha quando o script ainda não carregou
 * ou quando bloqueadores de anúncios atrasam o grecaptcha.
 */

const MAX_ATTEMPTS = 6
const RETRY_MS = 500
/** Tokens do Google expiram em ~120s — não reutilizar após isso */
const MAX_CACHED_TOKEN_AGE_MS = 90_000

export async function fetchRecaptchaToken(
  executeRecaptcha: (action: string) => Promise<string | null>,
  action: string,
  options?: {
    isReady?: boolean
    cachedToken?: string | null
    cachedTokenAt?: number | null
    waitForReadyMs?: number
  }
): Promise<string | null> {
  const {
    isReady = false,
    cachedToken,
    cachedTokenAt,
    waitForReadyMs = 8000,
  } = options ?? {}

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

  // Fallback: token pré-carregado só se ainda estiver fresco
  const tokenAge =
    typeof cachedTokenAt === 'number' ? Date.now() - cachedTokenAt : Number.POSITIVE_INFINITY
  if (cachedToken?.trim() && tokenAge < MAX_CACHED_TOKEN_AGE_MS) {
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
