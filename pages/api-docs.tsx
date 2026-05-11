import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'

const ENDPOINTS = [
  {
    method: 'GET', methodColor: 'mint',
    path: '/api/v1/services',
    desc: 'Lista serviços ativos com estoque disponível',
    sample: `curl -H "x-api-key: SUA_API_KEY" https://SEU_DOMINIO/api/v1/services
{
  "success": true,
  "services": [
    { "id": "svc123", "name": "Netflix", "icon": "🎬", "stockAvailable": 42 }
  ]
}`
  },
  {
    method: 'GET', methodColor: 'mint',
    path: '/api/v1/stock/availability?serviceId=ID',
    desc: 'Verifica disponibilidade e métricas de estoque',
    sample: `curl -H "x-api-key: SUA_API_KEY" "https://SEU_DOMINIO/api/v1/stock/availability?serviceId=svc123"
{
  "success": true,
  "service": { "id": "svc123", "name": "Netflix" },
  "availability": { "available": 42, "total": 120, "isAvailable": true }
}`
  },
  {
    method: 'POST', methodColor: 'violet',
    path: '/api/v1/generate',
    desc: 'Gera credenciais do serviço escolhido',
    sample: `curl -X POST -H "x-api-key: SUA_API_KEY" -H "Content-Type: application/json" \\
  -d '{ "serviceId": "svc123" }' https://SEU_DOMINIO/api/v1/generate
{
  "success": true,
  "account": {
    "username": "user@example.com",
    "password": "secret"
  },
  "usage": { "used": 11, "limit": 100, "remaining": 89 }
}`
  },
  {
    method: 'GET', methodColor: 'mint',
    path: '/api/v1/history?page=1&limit=20',
    desc: 'Histórico das suas gerações (sem credenciais)',
    sample: `curl -H "x-api-key: SUA_API_KEY" https://SEU_DOMINIO/api/v1/history`
  },
  {
    method: 'GET', methodColor: 'mint',
    path: '/api/v1/status',
    desc: 'Quota, rate limit e estado da API key',
    sample: `curl -H "x-api-key: SUA_API_KEY" https://SEU_DOMINIO/api/v1/status`
  }
]

const NODE_SAMPLE = `import axios from 'axios'
const api = axios.create({
  baseURL: 'https://SEU_DOMINIO/api/v1',
  headers: { 'x-api-key': process.env.API_KEY }
})
const { data: services } = await api.get('/services')
const svc = services.services[0].id
const { data: avail } = await api.get('/stock/availability', { params: { serviceId: svc } })
if (avail.availability.isAvailable) {
  const { data: gen } = await api.post('/generate', { serviceId: svc })
  console.log(gen.account)
}`

const PYTHON_SAMPLE = `import requests, os
base = 'https://SEU_DOMINIO/api/v1'
headers = { 'x-api-key': os.environ['API_KEY'] }
r = requests.get(f'{base}/services', headers=headers).json()
svc = r['services'][0]['id']
g = requests.post(
  f'{base}/generate',
  headers={**headers, 'Content-Type':'application/json'},
  json={'serviceId': svc}
).json()
print(g['account'])`

export default function ApiDocs() {
  const [lang, setLang] = useState<'node' | 'python'>('node')

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-aurora-cyan/12 blur-[140px]" />
        <div className="absolute right-1/4 top-1/3 h-[450px] w-[450px] rounded-full bg-aurora-violet/12 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-up">
          <div>
            <p className="eyebrow">Para desenvolvedores</p>
            <h1 className="mt-2 text-display text-5xl sm:text-6xl font-bold">
              <span className="text-gradient">API </span>
              <span className="text-gradient-aurora">Reference</span>
            </h1>
            <p className="mt-3 text-base text-white/55 max-w-xl">
              Integre nosso gerador ao seu site ou bot com endpoints simples e seguros.
            </p>
          </div>
          <Link href="/api-keys" className="btn btn-primary">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4M19 8l-4-4M15 12l-2-2"/></svg>
            Minhas API Keys
          </Link>
        </div>

        {/* Quick facts */}
        <div className="grid sm:grid-cols-3 gap-3 mb-10 animate-fade-up delay-100">
          <Fact label="Base URL" value="/api/v1" />
          <Fact label="Auth Header" value="x-api-key" />
          <Fact label="Rate limit" value="por plano · por minuto" />
        </div>

        {/* Endpoints */}
        <div className="surface-card p-7 sm:p-8 mb-8 animate-fade-up delay-200">
          <h2 className="text-display text-2xl font-bold text-white mb-5">Endpoints</h2>
          <div className="space-y-4">
            {ENDPOINTS.map((e) => (
              <div key={e.path} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`pill ${e.methodColor === 'mint' ? 'pill-mint' : 'pill-violet'} text-mono`}>{e.method}</span>
                  <code className="text-mono text-sm text-white font-semibold">{e.path}</code>
                </div>
                <p className="text-sm text-white/55 mb-3">{e.desc}</p>
                <div className="relative group">
                  <pre className="rounded-xl border border-white/8 bg-black/40 p-4 text-[12px] text-mono text-white/75 overflow-x-auto leading-relaxed">{e.sample}</pre>
                  <button
                    onClick={() => copy(e.sample)}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/60 text-white/55 opacity-0 hover:text-white group-hover:opacity-100 transition-all"
                    title="Copiar"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="surface-card p-7 sm:p-8 mb-8 animate-fade-up delay-300">
          <h2 className="text-display text-2xl font-bold text-white mb-5">Segurança & Limites</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ['IP whitelist por key', 'Restringe origens permitidas'],
              ['allowedServiceIds', 'Limita serviços por chave'],
              ['Rate limit', 'Por plano e por minuto'],
              ['Limite mensal', 'Gerações por API key'],
              ['Quantidade máx', 'API keys ativas por plano'],
              ['Logs detalhados', 'IP + user-agent por chamada']
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aurora-mint/15 text-aurora-mint">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-[12px] text-white/50">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Code samples */}
        <div className="surface-card p-7 sm:p-8 mb-8 animate-fade-up delay-400">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-display text-2xl font-bold text-white">Exemplos</h2>
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
              {(['node', 'python'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full transition-all ${
                    lang === l ? 'bg-white text-[#06060c]' : 'text-white/55 hover:text-white'
                  }`}
                >{l}</button>
              ))}
            </div>
          </div>
          <div className="relative group">
            <pre className="rounded-2xl border border-white/8 bg-black/50 p-5 text-[13px] text-mono text-white/80 overflow-x-auto leading-relaxed">
              {lang === 'node' ? NODE_SAMPLE : PYTHON_SAMPLE}
            </pre>
            <button onClick={() => copy(lang === 'node' ? NODE_SAMPLE : PYTHON_SAMPLE)}
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-black/60 text-white/55 opacity-0 hover:text-white group-hover:opacity-100 transition-all">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </button>
          </div>
        </div>

        {/* Best practices */}
        <div className="surface-card p-7 sm:p-8 animate-fade-up delay-500">
          <h2 className="text-display text-2xl font-bold text-white mb-5">Boas práticas</h2>
          <ul className="space-y-2 text-sm text-white/65">
            {[
              'Implemente retry respeitando o retryAfter em respostas 429',
              'Cacheie respostas de serviços e disponibilidade por alguns segundos',
              'Não exponha sua API key em clientes — use um backend',
              'Registre logs de falhas e sucesso para suporte'
            ].map((bp, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-aurora-violet" />
                {bp}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-display text-lg font-bold text-white text-mono">{value}</p>
    </div>
  )
}
