import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import axios from 'axios'
import toast from 'react-hot-toast'

interface Stock {
  id: string
  serviceId: string
  username: string
  password: string
  email: string | null
  isUsed: boolean
  createdAt: string
  service: {
    id: string
    name: string
  }
}

interface Service {
  id: string
  name: string
}

export default function AdminStocks() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [stocks, setStocks] = useState<Stock[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [showBulkDeleteForm, setShowBulkDeleteForm] = useState(false)
  const [editingStock, setEditingStock] = useState<Stock | null>(null)
  const [formData, setFormData] = useState({
    serviceId: '',
    username: '',
    password: '',
    email: ''
  })
  const [bulkData, setBulkData] = useState({
    serviceId: '',
    accounts: ''
  })
  const [bulkDeleteServiceId, setBulkDeleteServiceId] = useState<string>('')
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [filterService, setFilterService] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'OWNER') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      loadStocks()
      loadServices()
    }
  }, [session])

  // Limpar seleção quando filtros mudarem
  useEffect(() => {
    setSelectedStocks(new Set())
  }, [filterService, filterStatus, searchQuery])

  const loadStocks = async () => {
    try {
      const response = await axios.get('/api/stocks')
      setStocks(response.data)
    } catch (error) {
      toast.error('Erro ao carregar estoques')
    }
  }

  const loadServices = async () => {
    try {
      const response = await axios.get('/api/services')
      setServices(response.data)
    } catch (error) {
      toast.error('Erro ao carregar serviços')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingStock) {
        // Editar estoque existente
        await axios.put(`/api/stocks/${editingStock.id}`, {
          ...formData,
          force: editingStock.isUsed // Permitir edição mesmo se usado
        })
        toast.success('Estoque atualizado com sucesso!')
        setEditingStock(null)
      } else {
        // Criar novo estoque
        await axios.post('/api/stocks', formData)
        toast.success('Estoque adicionado com sucesso!')
        setShowForm(false)
      }
      setFormData({ serviceId: '', username: '', password: '', email: '' })
      loadStocks()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar estoque')
    }
  }

  const handleEdit = (stock: Stock) => {
    setEditingStock(stock)
    setFormData({
      serviceId: stock.serviceId,
      username: stock.username,
      password: stock.password,
      email: stock.email || ''
    })
    setShowForm(true)
    setShowBulkForm(false)
  }

  const handleCancelEdit = () => {
    setEditingStock(null)
    setShowForm(false)
    setFormData({ serviceId: '', username: '', password: '', email: '' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este estoque?')) return

    try {
      await axios.delete(`/api/stocks/${id}`)
      toast.success('Estoque excluído!')
      loadStocks()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao excluir estoque')
    }
  }

  const handleSelectStock = (id: string) => {
    const newSelected = new Set(selectedStocks)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedStocks(newSelected)
  }

  const handleSelectAll = () => {
    const availableStocks = filteredStocks.filter(s => !s.isUsed)
    if (selectedStocks.size === availableStocks.length) {
      setSelectedStocks(new Set())
    } else {
      setSelectedStocks(new Set(availableStocks.map(s => s.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedStocks.size === 0) {
      toast.error('Selecione pelo menos um estoque para excluir')
      return
    }

    const selectedCount = selectedStocks.size
    if (!confirm(`Tem certeza que deseja excluir ${selectedCount} estoque(s)?`)) return

    setIsDeleting(true)
    try {
      const response = await axios.post('/api/stocks/bulk-delete', {
        ids: Array.from(selectedStocks)
      })

      if (response.data.warning) {
        toast.error(response.data.warning)
      }

      if (response.data.deleted > 0) {
        toast.success(`${response.data.deleted} estoque(s) excluído(s) com sucesso!`)
      } else {
        toast.error('Nenhum estoque foi excluído. Verifique se os estoques selecionados não estão usados.')
      }
      setSelectedStocks(new Set())
      loadStocks()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao excluir estoques')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingBulk(true)

    try {
      const accounts = bulkData.accounts
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      if (accounts.length === 0) {
        toast.error('Nenhuma conta fornecida')
        setLoadingBulk(false)
        return
      }

      const response = await axios.post('/api/stocks/bulk', {
        serviceId: bulkData.serviceId,
        accounts
      })

      if (response.data.errors && response.data.errors.length > 0) {
        toast.success(`${response.data.created} contas criadas com sucesso!`)
        toast.error(`${response.data.errors.length} erros encontrados. Verifique o console.`)
        console.error('Erros:', response.data.errors)
      } else {
        toast.success(`${response.data.created} contas adicionadas com sucesso!`)
      }

      setShowBulkForm(false)
      setBulkData({ serviceId: '', accounts: '' })
      loadStocks()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao adicionar contas em massa')
      console.error('Bulk error:', error)
    } finally {
      setLoadingBulk(false)
    }
  }

  const handleBulkDeleteSubmit = async () => {
    if (!bulkDeleteServiceId) {
      toast.error('Selecione um serviço')
      return
    }

    const serviceStocks = stocks.filter(s => s.serviceId === bulkDeleteServiceId && !s.isUsed)
    
    if (serviceStocks.length === 0) {
      toast.error('Não há estoques disponíveis para remover neste serviço')
      return
    }

    if (!confirm(`Tem certeza que deseja remover TODOS os ${serviceStocks.length} estoques disponíveis deste serviço?`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await axios.post('/api/stocks/bulk-delete', {
        ids: serviceStocks.map(s => s.id)
      })

      if (response.data.warning) {
        toast.error(response.data.warning)
      }

      if (response.data.deleted > 0) {
        toast.success(`${response.data.deleted} estoque(s) removido(s) com sucesso!`)
      } else {
        toast.error('Nenhum estoque foi removido.')
      }
      
      setShowBulkDeleteForm(false)
      setBulkDeleteServiceId('')
      loadStocks()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao remover estoques')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtrar estoques
  const filteredStocks = stocks.filter(stock => {
    const matchesService = !filterService || stock.serviceId === filterService
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'available' && !stock.isUsed) ||
      (filterStatus === 'used' && stock.isUsed)
    const matchesSearch = !searchQuery || 
      stock.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.service.name.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesService && matchesStatus && matchesSearch
  })

  // Estatísticas
  const stats = {
    total: stocks.length,
    available: stocks.filter(s => !s.isUsed).length,
    used: stocks.filter(s => s.isUsed).length,
    byService: services.map(service => ({
      service: service.name,
      total: stocks.filter(s => s.serviceId === service.id).length,
      available: stocks.filter(s => s.serviceId === service.id && !s.isUsed).length
    }))
  }

  if (status === 'loading') {
    return <div className="text-center py-12">Carregando...</div>
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold">Gerenciamento de Estoque</h1>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setShowForm(false)
              setShowBulkDeleteForm(false)
              setShowBulkForm(!showBulkForm)
              setEditingStock(null)
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-md"
          >
            {showBulkForm ? 'Cancelar' : '➕ Adicionar em Massa'}
          </button>
          <button
            onClick={() => {
              setShowForm(false)
              setShowBulkForm(false)
              setShowBulkDeleteForm(!showBulkDeleteForm)
              setEditingStock(null)
              if (!showBulkDeleteForm) {
                setBulkDeleteServiceId('')
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-md"
          >
            {showBulkDeleteForm ? 'Cancelar' : '🗑️ Remover em Massa'}
          </button>
          <button
            onClick={() => {
              setShowBulkForm(false)
              setShowBulkDeleteForm(false)
              setShowForm(!showForm)
              setEditingStock(null)
              if (!showForm) {
                setFormData({ serviceId: '', username: '', password: '', email: '' })
              }
            }}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-md"
          >
            {showForm ? 'Cancelar' : '➕ Adicionar Estoque'}
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-sm text-gray-600">Total de Estoque</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 border border-green-200">
          <div className="text-sm text-green-600">Disponíveis</div>
          <div className="text-2xl font-bold text-green-700">{stats.available}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4 border border-red-200">
          <div className="text-sm text-red-600">Usados</div>
          <div className="text-2xl font-bold text-red-700">{stats.used}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
          <div className="text-sm text-blue-600">Taxa de Uso</div>
          <div className="text-2xl font-bold text-blue-700">
            {stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por usuário, email ou serviço..."
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Serviço</label>
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-white/10 border border-white/20 text-white'
                  : 'bg-white border border-gray-300 text-gray-900'
              }`}
              style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
            >
              <option value="" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Todos os serviços</option>
              {services.map((service) => (
                <option key={service.id} value={service.id} style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-white/10 border border-white/20 text-white'
                  : 'bg-white border border-gray-300 text-gray-900'
              }`}
              style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
            >
              <option value="all" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Todos</option>
              <option value="available" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Disponíveis</option>
              <option value="used" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Usados</option>
            </select>
          </div>
        </div>
      </div>

      {showBulkForm && (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Adicionar Múltiplas Contas</h2>
          <p className="text-sm text-gray-600 mb-4">
            Cole as contas no formato <strong>account:pass</strong>, uma por linha.
            Exemplo:<br />
            <code className="bg-gray-100 p-1 rounded">user1@example.com:senha123</code><br />
            <code className="bg-gray-100 p-1 rounded">user2@example.com:senha456</code>
          </p>
          <form onSubmit={handleBulkSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('services')}
                </label>
                <select
                  value={bulkData.serviceId}
                  onChange={(e) => setBulkData({ ...bulkData, serviceId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-white/10 border border-white/20 text-white'
                      : 'bg-white border border-gray-300 text-gray-900'
                  }`}
                  style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
                  required
                >
                  <option value="" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Selecione um serviço</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id} style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contas (account:pass, uma por linha)
                </label>
                <textarea
                  value={bulkData.accounts}
                  onChange={(e) => setBulkData({ ...bulkData, accounts: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  rows={10}
                  placeholder="user1@example.com:senha123&#10;user2@example.com:senha456&#10;user3@example.com:senha789"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loadingBulk}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {loadingBulk ? 'Processando...' : 'Adicionar Contas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showBulkDeleteForm && (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Remover Estoque em Massa</h2>
          <p className="text-sm text-gray-600 mb-4">
            Selecione um serviço para ver todos os estoques disponíveis e removê-los de uma vez.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('services')}
              </label>
              <select
                value={bulkDeleteServiceId}
                onChange={(e) => setBulkDeleteServiceId(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-white/10 border border-white/20 text-white'
                    : 'bg-white border border-gray-300 text-gray-900'
                }`}
                style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
                required
              >
                <option value="" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Selecione um serviço</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id} style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            {bulkDeleteServiceId && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">
                  Estoque do Serviço Selecionado
                </h3>
                {(() => {
                  const serviceStocks = stocks.filter(s => s.serviceId === bulkDeleteServiceId)
                  const availableStocks = serviceStocks.filter(s => !s.isUsed)
                  const usedStocks = serviceStocks.filter(s => s.isUsed)
                  
                  return (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-blue-900">
                            Total de estoques: {serviceStocks.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-green-700 font-medium">Disponíveis: {availableStocks.length}</span>
                          </div>
                          <div>
                            <span className="text-red-700 font-medium">Usados: {usedStocks.length}</span>
                          </div>
                        </div>
                      </div>

                      {availableStocks.length > 0 ? (
                        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {availableStocks.map((stock) => (
                                <tr key={stock.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                                    {stock.username}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                                    {stock.email || '-'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(stock.createdAt).toLocaleDateString('pt-BR')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                          <p className="text-yellow-800">Não há estoques disponíveis para remover neste serviço.</p>
                        </div>
                      )}

                      {availableStocks.length > 0 && (
                        <div className="flex gap-3">
                          <button
                            onClick={handleBulkDeleteSubmit}
                            disabled={isDeleting}
                            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shadow-md"
                          >
                            {isDeleting ? 'Removendo...' : `🗑️ Remover ${availableStocks.length} Estoque(s) Disponível(eis)`}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">
            {editingStock ? 'Editar Estoque' : 'Adicionar Estoque'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('services')}
                </label>
                <select
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-white/10 border border-white/20 text-white'
                      : 'bg-white border border-gray-300 text-gray-900'
                  }`}
                  style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
                  required
                >
                  <option value="" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Selecione um serviço</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id} style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('username')}
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('password')}
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('email')} (Opcional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingStock ? 'Salvar Alterações' : 'Adicionar'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de Estoque */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Estoque ({filteredStocks.length} de {stocks.length})
            </h3>
            {selectedStocks.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {selectedStocks.size} selecionado(s)
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shadow-md"
                >
                  {isDeleting ? 'Excluindo...' : `🗑️ Excluir ${selectedStocks.size} Selecionado(s)`}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={filteredStocks.filter(s => !s.isUsed).length > 0 && 
                             selectedStocks.size === filteredStocks.filter(s => !s.isUsed).length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serviço</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Senha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Nenhum estoque encontrado
                  </td>
                </tr>
              ) : (
                filteredStocks.map((stock) => (
                  <tr key={stock.id} className={stock.isUsed ? 'bg-gray-50' : selectedStocks.has(stock.id) ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedStocks.has(stock.id)}
                        onChange={() => handleSelectStock(stock.id)}
                        disabled={stock.isUsed}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{stock.service.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-mono">{stock.username}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-mono">{stock.email || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-mono">••••••</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        stock.isUsed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {stock.isUsed ? 'Usado' : 'Disponível'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(stock.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(stock)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Editar"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDelete(stock.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Excluir"
                        disabled={stock.isUsed}
                      >
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
