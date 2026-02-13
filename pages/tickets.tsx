import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
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
  const { theme } = useTheme()
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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Mobile menu handlers
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

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
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar ticket')
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
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao enviar resposta')
    } finally {
      setLoading(false)
    }
  }

  const loadTicketDetails = async (ticketId: string) => {
    try {
      const response = await axios.get(`/api/tickets/${ticketId}`)
      setSelectedTicket(response.data)
      loadTickets() // Atualizar lista também
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao carregar detalhes do ticket')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
      case 'IN_PROGRESS':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
      case 'RESOLVED':
        return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
      case 'CLOSED':
        return 'bg-gradient-to-r from-gray-600 to-gray-700 text-white'
      default:
        return 'bg-gradient-to-r from-gray-600 to-gray-700 text-white'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
      case 'MEDIUM':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
      case 'HIGH':
        return 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
      case 'URGENT':
        return 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-gray-500">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-[#000000] text-gray-100 pb-20">
      {/* Advanced Background with Mouse Tracking - Reduced for Mobile */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute w-[600px] h-[400px] sm:w-[1200px] sm:h-[800px] bg-[radial-gradient(circle,rgba(79,70,229,0.15)_0%,transparent_70%)] blur-[100px] sm:blur-[150px] transition-all duration-1000 ease-out hidden sm:block"
          style={{
            transform: `translate(${(mousePosition.x - 600) * 0.02}px, ${(mousePosition.y - 400) * 0.02}px)`,
            left: `${mousePosition.x - 600}px`,
            top: `${mousePosition.y - 400}px`
          }}
        />
        <div 
          className="absolute w-[500px] h-[300px] sm:w-[1000px] sm:h-[600px] bg-[radial-gradient(circle,rgba(236,72,153,0.1)_0%,transparent_70%)] blur-[80px] sm:blur-[120px] transition-all duration-1000 ease-out hidden sm:block"
          style={{
            transform: `translate(${(mousePosition.x - 500) * -0.01}px, ${(mousePosition.y - 300) * -0.01}px)`,
            right: `${500 - mousePosition.x}px`,
            bottom: `${300 - mousePosition.y}px`
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] sm:w-[800px] sm:h-[800px] bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)] blur-[60px] sm:blur-[100px] transition-all duration-1000 ease-out hidden sm:block"
          style={{
            transform: `translate(${(mousePosition.x - 400) * 0.015}px, ${(mousePosition.y - 400) * 0.015}px)`,
            left: `${mousePosition.x * 0.1}px`,
            bottom: `${mousePosition.y * 0.1}px`
          }}
        />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-30 sm:opacity-100" />
        
        {/* Floating particles effect - Reduced for Mobile */}
        <div className="absolute inset-0 hidden sm:block">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/15 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Futuristic Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/20 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-lg sm:text-xl font-bold text-white relative">
                {session.user.username?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <h1 className="font-bold text-lg sm:text-xl text-white">Central de Suporte</h1>
              <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">Suporte Inteligente 24/7</p>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center gap-3">
            <Link href="/dashboard" className="group relative overflow-hidden px-6 py-2.5 rounded-full glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300">
              <span className="relative z-10">⚡ Dashboard</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="sm:hidden p-2 rounded-lg glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300"
          >
            <div className="w-6 h-6 flex flex-col justify-center items-center">
              <span className={`bg-white block transition-all duration-300 ease-out h-0.5 w-6 rounded-sm ${isMobileMenuOpen ? 'rotate-45 translate-y-1' : '-translate-y-0.5'}`}></span>
              <span className={`bg-white block transition-all duration-300 ease-out h-0.5 w-6 rounded-sm my-0.5 ${isMobileMenuOpen ? 'opacity-0' : 'opacity-100'}`}></span>
              <span className={`bg-white block transition-all duration-300 ease-out h-0.5 w-6 rounded-sm ${isMobileMenuOpen ? '-rotate-45 -translate-y-1' : 'translate-y-0.5'}`}></span>
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-xl border-b border-white/10">
            <div className="px-4 py-4 space-y-3">
              <Link 
                href="/dashboard" 
                className="block px-4 py-3 rounded-xl glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300 text-center"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                ⚡ Dashboard
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="relative z-10 pt-24 sm:pt-32 pb-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Hero Section */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-8 sm:mb-12 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-[100px] sm:blur-[150px]" />
            <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-[100px] sm:blur-[150px]" />
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  <span>🧠</span>
                  <span>IA + Humano</span>
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Central de Suporte
                </h1>
                <p className="text-base sm:text-xl text-gray-400 max-w-2xl mb-6 sm:mb-8">
                  Obtenha ajuda instantânea com nossa IA avançada ou solicite atendimento humano quando necessário.
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  <div className="glass-panel px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-indigo-200 border border-indigo-500/20 flex items-center gap-1 sm:gap-2">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-indigo-400 rounded-full animate-pulse"></span>
                    IA 24/7
                  </div>
                  <div className="glass-panel px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-emerald-200 border border-emerald-500/20 flex items-center gap-1 sm:gap-2">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full"></span>
                    Resposta em segundos
                  </div>
                  <div className="glass-panel px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-purple-200 border border-purple-500/20 flex items-center gap-1 sm:gap-2">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full"></span>
                    Humano sob demanda
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:gap-4 w-full sm:w-auto">
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="group relative overflow-hidden px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base sm:text-lg hover:shadow-xl sm:hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500"
                >
                  <span className="relative z-10">{showForm ? 'Cancelar' : '+ Novo Ticket'}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </button>
                <Link
                  href="https://t.me/lynxdevz"
                  target="_blank"
                  className="group relative overflow-hidden px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300 text-center"
                >
                  <span className="relative z-10">📱 Telegram</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Link>
              </div>
            </div>
          </div>

          {/* Create Ticket Form */}
          {showForm && (
            <div className="grid lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
              <div className="lg:col-span-2 glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/10">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">Criar Novo Ticket</h2>
                  <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-indigo-200 bg-indigo-500/10 border border-indigo-500/20">
                    Atendimento Inteligente
                  </span>
                </div>
                
                <form onSubmit={handleCreateTicket} className="space-y-6 sm:space-y-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-3 sm:mb-4 uppercase tracking-wider">
                      Assunto
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-base sm:text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      required
                      placeholder="Descreva brevemente o problema"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-3 sm:mb-4 uppercase tracking-wider">
                      Prioridade
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-base sm:text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none"
                    >
                      <option value="LOW">🟢 Baixa</option>
                      <option value="MEDIUM">🔵 Média</option>
                      <option value="HIGH">🟠 Alta</option>
                      <option value="URGENT">🔴 Urgente</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-3 sm:mb-4 uppercase tracking-wider">
                      Descrição Detalhada
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-base sm:text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      rows={6}
                      required
                      placeholder="Descreva seu problema em detalhes... Quanto mais informações, melhor a IA poderá ajudar!"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:shadow-xl sm:hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500 disabled:opacity-50"
                  >
                    {loading ? 'Criando Ticket...' : 'Criar Ticket de Suporte'}
                  </button>
                </form>
              </div>
              
              <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/10">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Como funciona</h3>
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-base sm:text-lg">
                      🤖
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 sm:mb-2 text-base sm:text-lg">IA Responde Primeiro</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">Nossa IA avançada analisa seu problema e fornece soluções instantâneas.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-base sm:text-lg">
                      ⚡
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 sm:mb-2 text-base sm:text-lg">Resposta em Segundos</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">Obtenha ajuda imediata, 24 horas por dia, 7 dias por semana.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-base sm:text-lg">
                      🧑‍💻
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 sm:mb-2 text-base sm:text-lg">Humano quando Precisar</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">Se a IA não resolver, um humano entrará em contato rapidamente.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 sm:mt-8 glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10">
                  <h4 className="font-bold text-white mb-2 sm:mb-3 text-base sm:text-lg">💡 Dicas para melhor atendimento</h4>
                  <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-400">
                    <li className="flex items-start gap-1 sm:gap-2">
                      <span className="text-indigo-400 mt-0.5 sm:mt-1">•</span>
                      Informe o serviço e horário do problema
                    </li>
                    <li className="flex items-start gap-1 sm:gap-2">
                      <span className="text-indigo-400 mt-0.5 sm:mt-1">•</span>
                      Cole o erro exato se aparecer
                    </li>
                    <li className="flex items-start gap-1 sm:gap-2">
                      <span className="text-indigo-400 mt-0.5 sm:mt-1">•</span>
                      Inclua screenshots quando possível
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Tickets Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="group glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-2 cursor-pointer"
                onClick={() => loadTicketDetails(ticket.id)}
              >
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3 group-hover:text-indigo-300 transition-colors">
                      {ticket.subject}
                    </h3>
                    <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-3">
                      {ticket.message}
                    </p>
                    <div className="flex items-center space-x-2 sm:space-x-4 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1 sm:gap-2">
                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-gray-500 rounded-full"></span>
                        {format(new Date(ticket.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {session.user.role === 'OWNER' && (
                        <span className="flex items-center gap-1 sm:gap-2">
                          <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-gray-500 rounded-full"></span>
                          Por: {ticket.user.username}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2 sm:space-y-3 ml-3">
                    <span className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold ${getStatusColor(ticket.status)}`}>
                      {ticket.status === 'OPEN' ? 'Aberto' : 
                       ticket.status === 'IN_PROGRESS' ? 'Em Andamento' :
                       ticket.status === 'RESOLVED' ? 'Resolvido' : 'Fechado'}
                    </span>
                    <span className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority === 'LOW' ? 'Baixa' :
                       ticket.priority === 'MEDIUM' ? 'Média' :
                       ticket.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                    </span>
                    <span className="text-xs text-gray-500 bg-white/10 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                      {ticket.replies?.length || ticket._count?.replies || 0} {ticket.replies?.length === 1 ? 'resposta' : 'respostas'}
                    </span>
                  </div>
                </div>
                
                <div className="pt-3 sm:pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-xs sm:text-sm">
                        {ticket.user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs sm:text-sm text-gray-400">{ticket.user.username}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 text-indigo-400">
                      <span className="text-xs sm:text-sm font-semibold">Ver Ticket</span>
                      <span className="group-hover:translate-x-0.5 sm:group-hover:translate-x-1 transition-transform text-xs sm:text-sm">→</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {tickets.length === 0 && !showForm && (
            <div className="glass-card rounded-2xl sm:rounded-3xl p-8 sm:p-16 text-center border border-white/10">
              <div className="text-5xl sm:text-7xl mb-6 sm:mb-8">📋</div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">Nenhum ticket encontrado</h3>
              <p className="text-gray-400 text-base sm:text-lg mb-6 sm:mb-8 max-w-md mx-auto">
                Você ainda não criou nenhum ticket. Clique no botão "Novo Ticket" para obter ajuda.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="group relative overflow-hidden px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base sm:text-lg hover:shadow-xl sm:hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500"
              >
                <span className="relative z-10">Criar Primeiro Ticket</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Enhanced Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setSelectedTicket(null)}>
          <div className="w-full max-w-5xl bg-[#0a0a0a] border border-white/20 rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-h-[95vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl sm:rounded-3xl" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6 sm:mb-8">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">{selectedTicket.subject}</h2>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <span className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold ${getStatusColor(selectedTicket.status)}`}>
                      {selectedTicket.status === 'OPEN' ? 'Aberto' : 
                       selectedTicket.status === 'IN_PROGRESS' ? 'Em Andamento' :
                       selectedTicket.status === 'RESOLVED' ? 'Resolvido' : 'Fechado'}
                    </span>
                    <span className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority === 'LOW' ? 'Baixa' :
                       selectedTicket.priority === 'MEDIUM' ? 'Média' :
                       selectedTicket.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-500">
                      {format(new Date(selectedTicket.createdAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-white text-2xl sm:text-3xl transition-colors ml-2"
                >
                  ×
                </button>
              </div>

              {/* Ticket Message */}
              <div className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-base sm:text-lg">
                    {selectedTicket.user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-white text-base sm:text-lg">{selectedTicket.user.username}</div>
                    <div className="text-xs sm:text-sm text-gray-500">Autor do ticket</div>
                  </div>
                </div>
                <p className="text-gray-300 text-sm sm:text-lg leading-relaxed">{selectedTicket.message}</p>
              </div>

              {/* Action Buttons */}
              {selectedTicket.user.username === session?.user.username && 
               selectedTicket.status !== 'CLOSED' && 
               selectedTicket.status !== 'RESOLVED' && (
                <div className="mb-6 sm:mb-8 flex flex-wrap gap-3 sm:gap-4">
                  <button
                    onClick={async () => {
                      try {
                        await axios.put(`/api/tickets/${selectedTicket.id}`, { status: 'RESOLVED' })
                        toast.success('Ticket marcado como resolvido!')
                        loadTicketDetails(selectedTicket.id)
                      } catch (error: any) {
                        toast.error('Erro ao atualizar ticket')
                      }
                    }}
                    className="group relative overflow-hidden px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-sm sm:text-base hover:shadow-lg hover:shadow-green-500/25 transition-all"
                  >
                    <span className="relative z-10">✓ Marcar como Resolvido</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await axios.put(`/api/tickets/${selectedTicket.id}`, { status: 'CLOSED' })
                        toast.success('Ticket fechado!')
                        loadTicketDetails(selectedTicket.id)
                      } catch (error: any) {
                        toast.error('Erro ao fechar ticket')
                      }
                    }}
                    className="group relative overflow-hidden px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold text-sm sm:text-base hover:shadow-lg hover:shadow-gray-500/25 transition-all"
                  >
                    <span className="relative z-10">✕ Fechar Ticket</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              )}

              {/* Human Support Options */}
              {selectedTicket.user.username === session?.user.username && (
                <div className="mb-6 sm:mb-8 glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10">
                  <h4 className="font-bold text-white mb-3 sm:mb-4 text-base sm:text-lg">Precisa de atendimento humano?</h4>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    <button
                      onClick={() => {
                        setReplyMessage('Solicito atendimento humano via site.')
                      }}
                      className="group relative overflow-hidden px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-sm sm:text-base hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                    >
                      <span className="relative z-10">🧑‍💻 Atendimento no site</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <Link
                      href="https://t.me/lynxdevz"
                      target="_blank"
                      className="group relative overflow-hidden px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold text-sm sm:text-base hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                    >
                      <span className="relative z-10">📱 Falar no Telegram</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Replies */}
              <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-2xl font-bold text-white">Conversa ({selectedTicket.replies.length})</h3>
                {selectedTicket.replies.map((reply) => (
                  <div
                    key={reply.id}
                    className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border ${
                      reply.isAdmin 
                        ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border-l-4 border-purple-500'
                        : 'bg-white/5 border-l-4 border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg ${
                          reply.isAdmin 
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                            : 'bg-gradient-to-r from-gray-600 to-gray-700'
                        }`}>
                          {reply.isAdmin ? (reply.message?.startsWith('🤖 IA:') ? '🤖' : '🔧') : '👤'}
                        </div>
                        <div>
                          <div className={`font-bold ${reply.isAdmin ? 'text-purple-300' : 'text-white'} text-base sm:text-lg`}>
                            {reply.isAdmin
                              ? (reply.message?.startsWith('🤖 IA:') ? 'Assistente IA' : 'Suporte Human')
                              : 'Você'}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500">
                            {format(new Date(reply.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className={`${reply.isAdmin ? 'text-gray-300' : 'text-gray-300'} text-sm sm:text-lg leading-relaxed`}>
                      {reply.message}
                    </p>
                  </div>
                ))}
              </div>

              {/* Reply Form */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3 sm:mb-4 uppercase tracking-wider">
                  Adicionar Resposta
                </label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white text-sm sm:text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all mb-4 sm:mb-6"
                  rows={4}
                  placeholder="Digite sua resposta..."
                />
                <button
                  onClick={() => handleReply(selectedTicket.id)}
                  disabled={loading || !replyMessage.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg hover:shadow-xl sm:hover:shadow-2xl hover:shadow-purple-500/50 transition-all disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar Resposta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .glass-card {
          background: rgba(25, 25, 25, 0.3);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .glass-panel {
          background: rgba(25, 25, 25, 0.2);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        @media (max-width: 640px) {
          .glass-card {
            backdrop-filter: blur(15px);
            background: rgba(25, 25, 25, 0.4);
          }
          
          .glass-panel {
            backdrop-filter: blur(8px);
            background: rgba(25, 25, 25, 0.3);
          }
        }
        
        /* Touch-friendly improvements */
        @media (hover: none) and (pointer: coarse) {
          .group:hover {
            transform: none !important;
          }
          
          button:active {
            transform: scale(0.98);
          }
        }
      `}</style>
    </div>
  )
}