# 🧪 Guia de Teste - Sistema de Expiração de Planos

## ✅ Checklist de Testes

### 1. Teste de Limpeza Manual (Mais Fácil)

1. **Acesse o painel admin:**
   ```
   http://seu-dominio/admin
   ```

2. **Clique no botão "🧹 Limpar Planos":**
   - Deve aparecer uma notificação com "X planos expirados foram removidos"
   - Se não houver planos expirados, mostrará "0 planos expirados foram removidos"

3. **Verifique os logs no console do servidor:**
   - Deve mostrar: `✅ X planos expirados removidos com sucesso`

### 2. Teste com Usuário Real (Recomendado)

#### **Passo 1: Criar um Usuário de Teste**
1. Crie uma nova conta de usuário
2. Acesse o painel admin → Usuários
3. Atribua um plano com data de expiração PASSADA (ex: ontem)

#### **Passo 2: Tentar Gerar Conta**
1. Faça login com o usuário de teste
2. Tente gerar uma conta em um serviço que requer plano pago
3. **Resultado Esperado:** 
   - Erro: "Você não possui um plano ativo..."
   - O plano deve ter sido removido automaticamente

#### **Passo 3: Verificar no Admin**
1. Acesse o painel admin → Usuários
2. Busque o usuário de teste
3. **Resultado Esperado:**
   - Plano: "Sem plano"
   - Data de expiração: vazia

### 3. Teste de Renovação de Plano

#### **Cenário 1: Usuário sem plano**
1. Usuário compra plano de 30 dias
2. **Resultado Esperado:** `planExpiresAt = hoje + 30 dias`

#### **Cenário 2: Usuário com plano ativo**
1. Usuário tem plano até 01/12/2025
2. Usuário compra o MESMO plano de 30 dias
3. **Resultado Esperado:** `planExpiresAt = 01/12/2025 + 30 dias = 31/12/2025`

#### **Cenário 3: Usuário com plano diferente**
1. Usuário tem "Plano Basic" até 01/12/2025
2. Usuário compra "Plano Premium" de 30 dias
3. **Resultado Esperado:** `planExpiresAt = hoje + 30 dias` (substitui o plano)

### 4. Teste de Plano Vitalício

1. Crie um plano com `duration = 0`
2. Atribua a um usuário
3. **Resultado Esperado:**
   - `planExpiresAt = null`
   - Nunca expira
   - Não é removido pela limpeza

### 5. Teste de API (Opcional - Para Desenvolvedores)

#### **Limpar Planos Expirados:**
```bash
curl -X POST http://localhost:3000/api/admin/cleanup-expired-plans \
  -H "Cookie: next-auth.session-token=SEU_TOKEN_AQUI"
```

#### **Verificar Plano do Usuário:**
```bash
curl -X GET http://localhost:3000/api/users/check-plan \
  -H "Cookie: next-auth.session-token=SEU_TOKEN_AQUI"
```

## 🔍 O Que Observar nos Logs

### Logs de Sucesso:
```
✅ Plano ativado/renovado para usuário: abc123 - expira em: 2025-12-15T00:00:00.000Z
🔍 Encontrados 3 planos expirados:
   - Usuário: teste1 (id123) - Expirou em: 2025-11-01T00:00:00.000Z
   - Usuário: teste2 (id456) - Expirou em: 2025-10-15T00:00:00.000Z
   - Usuário: teste3 (id789) - Expirou em: 2025-09-30T00:00:00.000Z
✅ 3 planos expirados removidos com sucesso
🔄 Removendo plano expirado do usuário teste1 (id123)
✅ Plano removido com sucesso
```

### Logs de Erro (Se houver problemas):
```
❌ Erro ao limpar planos expirados: [descrição do erro]
❌ Erro ao verificar plano do usuário: [descrição do erro]
```

## 🎯 Cenários de Teste Rápidos

### ✅ TESTE 1: Plano Expirado (5 minutos)
1. Admin → Usuários → Editar usuário
2. Atribuir plano com data de ontem
3. Salvar
4. Admin → Clicar "🧹 Limpar Planos"
5. **Verificar:** Notificação mostra "1 plano expirado foi removido"

### ✅ TESTE 2: Tentativa de Uso com Plano Expirado (5 minutos)
1. Criar usuário com plano expirado (data passada)
2. Login com esse usuário
3. Tentar gerar conta em serviço pago
4. **Verificar:** Erro de "não possui plano ativo"
5. Admin → Usuários → Verificar que plano foi removido

### ✅ TESTE 3: Renovação de Plano (5 minutos)
1. Criar usuário com plano até 01/12/2025
2. Resgatar chave do MESMO plano (30 dias)
3. **Verificar:** Nova data = 31/12/2025 (01/12 + 30 dias)

## 🚨 Problemas Comuns

### Problema: "Planos não estão sendo removidos"
**Solução:**
1. Verificar se há planos com `planExpiresAt < hoje`
2. Verificar logs do servidor para erros
3. Tentar limpeza manual via botão admin

### Problema: "Usuários ainda conseguem usar após expiração"
**Solução:**
1. Limpar planos expirados manualmente
2. Verificar se a API `/api/accounts/generate` está sendo usada
3. Verificar logs para ver se `checkAndCleanUserPlan` está sendo executado

### Problema: "Erro ao ativar plano"
**Solução:**
1. Verificar se o plano existe no banco
2. Verificar se `duration` do plano está correto
3. Verificar logs do servidor

## 📊 Teste de Carga (Opcional)

Se quiser testar com muitos usuários:

1. **Criar 100 usuários com planos expirados:**
```sql
-- No MongoDB Compass ou similar
db.User.updateMany(
  { planId: { $ne: null } },
  { $set: { planExpiresAt: new Date('2025-01-01') } }
)
```

2. **Executar limpeza:**
   - Clicar em "🧹 Limpar Planos"
   - Verificar tempo de execução
   - Verificar logs

## ✅ Critérios de Sucesso

O sistema está funcionando corretamente se:

1. ✅ Planos expirados são removidos ao clicar no botão admin
2. ✅ Usuários com plano expirado não conseguem gerar contas
3. ✅ Planos são removidos automaticamente ao tentar gerar conta
4. ✅ Renovação de planos soma duração corretamente
5. ✅ Planos vitalícios nunca expiram
6. ✅ Logs mostram operações corretamente
7. ✅ Notificações aparecem no admin

## 📞 Suporte

Se encontrar problemas:
1. Verificar logs do servidor
2. Verificar dados no banco de dados
3. Abrir issue com logs e descrição do problema

