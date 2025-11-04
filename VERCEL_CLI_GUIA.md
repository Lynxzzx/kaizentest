# Guia de Uso do Vercel CLI

## Instalação
```bash
npm install -g vercel
```

## Comandos Principais

### 1. Login no Vercel
```bash
vercel login
```
Abre o navegador para fazer login na sua conta do Vercel.

### 2. Verificar Status
```bash
vercel whoami
```
Mostra qual conta você está usando.

### 3. Deploy
```bash
# Deploy para preview (produz uma URL temporária)
vercel

# Deploy para produção
vercel --prod
```

### 4. Gerenciar Variáveis de Ambiente

#### Listar variáveis de ambiente
```bash
vercel env ls
```

#### Adicionar variável de ambiente
```bash
# Para todos os ambientes
vercel env add ASAAS_API_KEY

# Para produção apenas
vercel env add ASAAS_API_KEY production

# Para preview apenas
vercel env add ASAAS_API_KEY preview

# Para desenvolvimento apenas
vercel env add ASAAS_API_KEY development
```

#### Remover variável de ambiente
```bash
vercel env rm ASAAS_API_KEY
```

#### Atualizar variável de ambiente
```bash
# Primeiro remova
vercel env rm ASAAS_API_KEY

# Depois adicione novamente
vercel env add ASAAS_API_KEY production
```

### 5. Ver Logs
```bash
# Logs de produção
vercel logs

# Logs de um deployment específico
vercel logs [deployment-url]
```

### 6. Listar Deployments
```bash
vercel ls
```

### 7. Remover Deployment
```bash
vercel rm [deployment-url]
```

### 8. Ver Informações do Projeto
```bash
vercel inspect
```

### 9. Abrir Dashboard
```bash
vercel open
```

### 10. Linkar Projeto Local ao Vercel
```bash
vercel link
```
Conecta o projeto local a um projeto existente no Vercel.

## Exemplos Práticos

### Adicionar Variáveis de Ambiente do Asaas
```bash
# Adicionar ASAAS_API_KEY
vercel env add ASAAS_API_KEY production
# Cole a chave quando solicitado

# Adicionar ASAAS_API_URL
vercel env add ASAAS_API_URL production
# Cole a URL (https://api.asaas.com/v3 ou https://api-sandbox.asaas.com/v3)
```

### Fazer Deploy Rápido
```bash
# Deploy para preview (teste)
vercel

# Deploy para produção
vercel --prod
```

### Ver Logs em Tempo Real
```bash
vercel logs --follow
```

## Dicas

1. **Sempre faça login primeiro**: `vercel login`
2. **Use `--prod` para produção**: Sem `--prod`, o deploy vai para preview
3. **Variáveis de ambiente**: Após adicionar/editar, faça um redeploy
4. **Logs**: Use `--follow` para ver logs em tempo real

## Troubleshooting

### Comando não encontrado
```bash
# Se o vercel não for encontrado, adicione ao PATH ou use npx
npx vercel login
```

### Erro de permissão
```bash
# No Windows, pode ser necessário executar como administrador
# Ou usar npx
npx vercel login
```

### Ver versão instalada
```bash
vercel --version
```

