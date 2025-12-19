/**
 * 🤖 Componente reCAPTCHA v2 - Checkbox "Não sou um robô"
 * 
 * Este componente integra o Google reCAPTCHA v2 com o famoso checkbox.
 * O usuário precisa clicar na caixinha e às vezes resolver desafios de imagem.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import Script from 'next/script'

// Tipos importados de types/grecaptcha.d.ts

interface ReCaptchaCheckboxProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  theme?: 'light' | 'dark'
  size?: 'normal' | 'compact'
}

export default function ReCaptchaCheckbox({
  onVerify,
  onExpire,
  onError,
  theme = 'light',
  size = 'normal'
}: ReCaptchaCheckboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<number | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY

  const renderCaptcha = useCallback(() => {
    if (!containerRef.current || !window.grecaptcha || !siteKey) return
    
    // Limpar container
    containerRef.current.innerHTML = ''
    
    try {
      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          setError(null)
          onVerify(token)
        },
        'expired-callback': () => {
          setError(null)
          onExpire?.()
        },
        'error-callback': () => {
          setError('Erro ao carregar reCAPTCHA')
          onError?.()
        },
        theme,
        size
      })
      setIsLoaded(true)
    } catch (err) {
      console.error('Erro ao renderizar reCAPTCHA:', err)
      setError('Erro ao carregar verificação')
    }
  }, [siteKey, theme, size, onVerify, onExpire, onError])

  useEffect(() => {
    if (!siteKey) {
      setError('reCAPTCHA não configurado')
      return
    }

    // Callback quando o script carregar
    window.onRecaptchaV2Load = () => {
      if (window.grecaptcha) {
        window.grecaptcha.ready(renderCaptcha)
      }
    }

    // Se já estiver carregado
    if (window.grecaptcha) {
      window.grecaptcha.ready(renderCaptcha)
    }

    return () => {
      delete window.onRecaptchaV2Load
    }
  }, [siteKey, renderCaptcha])

  // Função para resetar o captcha
  const reset = useCallback(() => {
    if (window.grecaptcha && widgetIdRef.current !== null) {
      window.grecaptcha.reset(widgetIdRef.current)
    }
  }, [])

  if (!siteKey) {
    return (
      <div className="text-center py-4">
        <p className="text-yellow-600 text-sm">
          ⚠️ reCAPTCHA v2 não configurado. Adicione NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY no .env
        </p>
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js?onload=onRecaptchaV2Load&render=explicit"
        strategy="afterInteractive"
      />
      
      <div className="flex flex-col items-center gap-2">
        <div 
          ref={containerRef} 
          className="recaptcha-container"
          style={{ minHeight: size === 'compact' ? 78 : 78 }}
        />
        
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        
        {!isLoaded && !error && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Carregando verificação...
          </div>
        )}
      </div>
    </>
  )
}

// Hook para gerenciar o estado do reCAPTCHA v2
export function useReCaptchaV2() {
  const [token, setToken] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const handleVerify = useCallback((newToken: string) => {
    setToken(newToken)
    setIsVerified(true)
    setIsExpired(false)
  }, [])

  const handleExpire = useCallback(() => {
    setToken(null)
    setIsVerified(false)
    setIsExpired(true)
  }, [])

  const handleError = useCallback(() => {
    setToken(null)
    setIsVerified(false)
  }, [])

  const reset = useCallback(() => {
    setToken(null)
    setIsVerified(false)
    setIsExpired(false)
  }, [])

  return {
    token,
    isVerified,
    isExpired,
    handleVerify,
    handleExpire,
    handleError,
    reset
  }
}

