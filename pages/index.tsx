import { useTranslation, useDynamicTranslation } from '@/lib/i18n-helper'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'

interface Feedback {
  id: string
  name: string
  message: string
  rating: number | null
  createdAt: string
  user: { username: string } | null
}

type PlanPopup = {
  name: string
  planKey: 'planDaily' | 'planMonthly' | 'planLifetime'
  price: string
  emoji: string
}

const PARTNERS = ['Netflix', 'Spotify', 'Disney+', 'HBO Max', 'Paramount+', 'Crunchyroll', 'Prime Video', 'Apple TV+', 'YouTube Premium', 'Deezer', 'Tidal', 'Adobe CC']

export default function Home() {
  const { t, locale } = useTranslation()
  const { translate } = useDynamicTranslation()
  const { data: session } = useSession()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [translatedFeedbacks, setTranslatedFeedbacks] = useState<Record<string, string>>({})
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  const stats = [
    { value: '25K+',   label: t('metricsUsers'),    desc: t('metricsUsersDesc') },
    { value: '480K+',  label: t('metricsAccounts'), desc: t('metricsAccountsDesc') },
    { value: '99.98%', label: t('metricsUptime'),   desc: t('metricsUptimeDesc') },
    { value: '<5min',  label: t('metricsSupport'),  desc: t('metricsSupportDesc') }
  ]

  const features = [
    { icon: '⚡', title: t('fastInstant'),        desc: t('fastInstantDesc'),       accent: 'from-amber-400/30 to-rose-500/20',   border: 'border-amber-400/30' },
    { icon: '🔒', title: t('secure100'),          desc: t('secure100Desc'),         accent: 'from-emerald-400/30 to-teal-500/20', border: 'border-emerald-400/30' },
    { icon: '🎯', title: t('multipleServices'),   desc: t('multipleServicesDesc'),  accent: 'from-cyan-400/30 to-blue-500/20',    border: 'border-cyan-400/30' },
    { icon: '💎', title: t('premiumQuality'),     desc: t('premiumQualityDesc'),    accent: 'from-fuchsia-400/30 to-violet-500/20', border: 'border-fuchsia-400/30' },
    { icon: '🛰️', title: t('support247'),         desc: t('support247Desc'),        accent: 'from-indigo-400/30 to-purple-500/20', border: 'border-indigo-400/30' },
    { icon: '🎁', title: t('freePlan'),           desc: t('freePlanDesc'),          accent: 'from-pink-400/30 to-rose-500/20',     border: 'border-pink-400/30' }
  ]

  const steps = [
    { number: '01', title: t('workflowStep1Title'), desc: t('workflowStep1Desc') },
    { number: '02', title: t('workflowStep2Title'), desc: t('workflowStep2Desc') },
    { number: '03', title: t('workflowStep3Title'), desc: t('workflowStep3Desc') }
  ]

  const planPopups = useMemo<PlanPopup[]>(() => ([
    { name: 'Luan',     planKey: 'planMonthly',  price: 'R$ 12,50', emoji: '🔥' },
    { name: 'Priscila', planKey: 'planDaily',    price: 'R$ 5,00',  emoji: '⚡' },
    { name: 'Yuri',     planKey: 'planLifetime', price: 'R$ 20,00', emoji: '🎯' },
    { name: 'Camila',   planKey: 'planMonthly',  price: 'R$ 12,50', emoji: '🚀' },
    { name: 'Rafael',   planKey: 'planDaily',    price: 'R$ 5,00',  emoji: '💥' },
    { name: 'Ana',      planKey: 'planLifetime', price: 'R$ 20,00', emoji: '💎' }
  ]), [locale])

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
      ;(async () => {
        const translations: Record<string, string> = {}
        for (const f of feedbacks) {
          if (f.message) {
            try { translations[f.id] = await translate(f.message) } catch { translations[f.id] = f.message }
          }
        }
        if (Object.keys(translations).length > 0) setTranslatedFeedbacks(translations)
      })()
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
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current)
    }
  }, [planPopups])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative isolate overflow-hidden pt-16 sm:pt-24 pb-20 sm:pb-28">
        {/* Aurora ambient overlay */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute h-[700px] w-[700px] rounded-full bg-aurora-violet/25 blur-[140px] transition-transform duration-700"
            style={{ top: `${10 + mousePos.y * 8}%`, left: `${5 + mousePos.x * 8}%` }}
          />
          <div
            className="absolute h-[600px] w-[600px] rounded-full bg-aurora-cyan/20 blur-[140px] transition-transform duration-700"
            style={{ top: `${20 - mousePos.y * 6}%`, right: `${5 - mousePos.x * 6}%` }}
          />
          <div className="absolute inset-0 bg-grid" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md animate-fade-up">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-mint opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aurora-mint" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">
              {locale === 'pt-BR' ? 'Plataforma #1 do mundo' : t('heroBadge')}
            </span>
            <span className="text-[11px] text-white/40">•</span>
            <span className="text-[11px] font-medium text-white/55">+25k membros ativos</span>
          </div>

          <h1 className="mt-8 text-display text-[clamp(2.5rem,9vw,8.5rem)] font-extrabold text-balance animate-fade-up delay-100">
            <span className="text-gradient block">
              {locale === 'pt-BR' ? 'O maior gerador' : t('heroSubtitle')}
            </span>
            <span className="text-gradient-aurora block">
              {locale === 'pt-BR' ? 'do planeta.' : 'on the planet.'}
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-pretty text-base sm:text-lg text-white/65 leading-relaxed animate-fade-up delay-200">
            {locale === 'pt-BR'
              ? 'Operação 24/7 em escala global. Centenas de milhares de credenciais premium geradas com qualidade absurda e latência abaixo de 18ms.'
              : t('heroTrustedBy')}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-up delay-300">
            <Link
              href={session ? '/dashboard' : '/register'}
              className="btn btn-primary btn-lg group"
            >
              {session ? t('dashboard') : t('startNow')}
              <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/plans" className="btn btn-ghost btn-lg">
              {t('viewPlans')}
            </Link>
            <Link href="/api-docs" className="btn btn-ghost btn-lg text-aurora-cyan border-aurora-cyan/30 hover:border-aurora-cyan/60">
              <span className="font-mono text-xs">{`</>`}</span>
              API Docs
            </Link>
          </div>

          {/* Marquee partners */}
          <div className="relative mt-20 sm:mt-24">
            <div className="mb-5 flex items-center justify-center gap-3">
              <span className="h-px w-16 bg-gradient-to-r from-transparent to-white/20" />
              <span className="eyebrow">Trusted across platforms</span>
              <span className="h-px w-16 bg-gradient-to-l from-transparent to-white/20" />
            </div>
            <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]">
              <div className="marquee-track">
                {[...PARTNERS, ...PARTNERS].map((p, i) => (
                  <div key={i} className="flex items-center gap-2 shrink-0">
                    <span className="inline-block h-1 w-1 rounded-full bg-white/30" />
                    <span className="text-display text-2xl sm:text-3xl font-bold text-white/30 hover:text-white/80 transition-colors whitespace-nowrap">
                      {p}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-20 sm:mt-28 grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10">
            {stats.map((s, i) => (
              <div
                key={i}
                className="bg-[#06060c]/85 p-6 sm:p-10 text-left animate-fade-up"
                style={{ animationDelay: `${0.3 + i * 0.1}s` }}
              >
                <p className="num-display text-4xl sm:text-6xl text-white">{s.value}</p>
                <p className="mt-3 text-sm font-semibold text-aurora-violet">{s.label}</p>
                <p className="mt-1.5 text-xs sm:text-sm text-white/55">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 sm:mb-20 text-center">
            <p className="eyebrow">{locale === 'pt-BR' ? 'Por que somos #1' : 'Why we are #1'}</p>
            <h2 className="mt-3 text-display text-4xl sm:text-6xl font-bold text-gradient">
              {locale === 'pt-BR' ? 'Engenharia obsessiva' : 'Obsessive engineering'}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-white/60">
              {locale === 'pt-BR' ? 'Cada detalhe foi pensado para entregar a melhor experiência possível em geração de contas.' : 'Every detail engineered for the best generation experience possible.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {features.map((f, i) => (
              <article
                key={i}
                className="surface-card spotlight group relative overflow-hidden p-7 sm:p-8 transition-all hover:-translate-y-1"
                style={{ animationDelay: `${i * 0.05}s` }}
                onMouseMove={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  ;(e.currentTarget as HTMLElement).style.setProperty('--mx', `${e.clientX - r.left}px`)
                  ;(e.currentTarget as HTMLElement).style.setProperty('--my', `${e.clientY - r.top}px`)
                }}
              >
                <div className={`absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br ${f.accent} blur-3xl opacity-50 group-hover:opacity-90 transition-opacity duration-500`} />
                <div className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${f.border} bg-white/[0.03] text-2xl backdrop-blur-md`}>
                  {f.icon}
                </div>
                <h3 className="relative mt-6 text-display text-2xl font-bold text-white">{f.title}</h3>
                <p className="relative mt-3 text-[15px] leading-relaxed text-white/60">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="relative py-20 sm:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-fine opacity-40" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 sm:mb-20 text-center">
            <p className="eyebrow">Processo</p>
            <h2 className="mt-3 text-display text-4xl sm:text-6xl font-bold text-gradient">
              {locale === 'pt-BR' ? 'Três passos, infinitas contas' : 'Three steps, infinite accounts'}
            </h2>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Connection line */}
            <div className="pointer-events-none absolute left-1/2 top-12 hidden h-px w-[70%] -translate-x-1/2 bg-gradient-to-r from-transparent via-aurora-violet/40 to-transparent md:block" />
            {steps.map((s, i) => (
              <div key={i} className="surface-card relative p-7 sm:p-9">
                <div className="flex items-center gap-3">
                  <span className="num-display text-5xl text-gradient-aurora">{s.number}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-aurora-violet/40 to-transparent" />
                </div>
                <h3 className="mt-5 text-display text-xl sm:text-2xl font-bold text-white">{s.title}</h3>
                <p className="mt-3 text-[15px] text-white/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {feedbacks.length > 0 && (
        <section className="relative py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-14 text-center">
              <p className="eyebrow">Reviews</p>
              <h2 className="mt-3 text-display text-4xl sm:text-5xl font-bold text-gradient">
                Amado por milhares
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {feedbacks.map((f) => (
                <article key={f.id} className="surface-card p-7">
                  <div className="flex items-center gap-1 text-aurora-gold">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <svg key={idx} viewBox="0 0 20 20" fill={idx < (f.rating ?? 5) ? 'currentColor' : 'rgba(255,255,255,0.12)'} className="h-4 w-4">
                        <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.9L10 14.9 4.8 17.7l1-5.9L1.5 7.7l5.9-.9L10 1.5z" />
                      </svg>
                    ))}
                  </div>
                  <p className="mt-4 text-[15px] leading-relaxed text-white/80">
                    "{translatedFeedbacks[f.id] || f.message}"
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full">
                      <span className="absolute inset-0 bg-gradient-to-br from-aurora-violet via-aurora-magenta to-aurora-cyan" />
                      <span className="absolute inset-[1.5px] rounded-full bg-[#0a0a13]" />
                      <span className="relative text-xs font-bold text-white">
                        {(f.user?.username || f.name)?.charAt(0).toUpperCase()}
                      </span>
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-white">{f.user?.username || f.name}</p>
                      <p className="text-[11px] uppercase tracking-wider text-white/40">Verified user</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative py-20 sm:py-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-aurora-violet/15 via-aurora-magenta/10 to-aurora-cyan/15 p-10 sm:p-16 text-center">
            <div className="pointer-events-none absolute -inset-px -z-10">
              <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-aurora-violet/40 blur-3xl animate-pulse-glow" />
              <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-aurora-cyan/30 blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
            </div>
            <p className="eyebrow">Ready when you are</p>
            <h2 className="mt-3 text-display text-4xl sm:text-6xl font-bold text-gradient">
              {locale === 'pt-BR' ? 'Pronto para gerar em nível planetário?' : t('readyToStart')}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-white/65">{t('readyToStartDesc')}</p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register" className="btn btn-primary btn-lg">{t('createFreeAccount')}</Link>
              <Link href="/plans" className="btn btn-ghost btn-lg">{t('viewPlans')}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Floating live notification */}
      {currentPopup && (
        <div
          className={`fixed bottom-5 left-5 z-30 transition-all duration-500 ${
            popupVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[rgba(12,12,21,0.85)] py-2.5 pl-2.5 pr-5 backdrop-blur-xl shadow-2xl">
            <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <span className="absolute inset-0 bg-gradient-to-br from-aurora-violet to-aurora-magenta" />
              <span className="relative text-base">{currentPopup.emoji}</span>
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">
                <span className="text-aurora-violet">{currentPopup.name}</span> {t('popupUserActivated')}
              </p>
              <p className="text-[11px] text-white/55">
                {t(currentPopup.planKey)} · <span className="text-aurora-mint font-semibold">{currentPopup.price}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
