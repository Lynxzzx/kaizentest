import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface Broadcast {
  id: string
  title: string | null
  message: string
  isActive: boolean
  createdAt: string
  expiresAt: string | null
  user: {
    username: string
    role: string
  }
}

export default function BroadcastPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    expiresAt: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'OWNER' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN') {
      loadBroadcasts()
    }
  }, [session])

  const loadBroadcasts = async () => {
    try {
      const response = await axios.get('/api/broadcast/admin')
      setBroadcasts(response.data.broadcasts || [])
    } catch (error: any) {
      toast.error('Erro ao carregar broadcasts')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await axios.post('/api/broadcast', formData)
      toast.success('Broadcast criado com sucesso!')
      setShowForm(false)
      setFormData({ title: '', message: '', expiresAt: '' })
      loadBroadcasts()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar broadcast')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await axios.put(`/api/broadcast/${id}`, { isActive: !currentStatus })
      toast.success('Broadcast atualizado!')
      loadBroadcasts()
    } catch (error: any) {
      toast.error('Erro ao atualizar broadcast')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          <p className="mt-4 text-gray-300 text-lg">Carregando...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'OWNER' && session?.user?.role !== 'ADMIN') {
    return null
  }

  return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">📢 Broadcast Messages</h1>
              <p className="text-gray-300">Envie mensagens para todos os usuários</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:from-blue-600 hover:to-purple-700 transition-all shadow-xl"
            >
              {showForm ? '✕ Cancelar' : '+ Novo Broadcast'}
            </button>
          </div>

          {showForm && (
            <div className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 rounded-3xl shadow-2xl p-8 mb-8 border border-gray-600">
              <h2 className="text-2xl font-bold text-white mb-6">Criar Novo Broadcast</h2>
              <form onSubmit={handleCreateBroadcast} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Título (opcional)</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Anúncio importante..."
                    className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Mensagem *</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Digite sua mensagem aqui..."
                    rows={6}
                    required
                    className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={1000}
                  />
                  <p className="text-xs text-gray-400 mt-2">{formData.message.length}/1000 caracteres</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Expira em (opcional)</label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving || !formData.message.trim()}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-bold hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 shadow-xl"
                >
                  {saving ? 'Enviando...' : '📢 Enviar Broadcast'}
                </button>
              </form>
            </div>
          )}

          <div className="space-y-4">
            {broadcasts.map((broadcast) => (
              <div
                key={broadcast.id}
                className={`bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 rounded-2xl shadow-xl p-6 border ${
                  broadcast.isActive ? 'border-green-500' : 'border-gray-600'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    {broadcast.title && (
                      <h3 className="text-2xl font-bold text-white mb-2">{broadcast.title}</h3>
                    )}
                    <p className="text-gray-300 whitespace-pre-wrap">{broadcast.message}</p>
                    <div className="flex items-center space-x-4 mt-4 text-sm text-gray-400">
                      <span>Por: {broadcast.user.username}</span>
                      <span>
                        {format(new Date(broadcast.createdAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {broadcast.expiresAt && (
                        <span>
                          Expira: {format(new Date(broadcast.expiresAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        broadcast.isActive
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-600 text-gray-300'
                      }`}
                    >
                      {broadcast.isActive ? '✓ Ativo' : '✕ Inativo'}
                    </span>
                    <button
                      onClick={() => handleToggleActive(broadcast.id, broadcast.isActive)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                        broadcast.isActive
                          ? 'bg-gray-600 text-white hover:bg-gray-700'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {broadcast.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {broadcasts.length === 0 && !showForm && (
            <div className="text-center py-12 bg-gradient-to-br from-gray-800 to-gray-700 rounded-2xl border border-gray-600">
              <div className="text-6xl mb-4">📢</div>
              <p className="text-gray-300 text-lg">Nenhum broadcast encontrado</p>
              <p className="text-gray-400 text-sm mt-2">Crie um novo broadcast para enviar mensagens aos usuários</p>
            </div>
          )}
        </div>
      </div>
  )
}

