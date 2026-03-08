import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'

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

const defaultConfig: AnnouncementConfig = {
  isActive: false,
  title: 'Aviso Importante',
  message: '',
  emoji: '📢',
  buttons: {
    primary: { label: 'Acessar Canal', url: '' },
    secondary: { label: 'Continuar para o site' },
  },
}

export default function AdminAnnouncement() {
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const themeClasses = getThemeClasses(theme)

  const [config, setConfig] = useState<AnnouncementConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'OWNER') { router.push('/'); return }
    if (status === 'authenticated') loadSettings()
  }, [status, session, router])

  const loadSettings = async () => {
    try {
      const { data } = await axios.get<AnnouncementConfig>('/api/admin/announcement')
      setConfig(data)
    } catch {
      toast.error('Erro ao carregar configurações do anúncio')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config.title.trim()) return toast.error('Título é obrigatório')
    if (!config.message.trim()) return toast.error('Mensagem é obrigatória')

    setSaving(true)
    try {
      await axios.post('/api/admin/announcement', config)
      toast.success('✅ Anúncio salvo com sucesso!')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar anúncio')
    } finally {
      setSaving(false)
    }
  }

  const set = (field: keyof AnnouncementConfig, value: any) =>
    setConfig(prev => ({ ...prev, [field]: value }))

  const setButton = (type: 'primary' | 'secondary', field: string, value: string) =>
    setConfig(prev => ({
      ...prev,
      buttons: {
        ...prev.buttons,
        [type]: { ...prev.buttons[type], [field]: value },
      },
    }))

  if (status === 'loading' || loading) {
    return (
      <div className={`min-h-screen ${themeClasses.bg} flex items-center justify-center`}>
        <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-purple-600'}`} />
      </div>
    )
  }

  if (session?.user?.role !== 'OWNER') return null

  const inputCls = `w-full rounded-2xl border px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
    theme === 'dark'
      ? 'border-white/10 bg-white/5 text-white placeholder-white/30'
      : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'
  }`

  return (
    <div className={`min-h-screen ${themeClasses.bg} relative overflow-hidden`}>
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] right-[-5%] w-[480px] h-[480px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-[-10%] left-[-5%] w-[480px] h-[480px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className={`${themeClasses.card} neon-shadow mb-8`}>
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/15 via-transparent to-cyan-400/10 rounded-[inherit]" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Painel Admin</p>
              <h1 className="text-3xl font-black text-white mt-1 flex items-center gap-3">
                <span>📣</span> Anúncio do Site
              </h1>
              <p className="text-sm text-white/50 mt-1">Configure o popup de anúncio exibido ao abrir o site</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-all"
              >
                ← Voltar
              </Link>
              <button
                onClick={() => setShowPreview(p => !p)}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500/20 transition-all"
              >
                👁️ {showPreview ? 'Fechar Preview' : 'Ver Preview'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-5">
            {/* Toggle */}
            <div className={`${themeClasses.card} neon-shadow`}>
              <h2 className={`font-bold text-lg mb-4 ${themeClasses.text.primary}`}>Status</h2>
              <label className="flex items-center justify-between cursor-pointer p-4 rounded-2xl border border-white/5 bg-white/3 hover:bg-white/5 transition-colors">
                <div>
                  <p className="font-semibold text-white text-sm">Ativar anúncio</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {config.isActive ? 'O modal aparecerá para todos os visitantes' : 'O modal está desativado'}
                  </p>
                </div>
                <div
                  onClick={() => set('isActive', !config.isActive)}
                  className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors cursor-pointer ${
                    config.isActive ? 'bg-gradient-to-r from-violet-500 to-cyan-500' : 'bg-white/10'
                  }`}
                  style={{ width: '52px' }}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                      config.isActive ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </div>
              </label>
            </div>

            {/* Content */}
            <div className={`${themeClasses.card} neon-shadow`}>
              <h2 className={`font-bold text-lg mb-4 ${themeClasses.text.primary}`}>Conteúdo</h2>
              <div className="space-y-4">
                {/* Emoji */}
                <div>
                  <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Emoji</label>
                  <input
                    type="text"
                    value={config.emoji}
                    onChange={e => set('emoji', e.target.value)}
                    placeholder="📢"
                    className={inputCls}
                    maxLength={6}
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Título</label>
                  <input
                    type="text"
                    value={config.title}
                    onChange={e => set('title', e.target.value)}
                    placeholder="Ex: Aviso Importante"
                    className={inputCls}
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs text-white/50 uppercase tracking-widest mb-2">Mensagem</label>
                  <textarea
                    value={config.message}
                    onChange={e => set('message', e.target.value)}
                    placeholder="Digite aqui a mensagem que será exibida para os visitantes..."
                    rows={5}
                    className={`${inputCls} resize-none`}
                  />
                  <p className="text-xs text-white/30 mt-1">Suporta quebras de linha (Enter)</p>
                </div>
              </div>
            </div>

            {/* Buttons config */}
            <div className={`${themeClasses.card} neon-shadow`}>
              <h2 className={`font-bold text-lg mb-4 ${themeClasses.text.primary}`}>Botões</h2>
              <div className="space-y-5">
                {/* Primary */}
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                  <p className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-3">🔮 Botão Primário (destaque)</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Texto do botão</label>
                      <input
                        type="text"
                        value={config.buttons.primary.label}
                        onChange={e => setButton('primary', 'label', e.target.value)}
                        placeholder="Ex: Ir para o Telegram"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">URL (link)</label>
                      <input
                        type="url"
                        value={config.buttons.primary.url}
                        onChange={e => setButton('primary', 'url', e.target.value)}
                        placeholder="https://t.me/seucanal"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                {/* Secondary */}
                <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">🔘 Botão Secundário (fechar modal)</p>
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Texto do botão</label>
                    <input
                      type="text"
                      value={config.buttons.secondary.label}
                      onChange={e => setButton('secondary', 'label', e.target.value)}
                      placeholder="Ex: Continuar para o site"
                      className={inputCls}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/25">Este botão sempre fecha o modal. Fica bloqueado por 5s para garantir a leitura.</p>
                </div>
              </div>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:scale-100"
              style={{
                background: saving
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)',
                boxShadow: saving ? 'none' : '0 8px 32px rgba(124,58,237,0.4)',
              }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="50 30" />
                  </svg>
                  Salvando...
                </span>
              ) : (
                '💾 Salvar Anúncio'
              )}
            </button>
          </div>

          {/* Preview Panel */}
          <div>
            <div className={`${themeClasses.card} neon-shadow sticky top-6`}>
              <h2 className={`font-bold text-lg mb-4 ${themeClasses.text.primary}`}>
                Preview em Tempo Real
              </h2>

              {/* Status pill */}
              <div className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                config.isActive
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-white/5 border border-white/10 text-white/40'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${config.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
                {config.isActive ? 'Anúncio ATIVO' : 'Anúncio desativado'}
              </div>

              {/* Mini preview of modal */}
              <div
                className="relative overflow-hidden rounded-[20px] border border-white/10 p-5"
                style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,27,75,0.98) 50%, rgba(15,23,42,0.98) 100%)' }}
              >
                {/* Decorative glows */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-40" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)', filter: 'blur(20px)' }} />
                  <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.5) 0%, transparent 70%)', filter: 'blur(20px)' }} />
                </div>

                {/* Border pulse */}
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[20px]" style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4, #f59e0b, #06b6d4, #7c3aed)' }} />

                <div className="relative z-10">
                  {/* Badge */}
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-widest text-white/50">
                    <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                    Aviso Oficial
                  </div>

                  {/* Emoji */}
                  <div className="my-3 text-center">
                    <span className="text-4xl">{config.emoji || '📢'}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-center text-base font-black text-white mb-2">
                    {config.title || 'Título do Anúncio'}
                  </h3>

                  {/* Message */}
                  <div className="mb-4 rounded-xl border border-white/5 bg-white/3 px-3 py-2.5 text-center text-xs text-white/65 whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {config.message || 'Sua mensagem aparecerá aqui...'}
                  </div>

                  {/* Buttons preview */}
                  <div className="flex flex-col gap-2">
                    {config.buttons.primary.url && (
                      <div
                        className="w-full rounded-xl py-2.5 text-center text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)' }}
                      >
                        {config.buttons.primary.label || 'Botão Primário'} →
                      </div>
                    )}
                    <div className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-xs text-white/40">
                      {config.buttons.secondary.label || 'Continuar para o site'} (bloqueado por 5s)
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-white/25">
                Preview aproximado — veja o modal real clicando em "Ver Preview"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Full Preview Modal */}
      {showPreview && (
        <>
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setShowPreview(false)}
            style={{ backdropFilter: 'blur(14px)', background: 'rgba(2,8,23,0.82)' }}
          />
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 shadow-[0_40px_120px_rgba(2,8,23,0.9)] pointer-events-auto"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,27,75,0.97) 50%, rgba(15,23,42,0.97) 100%)' }}
            >
              {/* Glows */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-40" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)', filter: 'blur(40px)' }} />
                <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.6) 0%, transparent 70%)', filter: 'blur(40px)' }} />
              </div>
              {/* Top border */}
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4, #f59e0b, #06b6d4, #7c3aed)' }} />

              <div className="relative z-10 px-8 pb-8 pt-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.35em] text-white/60">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    Aviso Oficial
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/50">
                    <svg className="h-3 w-3 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="50 30" />
                    </svg>
                    Preview — 5s
                  </div>
                </div>
                <div className="mb-4 text-center">
                  <span className="inline-block text-7xl" style={{ filter: 'drop-shadow(0 0 24px rgba(251,191,36,0.5))' }}>
                    {config.emoji || '📢'}
                  </span>
                </div>
                <h2 className="mb-3 text-center text-2xl font-black text-white">
                  {config.title || 'Título do Anúncio'}
                </h2>
                <div className="mb-7 rounded-2xl border border-white/5 px-5 py-4 text-center text-sm leading-relaxed text-white/75 whitespace-pre-wrap" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {config.message || 'Sua mensagem aparecerá aqui...'}
                </div>
                <div className="flex flex-col gap-3">
                  {config.buttons.primary.url && (
                    <div
                      className="w-full rounded-2xl py-3.5 text-center text-sm font-bold text-white cursor-default"
                      style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)', boxShadow: '0 8px 32px rgba(124,58,237,0.5)' }}
                    >
                      {config.buttons.primary.label || 'Botão Primário'} →
                    </div>
                  )}
                  <div className="w-full rounded-2xl border border-white/5 bg-white/3 py-3.5 text-center text-sm text-white/30 cursor-default">
                    {config.buttons.secondary.label || 'Continuar para o site'} (desbloqueado após 5s)
                  </div>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 py-2 text-sm text-white/50 hover:bg-white/10 transition-colors"
                >
                  ✕ Fechar Preview
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
