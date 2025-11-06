import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'

interface SystemConfig {
  id: string
  key: string
  description: string | null
  isConfigured: boolean
  valueLength: number
  isEncrypted: boolean
  updatedBy: {
    id: string
    username: string
    email: string | null
  } | null
  updatedAt: string
  createdAt: string
}

export default function AdminConfig() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'ADMIN' && session?.user?.role !== 'OWNER') {
      router.push('/')
      return
    }

    if (status === 'authenticated') {
      loadConfigs()
    }
  }, [status, session, router])

  const loadConfigs = async () => {
    try {
      const res = await fetch('/api/admin/config')
      if (!res.ok) throw new Error('Failed to load configs')
      const data = await res.json()
      setConfigs(data.configs)
    } catch (error: any) {
      console.error('Error loading configs:', error)
      setMessage({ type: 'error', text: 'Erro ao carregar configurações' })
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (config: SystemConfig) => {
    setEditingKey(config.key)
    setEditValue('')
    setMessage(null)
  }

  const saveConfig = async (key: string) => {
    if (!editValue.trim()) {
      setMessage({ type: 'error', text: 'Valor não pode estar vazio' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: editValue,
          description: configs.find(c => c.key === key)?.description || null
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update config')
      }

      setMessage({ type: 'success', text: 'Configuração atualizada com sucesso!' })
      setEditingKey(null)
      setEditValue('')
      await loadConfigs()
    } catch (error: any) {
      console.error('Error saving config:', error)
      setMessage({ type: 'error', text: error.message || 'Erro ao salvar configuração' })
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditValue('')
    setMessage(null)
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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Configurações do Sistema</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie as configurações do sistema, incluindo chaves de API
          </p>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Chave
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Atualizado por
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {configs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      Nenhuma configuração encontrada
                    </td>
                  </tr>
                ) : (
                  configs.map((config) => (
                    <tr key={config.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {config.key}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {config.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            config.isConfigured
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {config.isConfigured ? 'Configurado' : 'Não configurado'}
                        </span>
                        {config.isConfigured && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {config.valueLength} caracteres
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {config.updatedBy?.username || '-'}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(config.updatedAt).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingKey === config.key ? (
                          <div className="space-y-2">
                            <input
                              type="password"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder="Digite o novo valor..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveConfig(config.key)}
                                disabled={saving}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Salvando...' : 'Salvar'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(config)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Como funciona:
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>
              • As configurações são armazenadas no banco de dados como alternativa às variáveis de ambiente
            </li>
            <li>
              • O sistema tenta primeiro usar variáveis de ambiente, depois busca no banco de dados
            </li>
            <li>
              • Para ASAAS_API_KEY: Cole a chave completa do Asaas (deve começar com $aact_prod_ ou $aact_hmlg_)
            </li>
            <li>
              • Após atualizar, a configuração será usada automaticamente nas próximas requisições
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

