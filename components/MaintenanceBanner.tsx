import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { useTranslation } from '@/lib/i18n-helper'

export default function MaintenanceBanner() {
  const { data: session, status } = useSession()
  const { t } = useTranslation()
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
      setMaintenanceMessage(response.data.message || t('maintenanceSubtitle'))
    } catch (error) {
      console.error('Error checking maintenance status:', error)
      setIsMaintenanceMode(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !isMaintenanceMode) {
    return null
  }

  if (session?.user?.role === 'OWNER') {
    return null
  }

  if (status !== 'authenticated') {
    return (
      <div className="fixed bottom-6 right-6 z-[60] max-w-sm w-full">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 shadow-[0_20px_40px_rgba(2,8,23,0.6)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/80 to-yellow-500/80 text-black text-lg">
              ⚙️
            </span>
            <div>
              <p className="text-sm font-semibold text-white/90">{t('maintenanceSoftTitle')}</p>
              <p className="text-[12px] text-white/60">{t('maintenanceSoftSubtitle')}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-3xl flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-gradient-to-br from-slate-900/80 via-slate-900/70 to-indigo-900/60 border border-white/10 rounded-[32px] p-10 shadow-[0_40px_120px_rgba(2,8,23,0.85)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-14 w-56 h-56 bg-gradient-to-br from-indigo-500/40 via-transparent to-cyan-500/40 blur-[110px]" />
          <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-gradient-to-br from-purple-500/35 via-transparent to-emerald-400/35 blur-[130px]" />
        </div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.4em] text-white/60">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {t('maintenanceStatus')}
          </div>
          <h1 className="mt-6 text-3xl font-black text-white">{t('maintenanceTitle')}</h1>
          <p className="mt-3 text-white/70 whitespace-pre-wrap">{maintenanceMessage}</p>
          <p className="mt-2 text-sm text-white/40">{t('maintenanceContact')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={async () => {
                await signOut({ redirect: false })
                router.push('/login')
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
            >
              {t('maintenanceButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

