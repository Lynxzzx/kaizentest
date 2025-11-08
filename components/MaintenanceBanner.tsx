import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'

export default function MaintenanceBanner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkMaintenanceStatus()
  }, [])

  const checkMaintenanceStatus = async () => {
    try {
      const response = await axios.get('/api/maintenance/status')
      setIsMaintenanceMode(response.data.isMaintenanceMode || false)
      setMaintenanceMessage(response.data.message || 'O site está em manutenção. Volte em breve!')
    } catch (error) {
      console.error('Error checking maintenance status:', error)
      setIsMaintenanceMode(false)
    } finally {
      setLoading(false)
    }
  }

  // Se está carregando ou não está em manutenção, não mostra nada
  if (loading || !isMaintenanceMode) {
    return null
  }

  // Se o usuário é owner, permite acesso normal
  if (status === 'authenticated' && session?.user?.role === 'OWNER') {
    return null
  }

  // Se está em manutenção e não é owner, mostra a tela de manutenção
  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
            <svg
              className="w-10 h-10 text-yellow-600 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Site em Manutenção
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 whitespace-pre-wrap">
            {maintenanceMessage}
          </p>
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Voltaremos em breve!</span>
          </div>
        </div>
      </div>
    </div>
  )
}

