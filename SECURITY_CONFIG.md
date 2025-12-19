# 🛡️ Configuração de Segurança - Kaizen

Este documento descreve como configurar as proteções de segurança do sistema.

## 📋 Índice

1. [CAPTCHA Visual](#captcha-visual)
2. [Google reCAPTCHA v3](#google-recaptcha-v3)
3. [Proteções Implementadas](#proteções-implementadas)
4. [Configurações Avançadas](#configurações-avançadas)

---

## 🔐 CAPTCHA Visual

O sistema inclui um CAPTCHA visual tradicional que exibe letras e números distorcidos que o usuário deve digitar corretamente.

### Características

- **6 caracteres** alfanuméricos (sem I, O, 0, 1 para evitar confusão)
- **Rotação aleatória** de cada caractere
- **Linhas e ruído** de fundo para dificultar OCR
- **Curvas bezier** para distorção adicional
- **Expira em 5 minutos**
- **Máximo 3 tentativas** por CAPTCHA
- **Funciona sem configuração** adicional

### Como funciona

1. Usuário acessa login/registro
2. CAPTCHA é gerado automaticamente
3. Usuário digita as letras visíveis
4. Sistema valida antes de processar
5. Se errar, novo CAPTCHA é gerado

### Botão "Atualizar"

O usuário pode clicar em "Atualizar" para gerar um novo CAPTCHA se não conseguir ler o atual.

---

## 🤖 Google reCAPTCHA v2 - Checkbox "Não sou um robô"

O reCAPTCHA v2 exibe a famosa caixinha "Não sou um robô" que o usuário precisa marcar. Às vezes, pode pedir para selecionar imagens (semáforos, carros, etc).

### Passo 1: Criar Chaves no Google

1. Acesse: https://www.google.com/recaptcha/admin
2. Clique em "+" para criar um novo site
3. Configure:
   - **Rótulo**: Nome do seu site (ex: "Kaizen")
   - **Tipo de reCAPTCHA**: reCAPTCHA v2 → "Caixa de seleção 'Não sou um robô'"
   - **Domínios**: Adicione seus domínios (ex: `seusite.com`, `localhost`)
4. Aceite os termos e clique em "Enviar"
5. Copie as chaves:
   - **Chave do site** (pública)
   - **Chave secreta** (privada)

### Passo 2: Configurar Variáveis de Ambiente

Adicione ao seu arquivo `.env`:

```env
# reCAPTCHA v2 - Checkbox "Não sou um robô"
NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY=sua_chave_do_site_aqui
RECAPTCHA_V2_SECRET_KEY=sua_chave_secreta_aqui
```

### Passo 3: Verificar

Após configurar, o checkbox "Não sou um robô" aparecerá automaticamente nas páginas de login e registro.

---

## 🔍 Google reCAPTCHA v3 (Opcional - Invisível)

O reCAPTCHA v3 funciona de forma **invisível**, analisando o comportamento do usuário sem precisar resolver desafios. Pode ser usado em conjunto com o v2.

### Configurar Variáveis de Ambiente

```env
# reCAPTCHA v3 (opcional, invisível)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=sua_chave_do_site_aqui
RECAPTCHA_SECRET_KEY=sua_chave_secreta_aqui
```

---

## 🔒 Proteções Implementadas

### 1. reCAPTCHA v2 - Checkbox "Não sou um robô" (RECOMENDADO!)
- Caixinha famosa do Google "Não sou um robô"
- Às vezes pede para selecionar imagens
- Altamente eficaz contra bots
- Suporta tema claro e escuro
- **Requer configuração** (ver seção acima)

### 2. Rate Limiting
- **Registro**: Máximo 3 tentativas por IP por hora
- **Login**: Máximo 10 tentativas por IP por hora
- **Por usuário**: Máximo 5 tentativas de login por conta
- **Bloqueio**: 30 minutos após exceder limite

### 3. Honeypot
Campo invisível que apenas bots preenchem. Se preenchido, a requisição é bloqueada.

### 4. Tempo de Preenchimento
Detecta formulários preenchidos muito rapidamente (< 3 segundos), comportamento típico de bots.

### 5. Detecção de User-Agent
Bloqueia User-Agents conhecidos de:
- Ferramentas de hacking (sqlmap, nikto, etc)
- Bibliotecas HTTP automatizadas (curl, wget, python-requests)
- Navegadores headless (Selenium, PhantomJS)

### 6. Device Fingerprint
Cada dispositivo só pode criar uma conta, prevenindo criação em massa.

### 7. Validação de Username
Detecta padrões suspeitos de nomes gerados automaticamente:
- `user123`, `test1`, `ab12345`
- Nomes reservados (admin, root, system)
- Repetições excessivas (aaaaa)

### 8. Headers de Segurança
- **X-Frame-Options**: Previne clickjacking
- **X-Content-Type-Options**: Previne MIME sniffing
- **X-XSS-Protection**: Proteção XSS
- **Content-Security-Policy**: Controle de recursos
- **HSTS**: Força HTTPS

### 9. reCAPTCHA v3 (Opcional)
Análise comportamental invisível com score de 0 a 1:
- Score ≥ 0.5: Provavelmente humano
- Score < 0.5: Provavelmente bot
- **Requer configuração** (ver seção acima)

---

## ⚙️ Configurações Avançadas

### Ajustar Limites de Rate Limiting

Edite `lib/security.ts`:

```typescript
export const SECURITY_CONFIG = {
  MAX_REGISTER_ATTEMPTS_PER_IP: 3,      // Tentativas de registro/IP/hora
  MAX_LOGIN_ATTEMPTS_PER_IP: 10,         // Tentativas de login/IP/hora
  MAX_LOGIN_ATTEMPTS_PER_USER: 5,        // Tentativas de login/usuário
  BLOCK_DURATION_MINUTES: 30,            // Tempo de bloqueio
  RECAPTCHA_MIN_SCORE: 0.5,              // Score mínimo do reCAPTCHA
  // ...
}
```

### Adicionar User-Agents Bloqueados

```typescript
BLOCKED_USER_AGENTS: [
  'curl', 'wget', 'python', 'go-http',
  // Adicione mais aqui
]
```

### Padrões de Username Suspeitos

```typescript
SUSPICIOUS_USERNAME_PATTERNS: [
  /^user\d+$/i,
  /^test\d*$/i,
  // Adicione mais regex aqui
]
```

---

## 📊 Logs de Segurança

Todos os eventos de segurança são registrados na tabela `SecurityLog`:

```prisma
model SecurityLog {
  id          String   @id
  type        String   // register_attempt, login_attempt, bot_detected, etc
  ip          String
  userAgent   String?
  username    String?
  success     Boolean
  reason      String?
  metadata    String?  // JSON com dados adicionais
  createdAt   DateTime
}
```

### Tipos de Eventos

| Tipo | Descrição |
|------|-----------|
| `register_attempt` | Tentativa de registro |
| `login_attempt` | Tentativa de login |
| `bot_detected` | Bot detectado |
| `rate_limit` | Rate limit atingido |
| `blocked` | IP/usuário bloqueado |

---

## 🚨 Respondendo a Ataques

### Ver IPs Bloqueados

A função `getBlockedIps()` em `lib/security.ts` retorna todos os IPs atualmente bloqueados.

### Desbloquear IP Manualmente

```typescript
import { clearBlockedIp } from '@/lib/security'

clearBlockedIp('192.168.1.1')
```

### Analisar Logs

Consulte a tabela `SecurityLog` para identificar padrões de ataque:

```sql
// IPs com mais tentativas falhas
db.SecurityLog.aggregate([
  { $match: { success: false } },
  { $group: { _id: "$ip", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 }
])
```

---

## ✅ Checklist de Segurança

- [ ] Configurar HTTPS em produção
- [ ] Configurar reCAPTCHA v3
- [ ] Verificar variáveis de ambiente
- [ ] Testar rate limiting
- [ ] Monitorar logs de segurança
- [ ] Configurar backups do banco de dados
- [ ] Manter dependências atualizadas

---

## 🆘 Suporte

Em caso de problemas ou dúvidas sobre segurança, verifique:

1. Console do navegador para erros
2. Logs do servidor (`npm run dev`)
3. Tabela `SecurityLog` no banco de dados
4. Configuração das variáveis de ambiente

