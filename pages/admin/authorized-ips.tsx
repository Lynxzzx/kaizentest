import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface AuthorizedIp {
  id: string
  ip: string
  description: string | null
  authorizedBy?: {
    id: string
    username: string
  }
  createdAt: string
  updatedAt: string
}

export default function AuthorizedIpsAdmin() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { data: session, status } = useSession()
  const router = useRouter()
  const themeClasses = getThemeClasses(theme)

  const [authorizedIps, setAuthorizedIps] = useState<AuthorizedIp[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form para autorizar IP
  const [newIp, setNewIp] = useState('')
  const [description, setDescription] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
    
    // Verificar se é Owner
    if (status === 'authenticated' && session?.user?.role !== 'OWNER') {
      toast.error('Apenas o Owner pode acessar esta página')
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      loadData()
    }
  }, [session])

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/admin/authorized-ips')
      setAuthorizedIps(response.data.authorizedIps)
    } catch (error: any) {
      console.error('Erro ao carregar IPs autorizados:', error)
      if (error.response?.status === 403) {
        toast.error('Sem permissão para acessar esta página')
        router.push('/dashboard')
      } else {
        toast.error('Erro ao carregar IPs autorizados')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddIp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newIp.trim()) {
      toast.error('Digite um IP')
      return
    }

    // Validar formato básico de IP
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (!ipRegex.test(newIp.trim())) {
      toast.error('Formato de IP inválido')
      return
    }
    
    setAdding(true)
    try {
      await axios.post('/api/admin/authorized-ips', {
        ip: newIp.trim(),
        description: description.trim() || null
      })
      
      toast.success('IP autorizado com sucesso!')
      setNewIp('')
      setDescription('')
      loadData()
    } catch (error: any) {
      console.error('Erro ao autorizar IP:', error)
      toast.error(error.response?.data?.error || 'Erro ao autorizar IP')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveIp = async (id: string, ip: string) => {
    if (!confirm(`Tem certeza que deseja remover a autorização do IP ${ip}?`)) {
      return
    }

    try {
      await axios.delete('/api/admin/authorized-ips', {
        data: { id }
      })
      
      toast.success('IP removido com sucesso!')
      loadData()
    } catch (error: any) {
      console.error('Erro ao remover IP:', error)
      toast.error(error.response?.data?.error || 'Erro ao remover IP')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
        Carregando...
      </div>
    )
  }

  if (!session || session.user.role !== 'OWNER') {
    return null
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-aurora-violet/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          {/* Header */}
          <div className={`${themeClasses.card} neon-shadow mb-8`}>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/15 via-transparent to-cyan-400/10" />
            <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Administração</p>
                <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                  🌐 IPs Autorizados
                </h1>
                <p className="text-sm text-white/60">
                  Gerencie IPs autorizados a criar múltiplas contas no mesmo dispositivo
                </p>
              </div>
              <button
                onClick={() => router.push('/admin')}
                className="inline-flex items-center rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_30px_rgba(15,23,42,0.45)]"
              >
                ← Voltar
              </button>
            </div>
          </div>

          {/* Form para adicionar IP */}
          <div className={`${themeClasses.card} neon-shadow mb-8`}>
            <h2 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>
              ➕ Autorizar Novo IP
            </h2>
            <form onSubmit={handleAddIp} className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                  IP *
                </label>
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="Ex: 192.168.1.1"
                  className={`${themeClasses.input} w-full px-4 py-2 rounded-lg`}
                  required
                />
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${themeClasses.text.primary}`}>
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: IP do escritório"
                  className={`${themeClasses.input} w-full px-4 py-2 rounded-lg`}
                />
              </div>
              <button
                type="submit"
                disabled={adding}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Autorizando...' : 'Autorizar IP'}
              </button>
            </form>
          </div>

          {/* Lista de IPs autorizados */}
          <div className={`${themeClasses.card} neon-shadow`}>
            <h2 className={`text-xl font-bold mb-4 ${themeClasses.text.primary}`}>
              📋 IPs Autorizados ({authorizedIps.length})
            </h2>
            
            {authorizedIps.length === 0 ? (
              <div className={`text-center py-8 ${themeClasses.text.secondary}`}>
                <p className="text-lg mb-2">📭</p>
                <p>Nenhum IP autorizado ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {authorizedIps.map((ip) => (
                  <div
                    key={ip.id}
                    className={`p-4 rounded-lg border ${
                      theme === 'dark'
                        ? 'bg-white/5 border-white/10 hover:bg-white/10'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } transition-all`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`font-mono font-bold text-lg ${themeClasses.text.primary}`}>
                            {ip.ip}
                          </span>
                        </div>
                        {ip.description && (
                          <p className={`text-sm ${themeClasses.text.secondary} mb-2`}>
                            {ip.description}
                          </p>
                        )}
                        <div className={`text-xs ${themeClasses.text.muted} space-y-1`}>
                          {ip.authorizedBy && (
                            <p>
                              Autorizado por: <span className="font-semibold">{ip.authorizedBy.username}</span>
                            </p>
                          )}
                          <p>
                            Criado em: {format(new Date(ip.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveIp(ip.id, ip.ip)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all whitespace-nowrap"
                      >
                        🗑️ Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
  )
}

