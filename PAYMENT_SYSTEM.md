# Sistema de Pagamentos e Ativação Automática de Planos

## Como Funciona

### Pagamentos PIX
1. Usuário cria pagamento PIX → Status: `PENDING`
2. Asaas envia webhook quando pagamento é confirmado → `/api/payments/webhook`
3. Sistema atualiza status para `PAID` e ativa plano automaticamente ✅

**Configuração do Webhook no Asaas:**
- URL: `https://seu-dominio.com/api/payments/webhook`
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`
- O Asaas enviará um POST quando o pagamento for confirmado

### Pagamentos Bitcoin
1. Usuário cria pagamento Bitcoin → Status: `PENDING`
2. Duas opções de verificação:

   **Opção A - Verificação Manual (Frontend):**
   - Frontend chama periodicamente: `POST /api/payments/check-btc`
   - Sistema verifica status na blockchain
   - Se confirmado, ativa plano automaticamente ✅

   **Opção B - Cron Job (Backend):**
   - Criar um cron job que verifica pagamentos pendentes
   - Pode usar Vercel Cron ou serviço externo
   - Chamar `/api/payments/check-btc` para cada pagamento pendente

## Endpoints

### `/api/payments/webhook` (POST)
- **Público**: Sim (Asaas chama diretamente)
- **Função**: Recebe webhook do Asaas quando PIX é confirmado
- **Ação**: Ativa plano automaticamente

### `/api/payments/check-btc` (POST)
- **Autenticado**: Sim (usuário logado)
- **Body**: `{ paymentId: string }`
- **Função**: Verifica status de pagamento Bitcoin na blockchain
- **Ação**: Se confirmado, ativa plano automaticamente

## Fluxo de Ativação de Plano

Quando um pagamento é confirmado (PIX ou Bitcoin), o sistema:

1. Atualiza status do pagamento: `PENDING` → `PAID`
2. Define `paidAt` com data/hora atual
3. Ativa plano do usuário:
   - Atribui `planId` ao usuário
   - Define `planExpiresAt` = hoje + duração do plano (dias)

## Implementação Futura

### Para Bitcoin Automático:
- Integrar Binance Pay API para verificação automática
- Ou usar APIs de blockchain públicas (Blockstream, Etherscan)
- Implementar webhook do Binance Pay (se disponível)

### Para Melhor UX:
- Mostrar notificação no frontend quando pagamento é confirmado
- Atualizar status em tempo real via WebSocket ou polling
- Adicionar página de status de pagamento

## Notas Importantes

⚠️ **Webhook do Asaas precisa ser configurado no painel do Asaas**
⚠️ **Verificação Bitcoin ainda é placeholder - precisa implementar verificação real**
⚠️ **Webhook do Binance Pay pode não estar disponível - usar verificação periódica**

