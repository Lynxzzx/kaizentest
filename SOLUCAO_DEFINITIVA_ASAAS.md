# 🔧 SOLUÇÃO DEFINITIVA - Configurar ASAAS_API_KEY no Vercel

## ⚠️ PROBLEMA
A variável `ASAAS_API_KEY` está sendo salva vazia no Vercel, mesmo após tentativas de adicionar.

## ✅ SOLUÇÃO (Usando Dashboard do Vercel)

### Passo 1: Remover TODAS as variáveis ASAAS_API_KEY
1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto **kaizengens**
3. Vá em **Settings (⚙️)** > **Environment Variables**
4. Procure por `ASAAS_API_KEY`
5. **DELETE TODAS AS INSTÂNCIAS** (Development, Production, Preview) - clique no ícone de lixeira 🗑️ de cada uma
6. Certifique-se de que **NÃO RESTA NENHUMA** variável `ASAAS_API_KEY`

### Passo 2: Adicionar NOVAMENTE (uma única vez para todos os ambientes)
1. Clique em **"Add New"**
2. **Nome:** Digite EXATAMENTE: `ASAAS_API_KEY` (maiúsculas, sem espaços)
3. **Valor:** Cole esta chave COMPLETA (copie EXATAMENTE como está abaixo):

```
$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmViYjQ5ZDliLWZmN2EtNGI5Yi1iYTk5LWE3ZjkwZmQyM2ZmZDo6JGFhY2hfNDg1ZDI4ZmQtOGEyMC00ZTZiLTg0YzQtNjE1MWM2MGFhZjBk
```

**⚠️ ATENÇÃO:**
- Copie a chave COMPLETA (deve ter mais de 100 caracteres)
- NÃO adicione espaços antes ou depois
- NÃO adicione quebras de linha
- Certifique-se de que a chave começa com `$aact_prod_`
- Use Ctrl+V para colar (não Shift+Insert)

4. **IMPORTANTE:** Marque TODOS os ambientes:
   - ✅ **Production** (obrigatório!)
   - ✅ **Preview**
   - ✅ **Development**

5. **VERIFIQUE:** Olhe o campo de valor e certifique-se de que a chave COMPLETA aparece lá (deve ter mais de 100 caracteres)

6. Clique em **"Save"**

### Passo 3: Fazer Redeploy OBRIGATÓRIO
1. Vá em **Deployments**
2. Clique nos **3 pontos (⋯)** do último deployment
3. Clique em **"Redeploy"**
4. Aguarde **2-3 minutos** para o redeploy completar

### Passo 4: Verificar se funcionou
1. Vá em **Settings** > **Environment Variables**
2. Procure por `ASAAS_API_KEY`
3. Deve aparecer apenas **UMA** entrada com ✓ para Production, Preview e Development
4. **NÃO** deve aparecer múltiplas entradas

### Passo 5: Testar
Após o redeploy completar, teste criando um pagamento PIX. Se ainda der erro, verifique os logs.

## 🔍 Verificar se está funcionando

### Opção 1: Via Dashboard
1. Vá em **Settings** > **Environment Variables**
2. Clique em `ASAAS_API_KEY`
3. Deve mostrar o valor (começando com `$aact_prod_...`)

### Opção 2: Via CLI
```bash
vercel env ls
```

Deve mostrar apenas uma linha para `ASAAS_API_KEY` com todos os ambientes marcados.

## ❌ Problemas Comuns

### Variável ainda está vazia
- **Solução:** Delete TODAS as instâncias e adicione novamente. Certifique-se de que o valor está completo antes de salvar.

### Múltiplas entradas
- **Solução:** Delete TODAS e adicione apenas UMA vez, marcando todos os ambientes.

### Não fez Redeploy
- **Solução:** Após adicionar/editar variáveis, SEMPRE faça um redeploy manual.

### Variável não aparece no Production
- **Solução:** Certifique-se de marcar ✅ Production ao adicionar.

## 🆘 Se ainda não funcionar

1. Verifique se você tem permissões de administrador no projeto
2. Tente usar outro navegador ou limpar o cache
3. Verifique se há caracteres invisíveis na chave (copie diretamente do arquivo)
4. Entre em contato com o suporte do Vercel se persistir

## 📋 Chave Completa (copie e cole)

```
$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmViYjQ5ZDliLWZmN2EtNGI5Yi1iYTk5LWE3ZjkwZmQyM2ZmZDo6JGFhY2hfNDg1ZDI4ZmQtOGEyMC00ZTZiLTg0YzQtNjE1MWM2MGFhZjBk
```

