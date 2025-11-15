import { FormEvent, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface User {
  id: string
  username: string
  email: string | null
  role: string
  isBanned: boolean
  bannedAt: string | null
  plan: {
    id: string
    name: string
  } | null
  planExpiresAt: string | null
  bonusGenerations: number
  dailyFreeGenerations: number
  lastFreeGenerationDate: string | null
  createdAt: string
  _count: {
    generatedAccounts: number
    payments: number
  }
}

interface Plan {
  id: string
  name: string
  price: number
  duration: number
}

export default function AdminUsers() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editData, setEditData] = useState({
    planId: '',
    planExpiresAt: '',
    permanentPlan: false,
    isBanned: false,
    role: 'USER'
  })
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'OWNER') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      loadUsers('')
      loadPlans()
    }
  }, [session])

  const loadUsers = async (search = '') => {
    const showTableLoader = !loading
    if (showTableLoader) {
      setTableLoading(true)
    }

    try {
      const response = await axios.get('/api/admin/users', {
        params: {
          search: search.trim() || undefined
        }
      })
      setUsers(response.data)
    } catch (error) {
      toast.error('Erro ao carregar usuários')
    } finally {
      if (showTableLoader) {
        setTableLoading(false)
      }
      setLoading(false)
    }
  }

  const loadPlans = async () => {
    try {
      const response = await axios.get('/api/plans')
      setPlans(response.data)
    } catch (error) {
      toast.error('Erro ao carregar planos')
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setEditData({
      planId: user.plan?.id || '',
      planExpiresAt: user.planExpiresAt ? format(new Date(user.planExpiresAt), 'yyyy-MM-dd') : '',
      permanentPlan: !!user.plan && !user.planExpiresAt,
      isBanned: user.isBanned,
      role: user.role
    })
  }

  const handleSave = async () => {
    if (!editingUser) return

    try {
      await axios.put('/api/admin/users', {
        userId: editingUser.id,
        ...editData,
        planId: editData.planId || null,
        planExpiresAt: editData.permanentPlan ? null : editData.planExpiresAt || null
      })
      
      // Promover usuário se o role mudou
      if (editData.role !== editingUser.role) {
        await axios.put('/api/admin/promote', {
          userId: editingUser.id,
          role: editData.role
        })
      }
      
      toast.success('Usuário atualizado com sucesso!')
      setEditingUser(null)
      loadUsers(searchTerm)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar usuário')
    }
  }

  const handlePromote = async (userId: string, newRole: string) => {
    try {
      await axios.put('/api/admin/promote', {
        userId,
        role: newRole
      })
      toast.success('Usuário promovido com sucesso!')
      loadUsers(searchTerm)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao promover usuário')
    }
  }

  const handleBan = async (user: User, ban: boolean) => {
    try {
      await axios.put('/api/admin/users', {
        userId: user.id,
        isBanned: ban
      })
      toast.success(ban ? 'Usuário banido!' : 'Usuário desbanido!')
      loadUsers(searchTerm)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar status de banimento')
    }
  }

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    loadUsers(searchTerm)
  }

  const handleResetSearch = () => {
    setSearchTerm('')
    loadUsers('')
  }

  const handlePlanSelection = (planId: string) => {
    if (!planId) {
      setEditData((prev) => ({
        ...prev,
        planId: '',
        planExpiresAt: '',
        permanentPlan: false
      }))
      return
    }

    const selectedPlan = plans.find((plan) => plan.id === planId)
    if (!selectedPlan) {
      setEditData((prev) => ({
        ...prev,
        planId
      }))
      return
    }

    let computedExpiration = ''
    const isPermanent = selectedPlan.duration <= 0
    if (!isPermanent) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + selectedPlan.duration)
      computedExpiration = format(expiresAt, 'yyyy-MM-dd')
    }

    setEditData((prev) => ({
      ...prev,
      planId,
      planExpiresAt: computedExpiration,
      permanentPlan: isPermanent
    }))
  }

  const selectedPlanDetails = plans.find((plan) => plan.id === editData.planId)

  const renderUserRows = () => {
    if (tableLoading) {
      return (
        <tr>
          <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
            Carregando usuários...
          </td>
        </tr>
      )
    }

    if (users.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
            Nenhum usuário encontrado
          </td>
        </tr>
      )
    }

    return users.map((user) => (
      <tr key={user.id} className={user.isBanned ? 'bg-red-50 dark:bg-red-900/20' : ''}>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="font-medium text-gray-900 dark:text-gray-100">{user.username}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          {user.email || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span
            className={`px-2 py-1 rounded-full text-xs font-bold ${
              user.role === 'OWNER'
                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                : user.role === 'ADMIN'
                ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                : user.role === 'MODERATOR'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            {user.role === 'OWNER'
              ? '👑 Owner'
              : user.role === 'ADMIN'
              ? '🔧 Admin'
              : user.role === 'MODERATOR'
              ? '🛡️ Moderador'
              : '👤 Usuário'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {user.plan?.name || 'Sem plano'}
          </div>
          {user.planExpiresAt ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Expira: {format(new Date(user.planExpiresAt), "dd/MM/yyyy", { locale: ptBR })}
            </div>
          ) : (
            user.plan && (
              <div className="text-xs text-green-600 dark:text-green-300">Plano permanente</div>
            )
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {user.isBanned ? (
            <span className="px-2 py-1 rounded-full text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
              Banido
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              Ativo
            </span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          <div>Total: {user._count.generatedAccounts}</div>
          <div>Grátis hoje: {user.dailyFreeGenerations}/2</div>
          <div>Bonus: {user.bonusGenerations}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <div className="flex space-x-2">
            <button
              onClick={() => handleEdit(user)}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
            >
              Editar
            </button>
            {user.isBanned ? (
              <button
                onClick={() => handleBan(user, false)}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
              >
                Desbanir
              </button>
            ) : (
              <button
                onClick={() => handleBan(user, true)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                Banir
              </button>
            )}
          </div>
        </td>
      </tr>
    ))
  }

  if (status === 'loading' || loading) {
    return <div className="admin-shell text-center py-12">Carregando...</div>
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  return (
    <div className="admin-shell max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
        <form onSubmit={handleSearchSubmit} className="flex w-full md:w-auto gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome de usuário"
            className={`flex-1 md:w-64 px-4 py-2 rounded-md border ${
              theme === 'dark'
                ? 'bg-white/5 border-white/20 text-white placeholder-white/50'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
          <button
            type="submit"
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            Buscar
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={handleResetSearch}
              className={`${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} px-4 py-2 rounded-md`}
            >
              Limpar
            </button>
          )}
        </form>
      </div>

      {editingUser && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Editar Usuário: {editingUser.username}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Plano</label>
              <select
                value={editData.planId}
                onChange={(e) => handlePlanSelection(e.target.value)}
                className={`w-full px-3 py-2 rounded-md ${
                  theme === 'dark'
                    ? 'bg-white/10 border border-white/20 text-white'
                    : 'bg-white border border-gray-300 text-gray-900'
                }`}
                style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
              >
                <option value="" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>Sem plano</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id} style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Expiração do Plano
              </label>
              <input
                type="date"
                value={editData.planExpiresAt}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    planExpiresAt: e.target.value,
                    permanentPlan: e.target.value ? false : prev.permanentPlan
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                disabled={editData.permanentPlan}
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editData.permanentPlan}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      permanentPlan: e.target.checked,
                      planExpiresAt: e.target.checked ? '' : prev.planExpiresAt
                    }))
                  }
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Plano permanente (não expira)
              </label>
              {selectedPlanDetails && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedPlanDetails.duration > 0
                    ? `Este plano expira automaticamente em ${selectedPlanDetails.duration} dia${selectedPlanDetails.duration > 1 ? 's' : ''} a partir da data de ativação.`
                    : 'Este plano é vitalício e não expira automaticamente.'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cargo</label>
              <select
                value={editData.role}
                onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                className={`w-full px-3 py-2 rounded-md ${
                  theme === 'dark'
                    ? 'bg-white/10 border border-white/20 text-white'
                    : 'bg-white border border-gray-300 text-gray-900'
                }`}
                style={theme === 'dark' ? { colorScheme: 'dark' } : {}}
              >
                <option value="USER" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>👤 Usuário</option>
                <option value="MODERATOR" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>🛡️ Moderador</option>
                <option value="ADMIN" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>🔧 Administrador</option>
                <option value="OWNER" style={theme === 'dark' ? { backgroundColor: '#1e293b', color: '#fff' } : {}}>👑 Owner</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isBanned"
                checked={editData.isBanned}
                onChange={(e) => setEditData({ ...editData, isBanned: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="isBanned" className="text-sm font-medium text-gray-700">
                Usuário Banido
              </label>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
              >
                Salvar
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {searchTerm ? 'Usuários encontrados' : 'Total de usuários'}:{' '}
          <span className="font-bold text-primary-600 dark:text-primary-400">{users.length}</span>
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cargo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Plano</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Gerações</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {renderUserRows()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

