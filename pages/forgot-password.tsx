import { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email) {
      toast.error('Informe seu email cadastrado')
      return
    }

    setLoading(true)
    setSuccessMessage('')

    try {
      await axios.post('/api/auth/forgot-password', { email })
      setSuccessMessage('Se o email existir, enviaremos um link de redefinição. Confira sua caixa de entrada.')
      toast.success('Verifique seu email para continuar')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao solicitar redefinição')
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
            <h1 className={`text-3xl font-bold mb-2 ${themeClasses.text.primary}`}>Recuperar conta</h1>
            <p className={themeClasses.text.secondary}>
              Informe o email cadastrado. Enviaremos um link seguro para redefinir sua senha.
            </p>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>Email cadastrado</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                placeholder="seuemail@exemplo.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
          {successMessage && (
            <div className="mt-4 text-sm text-green-500 text-center">
              {successMessage}
            </div>
          )}
          <div className="mt-6 text-center space-y-2">
            <Link href="/login" className="text-sm text-primary-600 hover:text-primary-700 hover:underline">
              Voltar para login
            </Link>
            <div>
              <Link href="/" className={`text-sm ${themeClasses.text.secondary} hover:${themeClasses.text.primary} hover:underline`}>
                Voltar para a página inicial
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

