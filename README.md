# Kaizen Gens

Gerador de contas com sistema de planos e pagamentos.

## Características

- Sistema de autenticação com NextAuth
- Painel Admin para gerenciar serviços, estoques, planos e chaves
- Sistema de planos e pagamentos (PIX via Asaas e Bitcoin via Telegram)
- Geração de contas para usuários com planos ativos
- Suporte multi-idioma (PT-BR e Inglês)

## Tecnologias

- Next.js 14
- TypeScript
- Prisma (MongoDB)
- NextAuth
- Tailwind CSS
- Asaas API (PIX)

## Instalação

1. Clone o repositório
2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Configure o banco de dados MongoDB e atualize o `DATABASE_URL` no `.env`

5. Execute as migrações:
```bash
npm run db:push
```

6. Execute o servidor de desenvolvimento:
```bash
npm run dev
```

## Deploy na Vercel

1. Conecte seu repositório à Vercel
2. Configure as variáveis de ambiente:
   - `DATABASE_URL`
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
   - `ASAAS_API_URL`
   - `ASAAS_API_KEY`

3. Deploy automático será iniciado

## Login Admin

- Usuário: Lynx
- Senha: aaaaa

## Estrutura

- `/pages/api` - API Routes
- `/pages/admin` - Painel Admin
- `/pages` - Páginas públicas e dashboard
- `/components` - Componentes React
- `/lib` - Utilitários e configurações
- `/prisma` - Schema do banco de dados
