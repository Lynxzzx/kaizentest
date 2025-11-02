import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import axios from 'axios'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface Broadcast {
  id: string
  title: string | null
  message: string
  createdAt: string
  expiresAt: string | null
  user: {
    username: string
    role: string
  }
}

export default function BroadcastBanner() {
  const { data: session } = useSession()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    if (session) {
      loadBroadcasts()
      const interval = setInterval(loadBroadcasts, 30000) // Atualizar a cada 30 segundos
      return () => clearInterval(interval)
    }
  }, [session])

  useEffect(() => {
    const stored = localStorage.getItem('dismissedBroadcasts')
    if (stored) {
      setDismissed(JSON.parse(stored))
    }
  }, [])

  const loadBroadcasts = async () => {
    try {
      const response = await axios.get('/api/broadcast')
      const activeBroadcasts = (response.data.broadcasts || []).filter(
        (b: Broadcast) => !dismissed.includes(b.id) && (!b.expiresAt || new Date(b.expiresAt) > new Date())
      )
      setBroadcasts(activeBroadcasts)
    } catch (error) {
      // Silenciar erros
    }
  }

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissed, id]
    setDismissed(newDismissed)
    localStorage.setItem('dismissedBroadcasts', JSON.stringify(newDismissed))
    setBroadcasts(broadcasts.filter(b => b.id !== id))
  }

  if (!session || broadcasts.length === 0) return null

  return (
    <>
      {broadcasts.map((broadcast) => (
        <div
          key={broadcast.id}
          className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white p-4 shadow-xl border-b border-blue-500 relative"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex-1">
              {broadcast.title && (
                <h3 className="font-bold text-lg mb-1">{broadcast.title}</h3>
              )}
              <p className="text-sm md:text-base">{broadcast.message}</p>
              <p className="text-xs text-blue-100 mt-2">
                {format(new Date(broadcast.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <button
              onClick={() => handleDismiss(broadcast.id)}
              className="ml-4 text-white hover:text-blue-200 transition-colors text-xl font-bold"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

