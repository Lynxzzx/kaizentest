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
    <div className="relative min-h-screen bg-[#000000] text-white overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(circle,rgba(79,70,229,0.15)_0%,transparent_70%)] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-[radial-gradient(circle,rgba(236,72,153,0.1)_0%,transparent_70%)] blur-[100px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <span className="font-heading font-bold text-2xl tracking-tight">Kaizen<span className="text-indigo-500">Gens</span></span>
          </div>
          <div className="flex items-center gap-4">
            {!session && (
              <>
                <Link href="/login" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
                  {t('signIn')}
                </Link>
                <Link href="/register" className="text-sm font-bold bg-white text-black px-6 py-2.5 rounded-full hover:bg-gray-200 transition-all hover:scale-105 active:scale-95">
                  {t('signUp')}
                </Link>
              </>
            )}
            {session && (
              <Link href="/dashboard" className="text-sm font-bold bg-indigo-600 text-white px-6 py-2.5 rounded-full hover:bg-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-500/25">
                {t('dashboard')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in hover:bg-indigo-500/20 transition-colors cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            {t('heroBadge')}
          </div>

          <h1 className="text-6xl sm:text-8xl font-heading font-black tracking-tight mb-8 leading-[1.1] drop-shadow-2xl">
            <span className="block">{t('heroSubtitle')}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">
              {t('heroDescription')}
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-xl text-gray-400 mb-12 leading-relaxed font-light">
            {t('heroTrustedBy')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">
            <Link
              href={session ? '/dashboard' : '/register'}
              className="group relative w-full sm:w-auto px-10 py-5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg hover:shadow-[0_0_40px_rgba(79,70,229,0.4)] transition-all hover:-translate-y-1"
            >
              <span className="relative z-10 flex items-center gap-2">
                {session ? t('dashboard') : t('startNow')}
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </span>
            </Link>
            <Link
              href="/plans"
              className="w-full sm:w-auto px-10 py-5 rounded-full glass-panel hover:bg-white/10 transition-all font-bold text-lg border border-white/10 hover:border-white/20"
            >
              {t('viewPlans')}
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {stats.map((stat, i) => (
              <div key={i} className="glass-card p-8 rounded-3xl text-center hover:bg-white/5 transition-colors group">
                <div className="text-4xl sm:text-5xl font-heading font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">{stat.value}</div>
                <div className="text-xs sm:text-sm text-gray-500 font-bold uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="glass-card p-10 rounded-[2rem] group hover:border-indigo-500/30 transition-all duration-500">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-3xl mb-8 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300 shadow-lg shadow-indigo-500/5">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-heading font-bold mb-4 text-gray-100 group-hover:text-indigo-300 transition-colors">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-900/5 skew-y-3 transform origin-bottom-left" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">{t('workflowDesc')}</h2>
            <div className="h-1.5 w-24 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full" />
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((step, i) => (
              <div key={i} className="relative group">
                <div className="glass-panel p-10 rounded-[2.5rem] h-full border-t border-white/10 hover:-translate-y-2 transition-transform duration-300">
                  <span className="text-8xl font-heading font-black text-white/5 absolute -top-6 -right-6 select-none group-hover:text-indigo-500/10 transition-colors">
                    {step.number}
                  </span>
                  <h4 className="text-2xl font-bold mb-4 text-indigo-300">{step.title}</h4>
                  <p className="text-gray-400 text-lg">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto glass-card rounded-[3rem] p-16 text-center relative overflow-hidden border border-white/10 shadow-2xl shadow-indigo-500/10">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent" />
          <div className="relative z-10">
            <h2 className="text-5xl md:text-6xl font-heading font-bold mb-8 tracking-tight">{t('readyToStart')}</h2>
            <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">{t('readyToStartDesc')}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Link href="/register" className="px-10 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-gray-100 transition-all hover:scale-105 shadow-xl shadow-white/10">
                {t('createFreeAccount')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Popup Notifications */}
      {currentPopup && (
        <div className={`fixed bottom-8 left-8 z-50 transition-all duration-500 transform ${popupVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="glass-panel pl-3 pr-6 py-3 rounded-full flex items-center gap-4 shadow-2xl hover:bg-black/80 transition-colors border border-white/10">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xl shadow-lg animate-pulse-slow">
              {currentPopup.emoji}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                <span className="font-bold text-indigo-300">{currentPopup.name}</span> {t('popupUserActivated')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t(currentPopup.planKey)} • <span className="text-emerald-400 font-bold">{currentPopup.price}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Minimal */}
      <footer className="py-12 text-center text-gray-600 text-sm border-t border-white/5 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-50 hover:opacity-100 transition-opacity">
          <Logo size="sm" showText={false} />
          <span className="font-heading font-bold">Kaizen Gens</span>
        </div>
        <p>&copy; {new Date().getFullYear()} Kaizen Gens. All rights reserved.</p>
      </footer>
    </div>
  )
}
