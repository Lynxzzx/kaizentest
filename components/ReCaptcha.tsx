/**
 * 🛡️ Componente de reCAPTCHA v3
 *
 * Carrega o script do Google. Use o hook useReCaptcha() na página para executar o token.
 */

import { useEffect, useCallback, useState, useRef } from 'react'
import Script from 'next/script'

interface ReCaptchaProps {
  action?: string
}

const SCRIPT_LOAD_TIMEOUT_MS = 10000

export function useReCaptcha() {
  const [isReady, setIsReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null
  const readyRef = useRef(false)

  const markReady = useCallback(() => {
    if (!siteKey || !window.grecaptcha || readyRef.current) return
    window.grecaptcha.ready(() => {
      readyRef.current = true
      setIsReady(true)
      setLoadFailed(false)
    })
  }, [siteKey])

  useEffect(() => {
    if (!siteKey) return

    readyRef.current = false
    setIsReady(false)
    setLoadFailed(false)

    if (window.grecaptcha) {
      markReady()
      return
    }

    const interval = setInterval(() => {
      if (window.grecaptcha) {
        markReady()
        clearInterval(interval)
      } else if ((window as any).reCaptchaError) {
        setLoadFailed(true)
        clearInterval(interval)
      }
    }, 100)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      if (!readyRef.current) {
        setLoadFailed(true)
        console.error('❌ reCAPTCHA: script não carregou a tempo')
      }
    }, SCRIPT_LOAD_TIMEOUT_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [siteKey, markReady])

  const executeRecaptcha = useCallback(
    async (action: string): Promise<string | null> => {
      if (!siteKey) {
        console.warn('⚠️ reCAPTCHA site key não configurada')
        return null
      }

      if (!window.grecaptcha) {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 400))
          if (window.grecaptcha) break
        }
        if (!window.grecaptcha) {
          console.error('❌ reCAPTCHA não carregou após aguardar')
          return null
        }
      }

      try {
        await new Promise<void>((resolve) => {
          window.grecaptcha!.ready(() => resolve())
        })

        const token = await window.grecaptcha!.execute(siteKey, { action })
        return token || null
      } catch (error) {
        console.error('❌ Erro ao executar reCAPTCHA:', error)
        return null
      }
    },
    [siteKey]
  )

  return {
    isReady,
    loadFailed,
    executeRecaptcha,
    isConfigured: !!siteKey,
  }
}

/** Apenas carrega o script — o hook useReCaptcha fica na página pai */
export default function ReCaptcha(_props: ReCaptchaProps) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  useEffect(() => {
    window.onRecaptchaLoad = () => {
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {})
      }
    }
    return () => {
      delete window.onRecaptchaLoad
    }
  }, [])

  if (!siteKey) {
    return null
  }

  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="afterInteractive"
      onLoad={() => {
        if (window.grecaptcha) {
          window.grecaptcha.ready(() => {
            window.onRecaptchaLoad?.()
          })
        } else {
          window.onRecaptchaLoad?.()
        }
      }}
      onError={() => {
        console.error('❌ Falha ao carregar script reCAPTCHA (rede, CSP ou bloqueador)')
        if (typeof window !== 'undefined') (window as any).reCaptchaError = true;
      }}
    />
  )
}

export function ReCaptchaBadge() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  if (!siteKey) {
    return null
  }

  return (
    <div className="text-xs text-gray-500 text-center mt-4">
      Este site é protegido pelo reCAPTCHA e a{' '}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-600 hover:underline"
      >
        Política de Privacidade
      </a>{' '}
      e os{' '}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-600 hover:underline"
      >
        Termos de Serviço
      </a>{' '}
      do Google se aplicam.
    </div>
  )
}
