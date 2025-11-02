# 📋 Instruções para Verificar Logs do Sistema

## Como verificar os logs:

### 1. **Logs do Servidor Next.js** (Mais Importante)

Os logs aparecem no terminal onde você executou `npm run dev`.

**No terminal do servidor, você verá:**
- ✅ Sucessos (verde no console)
- ❌ Erros (vermelho no console)
- ⚠️ Avisos (amarelo no console)
- 📦 Informações de configuração

**Exemplos de logs que aparecem:**
```
📦 DATABASE_URL configurada: MongoDB Atlas
✅ Conectado ao banco de dados MongoDB
Creating Asaas customer with data: {...}
Asaas customer created: cus_xxxxx
Error creating Asaas payment: {...}
```

### 2. **Logs no Console do Navegador**

1. Abra o navegador
2. Pressione F12 (ou clique direito > Inspecionar)
3. Vá na aba "Console"
4. Você verá erros JavaScript do frontend

### 3. **API de Debug**

Acesse: `http://localhost:3000/api/debug/logs` (apenas admin)

Esta rota mostra:
- Se as variáveis de ambiente estão configuradas
- Informações do ambiente
- Status das configurações

### 4. **Logs de Erro Específicos**

Cada API tem logs detalhados. Os logs incluem:

#### **Pagamento PIX:**
```
Creating Asaas customer with data: {...}
Creating Asaas payment with data: {...}
Asaas payment created: pay_xxxxx
Error creating Asaas payment: {...}
```

#### **Tickets:**
```
Error creating ticket: {...}
Error fetching tickets: {...}
Error creating ticket reply: {...}
```

#### **Afiliados:**
```
Redeeming affiliate code: XXXX
Affiliate code not found: XXXX
Creating affiliate reward...
Error generating affiliate code: {...}
```

## Erros Comuns e Onde Ver:

### ❌ Erro ao criar pagamento PIX
**Onde ver:** Terminal do servidor
**Procure por:** `Error creating Asaas customer` ou `Error creating Asaas payment`
**Detalhes:** O log mostrará o erro completo do Asaas

### ❌ Erro ao criar ticket
**Onde ver:** Terminal do servidor  
**Procure por:** `Error creating ticket:`
**Detalhes:** Mostra o erro do Prisma ou validação

### ❌ Erro ao gerar código de afiliado
**Onde ver:** Terminal do servidor
**Procure por:** `Error generating affiliate code:`
**Detalhes:** Mostra erro do crypto ou banco de dados

## Como copiar os logs:

### Windows PowerShell:
```powershell
# Ver logs em tempo real
Get-Content .\npm-debug.log -Wait

# Ou copie manualmente do terminal onde o npm run dev está rodando
```

### Windows CMD:
```cmd
# Ver logs em tempo real
type npm-debug.log

# Ou copie manualmente do terminal
```

## Logs importantes para enviar:

Quando reportar um erro, envie:
1. ✅ O log completo do erro do terminal do servidor
2. ✅ O código de erro (se houver)
3. ✅ A mensagem de erro completa
4. ✅ O que você estava tentando fazer quando o erro ocorreu

## Exemplo de log de erro completo:

```
Error creating Asaas payment: {
  response: {
    status: 400,
    data: {
      errors: [{
        code: 'INVALID_CUSTOMER',
        description: 'Customer not found'
      }]
    }
  }
}
```

Este tipo de log ajuda a identificar exatamente o que está errado!

