import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import axios from 'axios'
import toast from 'react-hot-toast'

interface Plan {
  id: string
  name: string
  description: string
  price: number
  duration: number
  maxGenerations: number
  generationCooldownSeconds?: number
  isActive: boolean
}

export default function AdminPlans() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    maxGenerations: '0',
    generationCooldownSeconds: '120'
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
      loadPlans()
    }
  }, [session])

  const loadPlans = async () => {
    try {
      const response = await axios.get('/api/plans')
      setPlans(response.data)
    } catch (error) {
      toast.error('Erro ao carregar planos')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingPlan) {
        // Editar plano existente
        await axios.put(`/api/plans/${editingPlan.id}`, {
          ...formData,
          isActive: editingPlan.isActive
        })
        toast.success('Plano atualizado com sucesso!')
      } else {
        // Criar novo plano
        await axios.post('/api/plans', formData)
        toast.success('Plano criado com sucesso!')
      }
      setShowForm(false)
      setEditingPlan(null)
      setFormData({ name: '', description: '', price: '', duration: '', maxGenerations: '0', generationCooldownSeconds: '120' })
      loadPlans()
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingPlan ? 'Erro ao atualizar plano' : 'Erro ao criar plano'))
    }
  }

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price: plan.price.toString(),
      duration: plan.duration.toString(),
      maxGenerations: plan.maxGenerations.toString(),
      generationCooldownSeconds: (plan.generationCooldownSeconds || 120).toString()
    })
    setShowForm(true)
    // Scroll para o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingPlan(null)
    setFormData({ name: '', description: '', price: '', duration: '', maxGenerations: '0', generationCooldownSeconds: '120' })
  }

  const handleToggleActive = async (plan: Plan) => {
    try {
      await axios.put(`/api/plans/${plan.id}`, {
        ...plan,
        isActive: !plan.isActive
      })
      toast.success('Plano atualizado!')
      loadPlans()
    } catch (error) {
      toast.error('Erro ao atualizar plano')
    }
  }

  if (status === 'loading') {
    return <div className="admin-shell text-center py-12">Carregando...</div>
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  return (
    <div className="admin-shell max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t('plans')}</h1>
        <button
          onClick={() => {
            if (showForm) {
              handleCancel()
            } else {
              setShowForm(true)
            }
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          {showForm ? t('cancel') : t('create')} {t('plans')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingPlan ? `✏️ Editar Plano: ${editingPlan.name}` : `➕ ${t('create')} ${t('plans')}`}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('name')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('price')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('duration')}
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Gerações (0 = ilimitado)
                </label>
                <input
                  type="number"
                  value={formData.maxGenerations}
                  onChange={(e) => setFormData({ ...formData, maxGenerations: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cooldown de Geração (segundos)
                </label>
                <input
                  type="number"
                  value={formData.generationCooldownSeconds}
                  onChange={(e) => setFormData({ ...formData, generationCooldownSeconds: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="0"
                  placeholder="120"
                />
                <p className="text-xs text-gray-500 mt-1">Tempo de espera entre gerações (padrão: 120 segundos = 2 minutos)</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
                >
                  {editingPlan ? 'Atualizar' : t('save')}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white shadow rounded-lg p-6">
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <p className="text-gray-600 mb-4">{plan.description}</p>
            <div className="space-y-2 mb-4">
              <p><strong>Preço:</strong> R$ {plan.price.toFixed(2)}</p>
              <p><strong>Duração:</strong> {plan.duration} dias</p>
              <p><strong>Max Gerações:</strong> {plan.maxGenerations === 0 ? t('unlimitedLabel') : plan.maxGenerations}</p>
              <p><strong>Cooldown:</strong> {plan.generationCooldownSeconds || 120} segundos</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(plan)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                ✏️ Editar
              </button>
              <button
                onClick={() => handleToggleActive(plan)}
                className={`flex-1 px-4 py-2 rounded-md ${
                  plan.isActive
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {plan.isActive ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
