import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
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
}

export default function AdminUsers() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editData, setEditData] = useState({
    planId: '',
    planExpiresAt: '',
    isBanned: false
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'OWNER') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      loadUsers()
      loadPlans()
    }
  }, [session])

  const loadUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users')
      setUsers(response.data)
    } catch (error) {
      toast.error('Erro ao carregar usuários')
    } finally {
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
      isBanned: user.isBanned
    })
  }

  const handleSave = async () => {
    if (!editingUser) return

    try {
      await axios.put('/api/admin/users', {
        userId: editingUser.id,
        ...editData,
        planId: editData.planId || null,
        planExpiresAt: editData.planExpiresAt || null
      })
      toast.success('Usuário atualizado com sucesso!')
      setEditingUser(null)
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar usuário')
    }
  }

  const handleBan = async (user: User, ban: boolean) => {
    try {
      await axios.put('/api/admin/users', {
        userId: user.id,
        isBanned: ban
      })
      toast.success(ban ? 'Usuário banido!' : 'Usuário desbanido!')
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar status de banimento')
    }
  }

  if (status === 'loading' || loading) {
    return <div className="text-center py-12">Carregando...</div>
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
      </div>

      {editingUser && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Editar Usuário: {editingUser.username}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Plano</label>
              <select
                value={editData.planId}
                onChange={(e) => setEditData({ ...editData, planId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Sem plano</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
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
                onChange={(e) => setEditData({ ...editData, planExpiresAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
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

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plano</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gerações</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className={user.isBanned ? 'bg-red-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{user.username}</div>
                  <div className="text-sm text-gray-500">
                    {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {user.plan?.name || 'Sem plano'}
                  </div>
                  {user.planExpiresAt && (
                    <div className="text-xs text-gray-500">
                      Expira: {format(new Date(user.planExpiresAt), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.isBanned ? (
                    <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                      Banido
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      Ativo
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>Total: {user._count.generatedAccounts}</div>
                  <div>Grátis hoje: {user.dailyFreeGenerations}/2</div>
                  <div>Bonus: {user.bonusGenerations}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      Editar
                    </button>
                    {user.isBanned ? (
                      <button
                        onClick={() => handleBan(user, false)}
                        className="text-green-600 hover:text-green-800"
                      >
                        Desbanir
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBan(user, true)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Banir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

