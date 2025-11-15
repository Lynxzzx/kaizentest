import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function Settings() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()
  const { theme, setTheme, isLoading } = useTheme()
  const [saving, setSaving] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const handleThemeChange = async (newTheme: 'dark' | 'light' | 'default') => {
    setSaving(true)
    try {
      setTheme(newTheme)
      toast.success('Tema atualizado com sucesso!')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar tema')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault()
    if (passwordData.newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres')
      return
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('As senhas não conferem')
      return
    }

    setPasswordLoading(true)
    try {
      await axios.put('/api/users/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
      toast.success('Senha alterada com sucesso!')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao alterar senha')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <p className="mt-4 text-white">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
              Configurações
            </span>
          </h1>
          <p className="text-gray-300 text-lg">Personalize sua experiência</p>
        </div>

        {/* Theme Selection */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border border-white/20 shadow-2xl mb-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span>🎨</span>
            <span>Aparência</span>
          </h2>
          
          <div className="space-y-4">
            <p className="text-gray-300 mb-6">Escolha o tema que melhor se adapta ao seu estilo:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Dark Theme */}
              <button
                onClick={() => handleThemeChange('dark')}
                disabled={saving || theme === 'dark'}
                className={`relative p-6 rounded-xl border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/50'
                    : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                }`}
              >
                <div className="absolute top-2 right-2">
                  {theme === 'dark' && <span className="text-2xl">✓</span>}
                </div>
                <div className="mb-4">
                  <div className="w-full h-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg border border-white/20"></div>
                </div>
                <h3 className="font-bold text-lg mb-2">Dark</h3>
                <p className="text-sm text-gray-300">Tema escuro moderno e tecnológico</p>
              </button>

              {/* Light Theme */}
              <button
                onClick={() => handleThemeChange('light')}
                disabled={saving || theme === 'light'}
                className={`relative p-6 rounded-xl border-2 transition-all ${
                  theme === 'light'
                    ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/50'
                    : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                }`}
              >
                <div className="absolute top-2 right-2">
                  {theme === 'light' && <span className="text-2xl">✓</span>}
                </div>
                <div className="mb-4">
                  <div className="w-full h-20 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 rounded-lg border border-gray-200"></div>
                </div>
                <h3 className="font-bold text-lg mb-2">Light</h3>
                <p className="text-sm text-gray-300">Tema claro e limpo</p>
              </button>

              {/* Default Theme */}
              <button
                onClick={() => handleThemeChange('default')}
                disabled={saving || theme === 'default'}
                className={`relative p-6 rounded-xl border-2 transition-all ${
                  theme === 'default'
                    ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/50'
                    : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                }`}
              >
                <div className="absolute top-2 right-2">
                  {theme === 'default' && <span className="text-2xl">✓</span>}
                </div>
                <div className="mb-4">
                  <div className="w-full h-20 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-lg border border-gray-200"></div>
                </div>
                <h3 className="font-bold text-lg mb-2">Padrão</h3>
                <p className="text-sm text-gray-300">Tema padrão do sistema</p>
              </button>
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border border-white/20 shadow-2xl mb-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span>🔒</span>
            <span>Segurança</span>
          </h2>
          <p className="text-gray-300 mb-6">Atualize sua senha regularmente para manter a conta protegida.</p>
          <form className="space-y-4" onSubmit={handlePasswordChange}>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Senha atual</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Nova senha</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">Confirmar nova senha</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 py-3 rounded-lg font-bold hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 transition disabled:opacity-60"
            >
              {passwordLoading ? 'Salvando...' : 'Atualizar senha'}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="bg-blue-500/20 backdrop-blur-lg rounded-xl p-4 border border-blue-400/30">
          <p className="text-sm text-blue-200">
            <strong>💡 Dica:</strong> Sua preferência de tema é salva automaticamente e será aplicada em todas as páginas do site.
          </p>
        </div>
      </div>
    </div>
  )
}

