# Formulário de Solicitação de Whitelist - PagBank API

## Preenchimento do Formulário

### 1. Selecione qual serviço você integrou:
- ✅ **API de Pedidos e Pagamentos (Order)** - Usado para criar pedidos com pagamento PIX
- ✅ **API PIX** - Usado para gerar QR codes PIX para pagamento de planos

### 2. Instruções de acesso ao ambiente para validação:

```
Ambiente de Produção:
- URL: [INSERIR URL DO VERCEL AQUI - ex: https://seu-projeto.vercel.app]
- Ambiente: Produção (Vercel)
- Credenciais de teste:
  - Email: [INSERIR EMAIL DE TESTE]
  - Senha: [INSERIR SENHA DE TESTE]

Ambiente de Desenvolvimento (opcional):
- URL: http://localhost:3000
- Ambiente: Local
- Acesso: Requer instalação local do projeto
```

### 3. URL do site:
```
[INSERIR URL DO VERCEL AQUI]
Exemplo: https://kaizen-gens.vercel.app
```

### 4. Utiliza recaptcha ou algum outro recurso de segurança em sua página de checkout?
- ✅ **Não**

### 5. Anexo - Requests e Responses:

#### Request: Criar Pedido com Pagamento PIX

**Endpoint:** `POST https://api.pagseguro.com/orders`

**Headers:**
```
Authorization: Bearer [SEU_TOKEN]
App-Token: [SUA_CHAVE_APLICACAO]
Content-Type: application/json
```

**Request Body:**
```json
{
  "reference_id": "payment_1762292624099_6906ed51c600711dbcd793b0",
  "customer": {
    "name": "João Silva",
    "email": "joao@example.com",
    "tax_id": "12345678909"
  },
  "items": [
    {
      "reference_id": "payment_1762292624099_6906ed51c600711dbcd793b0_item",
      "name": "Plano Semanal - Kaizen Gens",
      "quantity": 1,
      "unit_amount": 700
    }
  ],
  "qr_codes": [
    {
      "amount": {
        "value": 700,
        "currency": "BRL"
      },
      "expiration_date": "2025-11-04T22:06:39.821Z"
    }
  ]
}
```

**Response (Sucesso - 200 OK):**
```json
{
  "id": "ORD-12345678901234567890",
  "reference_id": "payment_1762292624099_6906ed51c600711dbcd793b0",
  "status": "PAID",
  "created_at": "2025-11-04T21:06:39.000Z",
  "customer": {
    "name": "João Silva",
    "email": "joao@example.com",
    "tax_id": "12345678909"
  },
  "items": [
    {
      "reference_id": "payment_1762292624099_6906ed51c600711dbcd793b0_item",
      "name": "Plano Semanal - Kaizen Gens",
      "quantity": 1,
      "unit_amount": 700
    }
  ],
  "qr_codes": [
    {
      "id": "PIX-12345678901234567890",
      "text": "00020126360014BR.GOV.BCB.PIX0114+55119999999990204000053039865405700.005802BR5913PAGSEGURO S.A6009SAO PAULO62070503***6304ABCD",
      "amount": {
        "value": 700,
        "currency": "BRL"
      },
      "expiration_date": "2025-11-04T22:06:39.821Z"
    }
  ],
  "charges": [
    {
      "id": "CHG-12345678901234567890",
      "reference_id": "payment_1762292624099_6906ed51c600711dbcd793b0_charge",
      "status": "WAITING",
      "amount": {
        "value": 700,
        "currency": "BRL"
      },
      "payment_method": {
        "type": "PIX"
      }
    }
  ]
}
```

**Response (Erro - 400 Bad Request):**
```json
{
  "error_messages": [
    {
      "code": "ACCESS_DENIED",
      "description": "whitelist access required. Contact PagSeguro"
    }
  ]
}
```

#### Request: Consultar Status do Pedido

**Endpoint:** `GET https://api.pagseguro.com/orders/{order_id}`

**Headers:**
```
Authorization: Bearer [SEU_TOKEN]
App-Token: [SUA_CHAVE_APLICACAO]
```

**Response (Sucesso - 200 OK):**
```json
{
  "id": "ORD-12345678901234567890",
  "reference_id": "payment_1762292624099_6906ed51c600711dbcd793b0",
  "status": "PAID",
  "created_at": "2025-11-04T21:06:39.000Z",
  "updated_at": "2025-11-04T21:10:15.000Z",
  "charges": [
    {
      "id": "CHG-12345678901234567890",
      "status": "PAID",
      "amount": {
        "value": 700,
        "currency": "BRL"
      },
      "payment_method": {
        "type": "PIX"
      },
      "paid_at": "2025-11-04T21:10:15.000Z"
    }
  ]
}
```

## Informações Adicionais

### Sobre o Projeto:
- **Nome:** Kaizen Gens
- **Tipo:** Sistema de geração de contas com planos pagos
- **Tecnologia:** Next.js 14, TypeScript, MongoDB
- **Plataforma:** Vercel (Produção)

### Fluxo de Pagamento:
1. Usuário seleciona um plano
2. Sistema cria pedido via API `/orders` com QR code PIX
3. Usuário escaneia QR code e realiza pagamento
4. Sistema recebe webhook de confirmação do pagamento
5. Usuário recebe acesso ao plano

### Casos de Uso:
- Pagamento de planos mensais/semanais/diários
- Geração de QR codes PIX para pagamento instantâneo
- Consulta de status de pagamentos
- Webhook para atualização automática de status

