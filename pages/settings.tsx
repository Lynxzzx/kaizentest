import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTheme } from '@/contexts/ThemeContext'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function Settings() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { theme, setTheme, isLoading } = useTheme()
  const [saving, setSaving] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])

  const handleThemeChange = async (newTheme: 'dark' | 'light' | 'default') => {
    setSaving(true)
    try { setTheme(newTheme); toast.success('Tema atualizado!') }
    catch (error: any) { toast.error(error.response?.data?.error || 'Erro ao atualizar') }
    finally { setSaving(false) }
  }

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault()
    if (passwordData.newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return }
    if (passwordData.newPassword !== passwordData.confirmPassword) { toast.error('Senhas não conferem'); return }
    setPasswordLoading(true)
    try {
      await axios.put('/api/users/password', { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword })
      toast.success('Senha alterada!')
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error: any) { toast.error(error.response?.data?.error || 'Erro ao alterar senha') }
    finally { setPasswordLoading(false) }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
        Carregando...
      </div>
    )
  }
  if (!session) return null

  const themes: Array<{ id: 'dark' | 'light' | 'default'; label: string; desc: string; preview: string }> = [
    { id: 'dark',    label: 'Aurora', desc: 'Dark moderno com mesh gradient', preview: 'bg-gradient-to-br from-aurora-violet via-aurora-magenta to-aurora-cyan' },
    { id: 'light',   label: 'Light',   desc: 'Claro e limpo',                  preview: 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100' },
    { id: 'default', label: 'System',  desc: 'Padrão do sistema',              preview: 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400' }
  ]

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-0 top-1/4 h-[450px] w-[450px] rounded-full bg-aurora-violet/10 blur-[140px]" />
      </div>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-10 animate-fade-up">
          <p className="eyebrow">Configurações</p>
          <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient">Preferências</h1>
          <p className="mt-2 text-sm text-white/55">Personalize sua experiência no Kaizen.</p>
        </div>

        {/* Theme */}
        <div className="surface-card-elevated p-7 mb-6 animate-fade-up delay-100">
          <h2 className="text-display text-xl font-bold text-white mb-1">Aparência</h2>
          <p className="text-sm text-white/55 mb-5">Escolha o tema que melhor se adapta ao seu estilo.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {themes.map((th) => (
              <button
                key={th.id}
                onClick={() => handleThemeChange(th.id)}
                disabled={saving || theme === th.id}
                className={`group text-left rounded-2xl border p-4 transition-all ${
                  theme === th.id
                    ? 'border-aurora-violet/55 bg-aurora-violet/10 shadow-glow-violet'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                }`}
              >
                <div className={`mb-3 h-20 w-full rounded-xl ${th.preview} ring-1 ring-white/10`} />
                <div className="flex items-center justify-between">
                  <p className="text-display text-base font-bold text-white">{th.label}</p>
                  {theme === th.id && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-aurora-violet/30 text-aurora-violet">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-white/55 mt-1">{th.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="surface-card p-7 mb-6 animate-fade-up delay-200">
          <h2 className="text-display text-xl font-bold text-white mb-1">Segurança</h2>
          <p className="text-sm text-white/55 mb-5">Atualize sua senha regularmente.</p>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Senha atual</label>
              <input type="password" value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="input-premium" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Nova senha</label>
                <input type="password" value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="input-premium" required />
              </div>
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Confirmar</label>
                <input type="password" value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="input-premium" required />
              </div>
            </div>
            <button type="submit" disabled={passwordLoading} className="btn btn-primary w-full">
              {passwordLoading ? 'Salvando...' : 'Atualizar senha'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-aurora-cyan/30 bg-aurora-cyan/8 p-4 animate-fade-up delay-300">
          <p className="text-sm text-aurora-cyan">
            <span className="font-semibold">💡 Dica:</span> Sua preferência é salva automaticamente e aplicada em todas as páginas.
          </p>
        </div>
      </div>
    </div>
  )
}
