import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useChristmas } from '@/contexts/ChristmasContext'

export default function AdminChristmas() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { isChristmasMode, setChristmasMode, refreshChristmasMode } = useChristmas()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'ADMIN' && session?.user?.role !== 'OWNER') {
      router.push('/')
      return
    }

    if (status === 'authenticated') {
      setLoading(false)
    }
  }, [status, session, router])

  const toggleChristmasMode = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/christmas/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !isChristmasMode })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao alternar modo natalino')
      }

      setChristmasMode(data.enabled)
      await refreshChristmasMode()
      setMessage({
        type: 'success',
        text: data.message
      })
    } catch (error: any) {
      console.error('Erro:', error)
      setMessage({
        type: 'error',
        text: error.message || 'Erro ao alternar modo natalino'
      })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl">Carregando...</div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span>ðŸŽ„</span>
            <span>ConfiguraÃ§Ã£o Natalina</span>
            <span>ðŸŽ…</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Ative ou desative as decoraÃ§Ãµes natalinas do site para todos os usuÃ¡rios
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Card principal */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Header do card */}
          <div className={`p-6 ${isChristmasMode ? 'bg-gradient-to-r from-red-600 to-green-600' : 'bg-gradient-to-r from-gray-600 to-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl">
                  {isChristmasMode ? 'ðŸŽ„' : 'â„ï¸'}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Modo Natalino
                  </h2>
                  <p className="text-white/80">
                    {isChristmasMode ? 'Ativado para todos os usuÃ¡rios' : 'Desativado'}
                  </p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                isChristmasMode 
                  ? 'bg-white/20 text-white' 
                  : 'bg-gray-500/50 text-gray-300'
              }`}>
                {isChristmasMode ? 'ðŸŸ¢ ATIVO' : 'âš« INATIVO'}
              </div>
            </div>
          </div>

          {/* Corpo do card */}
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                O que acontece quando ativo:
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-lg">â„ï¸</span>
                  <span>Flocos de neve caindo pela tela</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lg">ðŸŽ„</span>
                  <span>Ãrvores de Natal decorativas nos cantos</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lg">ðŸ’¡</span>
                  <span>Luzes de Natal piscando no topo</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lg">ðŸŽ</span>
                  <span>Ãcones festivos (presentes, Papai Noel)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lg">ðŸŽ…</span>
                  <span>Banner de "Feliz Natal" para todos os visitantes</span>
                </li>
              </ul>
            </div>

            {/* PrÃ©via */}
            <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                PrÃ©via dos efeitos:
              </h4>
              <div className="relative h-32 bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg overflow-hidden">
                {/* Mini preview */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="flex gap-2 mb-2 justify-center">
                      {['â„ï¸', 'ðŸŽ„', 'ðŸŽ', 'ðŸŽ…', 'â­'].map((emoji, i) => (
                        <span 
                          key={i} 
                          className={`text-2xl ${isChristmasMode ? 'animate-bounce' : 'opacity-30'}`}
                          style={{ animationDelay: `${i * 0.1}s` }}
                        >
                          {emoji}
                        </span>
                      ))}
                    </div>
                    <p className={`text-sm ${isChristmasMode ? 'text-white' : 'text-gray-500'}`}>
                      {isChristmasMode ? 'DecoraÃ§Ãµes ativas!' : 'DecoraÃ§Ãµes desativadas'}
                    </p>
                  </div>
                </div>
                {isChristmasMode && (
                  <div className="absolute top-0 left-0 right-0 flex justify-center gap-2 pt-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{
                          backgroundColor: ['#ff0000', '#00ff00', '#ffff00', '#ff00ff', '#00ffff'][i % 5],
                          animationDelay: `${i * 0.15}s`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BotÃ£o de toggle */}
            <button
              onClick={toggleChristmasMode}
              disabled={saving}
              className={`w-full py-4 px-6 rounded-xl text-lg font-bold transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 ${
                isChristmasMode
                  ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800'
                  : 'bg-gradient-to-r from-red-500 via-red-600 to-green-600 text-white hover:from-red-600 hover:via-red-700 hover:to-green-700 shadow-lg shadow-red-500/30'
              }`}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processando...</span>
                </span>
              ) : isChristmasMode ? (
                <span className="flex items-center justify-center gap-2">
                  <span>âŒ</span>
                  <span>Desativar Modo Natalino</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>ðŸŽ„</span>
                  <span>Ativar Modo Natalino</span>
                  <span>ðŸŽ…</span>
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Dicas */}
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2 flex items-center gap-2">
            <span>ðŸ’¡</span>
            <span>Dicas:</span>
          </h3>
          <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
            <li>â€¢ Quando ativo, todos os usuÃ¡rios verÃ£o as decoraÃ§Ãµes automaticamente</li>
            <li>â€¢ Os efeitos sÃ£o leves e nÃ£o impactam a performance do site</li>
            <li>â€¢ Pode ser desativado a qualquer momento</li>
            <li>â€¢ Perfeito para o perÃ­odo de festas (dezembro/janeiro)</li>
          </ul>
        </div>
      </div>
    </>
  )
}

