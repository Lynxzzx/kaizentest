# 🚨 CONFIGURAR ASAAS_API_KEY NO VERCEL

## Problema
A variável `ASAAS_API_KEY` está vazia no Vercel, causando erro ao criar pagamentos PIX.

## Solução Rápida (Usando Vercel CLI)

### Passo 1: Instalar Vercel CLI (se ainda não tiver)
```bash
npm install -g vercel
```

### Passo 2: Fazer Login
```bash
vercel login
```

### Passo 3: Remover a variável vazia (se existir)
```bash
vercel env rm ASAAS_API_KEY
```

### Passo 4: Adicionar a chave correta
```bash
vercel env add ASAAS_API_KEY production
```

Quando solicitado, cole esta chave:
```
$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmViYjQ5ZDliLWZmN2EtNGI5Yi1iYTk5LWE3ZjkwZmQyM2ZmZDo6JGFhY2hfNDg1ZDI4ZmQtOGEyMC00ZTZiLTg0YzQtNjE1MWM2MGFhZjBk
```

**IMPORTANTE:** 
- Cole a chave COMPLETA (deve ter mais de 100 caracteres)
- NÃO adicione espaços ou quebras de linha
- Certifique-se de que a chave começa com `$aact_prod_`

### Passo 5: Adicionar também para Preview e Development
```bash
vercel env add ASAAS_API_KEY preview
```
Cole a mesma chave quando solicitado.

```bash
vercel env add ASAAS_API_KEY development
```
Cole a mesma chave quando solicitado.

### Passo 6: Verificar se foi adicionada corretamente
```bash
vercel env ls
```

Deve mostrar `ASAAS_API_KEY` com ✓ para Production, Preview e Development.

### Passo 7: Fazer Redeploy
No dashboard do Vercel:
1. Vá em **Deployments**
2. Clique nos **3 pontos (⋯)** do último deployment
3. Clique em **Redeploy**
4. Aguarde 1-2 minutos

## Solução Alternativa (Usando Dashboard do Vercel)

### Passo 1: Acessar Dashboard
1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto

### Passo 2: Remover variável vazia
1. Vá em **Settings (⚙️)** > **Environment Variables**
2. Encontre `ASAAS_API_KEY`
3. Clique no ícone de **lixeira (🗑️)** para deletar

### Passo 3: Adicionar nova variável
1. Clique em **"Add New"**
2. **Nome:** `ASAAS_API_KEY` (exatamente assim, maiúsculas)
3. **Valor:** Cole esta chave COMPLETA:
   ```
   $aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmViYjQ5ZDliLWZmN2EtNGI5Yi1iYTk5LWE3ZjkwZmQyM2ZmZDo6JGFhY2hfNDg1ZDI4ZmQtOGEyMC00ZTZiLTg0YzQtNjE1MWM2MGFhZjBk
   ```
4. **IMPORTANTE:** Marque TODOS os ambientes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Verifique se o valor aparece no campo antes de salvar
6. Clique em **"Save"**

### Passo 4: Fazer Redeploy
1. Vá em **Deployments**
2. Clique nos **3 pontos (⋯)** do último deployment
3. Clique em **Redeploy**
4. Aguarde 1-2 minutos

## Verificar se Funcionou

Após o redeploy, teste criando um pagamento PIX. Se ainda der erro, verifique os logs:

```bash
vercel logs --follow
```

## Problemas Comuns

### ❌ Variável ainda está vazia
- **Solução:** Delete e crie novamente. Certifique-se de que o valor está completo antes de salvar.

### ❌ Variável não aparece no Production
- **Solução:** Certifique-se de marcar ✅ Production ao adicionar a variável.

### ❌ Não fez Redeploy
- **Solução:** Após adicionar/editar variáveis, SEMPRE faça um redeploy manual.

### ❌ Chave incompleta
- **Solução:** A chave deve ter mais de 100 caracteres e começar com `$aact_prod_`.

## Chave do Asaas

Se você não tiver a chave do Asaas:
1. Acesse o painel do Asaas: https://www.asaas.com/
2. Faça login
3. Vá em **Configurações** > **Integrações** > **API**
4. Copie sua **Chave de API de Produção**
5. Deve começar com `$aact_prod_` e ter mais de 100 caracteres

