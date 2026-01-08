/**
 * 🛡️ Componente de reCAPTCHA v3
 * 
 * Este componente integra o Google reCAPTCHA v3 para proteção contra bots.
 * O reCAPTCHA v3 funciona de forma invisível, analisando o comportamento do usuário.
 */

import { useEffect, useCallback, useState } from 'react'
import Script from 'next/script'

// Tipos importados de types/grecaptcha.d.ts

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
    // Verificar se o script já está carregado
    const checkReady = () => {
      if (siteKey && window.grecaptcha) {
        window.grecaptcha.ready(() => {
          setIsReady(true)
        })
      }
    }

    // Se já estiver carregado
    if (window.grecaptcha) {
      checkReady()
    } else {
      // Aguardar o script carregar
      const interval = setInterval(() => {
        if (window.grecaptcha) {
          checkReady()
          clearInterval(interval)
        }
      }, 100)

      // Limpar após 10 segundos
      setTimeout(() => clearInterval(interval), 10000)
    }
  }, [siteKey])

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    if (!siteKey) {
      console.warn('⚠️ reCAPTCHA site key não configurada')
      return null
    }

    // Aguardar o grecaptcha estar pronto
    if (!window.grecaptcha) {
      console.warn('⚠️ reCAPTCHA não carregado, aguardando...')
      // Tentar aguardar um pouco
      await new Promise(resolve => setTimeout(resolve, 500))
      if (!window.grecaptcha) {
        console.error('❌ reCAPTCHA não carregou após aguardar')
        return null
      }
    }

    try {
      // Garantir que está pronto
      await new Promise<void>((resolve) => {
        if (window.grecaptcha) {
          window.grecaptcha.ready(() => {
            resolve()
          })
        } else {
          resolve()
        }
      })

      const token = await window.grecaptcha.execute(siteKey, { action })
      return token
    } catch (error) {
      console.error('❌ Erro ao executar reCAPTCHA:', error)
      return null
    }
  }, [siteKey])

  return {
    isReady,
    executeRecaptcha,
    isConfigured: !!siteKey
  }
}

// Componente que carrega o script do reCAPTCHA v3 (não executa automaticamente)
export default function ReCaptcha({ onVerify, action = 'submit' }: ReCaptchaProps) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  useEffect(() => {
    if (!siteKey) return

    // Função para marcar que o script está carregado
    const markAsLoaded = () => {
      // Apenas marca que está carregado, não executa
      // A execução será feita manualmente via executeRecaptcha
    }

    // Se já estiver carregado
    if (window.grecaptcha) {
      markAsLoaded()
    } else {
      // Aguardar o script carregar
      window.onRecaptchaLoad = markAsLoaded
    }

    return () => {
      if (window.onRecaptchaLoad === markAsLoaded) {
        delete window.onRecaptchaLoad
      }
    }
  }, [siteKey])

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

