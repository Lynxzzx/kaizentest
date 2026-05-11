import { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n-helper'

export default function ForgotPassword() {
  useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email) { toast.error('Informe seu email cadastrado'); return }
    setLoading(true)
    try {
      const response = await axios.post('/api/auth/forgot-password', { email })
      setCodeSent(true)
      toast.success('Código enviado para seu email!')
      if (response.data.debugCode) toast.success(`Código de redefinição: ${response.data.debugCode}`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao solicitar redefinição')
    } finally { setLoading(false) }
  }

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!resetCode || !newPassword || !confirmPassword) { toast.error('Preencha todos os campos'); return }
    if (newPassword !== confirmPassword) { toast.error('As senhas não coincidem'); return }
    if (newPassword.length < 6) { toast.error('A senha deve ter no mínimo 6 caracteres'); return }

    setResetting(true)
    try {
      await axios.post('/api/auth/reset-password', { email, code: resetCode, newPassword })
      toast.success('Senha redefinida com sucesso!')
      setTimeout(() => { window.location.href = '/login' }, 1800)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao redefinir senha')
    } finally { setResetting(false) }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-aurora-cyan/15 blur-[120px]" />
        <div className="absolute inset-0 bg-grid-fine opacity-40" />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 text-center">
          <p className="eyebrow">Recuperação de conta</p>
          <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient">
            {codeSent ? 'Definir nova senha' : 'Esqueceu a senha?'}
          </h1>
          <p className="mt-3 text-sm text-white/55">
            {codeSent ? 'Digite o código que enviamos e crie uma nova senha forte.' : 'Informe o email cadastrado e enviaremos um código para redefinir sua senha.'}
          </p>
        </div>

        <div className="surface-card-elevated p-7 sm:p-8">
          {!codeSent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Email cadastrado</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input-premium" placeholder="seuemail@exemplo.com" required autoFocus
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
                {loading ? 'Enviando...' : 'Enviar código de redefinição'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Código de 6 dígitos</label>
                <input
                  type="text" value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-premium text-mono text-center text-lg tracking-[0.5em]"
                  placeholder="000000" maxLength={6} required autoFocus
                />
              </div>
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Nova senha</label>
                <input
                  type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="input-premium" placeholder="Mínimo 6 caracteres" minLength={6} required
                />
              </div>
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Confirmar nova senha</label>
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-premium" placeholder="Repita a nova senha" minLength={6} required
                />
              </div>
              <button type="submit" disabled={resetting} className="btn btn-primary btn-lg w-full">
                {resetting ? 'Redefinindo...' : 'Redefinir senha'}
              </button>
              <button type="button" onClick={() => setCodeSent(false)} className="w-full pt-1 text-xs text-white/45 hover:text-white/70 transition-colors">
                Enviar código para outro email
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-white/55">
          <Link href="/login" className="hover:text-white transition-colors">Voltar ao login</Link>
          <span className="text-white/20">·</span>
          <Link href="/" className="hover:text-white transition-colors">Página inicial</Link>
        </div>
      </div>
    </div>
  )
}
