import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'

interface AnnouncementConfig {
  isActive: boolean
  title: string
  message: string
  emoji: string
  buttons: {
    primary: { label: string; url: string }
    secondary: { label: string }
  }
}

const STORAGE_KEY = 'kaizen_announcement_dismissed'
const COUNTDOWN_SECONDS = 5

export default function AnnouncementModal() {
  const [config, setConfig] = useState<AnnouncementConfig | null>(null)
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [canDismiss, setCanDismiss] = useState(false)
  const [closing, setClosing] = useState(false)

  const fetchAnnouncement = useCallback(async () => {
    try {
      const { data } = await axios.get<AnnouncementConfig>('/api/announcement')
      if (!data.isActive) return

      // Verifica se o usuário já dispensou este anúncio nesta sessão
      const dismissed = sessionStorage.getItem(STORAGE_KEY)
      if (dismissed === data.title + data.message) return

      setConfig(data)
      setVisible(true)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    fetchAnnouncement()
  }, [fetchAnnouncement])

  // Countdown de leitura obrigatória
  useEffect(() => {
    if (!visible) return
    setCountdown(COUNTDOWN_SECONDS)
    setCanDismiss(false)

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setCanDismiss(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [visible])

  const dismiss = useCallback(() => {
    if (!canDismiss || !config) return
    setClosing(true)
    setTimeout(() => {
      sessionStorage.setItem(STORAGE_KEY, config.title + config.message)
      setVisible(false)
      setClosing(false)
    }, 350)
  }, [canDismiss, config])

  const handlePrimary = useCallback(() => {
    if (config?.buttons.primary.url) {
      window.open(config.buttons.primary.url, '_blank', 'noopener,noreferrer')
    }
  }, [config])

  if (!visible || !config) return null

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[9999] transition-all duration-300 ${
          closing ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backdropFilter: 'blur(14px)', background: 'rgba(2,8,23,0.82)' }}
      />

      {/* Modal */}
      <div
        className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-all duration-350 ${
          closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
      >
        <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 shadow-[0_40px_120px_rgba(2,8,23,0.9)]"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.95) 50%, rgba(15,23,42,0.95) 100%)',
          }}
        >
          {/* Decorative glows */}
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-40"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)', filter: 'blur(40px)' }}
            />
            <div
              className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.6) 0%, transparent 70%)', filter: 'blur(40px)' }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full opacity-10"
              style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.8) 0%, transparent 70%)', filter: 'blur(60px)' }}
            />
          </div>

          {/* Animated top border */}
          <div className="relative h-1 w-full overflow-hidden rounded-t-[28px]">
            <div
              className="absolute inset-0 animate-pulse"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4, #f59e0b, #06b6d4, #7c3aed)', backgroundSize: '200% 100%' }}
            />
          </div>

          <div className="relative z-10 px-8 pb-8 pt-6">
            {/* Badge */}
            <div className="mb-5 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.35em] text-white/60">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                Aviso Oficial
              </div>
              {/* Countdown badge */}
              {!canDismiss && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/50">
                  <svg className="h-3 w-3 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="50 30" />
                  </svg>
                  Leia por {countdown}s
                </div>
              )}
            </div>

            {/* Emoji */}
            <div className="mb-4 text-center">
              <span
                className="inline-block text-7xl"
                style={{ filter: 'drop-shadow(0 0 24px rgba(251,191,36,0.5))' }}
              >
                {config.emoji}
              </span>
            </div>

            {/* Title */}
            <h2 className="mb-3 text-center text-2xl font-black text-white leading-tight">
              {config.title}
            </h2>

            {/* Message */}
            <div
              className="mb-7 rounded-2xl border border-white/5 px-5 py-4 text-center text-sm leading-relaxed text-white/75 whitespace-pre-wrap"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              {config.message}
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              {/* Primary button */}
              {config.buttons.primary.url && (
                <button
                  onClick={handlePrimary}
                  className="group relative w-full overflow-hidden rounded-2xl py-3.5 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)',
                    boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <span>{config.buttons.primary.label}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #0891b2 100%)' }} />
                </button>
              )}

              {/* Secondary button */}
              <button
                onClick={dismiss}
                disabled={!canDismiss}
                className={`relative w-full overflow-hidden rounded-2xl border py-3.5 text-sm font-semibold transition-all duration-200 ${
                  canDismiss
                    ? 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white hover:scale-[1.01] cursor-pointer'
                    : 'border-white/5 bg-white/3 text-white/30 cursor-not-allowed'
                }`}
              >
                {canDismiss ? (
                  <span className="flex items-center justify-center gap-2">
                    {config.buttons.secondary.label}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>{config.buttons.secondary.label}</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/40">
                      {countdown}
                    </span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </>
  )
}
