/**
 * 🛡️ Componente de reCAPTCHA v3
 * 
 * Este componente integra o Google reCAPTCHA v3 para proteção contra bots.
 * O reCAPTCHA v3 funciona de forma invisível, analisando o comportamento do usuário.
 */

import { useEffect, useCallback, useState } from 'react'
import Script from 'next/script'

// Estender Window para incluir grecaptcha
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
    onRecaptchaLoad?: () => void
  }
}

interface ReCaptchaProps {
  onVerify?: (token: string) => void
  action?: string
}

// Hook para usar reCAPTCHA
export function useReCaptcha() {
  const [isReady, setIsReady] = useState(false)
  const [siteKey, setSiteKey] = useState<string | null>(null)

  useEffect(() => {
    // Obter a site key das variáveis de ambiente públicas
    const key = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    if (key) {
      setSiteKey(key)
    }
  }, [])

  useEffect(() => {
    if (siteKey && window.grecaptcha) {
      window.grecaptcha.ready(() => {
        setIsReady(true)
      })
    }
  }, [siteKey])

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    if (!siteKey) {
      console.warn('reCAPTCHA site key não configurada')
      return null
    }

    if (!window.grecaptcha) {
      console.warn('reCAPTCHA não carregado')
      return null
    }

    try {
      return await window.grecaptcha.execute(siteKey, { action })
    } catch (error) {
      console.error('Erro ao executar reCAPTCHA:', error)
      return null
    }
  }, [siteKey])

  return {
    isReady,
    executeRecaptcha,
    isConfigured: !!siteKey
  }
}

// Componente que carrega o script do reCAPTCHA
export default function ReCaptcha({ onVerify, action = 'submit' }: ReCaptchaProps) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  useEffect(() => {
    if (!siteKey) return

    window.onRecaptchaLoad = () => {
      if (window.grecaptcha && onVerify) {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(siteKey, { action })
            onVerify(token)
          } catch (error) {
            console.error('Erro ao executar reCAPTCHA:', error)
          }
        })
      }
    }

    // Se o grecaptcha já estiver carregado
    if (window.grecaptcha) {
      window.onRecaptchaLoad()
    }

    return () => {
      delete window.onRecaptchaLoad
    }
  }, [siteKey, action, onVerify])

  if (!siteKey) {
    return null
  }

  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="afterInteractive"
      onLoad={() => {
        if (window.onRecaptchaLoad) {
          window.onRecaptchaLoad()
        }
      }}
    />
  )
}

// Componente de badge do reCAPTCHA (para exibir o texto obrigatório)
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

