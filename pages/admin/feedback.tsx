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

interface Feedback {
  id: string
  userId: string | null
  name: string
  message: string
  rating: number | null
  isApproved: boolean
  approvedById: string | null
  approvedAt: string | null
  createdAt: string
  user: {
    id: string
    username: string
    email: string | null
  } | null
  approvedBy: {
    id: string
    username: string
  } | null
}

export default function AdminFeedback() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all')
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'OWNER') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      loadFeedbacks()
    }
  }, [session, filter])

  const loadFeedbacks = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/admin/feedback?status=${filter}`)
      setFeedbacks(response.data)
    } catch (error) {
      toast.error('Erro ao carregar feedbacks')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await axios.put(`/api/admin/feedback/${id}`, { action: 'approve' })
      toast.success('Feedback aprovado com sucesso!')
      loadFeedbacks()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao aprovar feedback')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await axios.put(`/api/admin/feedback/${id}`, { action: 'reject' })
      toast.success('Feedback rejeitado')
      loadFeedbacks()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao rejeitar feedback')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este feedback?')) {
      return
    }

    try {
      await axios.delete(`/api/admin/feedback/${id}`)
      toast.success('Feedback deletado com sucesso!')
      loadFeedbacks()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao deletar feedback')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className={`min-h-screen ${themeClasses.loading} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${themeClasses.text.secondary}`}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  const approvedCount = feedbacks.filter(f => f.isApproved).length
  const pendingCount = feedbacks.filter(f => !f.isApproved).length

  return (
    <div className={`min-h-screen ${themeClasses.bg}`}>
      {/* Header */}
      <div className={`${theme === 'dark' ? 'bg-white/10 backdrop-blur-lg border-b border-white/20' : 'bg-white shadow-sm border-b border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>Gerenciar Feedbacks</h1>
              <p className={`mt-1 text-sm ${themeClasses.text.muted}`}>Aprove ou rejeite feedbacks dos usuários</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadFeedbacks}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`${themeClasses.card} rounded-xl shadow-md p-6 border-l-4 border-blue-500`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium mb-1 ${themeClasses.text.secondary}`}>Total</p>
                <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>{feedbacks.length}</p>
              </div>
              <div className="text-3xl">💬</div>
            </div>
          </div>
          <div className={`${themeClasses.card} rounded-xl shadow-md p-6 border-l-4 border-green-500`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium mb-1 ${themeClasses.text.secondary}`}>Aprovados</p>
                <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>{approvedCount}</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </div>
          <div className={`${themeClasses.card} rounded-xl shadow-md p-6 border-l-4 border-yellow-500`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium mb-1 ${themeClasses.text.secondary}`}>Pendentes</p>
                <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>{pendingCount}</p>
              </div>
              <div className="text-3xl">⏳</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`${themeClasses.card} rounded-xl shadow-md p-6 mb-8`}>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  : theme === 'dark' ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'approved'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                  : theme === 'dark' ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Aprovados
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'pending'
                  ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white'
                  : theme === 'dark' ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pendentes
            </button>
          </div>
        </div>

        {/* Feedbacks List */}
        <div className="space-y-4">
          {feedbacks.length === 0 ? (
            <div className={`${themeClasses.card} rounded-xl shadow-md p-12 text-center`}>
              <div className="text-6xl mb-4">💬</div>
              <p className={`text-xl font-semibold ${themeClasses.text.primary} mb-2`}>Nenhum feedback encontrado</p>
              <p className={themeClasses.text.muted}>
                {filter === 'pending' ? 'Não há feedbacks pendentes de aprovação' : 
                 filter === 'approved' ? 'Não há feedbacks aprovados' : 
                 'Não há feedbacks cadastrados'}
              </p>
            </div>
          ) : (
            feedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className={`${themeClasses.card} rounded-xl shadow-md p-6 ${
                  feedback.isApproved ? 'border-l-4 border-green-500' : 'border-l-4 border-yellow-500'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-xl font-bold ${themeClasses.text.primary}`}>{feedback.name}</h3>
                      {feedback.user && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                        }`}>
                          @{feedback.user.username}
                        </span>
                      )}
                      {feedback.isApproved && (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                          ✅ Aprovado
                        </span>
                      )}
                      {!feedback.isApproved && (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                          ⏳ Pendente
                        </span>
                      )}
                    </div>
                    {feedback.rating && (
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < feedback.rating! ? 'text-yellow-400' : 'text-gray-300'}>
                            ⭐
                          </span>
                        ))}
                        <span className={`text-sm ml-2 ${themeClasses.text.muted}`}>({feedback.rating}/5)</span>
                      </div>
                    )}
                    <p className={`${themeClasses.text.secondary} mb-4 whitespace-pre-wrap`}>{feedback.message}</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className={themeClasses.text.muted}>
                        📅 {format(new Date(feedback.createdAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {feedback.approvedAt && feedback.approvedBy && (
                        <span className={themeClasses.text.muted}>
                          ✅ Aprovado por {feedback.approvedBy.username} em {format(new Date(feedback.approvedAt), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                  {!feedback.isApproved && (
                    <button
                      onClick={() => handleApprove(feedback.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      ✅ Aprovar
                    </button>
                  )}
                  {feedback.isApproved && (
                    <button
                      onClick={() => handleReject(feedback.id)}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                    >
                      ⏳ Rejeitar
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(feedback.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    🗑️ Deletar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


