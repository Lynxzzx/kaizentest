import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import Link from 'next/link'
import toast from 'react-hot-toast'
import axios from 'axios'
import ReCaptcha, { useReCaptcha, ReCaptchaBadge } from '@/components/ReCaptcha'

export default function Login() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const themeClasses = getThemeClasses(theme)

  // 🛡️ SEGURANÇA: Estado para proteções anti-bot
  const [honeypot, setHoneypot] = useState('') // Campo invisível
  const formStartTimeRef = useRef<number>(Date.now()) // Tempo de início
  const [loginAttempts, setLoginAttempts] = useState(0)

  // 🛡️ Google reCAPTCHA v3 (invisível)
  const { isReady: recaptchaReady, executeRecaptcha, isConfigured: recaptchaConfigured } = useReCaptcha()
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

  // Resetar tempo quando o componente monta
  useEffect(() => {
    formStartTimeRef.current = Date.now()
  }, [])

  // Mostrar aviso se muitas tentativas
  useEffect(() => {
    if (loginAttempts >= 3) {
      toast.error('Muitas tentativas. Por favor, verifique suas credenciais.', {
        duration: 5000
      })
    }
  }, [loginAttempts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 🛡️ SEGURANÇA: Verificar honeypot (deve estar vazio)
    if (honeypot) {
      console.log('🚫 Honeypot triggered')
      toast.error('Verificação de segurança falhou.')
      return
    }

    if (!username.trim()) {
      toast.error('Digite seu username')
      return
    }

    if (!password) {
      toast.error('Digite sua senha')
      return
    }

    setLoading(true)

    try {
      if (!recaptchaConfigured) {
        toast.error('Verificação de segurança não configurada. Entre em contato com o suporte.')
        setLoading(false)
        return
      }
      let token = await executeRecaptcha('login')
      if (!token && !recaptchaReady) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        token = await executeRecaptcha('login')
      }
      if (!token) {
        toast.error('Erro ao verificar segurança. Por favor, recarregue a página e tente novamente.')
        setLoading(false)
        return
      }
      setRecaptchaToken(token)

      // 🛡️ SEGURANÇA: Validar requisição antes de autenticar
      try {
        const validateResponse = await axios.post('/api/auth/validate-login', {
          username: username.trim(),
          recaptchaToken: token,
          honeypot,
          formStartTime: formStartTimeRef.current
        })

        if (!validateResponse.data.allowed && validateResponse.status !== 200) {
          toast.error(validateResponse.data.error || 'Verificação de segurança falhou.')
          setRecaptchaToken(null)
          return
        }
      } catch (validateError: any) {
        if (validateError.response?.status === 403) {
          // Bloqueado por segurança
          toast.error(validateError.response.data.error || 'Acesso temporariamente bloqueado.')
          setRecaptchaToken(null)
          return
        }
        // Se a validação falhar por outro motivo, continuar com o login
        console.warn('Validação de segurança falhou, continuando...', validateError)
      }

      // Tentar fazer login
      const result = await signIn('credentials', {
        redirect: false,
        username: username.trim(),
        password
      })

      if (result?.error) {
        setLoginAttempts(prev => prev + 1)
        toast.error(t('invalidCredentials'))
        // Resetar reCAPTCHA após erro
        setRecaptchaToken(null)
      } else {
        // Login bem-sucedido - resetar tentativas no servidor
        try {
          await axios.post('/api/auth/validate-login', {
            username: username.trim(),
            resetAttempts: true
          })
        } catch (e) {
          // Ignorar erros ao resetar
        }

        toast.success(t('loginSuccess'))
        router.push('/dashboard')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      setLoginAttempts(prev => prev + 1)
      setRecaptchaToken(null)
      
      let errorMessage = t('errorLoggingIn')
      
      if (error.response?.data?.securityBlock) {
        errorMessage = error.response.data.error
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
      
      if (errorMessage.includes('conexão') || errorMessage.includes('banco de dados')) {
        toast.error(t('configureMongoDB'), {
          duration: 6000
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${themeClasses.bg} py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-md w-full">
        <div className={`${themeClasses.card} rounded-2xl shadow-2xl p-8`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl mb-4">
              <span className="text-white font-bold text-2xl">K</span>
            </div>
            <h2 className={`text-3xl font-bold mb-2 ${themeClasses.text.primary}`}>{t('login')}</h2>
            <p className={themeClasses.text.secondary}>{t('enterYourAccount')}</p>
          </div>

          {/* 🛡️ Aviso de tentativas excessivas */}
          {loginAttempts >= 3 && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-yellow-800">
                  Várias tentativas detectadas. Verifique suas credenciais ou{' '}
                  <Link href="/forgot-password" className="font-semibold underline">
                    redefina sua senha
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 🛡️ HONEYPOT - Campo invisível para bots */}
            <div 
              style={{ 
                position: 'absolute', 
                left: '-9999px', 
                opacity: 0, 
                height: 0, 
                overflow: 'hidden',
                pointerEvents: 'none'
              }}
              aria-hidden="true"
            >
              <label htmlFor="company">Company</label>
              <input
                type="text"
                id="company"
                name="company"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                {t('username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder={t('enterUsername')}
                required
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                {t('password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder={t('enterPassword')}
                required
                autoComplete="current-password"
              />
            </div>

            {/* 🛡️ Google reCAPTCHA v3 (invisível) */}
            <ReCaptcha onVerify={(token) => setRecaptchaToken(token)} action="login" />

            {/* 🛡️ Badge do reCAPTCHA */}
            <ReCaptchaBadge />

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline">
                Esqueceu sua senha?
              </Link>
            </div>

            {/* 🛡️ Indicador de segurança */}
            <div className={`flex items-center justify-center gap-2 text-xs ${themeClasses.text.muted}`}>
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Conexão segura e protegida</span>
            </div>

            <button
              type="submit"
              disabled={loading || !recaptchaConfigured}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('loggingIn')}
                </span>
              ) : (
                t('login')
              )}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className={`text-sm ${themeClasses.text.secondary}`}>
              {t('dontHaveAccount')}{' '}
              <Link href="/register" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
                {t('createAccount')}
              </Link>
            </p>
          </div>
        </div>
        <div className="mt-6 text-center">
          <Link href="/" className={`text-sm ${themeClasses.text.secondary} hover:${themeClasses.text.primary} hover:underline`}>
            {t('backToHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
