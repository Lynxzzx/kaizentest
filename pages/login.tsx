import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import Link from 'next/link'
import toast from 'react-hot-toast'
import axios from 'axios'
import ReCaptcha, { useReCaptcha, ReCaptchaBadge } from '@/components/ReCaptcha'

export default function Login() {
  const { t } = useTranslation()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const [honeypot, setHoneypot] = useState('')
  const formStartTimeRef = useRef<number>(Date.now())
  const [loginAttempts, setLoginAttempts] = useState(0)

  const { isReady: recaptchaReady, executeRecaptcha, isConfigured: recaptchaConfigured } = useReCaptcha()
  const [_recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

  useEffect(() => {
    formStartTimeRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (loginAttempts >= 3) {
      toast.error('Muitas tentativas. Por favor, verifique suas credenciais.', { duration: 5000 })
    }
  }, [loginAttempts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (honeypot) { toast.error('Verificação de segurança falhou.'); return }
    if (!username.trim()) { toast.error('Digite seu username'); return }
    if (!password) { toast.error('Digite sua senha'); return }

    setLoading(true)
    try {
      if (!recaptchaConfigured) {
        toast.error('Verificação de segurança não configurada.'); setLoading(false); return
      }
      let token = await executeRecaptcha('login')
      if (!token && !recaptchaReady) {
        await new Promise(r => setTimeout(r, 1000))
        token = await executeRecaptcha('login')
      }
      if (!token) { toast.error('Erro ao verificar segurança. Recarregue a página.'); setLoading(false); return }
      setRecaptchaToken(token)

      try {
        const validateResponse = await axios.post('/api/auth/validate-login', {
          username: username.trim(), recaptchaToken: token, honeypot, formStartTime: formStartTimeRef.current
        })
        if (!validateResponse.data.allowed && validateResponse.status !== 200) {
          toast.error(validateResponse.data.error || 'Verificação de segurança falhou.')
          setRecaptchaToken(null); return
        }
      } catch (validateError: any) {
        if (validateError.response?.status === 403) {
          toast.error(validateError.response.data.error || 'Acesso temporariamente bloqueado.')
          setRecaptchaToken(null); return
        }
      }

      const result = await signIn('credentials', { redirect: false, username: username.trim(), password })
      if (result?.error) {
        setLoginAttempts(p => p + 1); toast.error(t('invalidCredentials')); setRecaptchaToken(null)
      } else {
        try { await axios.post('/api/auth/validate-login', { username: username.trim(), resetAttempts: true }) } catch {}
        toast.success(t('loginSuccess'))
        router.push('/dashboard')
      }
    } catch (error: any) {
      setLoginAttempts(p => p + 1); setRecaptchaToken(null)
      const msg = error.response?.data?.error || error.message || t('errorLoggingIn')
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-aurora-violet/20 blur-[120px]" />
        <div className="absolute inset-0 bg-grid-fine opacity-40" />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 text-center">
          <p className="eyebrow">Bem-vindo de volta</p>
          <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient">
            Entrar
          </h1>
          <p className="mt-3 text-sm text-white/55">{t('enterYourAccount')}</p>
        </div>

        <div className="surface-card-elevated relative p-7 sm:p-8">
          {loginAttempts >= 3 && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-aurora-gold/30 bg-aurora-gold/10 p-3.5 text-[13px] text-aurora-gold">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.26 3.1c.76-1.36 2.72-1.36 3.48 0l5.58 9.92c.75 1.33-.21 2.98-1.74 2.98H4.42c-1.53 0-2.49-1.65-1.74-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
              <span>Várias tentativas detectadas. <Link href="/forgot-password" className="font-bold underline">Redefinir senha</Link></span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              <label htmlFor="company">Company</label>
              <input type="text" id="company" name="company" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>

            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('username')}</label>
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                className="input-premium" placeholder={t('enterUsername')} required autoComplete="username" autoFocus
              />
            </div>

            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input-premium pr-12" placeholder={t('enterPassword')} required autoComplete="current-password"
                />
                <button
                  type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/45 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <ReCaptcha onVerify={(token) => setRecaptchaToken(token)} action="login" />
            <ReCaptchaBadge />

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-[12.5px] font-semibold text-aurora-violet hover:text-aurora-magenta transition-colors">
                Esqueceu a senha?
              </Link>
            </div>

            <button type="submit" disabled={loading || !recaptchaConfigured} className="btn btn-primary btn-lg w-full">
              {loading ? (
                <>
                  <svg className="-ml-1 mr-1 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/>
                  </svg>
                  {t('loggingIn')}
                </>
              ) : t('login')}
            </button>

            <p className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-white/40">
              <svg className="h-3.5 w-3.5 text-aurora-mint" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.17 5A11.95 11.95 0 0010 1.94 11.95 11.95 0 0017.83 5c.11.65.17 1.32.17 2 0 5.23-3.34 9.67-8 11.32C5.34 16.67 2 12.23 2 7c0-.68.06-1.35.17-2zm11.54 3.71a1 1 0 00-1.41-1.42L9 10.59 7.71 9.29a1 1 0 00-1.42 1.42l2 2a1 1 0 001.42 0l4-4z" clipRule="evenodd"/></svg>
              Conexão segura • End-to-end encrypted
            </p>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-white/55">
          {t('dontHaveAccount')}{' '}
          <Link href="/register" className="font-semibold text-white hover:text-aurora-violet transition-colors">
            {t('createAccount')}
          </Link>
        </p>
      </div>
    </div>
  )
}
