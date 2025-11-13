import { useTranslation, useDynamicTranslation } from '@/lib/i18n-helper'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
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

export default function Home() {
  const { t, locale } = useTranslation()
  const { translate } = useDynamicTranslation()
  const { data: session } = useSession()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [translatedFeedbacks, setTranslatedFeedbacks] = useState<Record<string, string>>({})

  useEffect(() => {
    // Carregar alguns feedbacks aprovados para mostrar na landing page
    axios.get('/api/feedback')
      .then(response => {
        // Pegar apenas os 3 mais recentes
        setFeedbacks(response.data.slice(0, 3))
      })
      .catch(() => {
        // Ignorar erros silenciosamente
      })
  }, [])

  // Traduzir feedbacks quando o idioma for inglês
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-7xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8 sm:mb-12 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl blur-2xl opacity-50"></div>
              <div className="relative bg-white/10 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl">
                <Logo size="lg" showText={false} className="justify-center" />
              </div>
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 sm:mb-8 animate-fade-in animation-delay-200">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
              {t('siteName')}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl mb-4 sm:mb-6 text-gray-300 max-w-3xl mx-auto px-4 animate-fade-in animation-delay-400">
            {t('heroSubtitle')}
          </p>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto px-4 mb-8 sm:mb-12 animate-fade-in animation-delay-600">
            {t('heroDescription')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center px-4 animate-fade-in animation-delay-800">
            {session ? (
              <Link
                href="/dashboard"
                className="group relative px-8 py-4 sm:px-10 sm:py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-lg sm:text-xl font-bold rounded-2xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-2xl hover:shadow-purple-500/50 transform hover:-translate-y-1 hover:scale-105 duration-300 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span>🚀</span>
                  <span>{t('dashboard')}</span>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="group relative px-8 py-4 sm:px-10 sm:py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-lg sm:text-xl font-bold rounded-2xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-2xl hover:shadow-purple-500/50 transform hover:-translate-y-1 hover:scale-105 duration-300 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <span>✨</span>
                    <span>{t('startNow')}</span>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </Link>
                <Link
                  href="/plans"
                  className="group relative px-8 py-4 sm:px-10 sm:py-5 bg-white/10 backdrop-blur-lg text-white text-lg sm:text-xl font-bold rounded-2xl border-2 border-white/30 hover:bg-white/20 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-105 duration-300"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <span>💎</span>
                    <span>{t('viewPlans')}</span>
                  </span>
                </Link>
              </>
            )}
          </div>

          {/* Scroll Indicator */}
          <div className="mt-16 sm:mt-20 animate-bounce">
            <div className="w-6 h-10 border-2 border-white/30 rounded-full mx-auto flex items-start justify-center p-2">
              <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20 sm:py-24 md:py-32 bg-gradient-to-b from-transparent via-slate-800/50 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 md:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
                {t('whyChooseUs')}
              </span>
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
              {t('whyChooseUsDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
            {/* Feature 1 */}
            <div className="group relative bg-white/5 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">⚡</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">{t('fastInstant')}</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  {t('fastInstantDesc')}
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative bg-white/5 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🔒</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">{t('secure100')}</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  {t('secure100Desc')}
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative bg-white/5 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🎯</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">{t('multipleServices')}</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  {t('multipleServicesDesc')}
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group relative bg-white/5 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">💎</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">{t('premiumQuality')}</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  {t('premiumQualityDesc')}
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="group relative bg-white/5 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🚀</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">{t('support247')}</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  {t('support247Desc')}
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group relative bg-white/5 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🎁</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">{t('freePlan')}</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  {t('freePlanDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feedbacks Section */}
      {feedbacks.length > 0 && (
        <section className="relative z-10 py-20 sm:py-24 md:py-32 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
                  {t('whatClientsSay')}
                </span>
              </h2>
              <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
                {t('whatClientsSayDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-8">
              {feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className="group relative bg-white/5 backdrop-blur-lg rounded-3xl p-6 sm:p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    {feedback.rating && (
                      <div className="flex items-center gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < feedback.rating! ? 'text-yellow-400' : 'text-gray-500'}>
                            ⭐
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm sm:text-base text-gray-300 leading-relaxed mb-4 line-clamp-4">
                      "{translatedFeedbacks[feedback.id] || feedback.message}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        {feedback.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{feedback.name}</p>
                        {feedback.user && (
                          <p className="text-xs text-gray-400">@{feedback.user.username}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link
                href="/feedback"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-lg text-white font-semibold rounded-xl border border-white/30 hover:bg-white/20 transition-all shadow-xl hover:shadow-2xl"
              >
                <span>{t('viewAllFeedbacks')}</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="relative z-10 py-20 sm:py-24 md:py-32 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 sm:mb-8">
            {t('readyToStart')}
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl mb-8 sm:mb-12 text-white/90 max-w-2xl mx-auto">
            {t('readyToStartDesc')}
          </p>
          {!session && (
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center">
              <Link
                href="/plans"
                className="group relative px-8 py-4 sm:px-10 sm:py-5 bg-white text-purple-600 text-lg sm:text-xl font-bold rounded-2xl hover:bg-gray-100 transition-all shadow-2xl hover:shadow-white/50 transform hover:-translate-y-1 hover:scale-105 duration-300"
              >
                  <span className="relative z-10 flex items-center gap-2">
                  <span>💎</span>
                  <span>{t('viewPlans')}</span>
                </span>
              </Link>
              <Link
                href="/register"
                className="group relative px-8 py-4 sm:px-10 sm:py-5 bg-white/10 backdrop-blur-lg text-white text-lg sm:text-xl font-bold rounded-2xl border-2 border-white/30 hover:bg-white/20 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-105 duration-300"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span>✨</span>
                  <span>{t('createFreeAccount')}</span>
                </span>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animation-delay-200 {
          animation-delay: 0.2s;
        }
        .animation-delay-400 {
          animation-delay: 0.4s;
        }
        .animation-delay-600 {
          animation-delay: 0.6s;
        }
        .animation-delay-800 {
          animation-delay: 0.8s;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  )
}
