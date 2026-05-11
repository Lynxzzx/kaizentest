import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n-helper'
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
  user: { username: string; profilePicture: string | null } | null
}

export default function FeedbackPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ name: '', message: '', rating: 5 })

  useEffect(() => {
    loadFeedbacks()
    if (session?.user?.username) setFormData(p => ({ ...p, name: session.user.username || '' }))
  }, [session])

  const loadFeedbacks = async () => {
    try { setLoading(true); const r = await axios.get('/api/feedback'); setFeedbacks(r.data) }
    catch { toast.error(t('errorLoadingFeedbacks')) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.message.trim()) { toast.error(t('pleaseFillAllFields')); return }
    if (formData.message.length < 10) { toast.error(t('messageMinLength')); return }
    try {
      setSubmitting(true)
      await axios.post('/api/feedback', { name: formData.name.trim(), message: formData.message.trim(), rating: formData.rating })
      toast.success(t('feedbackSentSuccess'))
      setFormData({ name: session?.user?.username || '', message: '', rating: 5 })
      setTimeout(loadFeedbacks, 1000)
    } catch (error: any) { toast.error(error.response?.data?.error || t('errorSendingFeedback')) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-aurora-magenta/10 blur-[140px]" />
        <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-aurora-cyan/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-12 text-center animate-fade-up">
          <p className="eyebrow">Comunidade</p>
          <h1 className="mt-2 text-display text-5xl sm:text-6xl font-bold">
            <span className="text-gradient">Compartilhe sua </span>
            <span className="text-gradient-aurora">experiência</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/55">{t('shareYourExperience')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1 animate-fade-up delay-100">
            <div className="surface-card-elevated p-7 sticky top-20">
              <h2 className="text-display text-2xl font-bold text-white mb-5">{t('sendFeedback')}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('nameOrUsername')}</label>
                  <input
                    type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-premium" placeholder={t('yourName')} required disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('ratingOptional')}</label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button key={r} type="button" onClick={() => setFormData({ ...formData, rating: r })} disabled={submitting}
                        className={`text-2xl transition-all hover:scale-110 ${formData.rating >= r ? 'text-aurora-gold' : 'text-white/15'}`}>
                        ★
                      </button>
                    ))}
                    <span className="ml-2 text-xs text-white/45">({formData.rating}/5)</span>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('message')}</label>
                  <textarea
                    value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={6} className="input-premium resize-none" placeholder={t('shareExperiencePlaceholder')}
                    required disabled={submitting} maxLength={1000}
                  />
                  <p className="mt-1.5 text-[11px] text-white/40">{formData.message.length}/1000 {t('charactersCount')}</p>
                </div>
                <button type="submit" disabled={submitting || formData.message.length < 10} className="btn btn-primary w-full">
                  {submitting ? t('sending') : t('sendFeedbackButton')}
                </button>
                <p className="text-center text-[11px] text-white/40">{t('feedbackWillBeReviewed')}</p>
              </form>
            </div>
          </div>

          {/* List */}
          <div className="lg:col-span-2 animate-fade-up delay-200">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-display text-2xl font-bold text-white">{t('approvedFeedbacks')}</h2>
              <span className="pill pill-violet">{feedbacks.length} reviews</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <svg className="h-8 w-8 animate-spin text-aurora-violet" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3"/></svg>
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="surface-card p-12 text-center">
                <div className="text-5xl mb-3">💬</div>
                <p className="text-display text-xl font-bold text-white">{t('noFeedbackYet')}</p>
                <p className="mt-1 text-sm text-white/55">{t('beFirstToShare')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbacks.map((f) => (
                  <article key={f.id} className="surface-card p-5 sm:p-6 transition-all hover:-translate-y-0.5">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0">
                        {f.user?.profilePicture ? (
                          <img src={f.user.profilePicture} alt={f.name} className="h-11 w-11 rounded-full ring-1 ring-white/10" />
                        ) : (
                          <span className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full">
                            <span className="absolute inset-0 bg-gradient-to-br from-aurora-violet via-aurora-magenta to-aurora-cyan" />
                            <span className="absolute inset-[1.5px] rounded-full bg-[#0a0a13]" />
                            <span className="relative text-sm font-bold text-white">{f.name.charAt(0).toUpperCase()}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white">{f.name}</h3>
                          {f.user && <span className="pill pill-cyan">@{f.user.username}</span>}
                        </div>
                        {f.rating && (
                          <div className="mt-1 flex items-center gap-0.5 text-aurora-gold">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <svg key={i} viewBox="0 0 20 20" fill={i < (f.rating ?? 0) ? 'currentColor' : 'rgba(255,255,255,0.12)'} className="h-3.5 w-3.5">
                                <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.9L10 14.9 4.8 17.7l1-5.9L1.5 7.7l5.9-.9L10 1.5z" />
                              </svg>
                            ))}
                          </div>
                        )}
                        <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed text-white/75">{f.message}</p>
                        <p className="mt-3 text-[11px] text-white/35">
                          {format(new Date(f.createdAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
