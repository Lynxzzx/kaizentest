import Layout from '@/components/Layout'
import Link from 'next/link'

export default function ApiDocs() {
  return (
    <Layout>
      <div className="min-h-screen pt-12 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white">Documentação da API</h1>
              <p className="text-gray-400 mt-2">Integre nosso gerador ao seu site ou bot com endpoints simples e seguros</p>
            </div>
            <Link href="/api-keys" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3 rounded-lg font-semibold hover:contrast-125 transition-all">
              Minhas API Keys
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="glass-card p-6 rounded-2xl">
              <p className="text-sm text-indigo-300 font-mono mb-1">Base</p>
              <p className="text-white font-bold">/api/v1</p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <p className="text-sm text-indigo-300 font-mono mb-1">Autenticação</p>
              <p className="text-white font-bold">Header x-api-key</p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <p className="text-sm text-indigo-300 font-mono mb-1">Rate Limit</p>
              <p className="text-white font-bold">por plano e por minuto</p>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-2xl border border-white/10 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Endpoints</h2>
            <div className="space-y-6">
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <p className="font-mono text-green-400 text-xs mb-1">GET</p>
                <p className="text-white font-semibold">/api/v1/services</p>
                <p className="text-gray-400 text-sm mt-2">Lista serviços ativos com estoque disponível</p>
                <pre className="mt-3 bg-black/40 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto">
{`curl -H "x-api-key: SUA_API_KEY" https://SEU_DOMINIO/api/v1/services
{
  "success": true,
  "services": [
    { "id": "svc123", "name": "Netflix", "description": null, "icon": "🎬", "stockAvailable": 42 }
  ]
}`}
                </pre>
              </div>

              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <p className="font-mono text-green-400 text-xs mb-1">GET</p>
                <p className="text-white font-semibold">/api/v1/stock/availability?serviceId=ID</p>
                <p className="text-gray-400 text-sm mt-2">Verifica disponibilidade e métricas de estoque</p>
                <pre className="mt-3 bg-black/40 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto">
{`curl -H "x-api-key: SUA_API_KEY" "https://SEU_DOMINIO/api/v1/stock/availability?serviceId=svc123"
{
  "success": true,
  "service": { "id": "svc123", "name": "Netflix" },
  "availability": {
    "available": 42,
    "total": 120,
    "isAvailable": true,
    "lastAddedAt": "2026-02-04T02:30:00.000Z",
    "lastUsedAt": "2026-02-04T03:10:00.000Z"
  }
}`}
                </pre>
              </div>

              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <p className="font-mono text-purple-400 text-xs mb-1">POST</p>
                <p className="text-white font-semibold">/api/v1/generate</p>
                <p className="text-gray-400 text-sm mt-2">Gera credenciais do serviço escolhido</p>
                <pre className="mt-3 bg-black/40 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto">
{`curl -X POST -H "x-api-key: SUA_API_KEY" -H "Content-Type: application/json" \\
  -d '{ "serviceId": "svc123" }' https://SEU_DOMINIO/api/v1/generate
{
  "success": true,
  "account": {
    "username": "user@example.com",
    "password": "secret",
    "email": "user@example.com",
    "extraData": null
  },
  "usage": { "used": 11, "limit": 100, "remaining": 89 }
}`}
                </pre>
              </div>

              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <p className="font-mono text-green-400 text-xs mb-1">GET</p>
                <p className="text-white font-semibold">/api/v1/history?page=1&limit=20</p>
                <p className="text-gray-400 text-sm mt-2">Histórico das suas gerações (sem credenciais)</p>
                <pre className="mt-3 bg-black/40 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto">
{`curl -H "x-api-key: SUA_API_KEY" https://SEU_DOMINIO/api/v1/history
{
  "success": true,
  "history": [
    { "id": "gen_abc", "service": { "id": "svc123", "name": "Netflix" }, "createdAt": "2026-02-04T03:12:00.000Z" }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 48, "totalPages": 3, "hasPrev": false, "hasNext": true }
}`}
                </pre>
              </div>

              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <p className="font-mono text-green-400 text-xs mb-1">GET</p>
                <p className="text-white font-semibold">/api/v1/status</p>
                <p className="text-gray-400 text-sm mt-2">Quota, rate limit e últimas gerações</p>
                <pre className="mt-3 bg-black/40 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto">
{`curl -H "x-api-key: SUA_API_KEY" https://SEU_DOMINIO/api/v1/status
{
  "success": true,
  "apiKey": {
    "plan": "API Pro",
    "monthlyGenerations": 100,
    "usedGenerations": 11,
    "remainingGenerations": 89,
    "rateLimit": 120,
    "isActive": true
  }
}`}
                </pre>
              </div>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-2xl border border-white/10 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Segurança e Limites</h2>
            <ul className="text-gray-300 space-y-2">
              <li>IP whitelist por key: se configurada, somente IPs permitidos podem usar</li>
              <li>allowedServiceIds por key: restringe serviços que a key pode gerar</li>
              <li>Rate limit por plano e por minuto</li>
              <li>Limite mensal de gerações por key</li>
              <li>Limite de quantidade de API keys ativas por plano</li>
              <li>Logs de uso por chamada com IP e user-agent</li>
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass-panel p-8 rounded-2xl border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4">Exemplo em Node</h2>
              <pre className="bg-black/40 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto">
{`import axios from 'axios'
const api = axios.create({ baseURL: 'https://SEU_DOMINIO/api/v1', headers: { 'x-api-key': process.env.API_KEY } })
const { data: services } = await api.get('/services')
const svc = services.services[0].id
const { data: avail } = await api.get('/stock/availability', { params: { serviceId: svc } })
if (avail.availability.isAvailable) {
  const { data: gen } = await api.post('/generate', { serviceId: svc })
  console.log(gen.account)
}`}
              </pre>
            </div>
            <div className="glass-panel p-8 rounded-2xl border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4">Exemplo em Python</h2>
              <pre className="bg-black/40 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto">
{`import requests, os
base = 'https://SEU_DOMINIO/api/v1'
headers = { 'x-api-key': os.environ['API_KEY'] }
r = requests.get(f'{base}/services', headers=headers).json()
svc = r['services'][0]['id']
a = requests.get(f'{base}/stock/availability', headers=headers, params={'serviceId': svc}).json()
if a['availability']['isAvailable']:
  g = requests.post(f'{base}/generate', headers={**headers, 'Content-Type':'application/json'}, json={'serviceId': svc}).json()
  print(g['account'])
`}
              </pre>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-2xl border border-white/10 mt-8">
            <h2 className="text-2xl font-bold text-white mb-4">Boas Práticas</h2>
            <ul className="text-gray-300 space-y-2">
              <li>Implemente retry respeitando o retryAfter em respostas 429</li>
              <li>Cacheie respostas de serviços e disponibilidade por alguns segundos</li>
              <li>Não exponha sua API key em clientes; use um backend</li>
              <li>Registre logs de falhas e sucesso para suporte</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  )
}
