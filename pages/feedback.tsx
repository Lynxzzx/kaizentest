import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface Feedback {
  id: string
  name: string
  message: string
  rating: number | null
  createdAt: string
  user: {
    username: string
    profilePicture: string | null
  } | null
}

export default function FeedbackPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    rating: 5
  })

  useEffect(() => {
    loadFeedbacks()
    // Se o usuário está logado, preencher o nome automaticamente
    if (session?.user?.username) {
      setFormData(prev => ({ ...prev, name: session.user.username || '' }))
    }
  }, [session])

  const loadFeedbacks = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/feedback')
      setFeedbacks(response.data)
    } catch (error) {
      toast.error('Erro ao carregar feedbacks')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios')
      return
    }

    if (formData.message.length < 10) {
      toast.error('A mensagem deve ter pelo menos 10 caracteres')
      return
    }

    try {
      setSubmitting(true)
      await axios.post('/api/feedback', {
        name: formData.name.trim(),
        message: formData.message.trim(),
        rating: formData.rating
      })
      
      toast.success('Feedback enviado com sucesso! Aguarde aprovação do administrador.')
      setFormData({
        name: session?.user?.username || '',
        message: '',
        rating: 5
      })
      // Recarregar feedbacks após um pequeno delay
      setTimeout(() => {
        loadFeedbacks()
      }, 1000)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao enviar feedback')
    } finally {
      setSubmitting(false)
    }
  }

  const getCardClasses = () => {
    switch (theme) {
      case 'dark':
        return 'bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/20'
      case 'light':
        return 'bg-white rounded-xl shadow-xl p-6 border border-gray-200'
      case 'default':
        return 'bg-white rounded-xl shadow-xl p-6 border border-gray-200'
      default:
        return 'bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/20'
    }
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg} py-8 sm:py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className={`text-4xl sm:text-5xl font-extrabold mb-4 ${themeClasses.text.primary}`}>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
              Feedbacks
            </span>
          </h1>
          <p className={`text-lg sm:text-xl ${themeClasses.text.secondary} max-w-2xl mx-auto`}>
            Compartilhe sua experiência conosco! Seu feedback ajuda a melhorar nossos serviços.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-1">
            <div className={getCardClasses()}>
              <h2 className={`text-2xl font-bold mb-6 ${themeClasses.text.primary}`}>
                Enviar Feedback
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.text.primary}`}>
                    Nome {session && <span className="text-xs text-gray-500">(ou use seu username)</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-white/10 border-white/20 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                    placeholder="Seu nome"
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.text.primary}`}>
                    Avaliação (opcional)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating })}
                        className={`text-3xl transition-transform hover:scale-110 ${
                          formData.rating >= rating ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                        disabled={submitting}
                      >
                        ⭐
                      </button>
                    ))}
                    <span className={`text-sm ml-2 ${themeClasses.text.muted}`}>
                      ({formData.rating}/5)
                    </span>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.text.primary}`}>
                    Mensagem *
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={6}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-white/10 border-white/20 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none`}
                    placeholder="Compartilhe sua experiência, sugestões ou elogios..."
                    required
                    disabled={submitting}
                  />
                  <p className={`text-xs mt-1 ${themeClasses.text.muted}`}>
                    {formData.message.length}/1000 caracteres (mínimo 10)
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={submitting || formData.message.length < 10}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Enviando...' : 'Enviar Feedback'}
                </button>
                <p className={`text-xs text-center ${themeClasses.text.muted}`}>
                  ⚠️ Seu feedback será revisado antes de ser publicado
                </p>
              </form>
            </div>
          </div>

          {/* Feedbacks List */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <h2 className={`text-2xl font-bold ${themeClasses.text.primary}`}>
                Feedbacks Aprovados ({feedbacks.length})
              </h2>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className={`inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-primary-600'}`}></div>
              </div>
            ) : feedbacks.length === 0 ? (
              <div className={`${getCardClasses()} text-center py-12`}>
                <div className="text-6xl mb-4">💬</div>
                <p className={`text-xl font-semibold ${themeClasses.text.primary} mb-2`}>
                  Nenhum feedback ainda
                </p>
                <p className={themeClasses.text.muted}>
                  Seja o primeiro a compartilhar sua experiência!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map((feedback) => (
                  <div key={feedback.id} className={getCardClasses()}>
                    <div className="flex items-start gap-4 mb-4">
                      <div className="flex-shrink-0">
                        {feedback.user?.profilePicture ? (
                          <img
                            src={feedback.user.profilePicture}
                            alt={feedback.name}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                            {feedback.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className={`text-lg font-bold ${themeClasses.text.primary}`}>
                            {feedback.name}
                          </h3>
                          {feedback.user && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                            }`}>
                              @{feedback.user.username}
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
                          </div>
                        )}
                        <p className={`${themeClasses.text.secondary} whitespace-pre-wrap mb-3`}>
                          {feedback.message}
                        </p>
                        <p className={`text-xs ${themeClasses.text.muted}`}>
                          {format(new Date(feedback.createdAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

