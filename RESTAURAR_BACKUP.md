# 🔄 Como Restaurar Backup do MongoDB Atlas

## ⚠️ Situação Atual
O banco de dados foi resetado acidentalmente usando `--force-reset`. Alguns dados ainda existem, mas muitos foram perdidos.

## 📊 Status Atual do Banco
- ✅ 3 usuários (incluindo admin)
- ✅ 1 plano
- ❌ 0 serviços
- ❌ Estoque provavelmente vazio

## 🔍 Verificar Backup no MongoDB Atlas

### Passo 1: Acessar MongoDB Atlas
1. Acesse: https://cloud.mongodb.com/
2. Faça login na sua conta
3. Selecione seu cluster

### Passo 2: Verificar Backups Automáticos
1. No menu lateral, clique em **"Backups"** ou **"Backup"**
2. Verifique se há backups automáticos disponíveis
3. MongoDB Atlas geralmente mantém backups automáticos por 2-7 dias (dependendo do plano)

### Passo 3: Restaurar Backup
1. Se houver backup disponível:
   - Clique no backup que você deseja restaurar
   - Selecione **"Restore"** ou **"Restaurar"**
   - Escolha restaurar para o mesmo cluster ou criar um novo
   - **IMPORTANTE**: Isso vai sobrescrever os dados atuais!

### Passo 4: Restaurar Dados Específicos
Se você só quer restaurar algumas coleções:
1. Use o MongoDB Compass ou mongosh
2. Exporte as coleções do backup
3. Importe apenas as coleções que você precisa

## 🛠️ Alternativa: Recriar Dados Manualmente

Se não houver backup disponível, você precisará recriar:

### 1. Recriar Serviços
- Acesse `/admin` no site
- Vá em "Serviços" ou acesse `/admin/stocks`
- Crie os serviços que você tinha antes

### 2. Recriar Planos
- Acesse `/admin/plans`
- Recrie os planos que você tinha

### 3. Recriar Estoque
- Acesse `/admin/stocks`
- Adicione os estoques que você tinha

### 4. Usuários
- Os usuários precisarão se registrar novamente
- Ou você pode criar manualmente via script

## 📝 Scripts Disponíveis

### Restaurar Usuário Admin
```bash
npx ts-node scripts/create-owner.ts
```

### Verificar Status do Banco
```bash
npx ts-node scripts/restore-basic-data.ts
```

## ⚠️ IMPORTANTE

**NUNCA use `--force-reset` em produção!**

Use apenas:
```bash
npx prisma db push
```

O `--force-reset` apaga TODOS os dados do banco de dados!

## 🔐 Credenciais do Admin

- **Usuário**: Lynx
- **Senha**: eliezermito1

## 📞 Próximos Passos

1. ✅ Verificar backups no MongoDB Atlas
2. ✅ Se houver backup, restaurar
3. ✅ Se não houver backup, recriar dados manualmente
4. ✅ Recriar serviços e estoques
5. ✅ Informar usuários que precisam se registrar novamente (se necessário)

