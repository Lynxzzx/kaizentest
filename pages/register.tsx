import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import Link from 'next/link'
import axios from 'axios'
import { getStoredDeviceFingerprint } from '@/lib/device-fingerprint'
import toast from 'react-hot-toast'

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

  // Capturar parâmetro ref da URL
  useEffect(() => {
    if (router.query.ref && typeof router.query.ref === 'string') {
      setAffiliateRef(router.query.ref.toUpperCase())
    }
  }, [router.query.ref])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      // Obter device fingerprint para segurança
      const deviceFingerprint = getStoredDeviceFingerprint()
      
      const response = await axios.post('/api/auth/register', {
        username,
        email,
        password,
        deviceFingerprint,
        affiliateRef: affiliateRef || null // Enviar referência de afiliado se existir
      }, {
        signal: controller.signal,
        timeout: 30000
      })

      clearTimeout(timeoutId)
      
      toast.success('Conta criada com sucesso!')
      
      const loginResult = await signIn('credentials', {
        redirect: false,
        username,
        password
      })

      if (loginResult?.error) {
        toast.error('Conta criada, mas erro ao fazer login automático. Faça login manualmente.')
        router.push('/login')
      } else {
        toast.success('Login realizado com sucesso!')
        router.push('/dashboard')
      }
    } catch (error: any) {
      console.error('Register error:', error)
      
      let errorMessage = 'Erro ao criar conta'
      
      if (error.code === 'ECONNABORTED' || error.message === 'canceled') {
        errorMessage = 'Timeout: A requisição demorou muito. Verifique sua conexão com o banco de dados.'
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage, {
        duration: 8000
      })
      
      if (errorMessage.includes('conexão') || errorMessage.includes('banco de dados') || errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        toast.error('Verifique se o MongoDB está acessível e a DATABASE_URL está correta no .env', {
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
            <h2 className={`text-3xl font-bold mb-2 ${themeClasses.text.primary}`}>Criar Conta</h2>
            <p className={themeClasses.text.secondary}>Junte-se a nós e comece agora</p>
            {affiliateRef && (
              <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800 font-semibold">
                  🎁 Você ganhará 2 gerações grátis ao se cadastrar através deste link!
                </p>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                {t('username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder="Digite seu usuário"
                required
                minLength={3}
              />
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                {t('email')} <span className={`${themeClasses.text.muted} font-normal`}>(Opcional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder="Digite seu email"
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
                placeholder="Digite sua senha (mín. 6 caracteres)"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                Confirmar {t('password')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder="Confirme sua senha"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Criando conta...
                </span>
              ) : (
                'Criar Conta'
              )}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className={`text-sm ${themeClasses.text.secondary}`}>
              Já tem uma conta?{' '}
              <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
                {t('login')}
              </Link>
            </p>
          </div>
        </div>
        <div className="mt-6 text-center">
          <Link href="/" className={`text-sm ${themeClasses.text.secondary} hover:${themeClasses.text.primary} hover:underline`}>
            ← Voltar para a página inicial
          </Link>
        </div>
      </div>
    </div>
  )
}
