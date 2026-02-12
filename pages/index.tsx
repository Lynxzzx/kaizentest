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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [scrollY, setScrollY] = useState(0)

  const stats = [
    { value: '25k+', label: t('metricsUsers'), desc: t('metricsUsersDesc') },
    { value: '480k+', label: t('metricsAccounts'), desc: t('metricsAccountsDesc') },
    { value: '99,98%', label: t('metricsUptime'), desc: t('metricsUptimeDesc') },
    { value: '<5min', label: t('metricsSupport'), desc: t('metricsSupportDesc') }
  ]

  const partners = ['Netflix', 'Spotify', 'Disney+', 'HBO Max', 'Paramount+', 'Crunchyroll']

  const features = [
    { icon: '⚡', title: t('fastInstant'), desc: t('fastInstantDesc'), color: 'from-yellow-400 to-orange-500' },
    { icon: '🔒', title: t('secure100'), desc: t('secure100Desc'), color: 'from-green-400 to-emerald-500' },
    { icon: '🎯', title: t('multipleServices'), desc: t('multipleServicesDesc'), color: 'from-blue-400 to-cyan-500' },
    { icon: '💎', title: t('premiumQuality'), desc: t('premiumQualityDesc'), color: 'from-purple-400 to-pink-500' },
    { icon: '🛰️', title: t('support247'), desc: t('support247Desc'), color: 'from-indigo-400 to-purple-500' },
    { icon: '🎁', title: t('freePlan'), desc: t('freePlanDesc'), color: 'from-pink-400 to-rose-500' }
  ]

  const liveHighlights = [
    { value: '18ms', label: t('metricsLatency') },
    { value: '32+', label: t('metricsCountries') },
    { value: '4.9k', label: t('availableStocks') }
  ]

  const steps = [
    { number: '01', title: t('workflowStep1Title'), desc: t('workflowStep1Desc'), icon: '🚀' },
    { number: '02', title: t('workflowStep2Title'), desc: t('workflowStep2Desc'), icon: '⚙️' },
    { number: '03', title: t('workflowStep3Title'), desc: t('workflowStep3Desc'), icon: '✨' }
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-[#000000] text-white overflow-hidden">
      {/* Advanced Background with Mouse Tracking */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute w-[1200px] h-[800px] bg-[radial-gradient(circle,rgba(79,70,229,0.2)_0%,transparent_70%)] blur-[150px] transition-all duration-1000 ease-out"
          style={{
            transform: `translate(${(mousePosition.x - 600) * 0.02}px, ${(mousePosition.y - 400) * 0.02}px)`,
            left: `${mousePosition.x - 600}px`,
            top: `${mousePosition.y - 400}px`
          }}
        />
        <div 
          className="absolute w-[1000px] h-[600px] bg-[radial-gradient(circle,rgba(236,72,153,0.15)_0%,transparent_70%)] blur-[120px] transition-all duration-1000 ease-out"
          style={{
            transform: `translate(${(mousePosition.x - 500) * -0.01}px, ${(mousePosition.y - 300) * -0.01}px)`,
            right: `${500 - mousePosition.x}px`,
            bottom: `${300 - mousePosition.y}px`
          }}
        />
        <div 
          className="absolute w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,transparent_70%)] blur-[100px] transition-all duration-1000 ease-out"
          style={{
            transform: `translate(${(mousePosition.x - 400) * 0.015}px, ${(mousePosition.y - 400) * 0.015}px)`,
            left: `${mousePosition.x * 0.1}px`,
            bottom: `${mousePosition.y * 0.1}px`
          }}
        />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        
        {/* Floating particles effect */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full animate-float"
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
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/30 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-opacity" />
              <Logo size="sm" showText={false} />
            </div>
            <span className="font-bold text-xl tracking-tight">
              Kaizen<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Gens</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            {!session && (
              <>
                <Link href="/login" className="text-sm font-medium text-white/70 hover:text-white transition-all duration-300 hover:scale-105">
                  {t('signIn')}
                </Link>
                <Link href="/register" className="text-sm font-medium bg-gradient-to-r from-white to-gray-200 text-black px-6 py-2.5 rounded-full hover:shadow-lg hover:shadow-white/20 transition-all duration-300 hover:scale-105">
                  {t('signUp')}
                </Link>
              </>
            )}
            {session && (
              <Link href="/dashboard" className="text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-full hover:shadow-lg hover:shadow-indigo-500/50 transition-all duration-300 hover:scale-105">
                {t('dashboard')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section with Advanced Animations */}
      <main className="relative z-10 pt-40 pb-32 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-10 animate-pulse">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
            {locale === 'pt-BR' ? 'MAIOR gerador de contas do PLANETA' : t('heroBadge')}
          </div>

          <div className="mb-12">
            <h1 className="text-6xl sm:text-8xl font-bold tracking-tight mb-6 leading-[1.05]">
              <span className="block bg-gradient-to-br from-white to-gray-300 bg-clip-text text-transparent">
                {locale === 'pt-BR' ? 'Somos o MAIOR' : t('heroSubtitle')}
              </span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient bg-[length:200%_auto]">
                {locale === 'pt-BR' ? 'gerador de contas do planeta' : 'Account Generator'}
              </span>
            </h1>
          </div>

          <div className="max-w-4xl mx-auto mb-16">
            <p className="text-xl text-gray-300 leading-relaxed">
              {locale === 'pt-BR' ? 'Operação 24/7 em escala global. Centenas de milhares de credenciais geradas com qualidade premium.' : t('heroTrustedBy')}
            </p>
          </div>

          {/* Enhanced CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">
            <Link
              href={session ? '/dashboard' : '/register'}
              className="group relative overflow-hidden w-full sm:w-auto px-10 py-5 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500 hover:scale-105"
            >
              <span className="relative z-10">{session ? t('dashboard') : t('startNow')}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Link>
            <Link
              href="/plans"
              className="group relative overflow-hidden w-full sm:w-auto px-10 py-5 rounded-full glass-panel border border-white/20 hover:border-white/40 transition-all duration-500 hover:scale-105 font-semibold text-lg"
            >
              <span className="relative z-10">{t('viewPlans')}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Link>
            <Link
              href="/api-docs"
              className="group relative overflow-hidden w-full sm:w-auto px-10 py-5 rounded-full glass-panel border border-indigo-500/30 hover:border-indigo-500/60 transition-all duration-500 hover:scale-105 font-semibold text-lg text-indigo-200"
            >
              <span className="relative z-10">API Docs</span>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Link>
          </div>

          {/* Enhanced Partners Grid */}
          <div className="max-w-6xl mx-auto mb-32">
            <p className="text-sm text-gray-400 mb-8 tracking-widest uppercase">Trusted by Industry Leaders</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6">
              {partners.map((p, i) => (
                <div key={i} className="group relative">
                  <div className="glass-panel px-6 py-4 rounded-2xl border border-white/10 text-center hover:border-white/20 transition-all duration-500 hover:-translate-y-1">
                    <div className="text-sm text-gray-300 group-hover:text-white transition-colors">{p}</div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {stats.map((stat, i) => (
              <div key={i} className="group relative">
                <div className="glass-card p-10 rounded-3xl text-center border border-white/10 hover:border-indigo-500/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/20">
                  <div className="text-4xl font-bold text-white mb-2 group-hover:scale-110 transition-transform duration-300">{stat.value}</div>
                  <div className="text-indigo-300 font-bold text-lg">{stat.label}</div>
                  <p className="text-gray-400 text-sm mt-3">{stat.desc}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-16">
            <Link
              href="/plans"
              className="group inline-flex items-center gap-3 px-10 py-4 rounded-full bg-white/10 text-white font-semibold border border-white/10 hover:bg-white/20 hover:border-white/30 transition-all duration-500 hover:scale-105"
            >
              <span>Ver planos agora</span>
              <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Enhanced Features Section */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Por que somos #1
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Tecnologia de ponta combinada com experiência superior
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10">
            {features.map((feature, i) => (
              <div key={i} className="group relative">
                <div className="glass-card p-10 rounded-3xl border border-white/10 hover:border-white/20 transition-all duration-500 hover:-translate-y-2 overflow-hidden">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.color} flex items-center justify-center text-3xl mb-8 group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-100 group-hover:text-white transition-colors">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-24 grid md:grid-cols-3 gap-8">
            <div className="group relative overflow-hidden p-8 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 hover:border-indigo-500/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <p className="text-sm text-indigo-300 mb-3 font-semibold">Diferencial</p>
              <h4 className="text-2xl font-bold text-white mb-3">Atividade constante</h4>
              <p className="text-gray-300">Infra confiável e filas otimizadas para gerar credenciais em ritmo de produção, o dia todo.</p>
            </div>
            <div className="group relative overflow-hidden p-8 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:border-emerald-500/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <p className="text-sm text-emerald-300 mb-3 font-semibold">Escala</p>
              <h4 className="text-2xl font-bold text-white mb-3">Operação global</h4>
              <p className="text-gray-300">Latência baixa e disponibilidade alta, atendendo usuários em dezenas de países.</p>
            </div>
            <div className="group relative overflow-hidden p-8 rounded-3xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 hover:border-pink-500/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <p className="text-sm text-pink-300 mb-3 font-semibold">Qualidade</p>
              <h4 className="text-2xl font-bold text-white mb-3">UX premium</h4>
              <p className="text-gray-300">Experiência refinada com design moderno, animações sutis e foco em conversão.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Workflow Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/10 to-pink-900/10 skew-y-3 transform origin-bottom-left" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="text-center mb-24">
            <h2 className="text-5xl font-bold mb-6">{t('workflowDesc')}</h2>
            <div className="h-1 w-24 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full" />
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {steps.map((step, i) => (
              <div key={i} className="group relative text-center">
                <div className="glass-panel p-12 rounded-3xl h-full border border-white/10 hover:border-white/20 transition-all duration-500">
                  <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-500">{step.icon}</div>
                  <span className="text-7xl font-bold text-white/10 absolute top-6 right-6 select-none">
                    {step.number}
                  </span>
                  <h4 className="text-2xl font-bold mb-6 text-indigo-300">{step.title}</h4>
                  <p className="text-gray-400 text-lg leading-relaxed">{step.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-6 w-12 h-px bg-gradient-to-r from-indigo-500 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-[4rem] p-16 text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_50%)]" />
            <div className="relative z-10">
              <h2 className="text-6xl font-bold mb-8 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                {locale === 'pt-BR' ? 'Pronto para gerar em nível planetário?' : t('readyToStart')}
              </h2>
              <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">{t('readyToStartDesc')}</p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <Link href="/register" className="group relative overflow-hidden px-12 py-5 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-xl hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500 hover:scale-105">
                  <span className="relative z-10">{t('createFreeAccount')}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </Link>
                <Link href="/contact" className="group relative overflow-hidden px-12 py-5 rounded-full glass-panel border border-white/20 hover:border-white/40 transition-all duration-500 hover:scale-105 font-semibold text-xl">
                  <span className="relative z-10">Falar com especialista</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Popup Notifications */}
      {currentPopup && (
        <div className={`fixed bottom-8 left-8 z-50 transition-all duration-700 transform ${popupVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <div className="glass-panel pl-4 pr-8 py-4 rounded-2xl flex items-center gap-5 shadow-2xl border border-white/10 hover:border-white/20 transition-all duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-sm" />
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xl shadow-lg relative">
                {currentPopup.emoji}
              </div>
            </div>
            <div>
              <p className="text-base font-semibold text-white">
                <span className="font-bold text-indigo-300">{currentPopup.name}</span> {t('popupUserActivated')}
              </p>
              <p className="text-sm text-gray-400">
                {t(currentPopup.planKey)} • <span className="text-emerald-400 font-semibold">{currentPopup.price}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Footer */}
      <footer className="py-16 text-center text-gray-500 text-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Logo size="sm" showText={false} />
            <span className="font-bold text-lg text-gray-400">Kaizen Gens</span>
          </div>
          <p>&copy; {new Date().getFullYear()} Kaizen Gens. All rights reserved.</p>
          <p className="mt-2 text-xs text-gray-600">The future of account generation is here.</p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .glass-panel {
          background: rgba(25, 25, 25, 0.3);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .glass-card {
          background: rgba(25, 25, 25, 0.4);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </div>
  )
}