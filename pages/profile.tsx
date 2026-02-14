import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import Layout from '@/components/Layout'
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
  const { t } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // Password change states
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [changingPassword, setChangingPassword] = useState(false)

  // 2FA states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorSecret, setTwoFactorSecret] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false)

  // Email verification states
  const [emailCode, setEmailCode] = useState('')
  const [sendingEmailCode, setSendingEmailCode] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)

  // Forgot password states
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordCode, setForgotPasswordCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [sendingForgotCode, setSendingForgotCode] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }
    loadProfile()
  }, [session, router])

  const loadProfile = async () => {
    try {
      const response = await axios.get('/api/profile')
      setProfile(response.data)
      setTwoFactorEnabled(response.data.twoFactorEnabled)
    } catch (error) {
      toast.error('Erro ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setChangingPassword(true)
    try {
      await axios.put('/api/profile/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
      toast.success('Senha alterada com sucesso!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao alterar senha')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleEnableTwoFactor = async () => {
    try {
      const response = await axios.post('/api/profile/2fa/setup')
      setTwoFactorSecret(response.data.secret)
      setQrCodeUrl(response.data.qrCodeUrl)
      setShowTwoFactorSetup(true)
    } catch (error) {
      toast.error('Erro ao configurar 2FA')
    }
  }

  const handleVerifyTwoFactor = async () => {
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      toast.error('Código inválido')
      return
    }

    try {
      await axios.post('/api/profile/2fa/enable', {
        code: twoFactorCode,
        secret: twoFactorSecret
      })
      toast.success('2FA ativado com sucesso!')
      setTwoFactorEnabled(true)
      setShowTwoFactorSetup(false)
      setTwoFactorCode('')
      setTwoFactorSecret('')
      setQrCodeUrl('')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Código inválido')
    }
  }

  const handleDisableTwoFactor = async () => {
    if (!confirm('Tem certeza que deseja desativar o 2FA?')) return

    try {
      await axios.delete('/api/profile/2fa')
      toast.success('2FA desativado com sucesso!')
      setTwoFactorEnabled(false)
    } catch (error) {
      toast.error('Erro ao desativar 2FA')
    }
  }

  const handleSendEmailCode = async () => {
    if (!profile?.email) {
      toast.error('Email não encontrado')
      return
    }

    setSendingEmailCode(true)
    try {
      await axios.post('/api/profile/email/send-code')
      toast.success('Código enviado para seu email!')
    } catch (error) {
      toast.error('Erro ao enviar código')
    } finally {
      setSendingEmailCode(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (!emailCode || emailCode.length !== 6) {
      toast.error('Código inválido')
      return
    }

    setVerifyingEmail(true)
    try {
      await axios.post('/api/profile/email/verify', { code: emailCode })
      toast.success('Email verificado com sucesso!')
      setEmailCode('')
      loadProfile()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Código inválido')
    } finally {
      setVerifyingEmail(false)
    }
  }

  const handleSendForgotPasswordCode = async () => {
    if (!forgotPasswordEmail) {
      toast.error('Digite seu email')
      return
    }

    setSendingForgotCode(true)
    try {
      await axios.post('/api/auth/forgot-password', { email: forgotPasswordEmail })
      toast.success('Código enviado para seu email!')
    } catch (error) {
      toast.error('Erro ao enviar código')
    } finally {
      setSendingForgotCode(false)
    }
  }

  const handleResetPassword = async () => {
    if (!forgotPasswordCode || !newPassword || !confirmNewPassword) {
      toast.error('Preencha todos os campos')
      return
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setResettingPassword(true)
    try {
      await axios.post('/api/auth/reset-password', {
        email: forgotPasswordEmail,
        code: forgotPasswordCode,
        newPassword: newPassword
      })
      toast.success('Senha redefinida com sucesso!')
      setShowForgotPassword(false)
      setForgotPasswordEmail('')
      setForgotPasswordCode('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao redefinir senha')
    } finally {
      setResettingPassword(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#000000] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            <p className="mt-4 text-gray-500">Carregando perfil...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!session || !profile) return null

  return (
    <Layout>
      <div className="min-h-screen bg-[#000000] text-gray-100 pb-20">
        {/* Advanced Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-600/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center bg-fixed [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        </div>

        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/20 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-opacity" />
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white relative">
                  {session.user.username?.charAt(0).toUpperCase()}
                </div>
              </div>
              <div>
                <h1 className="font-bold text-xl text-white">Meu Perfil</h1>
                <p className="text-sm text-gray-400">Configurações de segurança</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="group relative overflow-hidden px-6 py-2.5 rounded-full glass-panel border border-white/20 hover:bg-white/5 transition-all duration-300">
                <span className="relative z-10">⚡ Dashboard</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            </div>
          </div>
        </nav>

        <main className="relative z-10 pt-32 pb-24 px-6">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Profile Info Card */}
            <div className="glass-card rounded-3xl p-8 border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Informações do Perfil</h2>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {String(profile.role).toUpperCase()}
                  </span>
                  {profile.emailVerified && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ Email Verificado
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Usuário</label>
                  <div className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white">
                    {profile.username}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Email</label>
                  <div className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white">
                    {profile.email || 'Não informado'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Membro desde</label>
                  <div className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white">
                    {new Date(profile.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Último acesso</label>
                  <div className="bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white">
                    {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleDateString('pt-BR') : 'Nunca'}
                  </div>
                </div>
              </div>
            </div>

            {/* Email Verification */}
            {!profile.emailVerified && profile.email && (
              <div className="glass-card rounded-3xl p-8 border border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Verificação de Email</h2>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    Pendente
                  </span>
                </div>
                
                <div className="space-y-4">
                  <p className="text-gray-400">Verifique seu email para maior segurança e acesso completo.</p>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleSendEmailCode}
                      disabled={sendingEmailCode}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all"
                    >
                      {sendingEmailCode ? 'Enviando...' : 'Enviar Código'}
                    </button>
                  </div>
                  
                  {sendingEmailCode && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value)}
                        placeholder="Digite o código de 6 dígitos"
                        className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500"
                        maxLength={6}
                      />
                      <button
                        onClick={handleVerifyEmail}
                        disabled={verifyingEmail || !emailCode}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all"
                      >
                        {verifyingEmail ? 'Verificando...' : 'Verificar Email'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Change Password */}
            <div className="glass-card rounded-3xl p-8 border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Alterar Senha</h2>
                <button
                  onClick={() => setShowForgotPassword(true)}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                >
                  Esqueci minha senha
                </button>
              </div>
              
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Senha Atual</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Nova Senha</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    required
                    minLength={6}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    required
                    minLength={6}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50"
                >
                  {changingPassword ? 'Alterando...' : 'Alterar Senha'}
                </button>
              </form>
            </div>

            {/* Two-Factor Authentication */}
            <div className="glass-card rounded-3xl p-8 border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Autenticação em Duas Etapas (2FA)</h2>
                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  twoFactorEnabled 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                }`}>
                  {twoFactorEnabled ? '✓ Ativado' : '✕ Desativado'}
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-400">
                  {twoFactorEnabled 
                    ? 'Sua conta está protegida com autenticação em duas etapas.' 
                    : 'Adicione uma camada extra de segurança à sua conta.'}
                </p>
                
                {twoFactorEnabled ? (
                  <button
                    onClick={handleDisableTwoFactor}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
                  >
                    Desativar 2FA
                  </button>
                ) : (
                  <button
                    onClick={handleEnableTwoFactor}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all"
                  >
                    Ativar 2FA
                  </button>
                )}
                
                {showTwoFactorSetup && (
                  <div className="mt-6 p-6 bg-black/40 border border-white/20 rounded-xl">
                    <h3 className="text-lg font-bold text-white mb-4">Configurar 2FA</h3>
                    
                    {qrCodeUrl && (
                      <div className="mb-4">
                        <p className="text-gray-400 mb-3">Escaneie este QR code com seu aplicativo autenticador:</p>
                        <div className="bg-white p-4 rounded-xl inline-block">
                          <img src={qrCodeUrl} alt="QR Code 2FA" className="w-48 h-48" />
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Digite o código de 6 dígitos"
                        className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500"
                        maxLength={6}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleVerifyTwoFactor}
                          disabled={!twoFactorCode}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                        >
                          Verificar e Ativar
                        </button>
                        <button
                          onClick={() => {
                            setShowTwoFactorSetup(false)
                            setTwoFactorCode('')
                            setTwoFactorSecret('')
                            setQrCodeUrl('')
                          }}
                          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card rounded-3xl p-8 max-w-md w-full border border-white/10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Redefinir Senha</h2>
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500"
                  />
                </div>
                
                <button
                  onClick={handleSendForgotPasswordCode}
                  disabled={sendingForgotCode}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                >
                  {sendingForgotCode ? 'Enviando...' : 'Enviar Código'}
                </button>
                
                {sendingForgotCode && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={forgotPasswordCode}
                      onChange={(e) => setForgotPasswordCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Código de 6 dígitos"
                      className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500"
                      maxLength={6}
                    />
                    
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nova senha"
                      className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500"
                    />
                    
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirmar nova senha"
                      className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500"
                    />
                    
                    <button
                      onClick={handleResetPassword}
                      disabled={resettingPassword}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                    >
                      {resettingPassword ? 'Redefinindo...' : 'Redefinir Senha'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .glass-card {
            background: rgba(25, 25, 25, 0.3);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
        `}</style>
      </div>
    </Layout>
  )
}