import { useTranslation } from '@/lib/i18n-helper'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import Logo from '@/components/Logo'

export default function Home() {
  const { t } = useTranslation()
  const { data: session } = useSession()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-24 lg:py-32">
          <div className="text-center">
            <div className="flex justify-center mb-6 sm:mb-8">
              <Logo size="lg" showText={false} className="justify-center" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 animate-fade-in px-2">
              {t('siteName')}
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 text-primary-100 max-w-3xl mx-auto px-4">
              {t('generate')} {t('accounts')} para os melhores serviços de forma rápida e segura
            </p>
            {session ? (
              <Link
                href="/dashboard"
                className="inline-block bg-white text-primary-600 px-6 py-3 sm:px-8 sm:py-4 rounded-lg text-base sm:text-lg font-bold hover:bg-primary-50 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
              >
                {t('dashboard')}
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
                <Link
                  href="/register"
                  className="inline-block bg-white text-primary-600 px-6 py-3 sm:px-8 sm:py-4 rounded-lg text-base sm:text-lg font-bold hover:bg-primary-50 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                >
                  Começar Agora
                </Link>
                <Link
                  href="/plans"
                  className="inline-block bg-primary-500 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-lg text-base sm:text-lg font-bold hover:bg-primary-400 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-white"
                >
                  Ver Planos
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50 to-transparent"></div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">Por que escolher a gente?</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
              Oferecemos a melhor experiência para gerar contas dos serviços que você precisa
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2">
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">⚡</div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Rápido e Fácil</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Gere contas instantaneamente com apenas alguns cliques. Sem complicações.
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2">
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🔒</div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">100% Seguro</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Seus dados são protegidos com a mais alta segurança e criptografia.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2">
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🎯</div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Variedade de Serviços</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Acesso a múltiplos serviços populares com um único plano.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 px-2">Pronto para começar?</h2>
          <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-primary-100 px-4">
            Escolha um plano e tenha acesso imediato a todos os nossos serviços
          </p>
          {!session && (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Link
                href="/plans"
                className="inline-block bg-white text-primary-600 px-6 py-3 sm:px-8 sm:py-4 rounded-lg text-base sm:text-lg font-bold hover:bg-primary-50 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
              >
                Ver Planos
              </Link>
              <Link
                href="/register"
                className="inline-block bg-primary-500 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-lg text-base sm:text-lg font-bold hover:bg-primary-400 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-white"
              >
                Criar Conta Grátis
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
