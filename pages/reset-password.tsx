import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n-helper'

export default function ResetPassword() {
  const router = useRouter()
  const { token } = router.query
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenReady, setTokenReady] = useState(false)

  useEffect(() => { if (router.isReady) setTokenReady(true) }, [router.isReady])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!token || typeof token !== 'string') { toast.error('Token inválido. Solicite uma nova recuperação.'); return }
    if (password.length < 6) { toast.error('A senha deve ter no mínimo 6 caracteres'); return }
    if (password !== confirmPassword) { toast.error('As senhas não conferem'); return }

    setLoading(true)
    try {
      await axios.post('/api/auth/reset-password', { token, password })
      toast.success('Senha redefinida com sucesso. Faça login novamente.')
      router.push('/login')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao redefinir senha')
    } finally { setLoading(false) }
  }

  if (!tokenReady) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="flex items-center gap-3 text-white/55">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/>
          </svg>
          Carregando...
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-aurora-violet/15 blur-[120px]" />
        <div className="absolute inset-0 bg-grid-fine opacity-40" />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 text-center">
          <p className="eyebrow">Sua conta, protegida</p>
          <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient">Nova senha</h1>
          <p className="mt-3 text-sm text-white/55">Crie uma nova senha forte para proteger sua conta.</p>
        </div>

        <div className="surface-card-elevated p-7 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('password')}</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="input-premium" placeholder="Nova senha" required autoFocus
              />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('confirmPassword') || 'Confirmar senha'}</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-premium" placeholder="Repita a nova senha" required
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
              {loading ? 'Salvando...' : 'Atualizar senha'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-white/55">
          <Link href="/login" className="hover:text-white transition-colors">Voltar para o login</Link>
        </p>
      </div>
    </div>
  )
}
