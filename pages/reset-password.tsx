import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import { useTranslation } from '@/lib/i18n-helper'

export default function ResetPassword() {
  const router = useRouter()
  const { token } = router.query
  const { theme } = useTheme()
  const { t } = useTranslation()
  const themeClasses = getThemeClasses(theme)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenReady, setTokenReady] = useState(false)

  useEffect(() => {
    if (router.isReady) {
      setTokenReady(true)
    }
  }, [router.isReady])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!token || typeof token !== 'string') {
      toast.error('Token inválido. Solicite uma nova recuperação.')
      return
    }

    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não conferem')
      return
    }

    setLoading(true)
    try {
      await axios.post('/api/auth/reset-password', {
        token,
        password
      })
      toast.success('Senha redefinida com sucesso. Faça login novamente.')
      router.push('/login')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao redefinir senha')
    } finally {
      setLoading(false)
    }
  }

  if (!tokenReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Carregando...</div>
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${themeClasses.bg} py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-md w-full">
        <div className={`${themeClasses.card} rounded-2xl shadow-2xl p-8`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl mb-4">
              <span className="text-white font-bold text-2xl">K</span>
            </div>
            <h1 className={`text-3xl font-bold mb-2 ${themeClasses.text.primary}`}>Definir nova senha</h1>
            <p className={themeClasses.text.secondary}>
              Crie uma nova senha forte para proteger sua conta.
            </p>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>{t('password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder="Nova senha"
                required
              />
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>{t('confirmPassword') || 'Confirmar senha'}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder="Repita a nova senha"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Salvando...' : 'Atualizar senha'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-primary-600 hover:text-primary-700 hover:underline">
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

