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
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  // Carregar dismissed do localStorage na inicialização
  useEffect(() => {
    const stored = localStorage.getItem('dismissedBroadcasts')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setDismissed(parsed || [])
      } catch (e) {
        console.error('Error parsing dismissed broadcasts:', e)
        setDismissed([])
      }
    }
  }, [])

  // Carregar broadcasts sempre que dismissed mudar OU na inicialização
  useEffect(() => {
    const loadBroadcasts = async () => {
      try {
        console.log('📢 Carregando broadcasts...')
        const response = await axios.get('/api/broadcast')
        const allBroadcasts = response.data.broadcasts || []
        
        console.log('📢 Broadcasts recebidos:', allBroadcasts.length)
        
        // Filtrar broadcasts: não descartados e não expirados
        const activeBroadcasts = allBroadcasts.filter((b: Broadcast) => {
          const isDismissed = dismissed.includes(b.id)
          const isExpired = b.expiresAt ? new Date(b.expiresAt) <= new Date() : false
          const shouldShow = !isDismissed && !isExpired
          
          if (!shouldShow) {
            console.log('📢 Broadcast filtrado:', b.id, { isDismissed, isExpired })
          }
          
          return shouldShow
        })
        
        console.log('📢 Broadcasts ativos:', activeBroadcasts.length)
        setBroadcasts(activeBroadcasts)
      } catch (error: any) {
        console.error('❌ Error loading broadcasts:', error)
        console.error('❌ Error details:', error.response?.data || error.message)
        setBroadcasts([])
      }
    }

    // Carregar imediatamente
    loadBroadcasts()
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadBroadcasts, 30000)
    
    return () => clearInterval(interval)
  }, [dismissed])

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissed, id]
    setDismissed(newDismissed)
    localStorage.setItem('dismissedBroadcasts', JSON.stringify(newDismissed))
    // Atualizar lista local imediatamente
    setBroadcasts(prev => prev.filter(b => b.id !== id))
  }

  if (broadcasts.length === 0) return null

  return (
    <div className="relative z-[100]">
      {broadcasts.map((broadcast) => (
        <div
          key={broadcast.id}
          className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white p-4 shadow-xl border-b border-blue-500"
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
    </div>
  )
}

