import { useTranslation, useDynamicTranslation } from '@/lib/i18n-helper'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import Logo from '@/components/Logo'

interface Feedback {
  id: string
  name: string
  message: string
  rating: number | null
  createdAt: string
  user: {
    username: string
  } | null
}

type PlanPopup = {
  name: string
  planKey: 'planDaily' | 'planMonthly' | 'planLifetime'
  price: string
  emoji: string
}

export default function Home() {
  const { t, locale } = useTranslation()
  const { translate } = useDynamicTranslation()
  const { data: session } = useSession()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [translatedFeedbacks, setTranslatedFeedbacks] = useState<Record<string, string>>({})

  const stats = [
    { value: '25k+', label: t('metricsUsers'), desc: t('metricsUsersDesc') },
    { value: '480k+', label: t('metricsAccounts'), desc: t('metricsAccountsDesc') },
    { value: '99,98%', label: t('metricsUptime'), desc: t('metricsUptimeDesc') },
    { value: '<5min', label: t('metricsSupport'), desc: t('metricsSupportDesc') }
  ]

  const partners = ['Netflix', 'Spotify', 'Disney+', 'HBO Max', 'Paramount+', 'Crunchyroll']

  const features = [
    { icon: '⚡', title: t('fastInstant'), desc: t('fastInstantDesc') },
    { icon: '🔒', title: t('secure100'), desc: t('secure100Desc') },
    { icon: '🎯', title: t('multipleServices'), desc: t('multipleServicesDesc') },
    { icon: '💎', title: t('premiumQuality'), desc: t('premiumQualityDesc') },
    { icon: '🛰️', title: t('support247'), desc: t('support247Desc') },
    { icon: '🎁', title: t('freePlan'), desc: t('freePlanDesc') }
  ]

  const liveHighlights = [
    { value: '18ms', label: t('metricsLatency') },
    { value: '32+', label: t('metricsCountries') },
    { value: '4.9k', label: t('availableStocks') }
  ]

  const steps = [
    { number: '01', title: t('workflowStep1Title'), desc: t('workflowStep1Desc') },
    { number: '02', title: t('workflowStep2Title'), desc: t('workflowStep2Desc') },
    { number: '03', title: t('workflowStep3Title'), desc: t('workflowStep3Desc') }
  ]

  const planPopups = useMemo<PlanPopup[]>(() => ([
    { name: 'Luan', planKey: 'planMonthly', price: 'R$ 12,50', emoji: '🔥' },
    { name: 'Priscila', planKey: 'planDaily', price: 'R$ 5,00', emoji: '⚡' },
    { name: 'Yuri', planKey: 'planLifetime', price: 'R$ 20,00', emoji: '🎯' },
    { name: 'Camila', planKey: 'planMonthly', price: 'R$ 12,50', emoji: '🚀' },
    { name: 'Rafael', planKey: 'planDaily', price: 'R$ 5,00', emoji: '💥' },
    { name: 'Ana', planKey: 'planLifetime', price: 'R$ 20,00', emoji: '💎' }
  ]), [locale])

  const [currentPopup, setCurrentPopup] = useState<PlanPopup>(planPopups[0])
  const [popupVisible, setPopupVisible] = useState(true)
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    axios.get('/api/feedback')
      .then(response => setFeedbacks(response.data.slice(0, 3)))
      .catch(() => { })
  }, [])

  useEffect(() => {
    if (feedbacks.length > 0 && locale === 'en') {
      const translateFeedbacks = async () => {
        const translations: Record<string, string> = {}
        for (const feedback of feedbacks) {
          if (feedback.message) {
            try {
              const translated = await translate(feedback.message)
              translations[feedback.id] = translated
            } catch (error) {
              translations[feedback.id] = feedback.message
            }
          }
        }
        if (Object.keys(translations).length > 0) {
          setTranslatedFeedbacks(translations)
        }
      }
      translateFeedbacks()
    } else if (locale !== 'en') {
      setTranslatedFeedbacks({})
    }
  }, [feedbacks, translate, locale])

  useEffect(() => {
    const interval = setInterval(() => {
      setPopupVisible(false)
      popupTimeoutRef.current = setTimeout(() => {
        const next = planPopups[Math.floor(Math.random() * planPopups.length)]
        setCurrentPopup(next)
        setPopupVisible(true)
      }, 250)
    }, 6000)

    return () => {
      clearInterval(interval)
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current)
      }
    }
  }, [planPopups])

  return (
    <div className="relative min-h-screen bg-[#000000] text-white overflow-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(circle,rgba(79,70,229,0.15)_0%,transparent_70%)] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-[radial-gradient(circle,rgba(236,72,153,0.1)_0%,transparent_70%)] blur-[100px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size="sm" showText={false} />
            <span className="font-bold text-lg tracking-tight">Kaizen<span className="text-indigo-500">Gens</span></span>
          </div>
          <div className="flex items-center gap-4">
            {!session && (
              <>
                <Link href="/login" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
                  {t('signIn')}
                </Link>
                <Link href="/register" className="text-sm font-medium bg-white text-black px-4 py-2 rounded-full hover:bg-gray-200 transition-colors">
                  {t('signUp')}
                </Link>
              </>
            )}
            {session && (
              <Link href="/dashboard" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors">
                {t('dashboard')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            {locale === 'pt-BR' ? 'MAIOR gerador de contas do PLANETA' : t('heroBadge')}
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
            <span className="block">
              {locale === 'pt-BR' ? 'Somos o MAIOR gerador de contas do planeta' : t('heroSubtitle')}
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              {locale === 'pt-BR' ? 'Atividade constante. Super ativo. Sem enrolação.' : t('heroDescription')}
            </span>
          </h1>

          <div className="max-w-3xl mx-auto mb-12">
            <p className="text-lg text-gray-400 leading-relaxed">
              {locale === 'pt-BR' ? 'Operação 24/7 em escala global. Centenas de milhares de credenciais geradas com qualidade premium.' : t('heroTrustedBy')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link
              href={session ? '/dashboard' : '/register'}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(79,70,229,0.5)]"
            >
              {session ? t('dashboard') : t('startNow')}
            </Link>
            <Link
              href="/plans"
              className="w-full sm:w-auto px-8 py-4 rounded-full glass-panel hover:bg-white/5 transition-colors font-medium"
            >
              {t('viewPlans')}
            </Link>
          </div>

          <div className="max-w-6xl mx-auto mb-20">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 items-center opacity-80">
              {partners.map((p, i) => (
                <div key={i} className="px-4 py-2 rounded-lg glass-panel border border-white/10 text-xs sm:text-sm text-gray-300 text-center hover:bg-white/5 transition-colors">
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {stats.map((stat, i) => (
              <div key={i} className="glass-card p-8 rounded-3xl text-center border border-white/10 hover:border-indigo-500/30 transition-all hover:-translate-y-1">
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-indigo-300 font-semibold">{stat.label}</div>
                <p className="text-gray-400 text-sm mt-2">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="glass-card p-8 rounded-3xl group">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-100">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
              <p className="text-sm text-indigo-300 mb-2">Diferencial</p>
              <h4 className="text-2xl font-bold text-white mb-2">Atividade constante</h4>
              <p className="text-gray-300">Infra confiável e filas otimizadas para gerar credenciais em ritmo de produção, o dia todo.</p>
            </div>
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
              <p className="text-sm text-emerald-300 mb-2">Escala</p>
              <h4 className="text-2xl font-bold text-white mb-2">Operação global</h4>
              <p className="text-gray-300">Latência baixa e disponibilidade alta, atendendo usuários em dezenas de países.</p>
            </div>
            <div className="p-6 rounded-3xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30">
              <p className="text-sm text-pink-300 mb-2">Qualidade</p>
              <h4 className="text-2xl font-bold text-white mb-2">UX premium</h4>
              <p className="text-gray-300">Experiência refinada com design moderno, animações sutis e foco em conversão.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-900/10 skew-y-3 transform origin-bottom-left" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{t('workflowDesc')}</h2>
            <div className="h-1 w-20 bg-indigo-500 mx-auto rounded-full" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="glass-panel p-8 rounded-3xl h-full border-t border-white/10">
                  <span className="text-6xl font-bold text-white/5 absolute top-4 right-4 select-none">
                    {step.number}
                  </span>
                  <h4 className="text-xl font-semibold mb-4 text-indigo-300">{step.title}</h4>
                  <p className="text-gray-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto glass-card rounded-[3rem] p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
          <div className="relative z-10">
            <h2 className="text-5xl font-bold mb-6">{locale === 'pt-BR' ? 'Pronto para gerar em nível planetário?' : t('readyToStart')}</h2>
            <p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto">{t('readyToStartDesc')}</p>
            <div className="flex justify-center gap-4">
              <Link href="/register" className="px-8 py-3 bg-white text-black rounded-full font-semibold hover:bg-gray-100 transition-colors">
                {t('createFreeAccount')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Popup Notifications */}
      {currentPopup && (
        <div className={`fixed bottom-8 left-8 z-50 transition-all duration-500 transform ${popupVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="glass-panel pl-3 pr-6 py-3 rounded-full flex items-center gap-4 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-lg shadow-lg">
              {currentPopup.emoji}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                <span className="font-bold text-indigo-300">{currentPopup.name}</span> {t('popupUserActivated')}
              </p>
              <p className="text-xs text-gray-400">
                {t(currentPopup.planKey)} • <span className="text-emerald-400">{currentPopup.price}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Minimal */}
      <footer className="py-8 text-center text-gray-600 text-sm border-t border-white/5">
        <p>&copy; {new Date().getFullYear()} Kaizen Gens. All rights reserved.</p>
      </footer>

      <style jsx>{`
        .glass-panel {
          background: rgba(25, 25, 25, 0.4);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </div>
  )
}
