# Logs de Erros - Sistema Kaizen

Este arquivo será atualizado com os erros encontrados e suas correções.

## Como verificar logs:

1. **Console do servidor Next.js**: Os logs aparecem no terminal onde o `npm run dev` está rodando
2. **API de Debug**: Acesse `/api/debug/logs` (apenas admin) para ver informações de ambiente
3. **Console do navegador**: F12 > Console para ver erros do frontend

## Erros Comuns e Soluções:

### 1. Erro ao criar pagamento PIX
**Possíveis causas:**
- Cliente não existe no Asaas
- API Key inválida ou expirada
- Formato de dados incorreto

**Solução:**
- Verificar se o cliente foi criado no Asaas
- Verificar logs no console: `Creating Asaas customer with data:`
- Verificar resposta do Asaas: `Asaas customer created:`

### 2. Erro ao criar ticket
**Possíveis causas:**
- Schema do Prisma não sincronizado
- Campo priority inválido
- Dados de entrada inválidos

**Solução:**
- Executar: `npm run db:push`
- Verificar se priority está em: LOW, MEDIUM, HIGH, URGENT
- Verificar logs: `Error creating ticket:`

### 3. Erro ao gerar código de afiliado
**Possíveis causas:**
- Módulo crypto não disponível
- Erro ao gerar código único
- Erro no banco de dados

**Solução:**
- Verificar logs: `Error generating affiliate code:`
- Verificar se o Prisma está conectado
- Tentar novamente (pode ser conflito de código único)

## Verificação Rápida:

Execute no terminal do servidor para ver logs em tempo real:
```bash
# Windows PowerShell
Get-Content .\npm-debug.log -Wait

# Ou verifique o terminal onde o npm run dev está rodando
```

## Estrutura de Logs:

Os logs seguem este padrão:
- `✅` Sucesso
- `❌` Erro
- `⚠️` Aviso
- `📦` Informação de configuração
- `🔧` Ação do sistema

