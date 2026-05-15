import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface CookieStock {
  id: string
  serviceId: string
  username: string
  password: string
  email: string | null
  extraData: string | null
  isUsed: boolean
  usedAt: string | null
  createdAt: string
  service: { id: string; name: string; icon: string | null }
}

interface Service {
  id: string
  name: string
  icon: string | null
}

type ActiveTab = 'estoque' | 'gerenciamento' | 'servicos'

export default function AdminCookies() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const { tab: tabParam } = router.query
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    tabParam === 'gerenciamento' ? 'gerenciamento' : tabParam === 'servicos' ? 'servicos' : 'estoque'
  )

  // ── Estoque ──────────────────────────────────────────────
  const [stocks, setStocks]           = useState<CookieStock[]>([])
  const [stocksLoading, setStocksLoading] = useState(false)
  const [filterStatus, setFilterStatus]   = useState<'all' | 'available' | 'used'>('all')
  const [filterServiceId, setFilterServiceId] = useState<string>('')
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [deleting, setDeleting]           = useState(false)

  // ── Gerenciamento / Import ────────────────────────────────
  const [services, setServices]             = useState<Service[]>([])
  const [importServiceId, setImportServiceId] = useState<string>('')
  const [cookieText, setCookieText]         = useState<string>('')
  const [importLoading, setImportLoading]   = useState(false)
  const [importMode, setImportMode]         = useState<'text' | 'files'>('files')
  const [selectedFiles, setSelectedFiles]   = useState<File[]>([])
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)

  // ── Serviços de cookies ───────────────────────────────────
  const [newServiceName, setNewServiceName] = useState<string>('')
  const [newServiceDesc, setNewServiceDesc] = useState<string>('')
  const [creatingService, setCreatingService] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (session?.user?.role !== 'OWNER') { router.replace('/dashboard'); return }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      loadStocks()
      loadServices()
    }
  }, [session])

  // ──────────────────────────────────────────────────────────
  // Data helpers
  // ──────────────────────────────────────────────────────────

  const isCookieStock = (s: CookieStock) => {
    if (!s.extraData) return false
    try { return JSON.parse(s.extraData).type === 'cookie' } catch { return false }
  }

  const parseCookieExtra = (extraData: string | null) => {
    if (!extraData) return null
    try { return JSON.parse(extraData) } catch { return null }
  }

  const loadStocks = async () => {
    setStocksLoading(true)
    try {
      const res = await axios.get('/api/stocks')
      setStocks(res.data.filter((s: CookieStock) => isCookieStock(s)))
    } catch {
      toast.error('Erro ao carregar estoque de cookies')
    } finally {
      setStocksLoading(false)
    }
  }

  const loadServices = async () => {
    try {
      const res = await axios.get('/api/services')
      const all: Service[] = res.data
      setServices(all.filter(s =>
        s.icon === '🍪' || s.name.toLowerCase().includes('cookie')
      ))
    } catch {
      toast.error('Erro ao carregar serviços')
    }
  }

  // ──────────────────────────────────────────────────────────
  // Import (Gerenciamento)
  // ──────────────────────────────────────────────────────────

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importServiceId) { toast.error('Selecione um serviço'); return }
    if (!cookieText.trim()) { toast.error('Cole os cookies antes de importar'); return }

    setImportLoading(true)
    try {
      const res = await axios.post('/api/cookies/bulk', {
        serviceId: importServiceId,
        cookieText: cookieText.trim()
      })
      toast.success(`✅ ${res.data.created} sessão(ões) importada(s) com sucesso!`)
      if (res.data.errors?.length) {
        toast.error(`⚠️ ${res.data.errors.length} erro(s) durante importação.`)
        console.warn('Erros de importação:', res.data.errors)
      }
      setCookieText('')
      loadStocks()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao importar cookies')
    } finally {
      setImportLoading(false)
    }
  }

  // ──────────────────────────────────────────────────────────
  // Import via arquivos .txt
  // ──────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f =>
      f.name.toLowerCase().endsWith('.txt')
    )
    setSelectedFiles(files)
  }

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error(`Erro ao ler ${file.name}`))
      reader.readAsText(file, 'utf-8')
    })

  const handleFileImport = async () => {
    if (!importServiceId) { toast.error('Selecione um serviço'); return }
    if (selectedFiles.length === 0) { toast.error('Selecione pelo menos um arquivo .txt'); return }

    setImportLoading(true)
    setImportProgress({ done: 0, total: selectedFiles.length })

    const filePayloads: { name: string; content: string }[] = []

    for (const file of selectedFiles) {
      try {
        const content = await readFileAsText(file)
        filePayloads.push({ name: file.name, content })
      } catch {
        toast.error(`Erro ao ler: ${file.name}`)
      }
    }

    try {
      const res = await axios.post('/api/cookies/bulk', {
        serviceId: importServiceId,
        files: filePayloads
      })

      const { created, filesProcessed, fileResults, errors } = res.data

      toast.success(`✅ ${created} sessão(ões) importada(s) de ${filesProcessed} arquivo(s)!`)

      if (errors?.length) {
        toast.error(`⚠️ ${errors.length} erro(s) durante importação`)
        console.warn('Erros de importação:', errors)
      }

      // Mostra resultado por arquivo no console
      if (fileResults) {
        console.table(fileResults)
      }

      setSelectedFiles([])
      ;(document.getElementById('cookie-file-input') as HTMLInputElement | null)?.value && 
        ((document.getElementById('cookie-file-input') as HTMLInputElement).value = '')
      loadStocks()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao importar arquivos')
    } finally {
      setImportLoading(false)
      setImportProgress(null)
    }
  }

  // ──────────────────────────────────────────────────────────
  // Delete
  // ──────────────────────────────────────────────────────────

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) { toast.error('Selecione pelo menos um item'); return }
    if (!confirm(`Excluir ${selectedIds.size} cookie(s)?`)) return
    setDeleting(true)
    try {
      const res = await axios.post('/api/stocks/bulk-delete', { ids: Array.from(selectedIds) })
      toast.success(`${res.data.deleted} cookie(s) excluído(s)`)
      setSelectedIds(new Set())
      loadStocks()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteOne = async (id: string) => {
    if (!confirm('Excluir este cookie?')) return
    try {
      await axios.delete(`/api/stocks/${id}`)
      toast.success('Cookie excluído')
      loadStocks()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir')
    }
  }

  // ──────────────────────────────────────────────────────────
  // Create cookie service
  // ──────────────────────────────────────────────────────────

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newServiceName.trim()) { toast.error('Nome do serviço é obrigatório'); return }
    setCreatingService(true)
    try {
      await axios.post('/api/services', {
        name: newServiceName.trim(),
        description: newServiceDesc.trim() || 'Serviço de cookies',
        icon: '🍪',
        isActive: true
      })
      toast.success('Serviço de cookies criado!')
      setNewServiceName('')
      setNewServiceDesc('')
      loadServices()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar serviço')
    } finally {
      setCreatingService(false)
    }
  }

  // ──────────────────────────────────────────────────────────
  // Selection
  // ──────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    const available = filteredStocks.filter(s => !s.isUsed)
    if (selectedIds.size === available.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(available.map(s => s.id)))
  }

  // ──────────────────────────────────────────────────────────
  // Filtered view
  // ──────────────────────────────────────────────────────────

  const filteredStocks = stocks.filter(s => {
    const matchService = !filterServiceId || s.serviceId === filterServiceId
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'available' && !s.isUsed) ||
      (filterStatus === 'used' && s.isUsed)
    return matchService && matchStatus
  })

  const stats = {
    total: stocks.length,
    available: stocks.filter(s => !s.isUsed).length,
    used: stocks.filter(s => s.isUsed).length
  }

  // All services that exist in current stocks (for filter)
  const stockServices = Array.from(
    new Map(stocks.map(s => [s.serviceId, s.service])).values()
  )

  if (status === 'loading') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/>
        </svg>
        Carregando...
      </div>
    )
  }

  if (session?.user?.role !== 'OWNER') return null

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[500px] w-[500px] rounded-full bg-amber-500/8 blur-[140px]" />
        <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-orange-500/8 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

        {/* Header */}
        <div className="surface-card-elevated p-7 sm:p-9 mb-6 animate-fade-up">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Owner · Gerenciamento</p>
              <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient-aurora flex items-center gap-3">
                <span className="text-4xl">🍪</span> Cookies
              </h1>
              <p className="mt-2 text-sm text-white/55">Gerencie estoque e serviços de cookies de sessão</p>
            </div>
            <Link href="/admin" className="btn btn-ghost btn-sm self-start md:self-auto">
              ← Voltar ao Painel
            </Link>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10 animate-fade-up delay-100">
          <div className="bg-[#0c0c15]/95 p-5">
            <p className="eyebrow">Total</p>
            <p className="num-display mt-2 text-2xl text-gradient">{stats.total}</p>
          </div>
          <div className="bg-[#0c0c15]/95 p-5">
            <p className="eyebrow">Disponíveis</p>
            <p className="num-display mt-2 text-2xl text-aurora-mint">{stats.available}</p>
          </div>
          <div className="bg-[#0c0c15]/95 p-5">
            <p className="eyebrow">Usados</p>
            <p className="num-display mt-2 text-2xl text-rose-400">{stats.used}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-fade-up delay-150">
          {([
            { key: 'estoque', label: 'Estoque', icon: '📦' },
            { key: 'gerenciamento', label: 'Gerenciamento', icon: '⚙️' },
            { key: 'servicos', label: 'Serviços', icon: '🔧' }
          ] as { key: ActiveTab; label: string; icon: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: ESTOQUE ─────────────────────────────────────── */}
        {activeTab === 'estoque' && (
          <div className="animate-fade-up">
            {/* Filters */}
            <div className="surface-card p-5 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-white/55">
                    Filtrar por Serviço
                  </label>
                  <select
                    value={filterServiceId}
                    onChange={e => setFilterServiceId(e.target.value)}
                    className="input-premium"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="">Todos os serviços</option>
                    {stockServices.map(s => (
                      <option key={s.id} value={s.id}>{s.icon || '🍪'} {s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-white/55">
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as any)}
                    className="input-premium"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="all">Todos</option>
                    <option value="available">Disponíveis</option>
                    <option value="used">Usados</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bulk delete toolbar */}
            {selectedIds.size > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-rose-400/30 bg-rose-400/5 px-5 py-3">
                <span className="text-sm text-rose-300 font-semibold">
                  {selectedIds.size} selecionado(s)
                </span>
                <button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : `🗑️ Excluir ${selectedIds.size}`}
                </button>
              </div>
            )}

            {/* Stock list */}
            <div className="surface-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Estoque de Cookies
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/55">
                    {filteredStocks.length}
                  </span>
                </h3>
                <button onClick={loadStocks} className="btn btn-ghost btn-sm">Atualizar</button>
              </div>

              {stocksLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-white/55">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/>
                  </svg>
                  Carregando...
                </div>
              ) : filteredStocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <span className="text-4xl opacity-30">🍪</span>
                  <p className="text-sm text-white/55">Nenhum cookie no estoque</p>
                  <p className="text-[12px] text-white/35">Vá para a aba Gerenciamento para importar cookies</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              filteredStocks.filter(s => !s.isUsed).length > 0 &&
                              selectedIds.size === filteredStocks.filter(s => !s.isUsed).length
                            }
                            onChange={toggleSelectAll}
                            className="rounded border-white/20 bg-white/10 accent-amber-500"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">Serviço</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">Sessão</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">NetflixId (prévia)</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">Status</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">Data</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStocks.map(stock => {
                        const extra = parseCookieExtra(stock.extraData)
                        const preview = stock.password.slice(0, 24) + '…'
                        return (
                          <tr
                            key={stock.id}
                            className={`border-b border-white/[0.04] transition-colors ${
                              stock.isUsed
                                ? 'opacity-50'
                                : selectedIds.has(stock.id)
                                ? 'bg-amber-400/5'
                                : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(stock.id)}
                                onChange={() => toggleSelect(stock.id)}
                                disabled={stock.isUsed}
                                className="rounded border-white/20 bg-white/10 accent-amber-500 disabled:opacity-30"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium text-white">
                                {stock.service.icon || '🍪'} {stock.service.name}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-white/70 font-mono">{stock.username}</span>
                            </td>
                            <td className="px-4 py-3">
                              <code className="text-[11px] text-amber-200/70 font-mono bg-amber-400/5 rounded px-1.5 py-0.5">
                                {preview}
                              </code>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                stock.isUsed
                                  ? 'bg-rose-400/15 text-rose-400'
                                  : 'bg-aurora-mint/15 text-aurora-mint'
                              }`}>
                                {stock.isUsed ? 'Usado' : 'Disponível'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[12px] text-white/40">
                              {format(new Date(stock.createdAt), 'dd/MM/yy', { locale: ptBR })}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDeleteOne(stock.id)}
                                disabled={stock.isUsed}
                                className="text-rose-400 hover:text-rose-300 text-[12px] disabled:opacity-30"
                                title="Excluir"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: GERENCIAMENTO ───────────────────────────────── */}
        {activeTab === 'gerenciamento' && (
          <div className="animate-fade-up space-y-5">
            <div className="surface-card-elevated p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-xl">⚙️</div>
                <div>
                  <h2 className="text-display text-xl font-bold text-white">Importar Cookies</h2>
                  <p className="text-xs text-white/55">Pasta de arquivos .txt ou cole o texto — cada arquivo = uma sessão</p>
                </div>
              </div>

              {/* Serviço de destino */}
              <div className="mb-5">
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">
                  Serviço de destino
                </label>
                {services.length === 0 ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-300/80">
                    Nenhum serviço de cookies encontrado. Crie um na aba <strong>Serviços</strong> primeiro.
                  </div>
                ) : (
                  <select
                    value={importServiceId}
                    onChange={e => setImportServiceId(e.target.value)}
                    className="input-premium"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="">Selecione o serviço de cookies...</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.icon || '🍪'} {s.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Mode switcher */}
              <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <button
                  onClick={() => setImportMode('files')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all ${
                    importMode === 'files'
                      ? 'bg-amber-500/80 text-white'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  📁 Upload de Arquivos / Pasta
                </button>
                <button
                  onClick={() => setImportMode('text')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all ${
                    importMode === 'text'
                      ? 'bg-amber-500/80 text-white'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  📋 Colar Texto
                </button>
              </div>

              {/* ── Modo: upload de arquivos ── */}
              {importMode === 'files' && (
                <div className="space-y-4">
                  {/* Drop zone / file input */}
                  <label
                    htmlFor="cookie-file-input"
                    className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-amber-400/30 bg-amber-400/5 py-10 cursor-pointer hover:border-amber-400/50 hover:bg-amber-400/8 transition-all"
                  >
                    <span className="text-4xl">📁</span>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white/80">Clique para selecionar pasta ou arquivos</p>
                      <p className="text-[12px] text-white/40 mt-1">Aceita pasta inteira ou múltiplos .txt — cada arquivo = uma sessão de cookie</p>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="rounded-lg bg-amber-500/20 px-3 py-1 text-[11px] font-semibold text-amber-300">
                        .txt
                      </span>
                      <span className="rounded-lg bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/50">
                        múltiplos arquivos
                      </span>
                      <span className="rounded-lg bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/50">
                        pasta inteira
                      </span>
                    </div>
                  </label>

                  {/* Inputs separados: pasta e múltiplos arquivos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                        Selecionar Pasta
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 hover:border-amber-400/30 hover:bg-amber-400/5 transition-all">
                        <span className="text-lg">📂</span>
                        <span className="text-sm text-white/60">Escolher pasta de cookies</span>
                        <input
                          type="file"
                          // @ts-ignore
                          webkitdirectory=""
                          multiple
                          accept=".txt"
                          className="hidden"
                          onChange={e => {
                            const files = Array.from(e.target.files || []).filter(f =>
                              f.name.toLowerCase().endsWith('.txt')
                            )
                            setSelectedFiles(prev => {
                              const existing = new Set(prev.map(f => f.name))
                              return [...prev, ...files.filter(f => !existing.has(f.name))]
                            })
                          }}
                        />
                      </label>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                        Selecionar Arquivos
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 hover:border-amber-400/30 hover:bg-amber-400/5 transition-all">
                        <span className="text-lg">📄</span>
                        <span className="text-sm text-white/60">Escolher .txt individuais</span>
                        <input
                          id="cookie-file-input"
                          type="file"
                          multiple
                          accept=".txt"
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Preview dos arquivos selecionados */}
                  {selectedFiles.length > 0 && (
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                        <p className="text-sm font-semibold text-white">
                          {selectedFiles.length} arquivo(s) selecionado(s)
                        </p>
                        <button
                          onClick={() => setSelectedFiles([])}
                          className="text-[12px] text-white/40 hover:text-rose-300 transition-colors"
                        >
                          Limpar tudo
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={file.name + idx}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm">🍪</span>
                              <span className="text-[13px] text-white/80 font-mono truncate">{file.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[11px] text-white/35">{(file.size / 1024).toFixed(1)} KB</span>
                              <button
                                onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="text-[11px] text-white/30 hover:text-rose-300"
                                title="Remover"
                              >✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progresso */}
                  {importLoading && importProgress && (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-amber-300">Importando arquivos...</span>
                        <span className="text-sm text-amber-300/70">{importProgress.done}/{importProgress.total}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                          style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleFileImport}
                    disabled={importLoading || services.length === 0 || selectedFiles.length === 0}
                    className="btn btn-lg w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/>
                        </svg>
                        Importando {selectedFiles.length} arquivo(s)...
                      </>
                    ) : (
                      <>📁 Importar {selectedFiles.length > 0 ? `${selectedFiles.length} arquivo(s)` : 'Arquivos'}</>
                    )}
                  </button>
                </div>
              )}

              {/* ── Modo: colar texto ── */}
              {importMode === 'text' && (
                <form onSubmit={handleImport} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">
                      Cookies (formato Netscape — colunas separadas por TAB)
                    </label>
                    <textarea
                      value={cookieText}
                      onChange={e => setCookieText(e.target.value)}
                      className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 font-mono text-[11px] text-white/80 placeholder-white/20 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-colors resize-y"
                      rows={10}
                      placeholder={`.netflix.com\tTRUE\t/\tTRUE\t1793639790\tNetflixId\tct%3D...\n.netflix.com\tTRUE\t/\tTRUE\t1793639790\tSecureNetflixId\tv%3D3...`}
                      spellCheck={false}
                    />
                    <p className="mt-2 text-[11px] text-white/35 leading-relaxed">
                      Cada sessão = 2 linhas (<code className="text-amber-400/70">NetflixId</code> + <code className="text-amber-400/70">SecureNetflixId</code>).
                      Múltiplas sessões são detectadas automaticamente pelo timestamp de expiração.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={importLoading || services.length === 0}
                    className="btn btn-lg w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/>
                        </svg>
                        Importando...
                      </>
                    ) : <>🍪 Importar Cookies</>}
                  </button>
                </form>
              )}
            </div>

            {/* Info box */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold text-white mb-3">📋 Formato esperado (cada .txt)</h3>
              <pre className="text-[11px] text-white/50 font-mono leading-relaxed overflow-x-auto whitespace-pre">
{`.netflix.com\tTRUE\t/\tTRUE\t1793639790\tNetflixId\tct%3DBgjHlO...
.netflix.com\tTRUE\t/\tTRUE\t1793639790\tSecureNetflixId\tv%3D3%26mac...`}
              </pre>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-white/40">
                {['domínio','subdomínios','path','secure','expiração','nome','valor'].map((col, i) => (
                  <span key={i}><strong className="text-white/60">Col {i+1}:</strong> {col}</span>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-[12px] text-amber-300/80">
                <strong>Dica de pasta:</strong> Cada arquivo .txt deve conter os cookies de <em>uma</em> conta/sessão.
                O nome do arquivo (ex: <code>conta1.txt</code>) será usado como identificador no estoque.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: SERVIÇOS ────────────────────────────────────── */}
        {activeTab === 'servicos' && (
          <div className="animate-fade-up space-y-5">
            {/* Create service */}
            <div className="surface-card-elevated p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-xl">🔧</div>
                <div>
                  <h2 className="text-display text-xl font-bold text-white">Criar Serviço de Cookies</h2>
                  <p className="text-xs text-white/55">Serviços com "Cookie" no nome ou ícone 🍪 são automaticamente detectados como cookie services</p>
                </div>
              </div>

              <form onSubmit={handleCreateService} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Nome do Serviço</label>
                    <input
                      type="text"
                      value={newServiceName}
                      onChange={e => setNewServiceName(e.target.value)}
                      placeholder="ex: Netflix Cookies Premium"
                      className="input-premium"
                      required
                    />
                    <p className="mt-1 text-[11px] text-white/35">Include "Cookie" no nome para ser detectado automaticamente</p>
                  </div>
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Descrição (opcional)</label>
                    <input
                      type="text"
                      value={newServiceDesc}
                      onChange={e => setNewServiceDesc(e.target.value)}
                      placeholder="ex: Cookies de sessão Netflix 1 mês"
                      className="input-premium"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={creatingService}
                  className="btn bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
                >
                  {creatingService ? 'Criando...' : '🍪 Criar Serviço'}
                </button>
              </form>
            </div>

            {/* Existing cookie services */}
            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Serviços de Cookies Existentes</h3>
                <Link href="/admin/services" className="btn btn-ghost btn-sm">
                  Ver todos os serviços →
                </Link>
              </div>

              {services.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="text-3xl opacity-30">🍪</span>
                  <p className="text-sm text-white/55">Nenhum serviço de cookies ainda</p>
                  <p className="text-[12px] text-white/35">Crie um acima ou vá em <strong>Serviços</strong> e adicione "Cookie" ao nome</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {services.map(s => {
                    const stocksForService = stocks.filter(st => st.serviceId === s.id)
                    const available = stocksForService.filter(st => !st.isUsed).length
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-xl">
                            {s.icon || '🍪'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{s.name}</p>
                            <p className="text-[11px] text-white/40">{available} cookies disponíveis</p>
                          </div>
                        </div>
                        <Link href="/admin/services" className="btn btn-ghost btn-sm">Editar →</Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
