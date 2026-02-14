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
  const [codeSent, setCodeSent] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email) {
      toast.error('Informe seu email cadastrado')
      return
    }

    setLoading(true)
    setSuccessMessage('')

    try {
      const response = await axios.post('/api/auth/forgot-password', { email })
      setCodeSent(true)
      setSuccessMessage('Código enviado! Verifique seu email.')
      toast.success('Código enviado para seu email!')
      
      // Mostrar código de debug se disponível
      if (response.data.debugCode) {
        toast.success(`Código de redefinição: ${response.data.debugCode}`)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao solicitar redefinição')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!resetCode || !newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setResettingPassword(true)
    try {
      await axios.post('/api/auth/reset-password', {
        email: email,
        code: resetCode,
        newPassword: newPassword
      })
      toast.success('Senha redefinida com sucesso!')
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao redefinir senha')
    } finally {
      setResettingPassword(false)
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
          {!codeSent ? (
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
                {loading ? 'Enviando...' : 'Enviar código de redefinição'}
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleResetPassword}>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>Código de 6 dígitos</label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                  placeholder="123456"
                  maxLength={6}
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none`}
                  placeholder="Repita a nova senha"
                  minLength={6}
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={resettingPassword}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-lg font-bold hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {resettingPassword ? 'Redefinindo...' : 'Redefinir senha'}
              </button>
              
              <button
                type="button"
                onClick={() => setCodeSent(false)}
                className="w-full text-gray-600 hover:text-gray-800 text-sm py-2"
              >
                Voltar para enviar código
              </button>
            </form>
          )}
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

