/**
 * 🛡️ Componente Cloudflare Turnstile - Checkbox "Não sou um robô"
 * 
 * Este componente integra o Cloudflare Turnstile como alternativa ao Google reCAPTCHA.
 * O Turnstile é mais privado e eficiente, sem rastreamento de usuários.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import Script from 'next/script'

// Tipos para Cloudflare Turnstile
declare global {
  interface Window {
    turnstile: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact'
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
      getResponse: (widgetId?: string) => string
    }
    onTurnstileLoad?: () => void
  }
}

interface TurnstileCheckboxProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact'
}

export default function TurnstileCheckbox({
  onVerify,
  onExpire,
  onError,
  theme = 'auto',
  size = 'normal'
}: TurnstileCheckboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const renderTurnstile = useCallback(() => {
    if (!containerRef.current || !window.turnstile || !siteKey) return
    
    // Limpar container
    containerRef.current.innerHTML = ''
    
    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
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
          setError('Erro ao carregar Turnstile')
          onError?.()
        },
        theme,
        size
      })
      setIsLoaded(true)
    } catch (err) {
      console.error('Erro ao renderizar Turnstile:', err)
      setError('Erro ao carregar verificação')
    }
  }, [siteKey, theme, size, onVerify, onExpire, onError])

  useEffect(() => {
    if (!siteKey) {
      setError('Turnstile não configurado')
      return
    }

    // Callback quando o script carregar
    window.onTurnstileLoad = () => {
      if (window.turnstile) {
        renderTurnstile()
      }
    }

    // Se já estiver carregado
    if (window.turnstile) {
      renderTurnstile()
    }

    return () => {
      delete window.onTurnstileLoad
      // Limpar widget ao desmontar
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch (err) {
          // Ignorar erros ao remover
        }
      }
    }
  }, [siteKey, renderTurnstile])

  // Função para resetar o captcha
  const reset = useCallback(() => {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [])

  if (!siteKey) {
    return (
      <div className="text-center py-4">
        <p className="text-yellow-600 text-sm">
          ⚠️ Turnstile não configurado. Adicione NEXT_PUBLIC_TURNSTILE_SITE_KEY no .env
        </p>
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad"
        strategy="afterInteractive"
      />
      
      <div className="flex flex-col items-center gap-2">
        <div 
          ref={containerRef} 
          className="turnstile-container"
          style={{ minHeight: size === 'compact' ? 65 : 65 }}
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

// Hook para gerenciar o estado do Turnstile
export function useTurnstile() {
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

