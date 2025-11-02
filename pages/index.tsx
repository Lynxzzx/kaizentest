import { useTranslation } from '@/lib/i18n-helper'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function Home() {
  const { t } = useTranslation()
  const { data: session } = useSession()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6 animate-fade-in">
              {t('siteName')}
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-primary-100 max-w-3xl mx-auto">
              {t('generate')} {t('accounts')} para os melhores serviços de forma rápida e segura
            </p>
            {session ? (
              <Link
                href={session.user.role === 'OWNER' ? '/admin' : '/dashboard'}
                className="inline-block bg-white text-primary-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-primary-50 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
              >
                {session.user.role === 'OWNER' ? t('admin') : t('dashboard')}
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/register"
                  className="inline-block bg-white text-primary-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-primary-50 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                >
                  Começar Agora
                </Link>
                <Link
                  href="/plans"
                  className="inline-block bg-primary-500 text-white px-8 py-4 rounded-lg text-lg font-bold hover:bg-primary-400 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-white"
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
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Por que escolher a gente?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Oferecemos a melhor experiência para gerar contas dos serviços que você precisa
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2">
              <div className="text-5xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Rápido e Fácil</h3>
              <p className="text-gray-600">
                Gere contas instantaneamente com apenas alguns cliques. Sem complicações.
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2">
              <div className="text-5xl mb-4">🔒</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">100% Seguro</h3>
              <p className="text-gray-600">
                Seus dados são protegidos com a mais alta segurança e criptografia.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-2">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Variedade de Serviços</h3>
              <p className="text-gray-600">
                Acesso a múltiplos serviços populares com um único plano.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Pronto para começar?</h2>
          <p className="text-xl mb-8 text-primary-100">
            Escolha um plano e tenha acesso imediato a todos os nossos serviços
          </p>
          {!session && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/plans"
                className="inline-block bg-white text-primary-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-primary-50 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
              >
                Ver Planos
              </Link>
              <Link
                href="/register"
                className="inline-block bg-primary-500 text-white px-8 py-4 rounded-lg text-lg font-bold hover:bg-primary-400 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-white"
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
