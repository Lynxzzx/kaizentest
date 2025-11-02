import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import Link from 'next/link'

interface Ticket {
  id: string
  subject: string
  message: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  user: {
    username: string
    email: string | null
  }
  replies: Array<{
    id: string
    message: string
    isAdmin: boolean
    createdAt: string
    userId: string
  }>
  _count?: {
    replies: number
  }
}

export default function Tickets() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    priority: 'MEDIUM'
  })
  const [replyMessage, setReplyMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      loadTickets()
    }
  }, [session])

  const loadTickets = async () => {
    try {
      const response = await axios.get('/api/tickets')
      setTickets(response.data)
    } catch (error) {
      toast.error('Erro ao carregar tickets')
    }
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await axios.post('/api/tickets', formData)
      toast.success('Ticket criado com sucesso!')
      setShowForm(false)
      setFormData({ subject: '', message: '', priority: 'MEDIUM' })
      loadTickets()
    } catch (error) {
      toast.error('Erro ao criar ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async (ticketId: string) => {
    if (!replyMessage.trim()) {
      toast.error('Digite uma mensagem')
      return
    }

    setLoading(true)
    try {
      await axios.post(`/api/tickets/${ticketId}/reply`, {
        message: replyMessage
      })
      toast.success('Resposta enviada!')
      setReplyMessage('')
      loadTicketDetails(ticketId)
    } catch (error) {
      toast.error('Erro ao enviar resposta')
    } finally {
      setLoading(false)
    }
  }

  const loadTicketDetails = async (ticketId: string) => {
    try {
      const response = await axios.get(`/api/tickets/${ticketId}`)
      setSelectedTicket(response.data)
      loadTickets() // Atualizar lista também
    } catch (error) {
      toast.error('Erro ao carregar detalhes do ticket')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-100 text-blue-800'
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800'
      case 'RESOLVED':
        return 'bg-green-100 text-green-800'
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-gray-100 text-gray-800'
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800'
      case 'URGENT':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Suporte</h1>
            <p className="text-gray-600">Gerencie seus tickets de suporte</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3 rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl"
          >
            {showForm ? 'Cancelar' : '+ Novo Ticket'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Criar Novo Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assunto
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                  placeholder="Descreva brevemente o problema"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Prioridade
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mensagem
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  rows={6}
                  required
                  placeholder="Descreva seu problema em detalhes..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar Ticket'}
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white rounded-2xl shadow-md p-6 border border-gray-200 hover:shadow-xl transition-all cursor-pointer"
              onClick={() => loadTicketDetails(ticket.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{ticket.subject}</h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{ticket.message}</p>
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <span>
                      {format(new Date(ticket.createdAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {session.user.role === 'OWNER' && (
                      <span>Por: {ticket.user.username}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                    {ticket.status === 'OPEN' ? 'Aberto' : 
                     ticket.status === 'IN_PROGRESS' ? 'Em Andamento' :
                     ticket.status === 'RESOLVED' ? 'Resolvido' : 'Fechado'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority === 'LOW' ? 'Baixa' :
                     ticket.priority === 'MEDIUM' ? 'Média' :
                     ticket.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {ticket.replies?.length || ticket._count?.replies || 0} {ticket.replies?.length === 1 ? 'resposta' : 'respostas'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {tickets.length === 0 && !showForm && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-md">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-600 text-lg">Nenhum ticket encontrado</p>
            <p className="text-gray-500 text-sm mt-2">Crie um novo ticket para obter suporte</p>
          </div>
        )}

        {/* Modal de detalhes do ticket */}
        {selectedTicket && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTicket(null)}>
            <div className="bg-white rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedTicket.subject}</h2>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedTicket.status)}`}>
                      {selectedTicket.status === 'OPEN' ? 'Aberto' : 
                       selectedTicket.status === 'IN_PROGRESS' ? 'Em Andamento' :
                       selectedTicket.status === 'RESOLVED' ? 'Resolvido' : 'Fechado'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority === 'LOW' ? 'Baixa' :
                       selectedTicket.priority === 'MEDIUM' ? 'Média' :
                       selectedTicket.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.message}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {format(new Date(selectedTicket.createdAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <h3 className="font-bold text-gray-900">Respostas ({selectedTicket.replies.length})</h3>
                {selectedTicket.replies.map((reply) => (
                  <div
                    key={reply.id}
                    className={`p-4 rounded-lg ${
                      reply.isAdmin ? 'bg-primary-50 border-l-4 border-primary-500' : 'bg-gray-50 border-l-4 border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-semibold ${reply.isAdmin ? 'text-primary-700' : 'text-gray-700'}`}>
                        {reply.isAdmin ? '🔧 Administrador' : '👤 Você'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(reply.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{reply.message}</p>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Adicionar Resposta
                </label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none mb-3"
                  rows={4}
                  placeholder="Digite sua resposta..."
                />
                <button
                  onClick={() => handleReply(selectedTicket.id)}
                  disabled={loading || !replyMessage.trim()}
                  className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-lg font-bold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar Resposta'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

