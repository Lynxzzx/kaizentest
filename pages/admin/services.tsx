import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import axios from 'axios'
import toast from 'react-hot-toast'

interface ServicePlanRule {
  planId: string
  plan?: {
    id: string
    name: string
    price: number
  } | null
}

interface Service {
  id: string
  name: string
  description: string | null
  icon: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  allowedPlans?: ServicePlanRule[]
  _count?: {
    stocks: number
  }
}

interface Plan {
  id: string
  name: string
  price: number
  isActive: boolean
}

export default function AdminServices() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    isActive: true,
    allowedPlanIds: [] as string[]
  })
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterActive, setFilterActive] = useState<string>('all')
  const [accessMode, setAccessMode] = useState<'all' | 'paid' | 'custom'>('all')

  const paidPlanIds = useMemo(
    () => plans.filter((plan) => plan.price > 0).map((plan) => plan.id),
    [plans]
  )

  const determineAccessMode = (allowedIds: string[]) => {
    if (!allowedIds || allowedIds.length === 0) return 'all'
    if (
      paidPlanIds.length > 0 &&
      allowedIds.length === paidPlanIds.length &&
      allowedIds.every((id) => paidPlanIds.includes(id))
    ) {
      return 'paid'
    }
    return 'custom'
  }

  const resetFormData = () => {
    setFormData({
      name: '',
      description: '',
      icon: '',
      isActive: true,
      allowedPlanIds: []
    })
    setAccessMode('all')
  }

  const getPlanAccessLabel = (service: Service) => {
    if (!service.allowedPlans || service.allowedPlans.length === 0) {
      return 'Todos (inclui plano grátis)'
    }
    const allPaid = service.allowedPlans.every((rule) => (rule.plan?.price ?? 0) > 0)
    if (allPaid) {
      return 'Somente planos pagos'
    }
    return service.allowedPlans.map((rule) => rule.plan?.name || 'Plano removido').join(', ')
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'OWNER') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      loadServices()
      loadPlans()
    }
  }, [session])

  const loadServices = async () => {
    try {
      const response = await axios.get('/api/services')
      setServices(response.data)
    } catch (error) {
      toast.error('Erro ao carregar serviços')
    }
  }

  const loadPlans = async () => {
    try {
      const response = await axios.get('/api/plans')
      setPlans(response.data)
    } catch (error) {
      toast.error('Erro ao carregar planos disponíveis')
    }
  }

  const handlePlanSelection = (planId: string) => {
    if (accessMode !== 'custom') {
      setAccessMode('custom')
    }
    setFormData((prev) => {
      const alreadySelected = prev.allowedPlanIds.includes(planId)
      return {
        ...prev,
        allowedPlanIds: alreadySelected
          ? prev.allowedPlanIds.filter((id) => id !== planId)
          : [...prev.allowedPlanIds, planId]
      }
    })
  }

  const handleAccessModeChange = (mode: 'all' | 'paid' | 'custom') => {
    setAccessMode(mode)
    if (mode === 'all') {
      setFormData((prev) => ({
        ...prev,
        allowedPlanIds: []
      }))
    } else if (mode === 'paid') {
      setFormData((prev) => ({
        ...prev,
        allowedPlanIds: paidPlanIds
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingService) {
        // Editar serviço existente
        await axios.put(`/api/services/${editingService.id}`, formData)
        toast.success('Serviço atualizado com sucesso!')
        setEditingService(null)
      } else {
        // Criar novo serviço
        await axios.post('/api/services', formData)
        toast.success('Serviço criado com sucesso!')
        setShowForm(false)
      }
      resetFormData()
      loadServices()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar serviço')
    }
  }

  const handleEdit = (service: Service) => {
    setEditingService(service)
    const allowedIds = service.allowedPlans?.map((rule) => rule.planId) ?? []
    setFormData({
      name: service.name,
      description: service.description || '',
      icon: service.icon || '',
      isActive: service.isActive,
      allowedPlanIds: allowedIds
    })
    setAccessMode(determineAccessMode(allowedIds))
    setShowForm(true)
  }

  const handleCancelEdit = () => {
    setEditingService(null)
    setShowForm(false)
    resetFormData()
  }

  const handleToggleActive = async (service: Service) => {
    try {
      const allowedPlanIds = service.allowedPlans?.map((rule) => rule.planId) ?? []
      await axios.put(`/api/services/${service.id}`, {
        name: service.name,
        description: service.description,
        icon: service.icon,
        isActive: !service.isActive,
        allowedPlanIds
      })
      toast.success('Serviço atualizado!')
      loadServices()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar serviço')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço? Isso também excluirá todos os estoques associados.')) return

    try {
      await axios.delete(`/api/services/${id}`)
      toast.success('Serviço excluído!')
      loadServices()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao excluir serviço')
    }
  }

  // Filtrar serviços
  const filteredServices = services.filter(service => {
    const matchesSearch = !searchQuery || 
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterActive === 'all' ||
      (filterActive === 'active' && service.isActive) ||
      (filterActive === 'inactive' && !service.isActive)

    return matchesSearch && matchesStatus
  })

  // Estatísticas
  const stats = {
    total: services.length,
    active: services.filter(s => s.isActive).length,
    inactive: services.filter(s => !s.isActive).length,
    totalStocks: services.reduce((sum, s) => sum + (s._count?.stocks || 0), 0)
  }

  if (status === 'loading') {
    return <div className="admin-shell text-center py-12">Carregando...</div>
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  return (
    <div className="admin-shell max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold">Gerenciamento de Serviços</h1>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setEditingService(null)
            if (!showForm) {
              resetFormData()
            }
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-md"
        >
          {showForm ? 'Cancelar' : '➕ Adicionar Serviço'}
        </button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="text-sm text-gray-600">Total de Serviços</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 border border-green-200">
          <div className="text-sm text-green-600">Ativos</div>
          <div className="text-2xl font-bold text-green-700">{stats.active}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4 border border-red-200">
          <div className="text-sm text-red-600">Inativos</div>
          <div className="text-2xl font-bold text-red-700">{stats.inactive}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
          <div className="text-sm text-blue-600">Estoque Total</div>
          <div className="text-2xl font-bold text-blue-700">{stats.totalStocks}</div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou descrição..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Status</label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-white/10 border border-white/20 text-white'
                  : 'bg-white border border-gray-300 text-gray-900'
              }`}
              style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
            >
              <option value="all" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Todos</option>
              <option value="active" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Ativos</option>
              <option value="inactive" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">
            {editingService ? 'Editar Serviço' : 'Criar Serviço'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                  placeholder="Ex: Netflix, Spotify, Disney+"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={3}
                  placeholder="Descrição do serviço (opcional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon (URL ou Emoji)
                </label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="URL da imagem ou emoji (ex: 🎬, 📺, 🎵)"
                />
                {formData.icon && (
                  <div className="mt-2">
                    {formData.icon.startsWith('http') ? (
                      <img src={formData.icon} alt="Preview" className="h-12 w-12 rounded" onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }} />
                    ) : (
                      <span className="text-4xl">{formData.icon}</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Planos autorizados
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Defina quais assinantes podem gerar este serviço. Se nenhum plano for selecionado, todos (inclusive o plano grátis) terão acesso.
                </p>
                <div className="flex flex-wrap gap-3 mb-4">
                  {[
                    { mode: 'all' as const, label: 'Todos os planos', description: 'Inclui o plano grátis' },
                    { mode: 'paid' as const, label: 'Somente planos pagos', description: 'Bloqueia usuários free' },
                    { mode: 'custom' as const, label: 'Selecionar planos específicos', description: 'Escolha manualmente' }
                  ].map((option) => (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => handleAccessModeChange(option.mode)}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                        accessMode === option.mode
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 text-gray-700 hover:border-primary-300 hover:text-primary-700'
                      }`}
                    >
                      <div className="font-semibold">{option.label}</div>
                      <div className="text-[11px] text-gray-500">{option.description}</div>
                    </button>
                  ))}
                </div>
                {accessMode === 'paid' && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                    <span>🔒</span>
                    <span>Somente assinantes de planos pagos poderão gerar este serviço.</span>
                  </div>
                )}
                {accessMode !== 'custom' && (
                  <p className="text-xs text-gray-500 mb-3">
                    Para escolher planos individualmente, selecione &quot;Selecionar planos específicos&quot;.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {plans.length === 0 ? (
                    <span className="text-sm text-gray-500">Nenhum plano ativo encontrado.</span>
                  ) : (
                    plans.map((plan) => (
                      <label
                        key={plan.id}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg ${
                          formData.allowedPlanIds.includes(plan.id) ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                        } ${accessMode !== 'custom' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.allowedPlanIds.includes(plan.id)}
                          onChange={() => handlePlanSelection(plan.id)}
                          disabled={accessMode !== 'custom'}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-60"
                        />
                        <span className="text-sm text-gray-700">
                          {plan.name} {plan.price === 0 ? '(Grátis)' : `- R$ ${plan.price.toFixed(2)}`}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {accessMode === 'custom' && (
                  <>
                    <div className="flex flex-wrap gap-3 mt-3">
                      <button
                        type="button"
                        onClick={() => handleAccessModeChange('paid')}
                        className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-100 rounded-md hover:bg-primary-200 transition-colors"
                      >
                        Selecionar todos os planos pagos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAccessModeChange('all')}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Liberar geral (inclui grátis)
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Usuários no plano grátis continuam com 2 gerações/dia somente quando o serviço estiver liberado para eles.
                    </p>
                  </>
                )}
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Serviço Ativo</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Serviços inativos não aparecerão para os usuários no dashboard
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingService ? 'Salvar Alterações' : 'Criar Serviço'}
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

      {/* Tabela de Serviços */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Serviços ({filteredServices.length} de {services.length})
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Icon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('name')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('description')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planos liberados</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Nenhum serviço encontrado
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {service.icon ? (
                        service.icon.startsWith('http') ? (
                          <img src={service.icon} alt={service.name} className="h-8 w-8 rounded" onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }} />
                        ) : (
                          <span className="text-2xl">{service.icon}</span>
                        )
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{service.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600 text-sm">{service.description || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600 text-sm">
                        {getPlanAccessLabel(service)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-semibold">
                        {service._count?.stocks || 0} disponíveis
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        service.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {service.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(service.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(service)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Editar"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleToggleActive(service)}
                        className={`transition-colors ${
                          service.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'
                        }`}
                        title={service.isActive ? 'Desativar' : 'Ativar'}
                      >
                        {service.isActive ? '⏸️ Desativar' : '▶️ Ativar'}
                      </button>
                      <button
                        onClick={() => handleDelete(service.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Excluir"
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
