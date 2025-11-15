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

# Binance (Pagamentos via Criptomoedas)
BINANCE_API_KEY=luweSTLeGMHiod5NAcGPTcVdLZ5LKNa4UjSqiHmHlXIJXHhCvJwifviwoaRSo3D5
BINANCE_SECRET_KEY=rohR1jojKsv1eFELP6D4ajPouTAeHoSDiGQ6FFZX6FExQVDT5VwHSjGfJpUkQXAS

# SMTP (Envio de Emails)
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario@seuprovedor.com
SMTP_PASS=sua-senha
SMTP_FROM="Kaizen Gens <no-reply@seuprovedor.com>"
```

## Como obter:

1. **DATABASE_URL**: URL de conexão do seu MongoDB (MongoDB Atlas ou local)
2. **NEXTAUTH_SECRET**: Gere uma string aleatória segura (pode usar: `openssl rand -base64 32`)
3. **ASAAS_API_URL**: Use `https://sandbox.asaas.com/api/v3` para testes ou `https://api.asaas.com/v3` para produção
4. **ASAAS_API_KEY**: Sua chave de API do Asaas (disponível no painel do Asaas)
5. **BINANCE_API_KEY**: Sua chave de API da Binance (disponível no painel da Binance)
6. **BINANCE_SECRET_KEY**: Sua chave secreta da Binance (disponível no painel da Binance)
7. **SMTP_HOST/PORT/SECURE/USER/PASS/FROM**: Dados do servidor de email (pode utilizar qualquer SMTP, como Gmail, Zoho ou serviços transacionais)
