# Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Database
DATABASE_URL="mongodb://localhost:27017/kaizen-gens"

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Asaas
# Para testes (Sandbox):
ASAAS_API_URL=https://api-sandbox.asaas.com/v3
# Para produção:
# ASAAS_API_URL=https://api.asaas.com/v3
ASAAS_API_KEY=$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmNjNTFlMjU5LTU2NTgtNGZkZi04NzM5LTRkNDE3YjYxYWM4Yjo6JGFhY2hfNGY0MDg2ZjktYmFhYS00MDJiLWFiZWUtMjYzZTlkNGUzYTNm
```

## Como obter:

1. **DATABASE_URL**: URL de conexão do seu MongoDB (MongoDB Atlas ou local)
2. **NEXTAUTH_SECRET**: Gere uma string aleatória segura (pode usar: `openssl rand -base64 32`)
3. **ASAAS_API_URL**: Use `https://sandbox.asaas.com/api/v3` para testes ou `https://api.asaas.com/v3` para produção
4. **ASAAS_API_KEY**: Sua chave de API do Asaas (disponível no painel do Asaas)
