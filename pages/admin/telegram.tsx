import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
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
    return (
      <Layout>
        <div className="min-h-screen pt-12 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center text-white">Carregando…</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen pt-12 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-extrabold text-white mb-6">Configurar Telegram</h1>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Bot Token</label>
              <input
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="7903...:AAF..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Chat ID</label>
              <input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-1003077080172"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={save} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-semibold">
                Salvar
              </button>
              <button onClick={test} disabled={testing} className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl font-semibold border border-white/10 disabled:opacity-50">
                {testing ? 'Enviando…' : 'Enviar Teste'}
              </button>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 mt-6 space-y-4">
            <label className="block text-sm text-gray-300 mb-1">Mensagem de Teste</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 outline-none h-28"
            />
            <button onClick={test} disabled={testing} className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl font-semibold border border-white/10 disabled:opacity-50">
              {testing ? 'Enviando…' : 'Enviar Teste'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
