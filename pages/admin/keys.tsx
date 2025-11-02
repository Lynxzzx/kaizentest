import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import axios from 'axios'
import toast from 'react-hot-toast'

interface Key {
  id: string
  key: string
  planId: string
  isUsed: boolean
  plan: {
    name: string
  }
}

interface Plan {
  id: string
  name: string
}

export default function AdminKeys() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [keys, setKeys] = useState<Key[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    planId: '',
    count: '1'
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
      loadKeys()
      loadPlans()
    }
  }, [session])

  const loadKeys = async () => {
    try {
      const response = await axios.get('/api/keys')
      setKeys(response.data)
    } catch (error) {
      toast.error('Erro ao carregar chaves')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post('/api/keys', formData)
      toast.success('Chaves criadas com sucesso!')
      setShowForm(false)
      setFormData({ planId: '', count: '1' })
      loadKeys()
    } catch (error) {
      toast.error('Erro ao criar chaves')
    }
  }

  if (status === 'loading') {
    return <div className="text-center py-12">Carregando...</div>
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t('keys')}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          {showForm ? t('cancel') : t('create')} {t('keys')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">{t('create')} {t('keys')}</h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('plans')}
                </label>
                <select
                  value={formData.planId}
                  onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Selecione um plano</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.count}
                  onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <button
                type="submit"
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
              >
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('plans')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('status')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {keys.map((key) => (
              <tr key={key.id}>
                <td className="px-6 py-4 whitespace-nowrap font-mono">{key.key}</td>
                <td className="px-6 py-4 whitespace-nowrap">{key.plan.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    key.isUsed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {key.isUsed ? 'Usada' : 'Disponível'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
