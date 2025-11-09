# PagSeguro PIX - Request e Response para Homologação

Este documento contém exemplos de requests e responses da integração com PagSeguro para pagamentos PIX, necessários para o processo de homologação.

## Configuração

### Variáveis de Ambiente Necessárias

```env
PAGSEGURO_APP_KEY=sua_chave_aplicacao
# OU
PAGSEGURO_TOKEN=seu_token

# Opcional: Para usar ambiente sandbox
PAGSEGURO_SANDBOX=true
```

### URLs da API

- **Produção:** `https://api.pagseguro.com`
- **Sandbox:** `https://sandbox.api.pagseguro.com`

---

## 1. Criar Pedido com Pagamento PIX

### Request

**Endpoint:** `POST https://api.pagseguro.com/orders`

**Headers:**
```
Authorization: Bearer [PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN]
App-Token: [PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN]
Content-Type: application/json
```

**Request Body:**
```json
{
  "reference_id": "payment_1735689600000_abc123def456",
  "customer": {
    "name": "João Silva",
    "email": "joao.silva@example.com",
    "tax_id": "12345678909"
  },
  "items": [
    {
      "reference_id": "payment_1735689600000_abc123def456_item",
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
      "expiration_date": "2025-01-01T12:00:00.000Z"
    }
  ]
}
```

### Response (Sucesso - 201 Created)

```json
{
  "id": "ORD-12345678901234567890",
  "reference_id": "payment_1735689600000_abc123def456",
  "status": "IN_ANALYSIS",
  "created_at": "2025-01-01T11:00:00.000Z",
  "customer": {
    "name": "João Silva",
    "email": "joao.silva@example.com",
    "tax_id": "12345678909"
  },
  "items": [
    {
      "reference_id": "payment_1735689600000_abc123def456_item",
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
      "expiration_date": "2025-01-01T12:00:00.000Z"
    }
  ],
  "charges": [
    {
      "id": "CHG-12345678901234567890",
      "reference_id": "payment_1735689600000_abc123def456_charge",
      "status": "WAITING",
      "amount": {
        "value": 700,
        "currency": "BRL"
      },
      "payment_method": {
        "type": "PIX"
      },
      "created_at": "2025-01-01T11:00:00.000Z"
    }
  ]
}
```

### Response (Erro - 400 Bad Request)

```json
{
  "error_messages": [
    {
      "code": "INVALID_PARAMETER",
      "description": "O campo 'customer.tax_id' é obrigatório"
    }
  ]
}
```

### Response (Erro - 401 Unauthorized)

```json
{
  "error_messages": [
    {
      "code": "UNAUTHORIZED",
      "description": "Token inválido ou expirado"
    }
  ]
}
```

### Response (Erro - 403 Forbidden - Whitelist)

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

---

## 2. Consultar Status do Pedido

### Request

**Endpoint:** `GET https://api.pagseguro.com/orders/{order_id}`

**Headers:**
```
Authorization: Bearer [PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN]
App-Token: [PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN]
```

**Exemplo:**
```
GET https://api.pagseguro.com/orders/ORD-12345678901234567890
```

### Response (Sucesso - 200 OK)

**Status: WAITING (Aguardando Pagamento)**
```json
{
  "id": "ORD-12345678901234567890",
  "reference_id": "payment_1735689600000_abc123def456",
  "status": "IN_ANALYSIS",
  "created_at": "2025-01-01T11:00:00.000Z",
  "updated_at": "2025-01-01T11:00:00.000Z",
  "charges": [
    {
      "id": "CHG-12345678901234567890",
      "status": "WAITING",
      "amount": {
        "value": 700,
        "currency": "BRL"
      },
      "payment_method": {
        "type": "PIX"
      },
      "created_at": "2025-01-01T11:00:00.000Z"
    }
  ]
}
```

**Status: PAID (Pago)**
```json
{
  "id": "ORD-12345678901234567890",
  "reference_id": "payment_1735689600000_abc123def456",
  "status": "PAID",
  "created_at": "2025-01-01T11:00:00.000Z",
  "updated_at": "2025-01-01T11:05:30.000Z",
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
      "created_at": "2025-01-01T11:00:00.000Z",
      "paid_at": "2025-01-01T11:05:30.000Z"
    }
  ]
}
```

### Response (Erro - 404 Not Found)

```json
{
  "error_messages": [
    {
      "code": "NOT_FOUND",
      "description": "Pedido não encontrado"
    }
  ]
}
```

---

## 3. Consultar QR Code PIX de uma Cobrança

### Request

**Endpoint:** `GET https://api.pagseguro.com/charges/{charge_id}/pix`

**Headers:**
```
Authorization: Bearer [PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN]
App-Token: [PAGSEGURO_APP_KEY ou PAGSEGURO_TOKEN]
```

**Exemplo:**
```
GET https://api.pagseguro.com/charges/CHG-12345678901234567890/pix
```

### Response (Sucesso - 200 OK)

```json
{
  "qr_code": "00020126360014BR.GOV.BCB.PIX0114+55119999999990204000053039865405700.005802BR5913PAGSEGURO S.A6009SAO PAULO62070503***6304ABCD",
  "qr_code_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "expires_at": "2025-01-01T12:00:00.000Z"
}
```

---

## 4. Webhook de Confirmação de Pagamento

### Request (Recebido do PagSeguro)

**Endpoint:** `POST https://seu-dominio.com/api/payments/webhook`

**Headers:**
```
Content-Type: application/json
X-PagSeguro-Signature: [assinatura_do_webhook]
```

**Request Body:**
```json
{
  "event": "PAYMENT_PAID",
  "order": {
    "id": "ORD-12345678901234567890",
    "reference_id": "payment_1735689600000_abc123def456",
    "status": "PAID",
    "created_at": "2025-01-01T11:00:00.000Z",
    "updated_at": "2025-01-01T11:05:30.000Z"
  },
  "charge": {
    "id": "CHG-12345678901234567890",
    "status": "PAID",
    "amount": {
      "value": 700,
      "currency": "BRL"
    },
    "payment_method": {
      "type": "PIX"
    },
    "paid_at": "2025-01-01T11:05:30.000Z"
  }
}
```

### Response (Sucesso - 200 OK)

```json
{
  "status": "received",
  "message": "Webhook processado com sucesso"
}
```

---

## Status Possíveis

### Status do Pedido (Order)
- `IN_ANALYSIS` - Em análise
- `PAID` - Pago
- `CANCELLED` - Cancelado
- `REFUNDED` - Reembolsado

### Status da Cobrança (Charge)
- `WAITING` - Aguardando pagamento
- `PAID` - Pago
- `CANCELLED` - Cancelado
- `REFUNDED` - Reembolsado

---

## Exemplos de Uso no Código

### Criar Pagamento PIX

```typescript
import { createPagSeguroPixPayment } from '@/lib/pagseguro'

const payment = await createPagSeguroPixPayment({
  reference_id: `payment_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
  customer: {
    name: "João Silva",
    email: "joao.silva@example.com",
    tax_id: "12345678909"
  },
  amount: 7.00, // Valor em reais
  description: "Plano Semanal - Kaizen Gens"
})

console.log('QR Code:', payment.qrCode)
console.log('ID do Pagamento:', payment.id)
console.log('Expira em:', payment.expiresAt)
```

### Consultar Status do Pagamento

```typescript
import { getPagSeguroPayment } from '@/lib/pagseguro'

const paymentStatus = await getPagSeguroPayment('CHG-12345678901234567890')
console.log('Status:', paymentStatus.charges[0].status)
```

---

## Notas Importantes

1. **Valores em Centavos**: O PagSeguro trabalha com valores em centavos. O valor `700` representa R$ 7,00.

2. **CPF/CNPJ**: O campo `tax_id` deve conter apenas números (sem pontos, traços ou barras).

3. **Expiração do QR Code**: Por padrão, o QR code PIX expira em 30 minutos. Você pode configurar uma data de expiração personalizada.

4. **Ambiente Sandbox**: Para testes, configure `PAGSEGURO_SANDBOX=true` no arquivo `.env`.

5. **Whitelist**: Para usar em produção, é necessário solicitar whitelist ao PagSeguro através do formulário oficial.

---

## Suporte

Para mais informações, consulte a [documentação oficial do PagSeguro](https://dev.pagseguro.uol.com.br/docs).

