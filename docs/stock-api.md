# API de Estoque - Integração para Sites e Bots

Esta API permite integrar nosso estoque e geração de contas diretamente ao seu site, bot ou aplicação. É pensada para desenvolvedores, com autenticação via API Key, rate limiting, whitelisting de IP e endpoints claros.

## Base URL
- Produção: `https://SEU_DOMINIO/api/v1`

## Autenticação
- Header obrigatório: `x-api-key: SUA_API_KEY`
- Acesse seu painel para criar e gerenciar API Keys.
- Campos da API Key:
  - `monthlyGenerations`: quota mensal
  - `rateLimit`: requisições por minuto
  - `allowedServiceIds`: serviços permitidos (opcional)
  - `ipWhitelist`: lista de IPs permitidos (opcional)

## Rate Limiting
- Todas as rotas respeitam seu `rateLimit` por minuto.
- Respostas 429 incluem `retryAfter` em segundos.

## Endpoints

### GET /services
Lista serviços ativos com contagem de estoque disponível.
```
GET /api/v1/services
Headers: x-api-key
Response:
{
  "success": true,
  "services": [
    { "id": "svc123", "name": "Netflix", "description": "...", "icon": "🎬", "stockAvailable": 42 }
  ]
}
```

### GET /stock/availability?serviceId=ID
Verifica disponibilidade e métricas de estoque para um serviço.
```
GET /api/v1/stock/availability?serviceId=svc123
Headers: x-api-key
Response:
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
}
```

### POST /generate
Gera uma conta (credenciais) do serviço escolhido, consumindo sua quota.
```
POST /api/v1/generate
Headers: x-api-key
Body: { "serviceId": "svc123" }
Response:
{
  "success": true,
  "account": {
    "username": "user@example.com",
    "password": "secret",
    "email": "user@example.com",
    "extraData": { ... }
  },
  "usage": {
    "used": 11,
    "limit": 100,
    "remaining": 89
  }
}
```
Erros comuns:
- 403 Service not allowed
- 404 No stock available
- 429 Rate limit exceeded

### GET /history?page=1&limit=20
Retorna histórico de gerações da sua API Key (sem credenciais).
```
GET /api/v1/history
Headers: x-api-key
Response:
{
  "success": true,
  "history": [
    { "id": "gen_abc", "service": { "id": "svc123", "name": "Netflix" }, "createdAt": "2026-02-04T03:12:00.000Z" }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 48, "totalPages": 3, "hasPrev": false, "hasNext": true }
}
```

### GET /status
Retorna informações da sua API Key: quota, rate limit, últimas gerações.
```
GET /api/v1/status
Headers: x-api-key
Response:
{
  "success": true,
  "apiKey": {
    "plan": "API Pro",
    "monthlyGenerations": 100,
    "usedGenerations": 11,
    "remainingGenerations": 89,
    "rateLimit": 120,
    "rateLimitRemaining": 118,
    "rateLimitResetAt": "2026-02-04T03:15:00.000Z",
    "isActive": true
  },
  "recentGenerations": [
    { "service": "Netflix", "username": "user@example.com", "createdAt": "2026-02-04T03:12:00.000Z" }
  ]
}
```

## Segurança
- `ipWhitelist`: se configurada, requisições fora da lista serão bloqueadas.
- `allowedServiceIds`: restringe quais serviços sua chave pode gerar.
- Logs: mantemos `ApiKeyUsageLog` com endpoint, IP, user-agent e sucesso/erro.

## Códigos de Erro
- 401: API key ausente ou inválida
- 403: Serviço não permitido para a chave
- 404: Serviço inexistente/inativo, ou sem estoque
- 429: Rate limit excedido
- 500: Erro interno

## Exemplos

### cURL
```bash
curl -H "x-api-key: SUA_API_KEY" https://SEU_DOMINIO/api/v1/services
curl -H "x-api-key: SUA_API_KEY" "https://SEU_DOMINIO/api/v1/stock/availability?serviceId=svc123"
curl -H "x-api-key: SUA_API_KEY" -H "Content-Type: application/json" -d '{ "serviceId": "svc123" }' https://SEU_DOMINIO/api/v1/generate
```

### Node (axios)
```js
import axios from 'axios'
const api = axios.create({ baseURL: 'https://SEU_DOMINIO/api/v1', headers: { 'x-api-key': process.env.API_KEY } })

const { data: services } = await api.get('/services')
const { data: avail } = await api.get('/stock/availability', { params: { serviceId: services.services[0].id } })
if (avail.availability.isAvailable) {
  const { data: gen } = await api.post('/generate', { serviceId: services.services[0].id })
  console.log(gen.account)
}
```

### Python (requests)
```python
import requests, os
base = 'https://SEU_DOMINIO/api/v1'
headers = { 'x-api-key': os.environ['API_KEY'] }

r = requests.get(f'{base}/services', headers=headers).json()
svc = r['services'][0]['id']
a = requests.get(f'{base}/stock/availability', headers=headers, params={'serviceId': svc}).json()
if a['availability']['isAvailable']:
  g = requests.post(f'{base}/generate', headers={**headers, 'Content-Type':'application/json'}, json={'serviceId': svc}).json()
  print(g['account'])
```

## Boas Práticas
- Respeite `rateLimit` e implemente retry com `retryAfter`.
- Cacheie `services` e `availability` por alguns segundos para reduzir chamadas.
- Nunca exponha sua API Key publicamente.

---

Precisa de outro endpoint? Conte-nos seu caso de uso e expandimos a API. 
