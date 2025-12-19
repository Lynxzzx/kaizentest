/**
 * 🔐 Componente de CAPTCHA Visual
 * 
 * Exibe uma imagem com letras distorcidas que o usuário precisa digitar.
 */

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

interface VisualCaptchaProps {
  onValidated: (isValid: boolean, captchaId: string) => void
  value: string
  onChange: (value: string) => void
  captchaId: string | null
  onCaptchaIdChange: (id: string) => void
  error?: string
  theme?: 'light' | 'dark'
}

export default function VisualCaptcha({
  onValidated,
  value,
  onChange,
  captchaId,
  onCaptchaIdChange,
  error,
  theme = 'dark'
}: VisualCaptchaProps) {
  const [captchaImage, setCaptchaImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Carregar novo CAPTCHA
  const loadCaptcha = useCallback(async () => {
    setLoading(true)
    setLocalError(null)
    onChange('') // Limpar input
    
    try {
      const response = await axios.get('/api/auth/captcha')
      setCaptchaImage(response.data.image)
      onCaptchaIdChange(response.data.id)
    } catch (err: any) {
      console.error('Erro ao carregar CAPTCHA:', err)
      setLocalError('Erro ao carregar CAPTCHA')
    } finally {
      setLoading(false)
    }
  }, [onChange, onCaptchaIdChange])

  // Carregar CAPTCHA inicial
  useEffect(() => {
    if (!captchaId) {
      loadCaptcha()
    }
  }, [])

  // Classes baseadas no tema
  const inputClasses = theme === 'dark' 
    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-primary-500'

  const containerClasses = theme === 'dark'
    ? 'bg-gray-800 border-gray-700'
    : 'bg-gray-50 border-gray-200'

  const textClasses = theme === 'dark'
    ? 'text-gray-300'
    : 'text-gray-600'

  return (
    <div className={`rounded-lg border p-4 ${containerClasses}`}>
      <div className="flex flex-col gap-3">
        {/* Label */}
        <div className="flex items-center justify-between">
          <label className={`text-sm font-semibold ${textClasses}`}>
            🔐 Verificação de Segurança
          </label>
          <button
            type="button"
            onClick={loadCaptcha}
            disabled={loading}
            className="text-primary-500 hover:text-primary-600 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
          >
            <svg 
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            Atualizar
          </button>
        </div>

        {/* Imagem do CAPTCHA */}
        <div className="flex items-center justify-center">
          {loading ? (
            <div className="w-[200px] h-[60px] flex items-center justify-center bg-gray-200 rounded">
              <svg className="animate-spin h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : captchaImage ? (
            <img 
              src={captchaImage} 
              alt="CAPTCHA" 
              className="rounded shadow-md select-none"
              style={{ width: 200, height: 60 }}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <div className="w-[200px] h-[60px] flex items-center justify-center bg-gray-200 rounded text-gray-500 text-sm">
              Carregando...
            </div>
          )}
        </div>

        {/* Input */}
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              // Aceitar apenas letras e números, converter para maiúsculo
              const newValue = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
              onChange(newValue)
            }}
            placeholder="Digite as letras acima"
            className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-center text-lg tracking-widest font-mono ${inputClasses}`}
            maxLength={6}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Erro */}
        {(error || localError) && (
          <p className="text-red-500 text-sm text-center">
            {error || localError}
          </p>
        )}

        {/* Dica */}
        <p className={`text-xs text-center ${textClasses} opacity-70`}>
          Digite os caracteres que aparecem na imagem (não diferencia maiúsculas)
        </p>
      </div>
    </div>
  )
}

// Hook para gerenciar estado do CAPTCHA
export function useCaptcha() {
  const [captchaId, setCaptchaId] = useState<string | null>(null)
  const [captchaValue, setCaptchaValue] = useState('')
  const [captchaError, setCaptchaError] = useState<string | null>(null)

  const validateCaptcha = async (): Promise<boolean> => {
    if (!captchaId || !captchaValue) {
      setCaptchaError('Por favor, digite o código da imagem')
      return false
    }

    try {
      const response = await axios.post('/api/auth/captcha', {
        id: captchaId,
        code: captchaValue
      })

      if (response.data.valid) {
        setCaptchaError(null)
        return true
      } else {
        setCaptchaError(response.data.error || 'CAPTCHA incorreto')
        return false
      }
    } catch (error: any) {
      setCaptchaError(error.response?.data?.error || 'Erro ao validar CAPTCHA')
      return false
    }
  }

  const resetCaptcha = () => {
    setCaptchaId(null)
    setCaptchaValue('')
    setCaptchaError(null)
  }

  return {
    captchaId,
    setCaptchaId,
    captchaValue,
    setCaptchaValue,
    captchaError,
    setCaptchaError,
    validateCaptcha,
    resetCaptcha
  }
}

