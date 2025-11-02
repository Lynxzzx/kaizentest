import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import axios from 'axios'
import toast from 'react-hot-toast'

interface Stock {
  id: string
  serviceId: string
  username: string
  password: string
  email: string
  isUsed: boolean
  service: {
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
  const router = useRouter()
  const [stocks, setStocks] = useState<Stock[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
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
  const [loadingBulk, setLoadingBulk] = useState(false)

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
      await axios.post('/api/stocks', formData)
      toast.success('Estoque adicionado com sucesso!')
      setShowForm(false)
      setFormData({ serviceId: '', username: '', password: '', email: '' })
      loadStocks()
    } catch (error) {
      toast.error('Erro ao adicionar estoque')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este estoque?')) return

    try {
      await axios.delete(`/api/stocks/${id}`)
      toast.success('Estoque excluído!')
      loadStocks()
    } catch (error) {
      toast.error('Erro ao excluir estoque')
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingBulk(true)

    try {
      // Processar contas: uma por linha, formato email:pass
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

  if (status === 'loading') {
    return <div className="text-center py-12">Carregando...</div>
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t('stocks')}</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setShowForm(false)
              setShowBulkForm(!showBulkForm)
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            {showBulkForm ? 'Cancelar' : 'Adicionar em Massa'}
          </button>
          <button
            onClick={() => {
              setShowBulkForm(false)
              setShowForm(!showForm)
            }}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            {showForm ? t('cancel') : t('add')} {t('stocks')}
          </button>
        </div>
      </div>

      {showBulkForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Adicionar Múltiplas Contas</h2>
          <p className="text-sm text-gray-600 mb-4">
            Cole as contas no formato <strong>email:pass</strong>, uma por linha.
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Selecione um serviço</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contas (email:pass, uma por linha)
                </label>
                <textarea
                  value={bulkData.accounts}
                  onChange={(e) => setBulkData({ ...bulkData, accounts: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                  rows={10}
                  placeholder="user1@example.com:senha123&#10;user2@example.com:senha456&#10;user3@example.com:senha789"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loadingBulk}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loadingBulk ? 'Processando...' : 'Adicionar Contas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">{t('add')} {t('stocks')}</h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('services')}
                </label>
                <select
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Selecione um serviço</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('services')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('username')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('password')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stocks.map((stock) => (
              <tr key={stock.id}>
                <td className="px-6 py-4 whitespace-nowrap">{stock.service.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{stock.username}</td>
                <td className="px-6 py-4 whitespace-nowrap">{stock.password}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    stock.isUsed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {stock.isUsed ? t('unavailable') : t('available')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleDelete(stock.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
