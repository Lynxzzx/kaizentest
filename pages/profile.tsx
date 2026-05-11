import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import axios from 'axios'
import toast from 'react-hot-toast'

interface UserProfile {
  id: string
  username: string
  email: string | null
  role: string
  twoFactorEnabled: boolean
  emailVerified: boolean
  createdAt: string
  lastLoginAt: string | null
}

export default function Profile() {
  useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [changingPassword, setChangingPassword] = useState(false)

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorSecret, setTwoFactorSecret] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false)

  const [emailCode, setEmailCode] = useState('')
  const [sendingEmailCode, setSendingEmailCode] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)

  useEffect(() => {
    if (!session) { router.push('/login'); return }
    loadProfile()
  }, [session, router])

  const loadProfile = async () => {
    try {
      const response = await axios.get('/api/profile')
      setProfile(response.data); setTwoFactorEnabled(response.data.twoFactorEnabled)
    } catch { toast.error('Erro ao carregar perfil') }
    finally { setLoading(false) }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('As senhas não coincidem'); return }
    if (passwordForm.newPassword.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
    setChangingPassword(true)
    try {
      await axios.put('/api/profile/password', { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })
      toast.success('Senha alterada com sucesso!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error: any) { toast.error(error.response?.data?.error || 'Erro ao alterar senha') }
    finally { setChangingPassword(false) }
  }

  const handleEnableTwoFactor = async () => {
    try {
      const response = await axios.post('/api/profile/2fa/setup')
      setTwoFactorSecret(response.data.secret); setQrCodeUrl(response.data.qrCodeUrl)
      setShowTwoFactorSetup(true)
      if (response.data.debugCode) toast.success(`Código: ${response.data.debugCode}`)
    } catch { toast.error('Erro ao configurar 2FA') }
  }

  const handleVerifyTwoFactor = async () => {
    if (!twoFactorCode || twoFactorCode.length !== 6) { toast.error('Código inválido'); return }
    try {
      await axios.post('/api/profile/2fa/enable', { code: twoFactorCode, secret: twoFactorSecret })
      toast.success('2FA ativado!'); setTwoFactorEnabled(true); setShowTwoFactorSetup(false)
      setTwoFactorCode(''); setTwoFactorSecret(''); setQrCodeUrl('')
    } catch (error: any) { toast.error(error.response?.data?.error || 'Código inválido') }
  }

  const handleDisableTwoFactor = async () => {
    if (!confirm('Tem certeza que deseja desativar o 2FA?')) return
    try { await axios.delete('/api/profile/2fa'); toast.success('2FA desativado'); setTwoFactorEnabled(false) }
    catch { toast.error('Erro ao desativar 2FA') }
  }

  const handleSendEmailCode = async () => {
    if (!profile?.email) { toast.error('Email não encontrado'); return }
    setSendingEmailCode(true)
    try {
      const response = await axios.post('/api/profile/email/send-code')
      toast.success('Código enviado para seu email!')
      if (response.data.debugCode) toast.success(`Código: ${response.data.debugCode}`)
    } catch { toast.error('Erro ao enviar código') }
    finally { setSendingEmailCode(false) }
  }

  const handleVerifyEmail = async () => {
    if (!emailCode || emailCode.length !== 6) { toast.error('Código inválido'); return }
    setVerifyingEmail(true)
    try {
      await axios.post('/api/profile/email/verify', { code: emailCode })
      toast.success('Email verificado!'); setEmailCode(''); loadProfile()
    } catch (error: any) { toast.error(error.response?.data?.error || 'Código inválido') }
    finally { setVerifyingEmail(false) }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="flex items-center gap-3 text-white/55">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
          Carregando perfil...
        </div>
      </div>
    )
  }
  if (!session || !profile) return null

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[450px] w-[450px] rounded-full bg-aurora-violet/10 blur-[140px]" />
        <div className="absolute right-0 top-1/3 h-[450px] w-[450px] rounded-full bg-aurora-cyan/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-up">
          <div className="flex items-center gap-4">
            <span className="relative inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl">
              <span className="absolute inset-0 bg-gradient-to-br from-aurora-violet via-aurora-magenta to-aurora-cyan" />
              <span className="absolute inset-[2px] rounded-2xl bg-[#0a0a13]" />
              <span className="relative text-2xl font-bold text-white">{session.user.username?.charAt(0).toUpperCase()}</span>
            </span>
            <div>
              <p className="eyebrow">Sua conta</p>
              <h1 className="mt-1 text-display text-4xl font-bold text-gradient">{profile.username}</h1>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <span className="pill pill-violet">{String(profile.role).toUpperCase()}</span>
                {profile.emailVerified && <span className="pill pill-mint">✓ Email verificado</span>}
                {twoFactorEnabled && <span className="pill pill-cyan">2FA Ativo</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="surface-card-elevated p-7 mb-6 animate-fade-up delay-100">
          <h2 className="text-display text-xl font-bold text-white mb-5">Informações do perfil</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Info label="Usuário" value={profile.username} />
            <Info label="Email" value={profile.email || 'Não informado'} />
            <Info label="Membro desde" value={new Date(profile.createdAt).toLocaleDateString('pt-BR')} />
            <Info label="Último acesso" value={profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleDateString('pt-BR') : 'Nunca'} />
          </div>
        </div>

        {/* Email verify */}
        {!profile.emailVerified && profile.email && (
          <div className="surface-card p-7 mb-6 animate-fade-up delay-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-display text-xl font-bold text-white">Verificação de email</h2>
              <span className="pill pill-gold">Pendente</span>
            </div>
            <p className="text-sm text-white/55 mb-4">Verifique seu email para mais segurança e acesso completo.</p>
            <div className="flex gap-2">
              <button onClick={handleSendEmailCode} disabled={sendingEmailCode} className="btn btn-primary">
                {sendingEmailCode ? 'Enviando...' : 'Enviar código'}
              </button>
            </div>
            {sendingEmailCode && (
              <div className="mt-4 space-y-3 animate-fade-up">
                <input type="text" value={emailCode} onChange={(e) => setEmailCode(e.target.value)}
                  placeholder="Código de 6 dígitos" className="input-premium text-mono text-center text-lg tracking-[0.5em]" maxLength={6} />
                <button onClick={handleVerifyEmail} disabled={verifyingEmail || !emailCode} className="btn btn-primary">
                  {verifyingEmail ? 'Verificando...' : 'Verificar'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Password */}
        <div className="surface-card p-7 mb-6 animate-fade-up delay-300">
          <h2 className="text-display text-xl font-bold text-white mb-5">Alterar senha</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Senha atual</label>
              <input type="password" value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="input-premium" required />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Nova senha</label>
              <input type="password" value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="input-premium" required minLength={6} />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Confirmar nova senha</label>
              <input type="password" value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="input-premium" required minLength={6} />
            </div>
            <button type="submit" disabled={changingPassword} className="btn btn-primary w-full">
              {changingPassword ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>
        </div>

        {/* 2FA */}
        <div className="surface-card p-7 animate-fade-up delay-400">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-display text-xl font-bold text-white">Autenticação 2FA</h2>
            <span className={twoFactorEnabled ? 'pill pill-mint' : 'pill pill-rose'}>
              {twoFactorEnabled ? '✓ Ativado' : '✕ Desativado'}
            </span>
          </div>
          <p className="text-sm text-white/55 mb-4">
            {twoFactorEnabled ? 'Sua conta está protegida com autenticação em duas etapas.' : 'Adicione uma camada extra de segurança à sua conta.'}
          </p>
          {twoFactorEnabled ? (
            <button onClick={handleDisableTwoFactor} className="btn btn-danger">Desativar 2FA</button>
          ) : (
            <button onClick={handleEnableTwoFactor} className="btn btn-primary">Ativar 2FA</button>
          )}

          {showTwoFactorSetup && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 animate-fade-up">
              <h3 className="text-lg font-bold text-white mb-3">Configurar 2FA</h3>
              {qrCodeUrl && (
                <div className="mb-4">
                  <p className="text-sm text-white/55 mb-3">Escaneie com seu app autenticador:</p>
                  <div className="inline-block rounded-xl bg-white p-3">
                    <img src={qrCodeUrl} alt="QR 2FA" className="h-44 w-44" />
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <input type="text" value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Código de 6 dígitos" className="input-premium text-mono text-center text-lg tracking-[0.5em]" maxLength={6} />
                <div className="flex gap-2">
                  <button onClick={handleVerifyTwoFactor} disabled={!twoFactorCode} className="btn btn-primary flex-1">Verificar</button>
                  <button onClick={() => { setShowTwoFactorSetup(false); setTwoFactorCode(''); setTwoFactorSecret(''); setQrCodeUrl('') }} className="btn btn-ghost">Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="eyebrow mb-1.5">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
