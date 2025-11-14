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
  ]), [])

  const [currentPopup, setCurrentPopup] = useState<PlanPopup>(planPopups[0])
  const [popupVisible, setPopupVisible] = useState(true)
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    axios.get('/api/feedback')
      .then(response => setFeedbacks(response.data.slice(0, 3)))
      .catch(() => {})
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
    <div className="relative min-h-screen bg-[#01020f] text-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-20 w-[520px] h-[520px] bg-gradient-to-br from-indigo-600/30 via-purple-600/20 to-cyan-400/30 blur-[180px] animate-blob" />
        <div className="absolute -bottom-24 -left-16 w-[480px] h-[480px] bg-gradient-to-br from-cyan-400/25 via-sky-500/15 to-transparent blur-[200px] animate-blob animation-delay-2000" />
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_1px_1px,_rgba(148,163,184,.35),transparent_40px)]" />
      </div>

      <section className="relative z-10 pt-28 pb-16 sm:pt-32 lg:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid gap-12 lg:grid-cols-[1.15fr_0.85fr] items-center">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Logo size="sm" showText={false} className="justify-start" />
              <span className="text-xs uppercase tracking-[0.4em] text-white/60">{t('siteName')}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {t('heroBadge')}
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
              {t('heroSubtitle')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-500 to-cyan-300">
                {t('heroDescription')}
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl">
              {t('heroTrustedBy')}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href={session ? '/dashboard' : '/register'}
                className="group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 px-8 py-4 text-base font-semibold shadow-[0_15px_35px_rgba(59,130,246,0.45)] transition-transform hover:-translate-y-1 hover:scale-[1.01]"
              >
                <span>{session ? '🚀' : '✨'}</span>
                <span>{session ? t('dashboard') : t('startNow')}</span>
                <span className="absolute inset-0 rounded-2xl border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <Link
                href="/plans"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-8 py-4 text-base font-semibold text-white/80 hover:bg-white/5 transition-colors"
              >
                <span>💎</span>
                <span>{t('viewPlans')}</span>
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-lg p-4">
                  <p className="text-2xl sm:text-3xl font-black text-white">{stat.value}</p>
                  <p className="text-xs uppercase tracking-wide text-white/60">{stat.label}</p>
                  <p className="text-[11px] text-white/40 mt-1">{stat.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-indigo-500/20 via-transparent to-cyan-500/20 blur-3xl" />
            <div className="relative rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_30px_80px_rgba(2,8,23,0.8)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.5em] text-white/60">{t('liveMonitorTitle')}</p>
                  <p className="text-lg font-semibold text-white/90">{t('liveMonitorDesc')}</p>
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300">
                  {t('active')}
                </span>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-4">
                {liveHighlights.map((highlight) => (
                  <div key={highlight.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-2xl font-black text-white">{highlight.value}</p>
                    <p className="text-xs text-white/60">{highlight.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-white/80">{t('autoActivation')}</p>
                    <p className="text-xs text-white/40">{t('autoActivationText')}</p>
                  </div>
                  <span className="text-emerald-400 text-xs font-semibold">{t('active')}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-white/80">{t('paymentConfirmed')}</p>
                    <p className="text-xs text-white/40">{t('checkingPayment')}</p>
                  </div>
                  <span className="text-xs text-white/50">+R$ 129,90</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-white/80">{t('availableServices')}</p>
                    <p className="text-xs text-white/40">{t('accessAllServices')}</p>
                  </div>
                  <span className="text-xs text-white/50">58</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-white/40">{t('partnersTitle')}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-semibold uppercase tracking-[0.5em] text-white/35">
            {partners.map((partner) => (
              <span key={partner}>{partner}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-16 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-300">
                {t('whyChooseUs')}
              </span>
            </h2>
            <p className="mt-4 text-lg text-white/70 max-w-3xl mx-auto">
              {t('whyChooseUsDesc')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="group relative rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8 transition-transform hover:-translate-y-1 hover:border-white/30">
                <div className="absolute inset-0 rounded-[28px] opacity-0 group-hover:opacity-100 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/10 transition-opacity" />
                <div className="relative z-10">
                  <div className="text-4xl sm:text-5xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm text-white/60 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-16 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-2xl p-8 sm:p-12 shadow-[0_30px_80px_rgba(2,8,23,0.65)]">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.6em] text-white/50">{t('workflowTitle')}</p>
            <h3 className="mt-4 text-3xl font-extrabold text-white">{t('workflowDesc')}</h3>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <span className="text-xs font-black uppercase tracking-[0.6em] text-white/50">{step.number}</span>
                <h4 className="mt-4 text-xl font-semibold text-white">{step.title}</h4>
                <p className="mt-3 text-sm text-white/60">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {feedbacks.length > 0 && (
        <section className="relative z-10 py-16 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs uppercase tracking-[0.6em] text-white/50">{t('whatClientsSay')}</p>
              <h3 className="mt-4 text-3xl font-extrabold">{t('whatClientsSayDesc')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {feedbacks.map((feedback) => (
                <div key={feedback.id} className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                  {feedback.rating && (
                    <div className="flex items-center gap-1 text-yellow-400 text-lg mb-4">
                      {[...Array(5)].map((_, i) => (
                        <span key={i}>{i < feedback.rating! ? '★' : '☆'}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-white/70 italic mb-4">
                    “{translatedFeedbacks[feedback.id] || feedback.message}”
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center font-semibold">
                      {feedback.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{feedback.name}</p>
                      {feedback.user && <p className="text-xs text-white/50">@{feedback.user.username}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                href="/feedback"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/5"
              >
                {t('viewAllFeedbacks')} →
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="relative z-10 py-16 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto rounded-[36px] border border-white/10 bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 p-10 text-center shadow-[0_30px_80px_rgba(62,3,83,0.45)]">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">{t('readyToStart')}</h2>
          <p className="mt-4 text-lg text-white/80">{t('readyToStartDesc')}</p>
          {!session && (
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/plans"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-base font-semibold text-purple-600 shadow-lg"
              >
                💎 {t('viewPlans')}
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/30 px-6 py-3 text-base font-semibold text-white hover:bg-white/10"
              >
                ✨ {t('createFreeAccount')}
              </Link>
            </div>
          )}
        </div>
      </section>

      {currentPopup && (
        <div className={`fixed bottom-6 left-6 z-30 transition-all duration-300 ${popupVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl px-5 py-4 shadow-[0_20px_45px_rgba(2,8,23,0.6)] max-w-xs">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <span>{currentPopup.emoji}</span>
              <span>{currentPopup.name} {t('popupUserActivated')} {t(currentPopup.planKey)}</span>
            </p>
            <p className="text-xs text-white/60 mt-1">{currentPopup.price} • {t('popupJustNow')}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          33% { transform: translate3d(30px, -50px, 0) scale(1.1); }
          66% { transform: translate3d(-20px, 20px, 0) scale(0.9); }
        }
        .animate-blob {
          animation: blob 10s ease-in-out infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  )
}
