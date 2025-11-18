# Sistema de Expiração de Planos

## 🎯 Problema Resolvido

O sistema anterior tinha dois problemas críticos:
1. **Verificação incorreta**: Usava `new Date() <= planExpiresAt` em vez de `new Date() < planExpiresAt`
2. **Sem limpeza automática**: Planos expirados permaneciam no banco de dados indefinidamente

## ✅ Solução Implementada

### 1. Função Utilitária Centralizada (`lib/plan-utils.ts`)

Criamos três funções principais:

#### `isUserPlanActive(planId, planExpiresAt)`
Verifica se um plano está ativo:
- Retorna `false` se não há `planId`
- Retorna `true` se não há `planExpiresAt` (plano vitalício)
- Retorna `true` se `planExpiresAt > new Date()` (ainda não expirou)

#### `cleanExpiredPlans()`
Remove todos os planos expirados do banco de dados:
- Busca usuários com `planExpiresAt < new Date()`
- Define `planId` e `planExpiresAt` como `null`
- Retorna o número de planos removidos

#### `checkAndCleanUserPlan(userId)`
Verifica e limpa o plano de um usuário específico:
- Verifica se o plano está expirado
- Remove se necessário
- Retorna `true` se removeu, `false` caso contrário

### 2. API de Limpeza Manual (`/api/admin/cleanup-expired-plans`)

Endpoint que permite ao administrador limpar planos expirados manualmente:
- Método: `POST`
- Autenticação: Requer role `OWNER`
- Retorna: Número de planos removidos

**Uso:**
```bash
POST /api/admin/cleanup-expired-plans
```

### 3. API de Verificação por Usuário (`/api/users/check-plan`)

Endpoint que verifica e limpa o plano do usuário autenticado:
- Método: `GET`
- Autenticação: Requer sessão válida
- Retorna: Status do plano e se foi limpo

**Uso:**
```bash
GET /api/users/check-plan
```

### 4. Botão no Painel Admin

Adicionado botão "🧹 Limpar Planos" no painel admin (`/admin`) que:
- Chama a API de limpeza
- Exibe notificação com número de planos removidos
- Atualiza estatísticas automaticamente

### 5. Limpeza Automática em Requisições

A API de geração de contas (`/api/accounts/generate`) agora:
- Chama `checkAndCleanUserPlan()` antes de verificar permissões
- Garante que planos expirados são removidos em tempo real

### 6. Uso Consistente da Função de Ativação

Todos os locais que ativam planos agora usam `activateUserPlan()`:
- ✅ `/api/keys/redeem` - Resgate de chaves
- ✅ `/api/payments/check-btc` - Pagamento Bitcoin
- ✅ `/api/payments/webhook` - Webhook de pagamentos (via `settlePaymentAsPaid`)
- ✅ `/api/payments/check-pix` - Verificação PIX (via `settlePaymentAsPaid`)
- ✅ `/api/admin/raffles/index` - Sorteios automáticos
- ✅ `/api/admin/raffles/draw` - Sorteios manuais

## 🔧 Como Usar

### Para Administradores

1. **Limpeza Manual:**
   - Acesse o painel admin (`/admin`)
   - Clique no botão "🧹 Limpar Planos"
   - Veja quantos planos foram removidos

2. **Automatização (Recomendado):**
   - Configure um cron job para chamar `/api/admin/cleanup-expired-plans` diariamente
   - Exemplo: Todo dia às 3:00 AM

### Para Desenvolvedores

**Verificar se um plano está ativo:**
```typescript
import { isUserPlanActive } from '@/lib/plan-utils'

const isActive = isUserPlanActive(user.planId, user.planExpiresAt)
```

**Limpar plano de um usuário:**
```typescript
import { checkAndCleanUserPlan } from '@/lib/plan-utils'

const wasRemoved = await checkAndCleanUserPlan(userId)
```

**Limpar todos os planos expirados:**
```typescript
import { cleanExpiredPlans } from '@/lib/plan-utils'

const count = await cleanExpiredPlans()
console.log(`${count} planos expirados removidos`)
```

**Ativar/Renovar um plano:**
```typescript
import { activateUserPlan } from '@/lib/payment-utils'

const expiresAt = await activateUserPlan(userId, planId, durationDays)
// Se durationDays = 0, o plano é vitalício (expiresAt = null)
// Se o usuário já tem o mesmo plano ativo, a duração é somada
```

## 🔒 Segurança

- Apenas usuários com role `OWNER` podem limpar planos via API
- Usuários normais podem verificar apenas seu próprio plano
- Logs detalhados de todas as operações

## 📊 Logs

O sistema gera logs informativos:
- `🔍 Encontrados X planos expirados`
- `✅ X planos expirados removidos com sucesso`
- `🔄 Removendo plano expirado do usuário...`
- `✅ Plano ativado/renovado para usuário: X - expira em: Y`

## 🎯 Fluxo Completo

1. **Usuário tenta gerar conta:**
   - Sistema verifica e limpa plano se expirado
   - Verifica se tem plano ativo usando `isUserPlanActive()`
   - Permite ou nega acesso

2. **Administrador limpa planos:**
   - Clica em "Limpar Planos" no painel admin
   - `cleanExpiredPlans()` remove todos expirados
   - Notificação exibe quantos foram removidos

3. **Pagamento confirmado:**
   - `activateUserPlan()` ativa ou renova o plano
   - Se usuário já tem o mesmo plano ativo, duração é somada
   - Plano nunca é perdido, apenas estendido

## 🔄 Migração

Nenhuma migração necessária! O sistema é retrocompatível:
- Planos existentes continuam funcionando
- Planos expirados serão removidos na próxima verificação
- Nenhuma alteração no banco de dados necessária

## 📝 Notas Importantes

1. **Planos Vitalícios:**
   - `planExpiresAt = null` significa plano vitalício
   - Nunca serão removidos pela limpeza automática

2. **Renovação de Planos:**
   - Se usuário tem plano X ativo e compra plano X novamente
   - A duração é somada à data de expiração atual
   - Usuário não perde dias restantes

3. **Gerações Grátis:**
   - Usuários sem plano ainda têm 2 gerações grátis por dia
   - Sistema reseta contador diariamente às 00:00

4. **Gerações Bônus:**
   - Não expiram
   - Podem ser usadas mesmo sem plano ativo
   - São decrementadas quando usadas

