import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import Link from 'next/link'
import axios from 'axios'
import { getStoredDeviceFingerprint } from '@/lib/device-fingerprint'
import toast from 'react-hot-toast'
import ReCaptcha, { useReCaptcha, ReCaptchaBadge } from '@/components/ReCaptcha'
import { fetchRecaptchaToken, recaptchaLoadErrorMessage } from '@/lib/recaptcha-client'
import VisualCaptcha, { useCaptcha as useVisualCaptcha } from '@/components/VisualCaptcha'

export default function Register() {
  const { t } = useTranslation()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [affiliateRef, setAffiliateRef] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  const [honeypot, setHoneypot] = useState('')
  const formStartTimeRef = useRef<number>(Date.now())

  const { 
    isReady: recaptchaReady, 
    executeRecaptcha, 
    isConfigured: recaptchaConfigured,
    loadFailed: recaptchaLoadFailed 
  } = useReCaptcha()
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

  // Fallback CAPTCHA Visual
  const [useVisualFallback, setUseVisualFallback] = useState(false)
  const { 
    captchaId, setCaptchaId, captchaValue, setCaptchaValue, 
    captchaError, resetCaptcha 
  } = useVisualCaptcha()

  // Se o reCAPTCHA falhar ao carregar, ativa fallback visual
  useEffect(() => {
    if (recaptchaLoadFailed && recaptchaConfigured) {
      setUseVisualFallback(true)
    }
  }, [recaptchaLoadFailed, recaptchaConfigured])

  useEffect(() => {
    if (router.query.ref && typeof router.query.ref === 'string') {
      setAffiliateRef(router.query.ref.toUpperCase())
    }
  }, [router.query.ref])

  useEffect(() => { formStartTimeRef.current = Date.now() }, [])

  useEffect(() => {
    if (!recaptchaReady) return
    let cancelled = false
    const warm = async () => {
      const token = await executeRecaptcha('register')
      if (!cancelled && token) setRecaptchaToken(token)
    }
    warm()
    const interval = setInterval(warm, 90_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [recaptchaReady, executeRecaptcha])

  const handleSendVerificationCode = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Email inválido'); return }
    setLoading(true)
    try {
      const response = await axios.post('/api/auth/send-verification-code', { email, username })
      setCodeSent(true)
      toast.success('Código enviado para seu email!')
      if (response.data.debugCode) toast.success(`Código de verificação: ${response.data.debugCode}`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao enviar código')
    } finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (honeypot) { toast.error('Verificação de segurança falhou.'); return }
    if (password !== confirmPassword) { toast.error(t('passwordsDontMatch')); return }
    if (password.length < 6) { toast.error(t('passwordMinLength')); return }
    if (username.length < 3) { toast.error('Username deve ter pelo menos 3 caracteres'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { toast.error('Username só pode conter letras, números e underscore'); return }
    if (!email || !email.trim()) { toast.error('Email é obrigatório'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Email inválido'); return }
    if (!verificationCode || verificationCode.length !== 6) { toast.error('Código de verificação inválido'); return }

    setLoading(true)
    try {
      let token = null
      let currentCaptchaId = null
      let currentCaptchaCode = null

      if (!useVisualFallback) {
        token = await fetchRecaptchaToken(executeRecaptcha, 'register', {
          isReady: recaptchaReady,
          cachedToken: recaptchaToken,
        })
        if (!token) {
          setUseVisualFallback(true)
          toast.error('Não foi possível carregar a verificação automática. Por favor, use o código da imagem.', { duration: 5000 })
          setLoading(false)
          return
        }
        setRecaptchaToken(token)
      } else {
        if (!captchaValue) {
          toast.error('Por favor, digite o código da imagem'); setLoading(false); return
        }
        currentCaptchaId = captchaId
        currentCaptchaCode = captchaValue
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      const deviceFingerprint = getStoredDeviceFingerprint()

      await axios.post('/api/auth/register', {
        username, email, password, deviceFingerprint,
        affiliateRef: affiliateRef || null,
        recaptchaToken: token || undefined,
        captchaId: currentCaptchaId || undefined,
        captchaCode: currentCaptchaCode || undefined,
        honeypot, formStartTime: formStartTimeRef.current, verificationCode
      }, { signal: controller.signal, timeout: 30000 })
      clearTimeout(timeoutId)

      toast.success(t('accountCreatedSuccess'))
      const loginResult = await signIn('credentials', { redirect: false, username, password })
      if (loginResult?.error) {
        toast.error(t('accountCreatedButLoginError')); router.push('/login')
      } else {
        toast.success(t('loginSuccess')); router.push('/dashboard')
      }
    } catch (error: any) {
      setRecaptchaToken(null)
      if (useVisualFallback) resetCaptcha()
      let msg = t('errorCreatingAccount')
      if (error.code === 'ECONNABORTED' || error.message === 'canceled') msg = 'Timeout: A requisição demorou muito.'
      else if (error.response?.data?.error) msg = error.response.data.error
      else if (error.message) msg = error.message
      toast.error(msg, { duration: 8000 })
    } finally { setLoading(false) }
  }

  // Password strength indicator
  const strength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 6) s++
    if (password.length >= 10) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()

  const strengthColors = ['bg-white/10', 'bg-rose-500', 'bg-amber-500', 'bg-aurora-cyan', 'bg-aurora-mint', 'bg-emerald-400']
  const strengthLabels = ['', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Excelente']

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-aurora-magenta/15 blur-[140px]" />
        <div className="absolute left-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-aurora-cyan/15 blur-[120px]" />
        <div className="absolute inset-0 bg-grid-fine opacity-40" />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 text-center">
          <p className="eyebrow">Comece grátis</p>
          <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient">{t('createAccount')}</h1>
          <p className="mt-3 text-sm text-white/55">{t('joinUs')}</p>
          {affiliateRef && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-aurora-mint/40 bg-aurora-mint/10 px-3 py-1.5 text-[12px] font-semibold text-aurora-mint">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path d="M5 9a3 3 0 116 0v1.5a1.5 1.5 0 01-3 0v-1a.5.5 0 00-1 0V11a3 3 0 11-3 0V9z"/></svg>
              {t('youWillGet2FreeGenerations')}
            </div>
          )}
        </div>

        <div className="surface-card-elevated p-7 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>

            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('username')}</label>
              <input
                type="text" value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className="input-premium" placeholder={t('enterUsername')} required minLength={3} maxLength={30}
                pattern="[a-zA-Z0-9_]+" autoComplete="username"
              />
              <p className="mt-1.5 text-[11px] text-white/40">Apenas letras, números e underscore</p>
            </div>

            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('email')}</label>
              <div className="flex gap-2">
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input-premium" placeholder={t('enterEmail')} required autoComplete="email" disabled={codeSent}
                />
                <button
                  type="button" onClick={handleSendVerificationCode}
                  disabled={loading || codeSent || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  {codeSent ? 'Enviado ✓' : 'Enviar'}
                </button>
              </div>
              {codeSent && <p className="mt-1.5 text-[11px] text-aurora-mint">Código enviado — verifique seu email.</p>}
            </div>

            {codeSent && (
              <div className="animate-fade-up">
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Código de verificação</label>
                <input
                  type="text" value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-premium text-mono text-center text-lg tracking-[0.5em]"
                  placeholder="000000" required maxLength={6} pattern="[0-9]{6}"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input-premium pr-12" placeholder={t('enterPassword')} required minLength={6} maxLength={100} autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/45 hover:text-white" tabIndex={-1}>
                  {showPassword ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {password && (
                <div className="mt-2.5">
                  <div className="flex gap-1">
                    {[0,1,2,3,4].map(i => (
                      <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength > i ? strengthColors[strength] : 'bg-white/8'}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">Força: <span className="text-white/70 font-semibold">{strengthLabels[strength]}</span></p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">{t('confirmPassword')}</label>
              <input
                type={showPassword ? 'text' : 'password'} value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-premium" placeholder={t('enterConfirmPassword')} required minLength={6} maxLength={100} autoComplete="new-password"
              />
            </div>

            {useVisualFallback ? (
              <div className="animate-fade-in my-2">
                <VisualCaptcha
                  captchaId={captchaId}
                  onCaptchaIdChange={setCaptchaId}
                  value={captchaValue}
                  onChange={setCaptchaValue}
                  onValidated={() => {}}
                  error={captchaError || undefined}
                />
              </div>
            ) : (
              <>
                <ReCaptcha action="register" />
                <ReCaptchaBadge />
              </>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
              {loading ? (
                <>
                  <svg className="-ml-1 mr-1 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/>
                  </svg>
                  {t('creating')}
                </>
              ) : t('createAccount')}
            </button>

            <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-white/40">
              <svg className="h-3.5 w-3.5 text-aurora-mint" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.17 5A11.95 11.95 0 0010 1.94 11.95 11.95 0 0017.83 5c.11.65.17 1.32.17 2 0 5.23-3.34 9.67-8 11.32C5.34 16.67 2 12.23 2 7c0-.68.06-1.35.17-2zm11.54 3.71a1 1 0 00-1.41-1.42L9 10.59 7.71 9.29a1 1 0 00-1.42 1.42l2 2a1 1 0 001.42 0l4-4z" clipRule="evenodd"/></svg>
              Verificação de segurança protegida por reCAPTCHA
            </p>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-white/55">
          {t('alreadyHaveAccount')}{' '}
          <Link href="/login" className="font-semibold text-white hover:text-aurora-violet transition-colors">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
