import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import { useTheme } from '@/contexts/ThemeContext'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function AdminMaintenance() {
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'OWNER') {
      router.push('/')
      return
    }

    if (status === 'authenticated') {
      loadMaintenanceSettings()
    }
  }, [status, session, router])

  const loadMaintenanceSettings = async () => {
    try {
      const response = await axios.get('/api/admin/maintenance')
      setIsMaintenanceMode(response.data.isMaintenanceMode || false)
      setMaintenanceMessage(response.data.message || 'O site está em manutenção. Volte em breve!')
    } catch (error: any) {
      console.error('Error loading maintenance settings:', error)
      toast.error('Erro ao carregar configurações de manutenção')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (isMaintenanceMode && !maintenanceMessage.trim()) {
      toast.error('Digite uma mensagem de manutenção')
      return
    }

    setSaving(true)
    try {
      await axios.post('/api/admin/maintenance', {
        isMaintenanceMode,
        message: maintenanceMessage.trim()
      })
      toast.success('Configurações de manutenção salvas com sucesso!')
    } catch (error: any) {
      console.error('Error saving maintenance settings:', error)
      toast.error(error.response?.data?.error || 'Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl">Carregando...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Modo de Manutenção</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Ative ou desative o modo de manutenção do site. Quando ativo, apenas o owner pode acessar o site.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="space-y-6">
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMaintenanceMode}
                  onChange={(e) => setIsMaintenanceMode(e.target.checked)}
                  className="w-6 h-6 text-primary-600 rounded focus:ring-primary-500 focus:ring-2"
                />
                <div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Ativar Modo de Manutenção
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Quando ativo, todos os usuários (exceto o owner) verão a mensagem de manutenção
                  </p>
                </div>
              </label>
            </div>

            {isMaintenanceMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mensagem de Manutenção
                </label>
                <textarea
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="Digite a mensagem que será exibida para os usuários..."
                  rows={6}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Esta mensagem será exibida para todos os usuários quando o modo de manutenção estiver ativo.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isMaintenanceMode
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } disabled:opacity-50`}
              >
                {saving ? 'Salvando...' : isMaintenanceMode ? 'Ativar Manutenção' : 'Desativar Manutenção'}
              </button>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg ${
          isMaintenanceMode
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`text-2xl ${isMaintenanceMode ? 'text-red-600' : 'text-green-600'}`}>
              {isMaintenanceMode ? '⚠️' : '✅'}
            </div>
            <div>
              <h3 className={`font-semibold mb-1 ${
                isMaintenanceMode
                  ? 'text-red-900 dark:text-red-200'
                  : 'text-green-900 dark:text-green-200'
              }`}>
                Status Atual: {isMaintenanceMode ? 'Modo de Manutenção ATIVO' : 'Site OPERACIONAL'}
              </h3>
              <p className={`text-sm ${
                isMaintenanceMode
                  ? 'text-red-800 dark:text-red-300'
                  : 'text-green-800 dark:text-green-300'
              }`}>
                {isMaintenanceMode
                  ? 'O site está em manutenção. Apenas você (owner) pode acessar.'
                  : 'O site está operacional e acessível para todos os usuários.'}
              </p>
            </div>
          </div>
        </div>

        {isMaintenanceMode && maintenanceMessage && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Preview da Mensagem:
            </h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-300 dark:border-blue-700">
              <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {maintenanceMessage}
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

