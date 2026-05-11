import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function AdminTelegram() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('🔔 Teste de integração: Telegram foi configurado com sucesso.')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (session && session.user.role !== 'OWNER') {
      router.push('/dashboard')
      return
    }
    loadConfig()
  }, [session, status])

  const loadConfig = async () => {
    try {
      const res = await axios.get('/api/admin/telegram')
      if (res.data.botTokenSet) setBotToken('••••••••')
      if (res.data.chatIdSet) setChatId('••••••••')
    } catch {}
    setLoading(false)
  }

  const save = async () => {
    try {
      const payload: any = {}
      if (botToken && botToken !== '••••••••') payload.botToken = botToken
      if (chatId && chatId !== '••••••••') payload.chatId = chatId
      await axios.post('/api/admin/telegram', payload)
      toast.success('Configurações salvas')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao salvar')
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const res = await axios.post('/api/admin/telegram', {
        test: true,
        message,
        botToken: botToken !== '••••••••' ? botToken : undefined,
        chatId: chatId !== '••••••••' ? chatId : undefined
      })
      if (res.data.ok) {
        toast.success('Mensagem de teste enviada')
      } else {
        toast.error('Falha ao enviar teste')
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro no teste')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">Carregando…</div>
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[450px] w-[450px] rounded-full bg-aurora-cyan/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-8 animate-fade-up">
          <p className="eyebrow">Integrações</p>
          <h1 className="mt-2 text-display text-3xl sm:text-4xl font-bold text-gradient-aurora">Telegram</h1>
        </div>

        <div className="surface-card-elevated p-7 space-y-4 animate-fade-up delay-100">
          <div>
            <label className="eyebrow block mb-1.5">Bot Token</label>
            <input value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="7903...:AAF..." className="input-premium text-mono text-xs" />
          </div>
          <div>
            <label className="eyebrow block mb-1.5">Chat ID</label>
            <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="-1003077080172" className="input-premium text-mono text-xs" />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn btn-primary btn-sm">Salvar</button>
            <button onClick={test} disabled={testing} className="btn btn-ghost btn-sm">{testing ? 'Enviando…' : 'Enviar teste'}</button>
          </div>
        </div>

        <div className="surface-card p-7 mt-4 space-y-3 animate-fade-up delay-200">
          <label className="eyebrow block">Mensagem de teste</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} className="input-premium h-28" />
          <button onClick={test} disabled={testing} className="btn btn-ghost btn-sm">{testing ? 'Enviando…' : 'Enviar teste'}</button>
        </div>
      </div>
    </div>
  )
}
