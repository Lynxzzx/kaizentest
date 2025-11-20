# Melhorias no Sistema de PIX PagSeguro

## 📋 Resumo das Melhorias

Este documento detalha as melhorias implementadas no sistema de pagamento PIX via PagSeguro para garantir a **ativação automática de planos** após confirmação de pagamento.

## 🔧 Problemas Corrigidos

### 1. **Logs Detalhados para Debug**
- ✅ Adicionados logs detalhados em todos os pontos do fluxo de pagamento
- ✅ Logs incluem IDs, status, usuário e plano
- ✅ Facilita identificação de problemas em produção

### 2. **Melhor Detecção de Status PAID**
- ✅ Suporte para múltiplas variações de status:
  - `PAID`
  - `PAYMENT_PAID`
  - `CONFIRMED`
  - `APPROVED`
- ✅ Verifica tanto no webhook quanto na consulta manual

### 3. **Busca Mais Robusta de Pagamentos**
- ✅ Busca por múltiplos identificadores:
  - `orderId` (ORD-...)
  - `chargeId` (CHG-...)
  - `referenceId` (payment_...)
- ✅ Logs mostram exatamente quais IDs foram encontrados

### 4. **Verificação Manual de Pagamentos Pendentes**
- ✅ Novo endpoint para admin: `/api/admin/check-pending-payments`
- ✅ Botão no painel admin: **"Verificar PIX"**
- ✅ Verifica automaticamente todos os pagamentos das últimas 24h
- ✅ Ativa planos que foram pagos mas não foram confirmados pelo webhook

### 5. **Logs Completos no Processo de Ativação**
- ✅ Rastreamento completo do processo:
  1. `settlePaymentAsPaid` - Confirmação do pagamento
  2. `activateUserPlan` - Ativação do plano
  3. Logs de renovação vs. novo plano
  4. Logs de data de expiração

## 📊 Arquivos Modificados

### 1. `pages/api/payments/webhook.ts`
**O que foi melhorado:**
- Logs detalhados de IDs extraídos do webhook
- Busca de pagamentos pendentes para debug quando não encontra
- Detecção de múltiplas variações de status PAID
- Consulta na API do PagSeguro se status não vier no webhook
- Tratamento de erros com logs detalhados
- Retorno de informações de sucesso

### 2. `pages/api/payments/check-pix.ts`
**O que foi melhorado:**
- Logs detalhados em cada etapa da verificação
- Detecção de múltiplas variações de status PAID
- Tratamento de erros melhorado
- Logs completos da resposta do PagSeguro

### 3. `lib/payment-utils.ts`
**O que foi melhorado:**
- Função `settlePaymentAsPaid`: Logs de cada etapa
- Função `activateUserPlan`: Logs detalhados incluindo:
  - Tipo de plano (novo, renovação, vitalício)
  - Usuário e plano
  - Data de expiração calculada
  - Confirmação de sucesso

### 4. `pages/api/admin/check-pending-payments.ts` (NOVO)
**Funcionalidades:**
- Busca todos os pagamentos PIX pendentes das últimas 24h
- Consulta status de cada um no PagSeguro
- Ativa automaticamente os que foram pagos
- Retorna relatório completo:
  - Total verificado
  - Quantos foram ativados
  - Quantos ainda estão pendentes
  - Erros encontrados

### 5. `pages/admin/index.tsx`
**O que foi melhorado:**
- Novo botão **"Verificar PIX"** no header
- Função `checkPendingPayments()` que chama o novo endpoint
- Toast notifications com resultados da verificação

## 🚀 Como Usar

### 1. **Ativação Automática (Normal)**
Quando um cliente paga via PIX:
1. PagSeguro envia webhook para `/api/payments/webhook`
2. Sistema identifica o pagamento no banco de dados
3. Verifica se status é PAID
4. Atualiza pagamento e ativa plano automaticamente
5. Logs completos são gerados

### 2. **Verificação Manual (Admin)**
Se o webhook falhar ou quiser verificar manualmente:
1. Acesse o painel admin
2. Clique no botão **"💰 Verificar PIX"**
3. Sistema verifica automaticamente todos os pagamentos pendentes
4. Ativa os que foram pagos
5. Exibe relatório com resultados

### 3. **Verificação Individual (Usuário)**
O usuário pode verificar seu próprio pagamento:
- O frontend já faz polling automático em `/api/payments/check-pix`
- A cada alguns segundos verifica se o pagamento foi confirmado
- Quando confirmar, ativa o plano automaticamente

## 🔍 Como Debugar Problemas

### 1. **Verificar Logs do Webhook**
Os logs agora incluem:
```
📥 Webhook recebido do PagSeguro: { ... }
🔍 IDs extraídos do webhook: { orderId, chargeId, referenceId }
🔍 Filtros de busca de pagamento: [ ... ]
✅ Pagamento encontrado no banco: { id, userId, username, ... }
🔍 Status encontrados no webhook: [ ... ]
🔍 Status de pagamento detectado: { isPaid, normalizedStatus }
🚀 Iniciando processo de ativação do plano...
💰 [settlePaymentAsPaid] Iniciando confirmação de pagamento: ...
✅ [settlePaymentAsPaid] Plano ativado! Expira em: ...
```

### 2. **Verificar Logs do Check Manual**
```
🔍 [check-pix] Buscando pagamento: ...
✅ [check-pix] Pagamento encontrado: { ... }
🔍 [check-pix] Tipo de pagamento: PagSeguro
🔄 [check-pix] Consultando status no PagSeguro...
📦 [check-pix] Resposta do PagSeguro: { ... }
🔍 [check-pix] Status extraídos: { ... }
✅ [check-pix] Pagamento PagSeguro confirmado e plano ativado
```

### 3. **Verificar Logs do Admin Check**
```
🔍 [admin-check] Buscando pagamentos PIX pendentes...
📊 [admin-check] Encontrados X pagamentos pendentes
🔄 [admin-check] Verificando pagamento ID (username)...
✅ [admin-check] Pagamento ID está PAGO! Ativando plano...
✅ [admin-check] Plano ativado para username!
```

## 🎯 Fluxo Completo de Ativação

```
1. Cliente paga PIX no PagSeguro
   ↓
2. PagSeguro envia webhook
   ↓
3. Sistema recebe webhook e loga payload completo
   ↓
4. Extrai IDs (orderId, chargeId, referenceId)
   ↓
5. Busca pagamento no banco usando múltiplos filtros
   ↓
6. Verifica status (PAID, CONFIRMED, APPROVED)
   ↓
7. Se não encontrar status, consulta API PagSeguro
   ↓
8. Se status = PAID:
   ├─ Atualiza pagamento para PAID
   ├─ Registra uso de cupom (se houver)
   └─ Ativa plano do usuário
      ├─ Verifica plano atual
      ├─ Calcula data de expiração
      ├─ Atualiza usuário no banco
      └─ Loga sucesso com detalhes
   ↓
9. Retorna sucesso para PagSeguro
```

## 🛠️ Configuração Necessária

### No PagSeguro:
1. Configurar webhook URL: `https://seu-dominio.com/api/payments/webhook`
2. Eventos para ativar:
   - `PAYMENT_PAID`
   - `ORDER_PAID`
   - Todos os eventos relacionados a pagamento

### No Servidor:
Variáveis de ambiente ou configuração no admin:
- `PAGSEGURO_APP_KEY` ou `PAGSEGURO_TOKEN`
- `PAGSEGURO_SANDBOX` (true/false)
- `PAGSEGURO_API_URL` (opcional)
- `PAGSEGURO_SELLER_EMAIL` (opcional, mas recomendado)

## 📝 Notas Importantes

1. **Webhook pode falhar**: Por isso temos verificação manual
2. **Logs são essenciais**: Sempre verifique os logs em produção
3. **Múltiplos IDs**: PagSeguro usa orderId e chargeId, ambos são salvos
4. **Status variados**: PagSeguro pode enviar diferentes status, todos são tratados
5. **Verificação das últimas 24h**: Admin check só verifica pagamentos recentes

## ✅ Checklist de Testes

- [ ] Criar pagamento PIX via PagSeguro
- [ ] Verificar logs do webhook quando PagSeguro enviar confirmação
- [ ] Verificar se plano foi ativado automaticamente
- [ ] Testar botão "Verificar PIX" no admin
- [ ] Testar verificação manual em `/api/payments/check-pix`
- [ ] Verificar logs de ativação completos
- [ ] Testar com plano vitalício (duration = 0)
- [ ] Testar renovação de plano existente

## 🐛 Solução de Problemas Comuns

### Problema: Webhook não está sendo chamado
**Solução:**
1. Verificar configuração no painel PagSeguro
2. Verificar se URL é acessível publicamente
3. Usar botão "Verificar PIX" no admin como fallback

### Problema: Pagamento não está sendo encontrado
**Solução:**
1. Verificar logs: `🔍 Filtros de busca de pagamento`
2. Verificar se `asaasId` ou `pagSeguroReferenceId` está salvo corretamente
3. Verificar logs: `📊 Últimos 10 pagamentos PIX pendentes`

### Problema: Status não está sendo detectado como PAID
**Solução:**
1. Verificar logs: `🔍 Status encontrados no webhook`
2. Sistema já suporta: PAID, PAYMENT_PAID, CONFIRMED, APPROVED
3. Se for outro status, adicionar no código

### Problema: Plano não está sendo ativado
**Solução:**
1. Verificar logs completos de `[settlePaymentAsPaid]` e `[activateUserPlan]`
2. Verificar se erro está sendo logado
3. Verificar se duração do plano está correta
4. Usar endpoint admin para forçar verificação

## 📞 Suporte

Se problemas persistirem:
1. Verificar logs completos do servidor
2. Usar botão "Verificar PIX" no admin
3. Verificar configuração do PagSeguro
4. Verificar se webhook está sendo recebido (logs mostram isso)

