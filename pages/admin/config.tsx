import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConfigKey, setNewConfigKey] = useState('')
  const [newConfigValue, setNewConfigValue] = useState('')
  const [newConfigDescription, setNewConfigDescription] = useState('')

  const [misticClientId, setMisticClientId] = useState('')
  const [misticClientSecret, setMisticClientSecret] = useState('')
  const [misticLoading, setMisticLoading] = useState(true)
  const [misticSaving, setMisticSaving] = useState(false)
  const [misticStatus, setMisticStatus] = useState<{
    ready: boolean
    clientIdMask: string | null
    clientSecretMask: string | null
    storedInDatabase: { clientId: boolean; clientSecret: boolean }
  } | null>(null)

  useEffect(() => {
    const role = session?.user?.role
    const canAccess = role === 'ADMIN' || role === 'OWNER' || role === 'CO_OWNER'

    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated' && !canAccess) {
      router.push('/')
      return
    }

    if (status === 'authenticated' && canAccess) {
      loadConfigs()
      loadMisticPayConfig()
    }
  }, [status, session?.user?.role, router])

  const loadMisticPayConfig = async () => {
    setMisticLoading(true)
    try {
      const res = await fetch('/api/admin/config/misticpay')
      if (!res.ok) throw new Error('Falha ao carregar MisticPay')
      const data = await res.json()
      setMisticStatus({
        ready: data.ready,
        clientIdMask: data.clientIdMask,
        clientSecretMask: data.clientSecretMask,
        storedInDatabase: data.storedInDatabase
      })
    } catch (error: any) {
      console.error('Error loading MisticPay config:', error)
    } finally {
      setMisticLoading(false)
    }
  }

  const saveMisticPayConfig = async () => {
    if (!misticClientId.trim()) {
      setMessage({ type: 'error', text: 'Informe o Client ID (ci_...)' })
      return
    }
    if (!misticClientSecret.trim() && !misticStatus?.storedInDatabase.clientSecret) {
      setMessage({ type: 'error', text: 'Informe o Client Secret (cs_...)' })
      return
    }

    setMisticSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/config/misticpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: misticClientId.trim(),
          clientSecret: misticClientSecret.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')

      setMessage({ type: 'success', text: data.message || 'MisticPay configurada!' })
      setMisticClientId('')
      setMisticClientSecret('')
      await loadMisticPayConfig()
      await loadConfigs()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao salvar MisticPay' })
    } finally {
      setMisticSaving(false)
    }
  }

  const loadConfigs = async () => {
    try {
      const res = await fetch('/api/admin/config')
      if (!res.ok) throw new Error('Failed to load configs')
      const data = await res.json()
      
      // Garantir que configuraÃ§Ãµes padrÃ£o apareÃ§am na lista
      const defaultConfigs = [
        { key: 'ASAAS_API_KEY', description: 'Chave de API do Asaas (para pagamentos PIX)' },
        { key: 'ASAAS_API_URL', description: 'URL da API do Asaas' },
        { key: 'MISTICPAY_CLIENT_ID', description: 'Client ID da MisticPay (pagamentos PIX)' },
        { key: 'MISTICPAY_CLIENT_SECRET', description: 'Client Secret da MisticPay (pagamentos PIX)' }
      ]
      
      const existingKeys = data.configs.map((c: SystemConfig) => c.key)
      const missingConfigs = defaultConfigs
        .filter(dc => !existingKeys.includes(dc.key))
        .map(dc => ({
          id: '',
          key: dc.key,
          description: dc.description,
          isConfigured: false,
          valueLength: 0,
          isEncrypted: false,
          updatedBy: null,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }))
      
      setConfigs([...data.configs, ...missingConfigs].sort((a, b) => a.key.localeCompare(b.key)))
    } catch (error: any) {
      console.error('Error loading configs:', error)
      setMessage({ type: 'error', text: 'Erro ao carregar configuraÃ§Ãµes' })
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
      setMessage({ type: 'error', text: 'Valor nÃ£o pode estar vazio' })
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

      setMessage({ type: 'success', text: 'ConfiguraÃ§Ã£o atualizada com sucesso!' })
      setEditingKey(null)
      setEditValue('')
      await loadConfigs()
    } catch (error: any) {
      console.error('Error saving config:', error)
      setMessage({ type: 'error', text: error.message || 'Erro ao salvar configuraÃ§Ã£o' })
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditValue('')
    setMessage(null)
  }

  const handleAddConfig = async () => {
    if (!newConfigKey.trim() || !newConfigValue.trim()) {
      setMessage({ type: 'error', text: 'Chave e valor sÃ£o obrigatÃ³rios' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newConfigKey.trim(),
          value: newConfigValue.trim(),
          description: newConfigDescription.trim() || null
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create config')
      }

      setMessage({ type: 'success', text: 'ConfiguraÃ§Ã£o criada com sucesso!' })
      setShowAddForm(false)
      setNewConfigKey('')
      setNewConfigValue('')
      setNewConfigDescription('')
      await loadConfigs()
    } catch (error: any) {
      console.error('Error creating config:', error)
      setMessage({ type: 'error', text: error.message || 'Erro ao criar configuraÃ§Ã£o' })
    } finally {
      setSaving(false)
    }
  }

  const quickAddConfig = (key: string, description: string) => {
    setNewConfigKey(key)
    setNewConfigDescription(description)
    setShowAddForm(true)
    setMessage(null)
  }

  if (status === 'loading' || loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl">Carregando...</div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">ConfiguraÃ§Ãµes do Sistema</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gerencie as configuraÃ§Ãµes do sistema, incluindo chaves de API
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showAddForm ? 'Cancelar' : '+ Adicionar ConfiguraÃ§Ã£o'}
          </button>
        </div>

        {showAddForm && (
          <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Adicionar Nova ConfiguraÃ§Ã£o
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Chave (ex: ASAAS_API_KEY)
                </label>
                <input
                  type="text"
                  value={newConfigKey}
                  onChange={(e) => setNewConfigKey(e.target.value.toUpperCase())}
                  placeholder="ASAAS_API_KEY"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor
                </label>
                <input
                  type="password"
                  value={newConfigValue}
                  onChange={(e) => setNewConfigValue(e.target.value)}
                  placeholder="Digite o valor..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  DescriÃ§Ã£o (opcional)
                </label>
                <input
                  type="text"
                  value={newConfigDescription}
                  onChange={(e) => setNewConfigDescription(e.target.value)}
                  placeholder="DescriÃ§Ã£o da configuraÃ§Ã£o..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddConfig}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setNewConfigKey('')
                    setNewConfigValue('')
                    setNewConfigDescription('')
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
            ConfiguraÃ§Ãµes RÃ¡pidas:
          </h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => quickAddConfig('ASAAS_API_KEY', 'Chave de API do Asaas (para pagamentos PIX)')}
              className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-sm"
            >
              + ASAAS_API_KEY
            </button>
            <button
              onClick={() => quickAddConfig('ASAAS_API_URL', 'URL da API do Asaas')}
              className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-sm"
            >
              + ASAAS_API_URL
            </button>
            <button
              onClick={() => quickAddConfig('MISTICPAY_CLIENT_ID', 'Client ID da MisticPay (pagamentos PIX)')}
              className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded hover:bg-green-200 dark:hover:bg-green-800 text-sm"
            >
              + MISTICPAY_CLIENT_ID
            </button>
            <button
              onClick={() => quickAddConfig('MISTICPAY_CLIENT_SECRET', 'Client Secret da MisticPay (pagamentos PIX)')}
              className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded hover:bg-green-200 dark:hover:bg-green-800 text-sm"
            >
              + MISTICPAY_CLIENT_SECRET
            </button>
          </div>
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

        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-green-500/30">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                MisticPay — PIX
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure o Client ID e Client Secret obtidos em{' '}
                <a
                  href="https://app.misticpay.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 underline"
                >
                  app.misticpay.com
                </a>
              </p>
            </div>
            {misticLoading ? (
              <span className="px-3 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600">
                Carregando...
              </span>
            ) : (
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  misticStatus?.ready
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}
              >
                {misticStatus?.ready ? 'Pronta para PIX' : 'Não configurada'}
              </span>
            )}
          </div>

          {misticStatus?.ready && (
            <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <span className="font-medium text-gray-800 dark:text-gray-200">Client ID:</span>{' '}
                {misticStatus.clientIdMask}
                {misticStatus.storedInDatabase.clientId ? ' (salvo no painel)' : ' (variável de ambiente)'}
              </p>
              <p className="mt-1">
                <span className="font-medium text-gray-800 dark:text-gray-200">Client Secret:</span>{' '}
                {misticStatus.clientSecretMask}
                {misticStatus.storedInDatabase.clientSecret ? ' (salvo no painel)' : ' (variável de ambiente)'}
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Client ID
              </label>
              <input
                type="text"
                value={misticClientId}
                onChange={(e) => setMisticClientId(e.target.value.trim())}
                placeholder="ci_xxxxxxxx"
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Client Secret
              </label>
              <input
                type="password"
                value={misticClientSecret}
                onChange={(e) => setMisticClientSecret(e.target.value)}
                placeholder={
                  misticStatus?.storedInDatabase.clientSecret
                    ? 'Deixe vazio para manter o atual'
                    : 'cs_xxxxxxxx'
                }
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            As credenciais são salvas no banco e têm prioridade sobre o arquivo .env. Ao salvar, testamos a conexão com a API da MisticPay.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={saveMisticPayConfig}
              disabled={misticSaving || misticLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {misticSaving ? 'Salvando...' : 'Salvar credenciais MisticPay'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Chave
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    DescriÃ§Ã£o
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Atualizado por
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    AÃ§Ãµes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {configs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      Nenhuma configuraÃ§Ã£o encontrada
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
                          {config.isConfigured ? 'Configurado' : 'NÃ£o configurado'}
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
                              placeholder={config.isConfigured ? "Digite o novo valor..." : "Digite o valor..."}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveConfig(config.key)}
                                disabled={saving}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? 'Salvando...' : config.isConfigured ? 'Atualizar' : 'Criar'}
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
                            {config.isConfigured ? 'Editar' : 'Configurar'}
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
              â€¢ As configuraÃ§Ãµes sÃ£o armazenadas no banco de dados como alternativa Ã s variÃ¡veis de ambiente
            </li>
            <li>
              â€¢ O sistema tenta primeiro usar variÃ¡veis de ambiente, depois busca no banco de dados
            </li>
            <li>
              â€¢ Para ASAAS_API_KEY: Cole a chave completa do Asaas (deve comeÃ§ar com $aact_prod_ ou $aact_hmlg_)
            </li>
            <li>
              â€¢ MisticPay (PIX): use o formulário acima com Client ID (ci_...) e Client Secret (cs_...) do painel MisticPay
            </li>
            <li>
              â€¢ ApÃ³s atualizar, a configuraÃ§Ã£o serÃ¡ usada automaticamente nas prÃ³ximas requisiÃ§Ãµes
            </li>
          </ul>
        </div>
      </div>
    </>
  )
}

