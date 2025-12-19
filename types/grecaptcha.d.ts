/**
 * Tipos para Google reCAPTCHA (v2 e v3)
 */

declare global {
  interface Window {
    grecaptcha: {
      // Comum a v2 e v3
      ready: (callback: () => void) => void
      
      // reCAPTCHA v3 (invisível)
      execute: (siteKey: string, options: { action: string }) => Promise<string>
      
      // reCAPTCHA v2 (checkbox)
      render: (container: string | HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
        'error-callback'?: () => void
        theme?: 'light' | 'dark'
        size?: 'normal' | 'compact'
      }) => number
      reset: (widgetId?: number) => void
      getResponse: (widgetId?: number) => string
    }
    onRecaptchaLoad?: () => void
    onRecaptchaV2Load?: () => void
  }
}

export {}

