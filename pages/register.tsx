import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import Link from 'next/link'
import axios from 'axios'
import { getStoredDeviceFingerprint } from '@/lib/device-fingerprint'
import toast from 'react-hot-toast'
import ReCaptcha, { useReCaptcha, ReCaptchaBadge } from '@/components/ReCaptcha'

export default function Register() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [affiliateRef, setAffiliateRef] = useState<string | null>(null)
  const themeClasses = getThemeClasses(theme)

  // 🛡️ SEGURANÇA: Estado para proteções anti-bot
  const [honeypot, setHoneypot] = useState('') // Campo invisível
  const formStartTimeRef = useRef<number>(Date.now()) // Tempo de início

  // 🛡️ Google reCAPTCHA v3 (invisível)
  const { isReady: recaptchaReady, executeRecaptcha, isConfigured: recaptchaConfigured } = useReCaptcha()
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

  // Capturar parâmetro ref da URL
  useEffect(() => {
    if (router.query.ref && typeof router.query.ref === 'string') {
      setAffiliateRef(router.query.ref.toUpperCase())
    }
  }, [router.query.ref])

  // Resetar tempo quando o componente monta
  useEffect(() => {
    formStartTimeRef.current = Date.now()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 🛡️ SEGURANÇA: Verificar honeypot (deve estar vazio)
    if (honeypot) {
      console.log('🚫 Honeypot triggered')
      toast.error('Verificação de segurança falhou. Por favor, tente novamente.')
      return
    }

    if (password !== confirmPassword) {
      toast.error(t('passwordsDontMatch'))
      return
    }

    if (password.length < 6) {
      toast.error(t('passwordMinLength'))
      return
    }

    // Validar username
    if (username.length < 3) {
      toast.error('Username deve ter pelo menos 3 caracteres')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error('Username só pode conter letras, números e underscore')
      return
    }

    // Validar email (agora obrigatório)
    if (!email || !email.trim()) {
      toast.error('Email é obrigatório')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email inválido')
      return
    }

    setLoading(true)

    try {
      // 🛡️ Executar reCAPTCHA v3
      if (!recaptchaConfigured) {
        toast.error('Verificação de segurança não configurada. Entre em contato com o suporte.')
        setLoading(false)
        return
      }

      // Executar reCAPTCHA v3 - aguardar se necessário
      let token = await executeRecaptcha('register')
      
      // Se não obteve token e não está pronto, aguardar um pouco
      if (!token && !recaptchaReady) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        token = await executeRecaptcha('register')
      }

      if (!token) {
        toast.error('Erro ao verificar segurança. Por favor, recarregue a página e tente novamente.')
        setLoading(false)
        return
      }
      setRecaptchaToken(token)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      // Obter device fingerprint para segurança
      const deviceFingerprint = getStoredDeviceFingerprint()
      
      const response = await axios.post('/api/auth/register', {
        username,
        email,
        password,
        deviceFingerprint,
        affiliateRef: affiliateRef || null,
        // 🛡️ Dados de segurança
        recaptchaToken: token,
        honeypot,
        formStartTime: formStartTimeRef.current
      }, {
        signal: controller.signal,
        timeout: 30000
      })

      clearTimeout(timeoutId)
      
      toast.success(t('accountCreatedSuccess'))
      
      const loginResult = await signIn('credentials', {
        redirect: false,
        username,
        password
      })

      if (loginResult?.error) {
        toast.error(t('accountCreatedButLoginError'))
        router.push('/login')
      } else {
        toast.success(t('loginSuccess'))
        router.push('/dashboard')
      }
    } catch (error: any) {
      console.error('Register error:', error)
      setRecaptchaToken(null)
      
      let errorMessage = t('errorCreatingAccount')
      
      if (error.code === 'ECONNABORTED' || error.message === 'canceled') {
        errorMessage = 'Timeout: A requisição demorou muito. Verifique sua conexão com o banco de dados.'
      } else if (error.response?.data?.securityBlock) {
        // Erro de segurança - mostrar mensagem específica
        errorMessage = error.response.data.error
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage, {
        duration: 8000
      })
      
      if (errorMessage.includes('conexão') || errorMessage.includes('banco de dados') || errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        toast.error(t('checkMongoDB'), {
          duration: 8000
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
            <h2 className={`text-3xl font-bold mb-2 ${themeClasses.text.primary}`}>{t('createAccount')}</h2>
            <p className={themeClasses.text.secondary}>{t('joinUs')}</p>
            {affiliateRef && (
              <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800 font-semibold">
                  {t('youWillGet2FreeGenerations')}
                </p>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
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
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder={t('enterUsername')}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                autoComplete="username"
              />
              <p className={`text-xs mt-1 ${themeClasses.text.muted}`}>
                Apenas letras, números e underscore
              </p>
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                {t('email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder={t('enterEmail')}
                required
                autoComplete="email"
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
                minLength={6}
                maxLength={100}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                {t('confirmPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder={t('enterConfirmPassword')}
                required
                minLength={6}
                maxLength={100}
                autoComplete="new-password"
              />
            </div>

            {/* 🛡️ Google reCAPTCHA v3 (invisível) */}
            <ReCaptcha onVerify={(token) => setRecaptchaToken(token)} action="register" />

            {/* 🛡️ Badge do reCAPTCHA */}
            <ReCaptchaBadge />

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
                  {t('creating')}
                </span>
              ) : (
                t('createAccount')
              )}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className={`text-sm ${themeClasses.text.secondary}`}>
              {t('alreadyHaveAccount')}{' '}
              <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
                {t('login')}
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
