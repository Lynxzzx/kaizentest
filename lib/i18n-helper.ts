import { useRouter } from 'next/router'
import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'

// Helper functions for i18n translations
// For now, we'll use simple translations until next-i18next is properly configured

// Cache de traduções no cliente
const clientTranslationCache = new Map<string, string>()

// Função para traduzir texto usando API
async function translateText(text: string, from: string = 'pt', to: string = 'en'): Promise<string> {
  // Verificar cache primeiro
  const cacheKey = `${from}-${to}-${text}`
  if (clientTranslationCache.has(cacheKey)) {
    return clientTranslationCache.get(cacheKey)!
  }

  // Se o texto já está em inglês ou é muito curto, retornar como está
  if (to === 'en' && text.length < 3) {
    return text
  }

  try {
    const response = await axios.post('/api/translate', {
      text,
      from,
      to
    })

    const translatedText = response.data.translatedText || text
    
    // Salvar no cache
    clientTranslationCache.set(cacheKey, translatedText)
    
    // Limitar cache a 500 entradas
    if (clientTranslationCache.size > 500) {
      const firstKey = clientTranslationCache.keys().next().value
      if (firstKey) {
        clientTranslationCache.delete(firstKey)
      }
    }

    return translatedText
  } catch (error) {
    console.error('Error translating text:', error)
    return text // Retornar texto original em caso de erro
  }
}

export const translations: Record<string, Record<string, string>> = {
  'pt-BR': {
    'siteName': 'Kaizen Gens',
    'login': 'Entrar',
    'logout': 'Sair',
    'register': 'Registrar',
    'createAccount': 'Criar Conta',
    'username': 'Usuário',
    'password': 'Senha',
    'email': 'Email',
    'admin': 'Admin',
    'dashboard': 'Painel',
    'services': 'Serviços',
    'stocks': 'Estoques',
    'plans': 'Planos',
    'keys': 'Chaves',
    'users': 'Usuários',
    'generate': 'Gerar',
    'account': 'Conta',
    'accounts': 'Contas',
    'create': 'Criar',
    'edit': 'Editar',
    'delete': 'Excluir',
    'save': 'Salvar',
    'cancel': 'Cancelar',
    'name': 'Nome',
    'description': 'Descrição',
    'price': 'Preço',
    'duration': 'Duração (dias)',
    'active': 'Ativo',
    'inactive': 'Inativo',
    'status': 'Status',
    'payment': 'Pagamento',
    'pay': 'Pagar',
    'pix': 'PIX',
    'bitcoin': 'Bitcoin',
    'pending': 'Pendente',
    'paid': 'Pago',
    'expired': 'Expirado',
    'myPlan': 'Meu Plano',
    'expiresAt': 'Expira em',
    'generationsLeft': 'Gerações restantes',
    'unlimited': 'Ilimitado',
    'selectService': 'Selecione um serviço',
    'generateAccount': 'Gerar Conta',
    'available': 'Disponível',
    'unavailable': 'Indisponível',
    'add': 'Adicionar',
    'search': 'Buscar',
    'noResults': 'Nenhum resultado encontrado',
    'confirm': 'Confirmar',
    'areYouSure': 'Tem certeza?',
    'createdAt': 'Criado em',
    'updatedAt': 'Atualizado em',
    'plansDescription': 'Escolha o plano ideal para você e tenha acesso a todos os nossos serviços',
    'mostPopular': 'MAIS POPULAR',
    'daysAccess': 'dias de acesso',
    'generations': 'gerações',
    'accessAllServices': 'Acesso a todos os serviços',
    'payViaPix': 'Pagar via PIX',
    'payViaCrypto': 'Pagar via Criptomoedas',
    'noPlansAvailable': 'Nenhum plano disponível no momento.',
    'informEmail': 'Informe seu email',
    'emailRequired': 'O PagSeguro exige um email válido para processar o pagamento PIX. Este email será usado apenas para a transação.',
    'emailLabel': 'Email *',
    'emailPlaceholder': 'seu@email.com',
    'continue': 'Continuar',
    'close': 'Fechar',
    'paymentVia': 'Pagamento via',
    'creatingPixPayment': 'Criando pagamento PIX...',
    'checkingPayment': 'Verificando pagamento automaticamente... (a cada 5 segundos)',
    'pixCodeCopyPaste': 'Código PIX (Copiar e Colar)',
    'instructions': 'Instruções:',
    'instructionsText': 'Escaneie o QR Code ou copie o código PIX.',
    'autoActivation': '✨ Ativação Automática:',
    'autoActivationText': 'O sistema verifica o pagamento a cada 5 segundos. Assim que o pagamento for confirmado, seu plano será ativado automaticamente!',
    'waitProcessing': 'Aguarde:',
    'waitProcessingText': 'Estamos processando os dados do pagamento PIX. Por favor, recarregue a página em alguns instantes ou verifique o código do pagamento na sua conta.',
    'amountToPay': 'Valor a pagar:',
    'bitcoinAddress': 'Endereço Bitcoin',
    'copy': 'Copiar',
    'network': 'Rede:',
    'sendExactly': 'Envie exatamente',
    'toAddressAbove': 'para o endereço acima.',
    'paymentProcessed': 'O pagamento será processado automaticamente após confirmação na rede.',
    'important': '⚠️ Importante:',
    'importantText': 'Verifique o endereço antes de enviar. Transações de criptomoedas são irreversíveis.',
    'attention': 'Atenção:',
    'autoPaymentUnavailable': 'Sistema de pagamento automático temporariamente indisponível.',
    'contactTelegram': 'Entre em contato via Telegram para completar o pagamento:',
    'openTelegram': 'Abrir Telegram',
    'joinTelegram': 'Entrar no Telegram',
    'joinDiscord': 'Entrar no Discord',
    'freeKeys': 'Lá soltamos Keys de acesso ao gerador totalmente free e muito mais',
    'or': 'ou',
    'loadingQrCode': 'Carregando QR code...',
    'pixPaymentCreated': 'Pagamento PIX criado com sucesso!',
    'paymentConfirmed': '🎉 Pagamento confirmado! Seu plano foi ativado automaticamente!',
    'loginToContinue': 'Faça login para continuar',
    'errorLoadingPlans': 'Erro ao carregar planos',
    'errorCreatingPix': 'Erro ao criar pagamento PIX',
    'errorCreatingPayment': 'Erro ao criar pagamento. Tente novamente.',
    'errorInvalidEmail': 'Por favor, insira um email válido',
    'errorIncompletePaymentData': 'Erro: Dados de pagamento incompletos. Tente novamente.',
    'addressCopied': 'Endereço copiado!',
    'errorCreatingPaymentCrypto': 'Erro ao criar pagamento via criptomoedas',
    'cryptoPaymentCreated': 'Pagamento via criptomoedas criado com sucesso!',
    'currencySymbol': 'R$',
    'paymentMethodPix': 'PIX',
    'paymentMethodCrypto': 'Criptomoedas',
    'qrCodePixAlt': 'QR Code PIX',
    // Landing Page
    'heroSubtitle': 'Gere contas premium para os melhores serviços',
    'heroDescription': 'Acesso rápido, seguro e confiável às plataformas mais populares',
    'startNow': 'Começar Agora',
    'viewPlans': 'Ver Planos',
    'whyChooseUs': 'Por que escolher a gente?',
    'whyChooseUsDesc': 'Tecnologia avançada, segurança máxima e experiência premium',
    'fastInstant': 'Rápido e Instantâneo',
    'fastInstantDesc': 'Gere contas em segundos com nossa tecnologia de ponta. Sem espera, sem complicação.',
    'secure100': '100% Seguro',
    'secure100Desc': 'Criptografia de nível bancário e proteção avançada para garantir total segurança dos seus dados.',
    'multipleServices': 'Múltiplos Serviços',
    'multipleServicesDesc': 'Acesso a diversas plataformas populares com um único plano. Streaming, gaming e muito mais.',
    'premiumQuality': 'Premium Quality',
    'premiumQualityDesc': 'Contas de alta qualidade testadas e verificadas para garantir a melhor experiência.',
    'support247': 'Suporte 24/7',
    'support247Desc': 'Equipe especializada disponível sempre que precisar. Resolvemos qualquer questão rapidamente.',
    'freePlan': 'Plano Gratuito',
    'freePlanDesc': 'Comece com 2 gerações grátis por dia. Sem compromisso, sem cartão de crédito.',
    'whatClientsSay': 'O que nossos clientes dizem',
    'whatClientsSayDesc': 'Veja o que nossos usuários estão falando sobre nossa plataforma',
    'viewAllFeedbacks': 'Ver todos os feedbacks',
    'readyToStart': 'Pronto para começar?',
    'readyToStartDesc': 'Escolha um plano e tenha acesso imediato a todos os nossos serviços premium',
    'createFreeAccount': 'Criar Conta Grátis',
    // Layout Menu
    'affiliates': 'Afiliados',
    'raffles': 'Sorteios',
    'support': 'Suporte',
    'feedbacks': 'Feedbacks',
    'redeemKey': 'Resgatar Chave',
    'settings': 'Configurações',
    'chat': 'Chat',
    'tickets': 'Tickets',
    'administrator': 'Administrador',
    'user': 'Usuário',
    'allRightsReserved': 'Todos os direitos reservados',
    // Dashboard
    'welcome': 'Bem-vindo',
    'viewProfile': 'Ver Perfil',
    'expiresIn': 'Expira em',
    'duration': 'Duração',
    'days': 'dias',
    'generations': 'Gerações',
    'unlimited': 'Ilimitadas',
    'freePlan': 'Plano Free',
    'youAreUsingFreePlan': 'Você está usando o plano gratuito',
    'dailyGenerations': 'Gerações diárias',
    'free': 'grátis',
    'upgradeToPremium': 'Upgrade para Premium',
    'selectService': 'Selecione um serviço',
    'generating': 'Gerando...',
    'youDontHaveActivePlan': 'Você não possui um plano ativo',
    'youHave2FreeGenerations': '💡 Você tem 2 gerações grátis por dia!',
    'accountGeneratedSuccess': 'Conta Gerada com Sucesso! ✅',
    'accountFormat': 'Conta (formato: account:pass):',
    'copyFullAccount': 'Copiar conta completa',
    'emailUser': 'Email/Usuário:',
    'usernameLabel': 'Usuário:',
    'emailUserCopied': 'Email/Usuário copiado!',
    'password': 'Senha:',
    'passwordCopied': 'Senha copiada!',
    'copy': '📋 Copiar',
    'importantInfo': 'ℹ️ Informação Importante:',
    'accountNotWorkingInfo': 'Se a conta não funcionar, não há problema! Você pode gerar novamente. Às vezes o estoque pode estar vencendo ou alguém pode ter trocado a senha.',
    'saveCredentials': '⚠️ Importante: Salve estas credenciais em um local seguro. Elas não serão exibidas novamente.',
    'yourAffiliateLink': 'Seu Link de Afiliado',
    'linkToShare': 'Link para compartilhar:',
    'copyLink': '📋 Copiar Link',
    'affiliateTip': '💡 Dica: Compartilhe este link com seus amigos! Quando eles se cadastrarem através do seu link, você ganha 2 gerações grátis e eles também ganham 2 gerações grátis!',
    'viewFullAffiliateStats': 'Ver estatísticas completas de afiliados →',
    'availableServices': 'Serviços Disponíveis',
    'available': 'disponíveis',
    'noServicesAvailable': 'Nenhum serviço disponível no momento.',
    'errorLoadingServices': 'Erro ao carregar serviços',
    'errorGeneratingAccount': 'Erro ao gerar conta',
    'affiliateLinkCopied': 'Link de afiliado copiado!',
    // Admin Dashboard
    'adminPanel': 'Painel Administrativo',
    'update': 'Atualizar',
    'totalUsers': 'Total de Usuários',
    'totalRevenue': 'Receita Total',
    'confirmedPayments': 'Pagamentos Confirmados',
    'availableStocks': 'Estoques Disponíveis',
    'activeServices': 'Serviços Ativos',
    'plans': 'Planos',
    'generatedAccounts': 'Contas Geradas',
    'availableKeys': 'Chaves Disponíveis',
    'quickActions': 'Ações Rápidas',
    'services': 'Serviços',
    'stocks': 'Estoques',
    'keys': 'Chaves',
    'users': 'Usuários',
    'broadcast': 'Broadcast',
    'raffles': 'Sorteios',
    'feedbacks': 'Feedbacks',
    'settings': 'Configurações',
    'maintenance': 'Manutenção',
    'recentUsers': 'Usuários Recentes',
    'recentPayments': 'Pagamentos Recentes',
    'noEmail': 'Sem email',
    'noPlan': 'Sem plano',
    'noRecentUsers': 'Nenhum usuário recente',
    'noRecentPayments': 'Nenhum pagamento recente',
    'paid': 'Pago',
    'pending': 'Pendente',
    'cancelled': 'Cancelado',
    'errorLoadingStats': 'Erro ao carregar estatísticas',
    'loading': 'Carregando...',
    // Feedback Page
    'shareYourExperience': 'Compartilhe sua experiência conosco! Seu feedback ajuda a melhorar nossos serviços.',
    'sendFeedback': 'Enviar Feedback',
    'nameOrUsername': 'Nome (ou use seu username)',
    'yourName': 'Seu nome',
    'ratingOptional': 'Avaliação (opcional)',
    'message': 'Mensagem *',
    'shareExperiencePlaceholder': 'Compartilhe sua experiência, sugestões ou elogios...',
    'charactersCount': 'caracteres (mínimo 10)',
    'sending': 'Enviando...',
    'sendFeedbackButton': 'Enviar Feedback',
    'feedbackWillBeReviewed': '⚠️ Seu feedback será revisado antes de ser publicado',
    'approvedFeedbacks': 'Feedbacks Aprovados',
    'noFeedbackYet': 'Nenhum feedback ainda',
    'beFirstToShare': 'Seja o primeiro a compartilhar sua experiência!',
    'errorLoadingFeedbacks': 'Erro ao carregar feedbacks',
    'pleaseFillAllFields': 'Por favor, preencha todos os campos obrigatórios',
    'messageMinLength': 'A mensagem deve ter pelo menos 10 caracteres',
    'feedbackSentSuccess': 'Feedback enviado com sucesso! Aguarde aprovação do administrador.',
    'errorSendingFeedback': 'Erro ao enviar feedback',
    // Login
    'enterYourAccount': 'Entre na sua conta para continuar',
    'enterUsername': 'Digite seu usuário',
    'enterPassword': 'Digite sua senha',
    'loggingIn': 'Entrando...',
    'invalidCredentials': 'Credenciais inválidas',
    'loginSuccess': 'Login realizado com sucesso!',
    'errorLoggingIn': 'Erro ao fazer login',
    'dontHaveAccount': 'Não tem uma conta?',
    'backToHome': '← Voltar para a página inicial',
    // Register
    'joinUs': 'Junte-se a nós e comece agora',
    'youWillGet2FreeGenerations': '🎁 Você ganhará 2 gerações grátis ao se cadastrar através deste link!',
    'emailOptional': '(Opcional)',
    'enterEmail': 'Digite seu email',
    'confirmPassword': 'Confirmar Senha',
    'enterConfirmPassword': 'Digite novamente sua senha',
    'passwordsDontMatch': 'As senhas não coincidem',
    'passwordMinLength': 'A senha deve ter pelo menos 6 caracteres',
    'accountCreatedSuccess': 'Conta criada com sucesso!',
    'accountCreatedButLoginError': 'Conta criada, mas erro ao fazer login automático. Faça login manualmente.',
    'errorCreatingAccount': 'Erro ao criar conta',
    'checkMongoDB': 'Verifique se o MongoDB está acessível e a DATABASE_URL está correta no .env',
    'configureMongoDB': 'Configure o MongoDB no arquivo .env e execute: npm run db:push',
    // Tickets
    'errorLoadingTickets': 'Erro ao carregar tickets',
    'ticketCreatedSuccess': 'Ticket criado com sucesso!',
    'errorCreatingTicket': 'Erro ao criar ticket',
    'enterMessage': 'Digite uma mensagem',
    'replySent': 'Resposta enviada!',
    'errorSendingReply': 'Erro ao enviar resposta',
    'errorLoadingTicketDetails': 'Erro ao carregar detalhes do ticket',
    'open': 'Aberto',
    'inProgress': 'Em Progresso',
    'resolved': 'Resolvido',
    'closed': 'Fechado',
    'low': 'Baixa',
    'medium': 'Média',
    'high': 'Alta',
    'urgent': 'Urgente',
    'subject': 'Assunto',
    'priority': 'Prioridade',
    'status': 'Status',
    'createTicket': 'Criar Ticket',
    'newTicket': 'Novo Ticket',
    'myTickets': 'Meus Tickets',
    'noTickets': 'Nenhum ticket encontrado',
    'createFirstTicket': 'Crie seu primeiro ticket de suporte',
    'reply': 'Responder',
    'sendReply': 'Enviar Resposta',
    'replies': 'Respostas',
    'noReplies': 'Nenhuma resposta ainda',
    'creating': 'Criando conta...',
    'alreadyHaveAccount': 'Já tem uma conta?'
  },
  'en': {
    'siteName': 'Kaizen Gens',
    'login': 'Login',
    'logout': 'Logout',
    'register': 'Register',
    'createAccount': 'Create Account',
    'username': 'Username',
    'password': 'Password',
    'email': 'Email',
    'admin': 'Admin',
    'dashboard': 'Dashboard',
    'services': 'Services',
    'stocks': 'Stocks',
    'plans': 'Plans',
    'keys': 'Keys',
    'users': 'Users',
    'generate': 'Generate',
    'account': 'Account',
    'accounts': 'Accounts',
    'create': 'Create',
    'edit': 'Edit',
    'delete': 'Delete',
    'save': 'Save',
    'cancel': 'Cancel',
    'name': 'Name',
    'description': 'Description',
    'price': 'Price',
    'duration': 'Duration (days)',
    'active': 'Active',
    'inactive': 'Inactive',
    'status': 'Status',
    'payment': 'Payment',
    'pay': 'Pay',
    'pix': 'PIX',
    'bitcoin': 'Bitcoin',
    'pending': 'Pending',
    'paid': 'Paid',
    'expired': 'Expired',
    'myPlan': 'My Plan',
    'expiresAt': 'Expires at',
    'generationsLeft': 'Generations left',
    'unlimited': 'Unlimited',
    'selectService': 'Select a service',
    'generateAccount': 'Generate Account',
    'available': 'Available',
    'unavailable': 'Unavailable',
    'add': 'Add',
    'search': 'Search',
    'noResults': 'No results found',
    'confirm': 'Confirm',
    'areYouSure': 'Are you sure?',
    'createdAt': 'Created at',
    'updatedAt': 'Updated at',
    'plansDescription': 'Choose the perfect plan for you and get access to all our services',
    'mostPopular': 'MOST POPULAR',
    'daysAccess': 'days of access',
    'generations': 'generations',
    'accessAllServices': 'Access to all services',
    'payViaPix': 'Pay via PIX',
    'payViaCrypto': 'Pay via Cryptocurrencies',
    'noPlansAvailable': 'No plans available at the moment.',
    'informEmail': 'Enter your email',
    'emailRequired': 'PagSeguro requires a valid email to process PIX payments. This email will only be used for the transaction.',
    'emailLabel': 'Email *',
    'emailPlaceholder': 'your@email.com',
    'continue': 'Continue',
    'close': 'Close',
    'paymentVia': 'Payment via',
    'creatingPixPayment': 'Creating PIX payment...',
    'checkingPayment': 'Checking payment automatically... (every 5 seconds)',
    'pixCodeCopyPaste': 'PIX Code (Copy and Paste)',
    'instructions': 'Instructions:',
    'instructionsText': 'Scan the QR Code or copy the PIX code.',
    'autoActivation': '✨ Automatic Activation:',
    'autoActivationText': 'The system checks payment every 5 seconds. As soon as payment is confirmed, your plan will be activated automatically!',
    'waitProcessing': 'Please wait:',
    'waitProcessingText': 'We are processing PIX payment data. Please reload the page in a few moments or check the payment code in your account.',
    'amountToPay': 'Amount to pay:',
    'bitcoinAddress': 'Bitcoin Address',
    'copy': 'Copy',
    'network': 'Network:',
    'sendExactly': 'Send exactly',
    'toAddressAbove': 'to the address above.',
    'paymentProcessed': 'Payment will be processed automatically after network confirmation.',
    'important': '⚠️ Important:',
    'importantText': 'Verify the address before sending. Cryptocurrency transactions are irreversible.',
    'attention': 'Attention:',
    'autoPaymentUnavailable': 'Automatic payment system temporarily unavailable.',
    'contactTelegram': 'Contact us via Telegram to complete payment:',
    'openTelegram': 'Open Telegram',
    'joinTelegram': 'Join Telegram',
    'joinDiscord': 'Join Discord',
    'freeKeys': 'We release free access keys to the generator and much more',
    'or': 'or',
    'loadingQrCode': 'Loading QR code...',
    'pixPaymentCreated': 'PIX payment created successfully!',
    'paymentConfirmed': '🎉 Payment confirmed! Your plan has been activated automatically!',
    'loginToContinue': 'Please login to continue',
    'errorLoadingPlans': 'Error loading plans',
    'errorCreatingPix': 'Error creating PIX payment',
    'errorCreatingPayment': 'Error creating payment. Please try again.',
    'errorInvalidEmail': 'Please enter a valid email',
    'errorIncompletePaymentData': 'Error: Incomplete payment data. Please try again.',
    'addressCopied': 'Address copied!',
    'errorCreatingPaymentCrypto': 'Error creating cryptocurrency payment',
    'cryptoPaymentCreated': 'Cryptocurrency payment created successfully!',
    'currencySymbol': '$',
    'paymentMethodPix': 'PIX',
    'paymentMethodCrypto': 'Cryptocurrencies',
    'qrCodePixAlt': 'PIX QR Code',
    // Landing Page
    'heroSubtitle': 'Generate premium accounts for the best services',
    'heroDescription': 'Fast, secure and reliable access to the most popular platforms',
    'startNow': 'Start Now',
    'viewPlans': 'View Plans',
    'whyChooseUs': 'Why choose us?',
    'whyChooseUsDesc': 'Advanced technology, maximum security and premium experience',
    'fastInstant': 'Fast and Instant',
    'fastInstantDesc': 'Generate accounts in seconds with our cutting-edge technology. No waiting, no complications.',
    'secure100': '100% Secure',
    'secure100Desc': 'Bank-level encryption and advanced protection to ensure total security of your data.',
    'multipleServices': 'Multiple Services',
    'multipleServicesDesc': 'Access to various popular platforms with a single plan. Streaming, gaming and much more.',
    'premiumQuality': 'Premium Quality',
    'premiumQualityDesc': 'High-quality accounts tested and verified to ensure the best experience.',
    'support247': '24/7 Support',
    'support247Desc': 'Specialized team available whenever you need. We solve any issue quickly.',
    'freePlan': 'Free Plan',
    'freePlanDesc': 'Start with 2 free generations per day. No commitment, no credit card.',
    'whatClientsSay': 'What our clients say',
    'whatClientsSayDesc': 'See what our users are saying about our platform',
    'viewAllFeedbacks': 'View all feedbacks',
    'readyToStart': 'Ready to start?',
    'readyToStartDesc': 'Choose a plan and get immediate access to all our premium services',
    'createFreeAccount': 'Create Free Account',
    // Layout Menu
    'affiliates': 'Affiliates',
    'raffles': 'Raffles',
    'support': 'Support',
    'feedbacks': 'Feedbacks',
    'redeemKey': 'Redeem Key',
    'settings': 'Settings',
    'chat': 'Chat',
    'tickets': 'Tickets',
    'administrator': 'Administrator',
    'user': 'User',
    'allRightsReserved': 'All rights reserved',
    // Dashboard
    'welcome': 'Welcome',
    'viewProfile': 'View Profile',
    'expiresIn': 'Expires in',
    'duration': 'Duration',
    'days': 'days',
    'generations': 'Generations',
    'unlimited': 'Unlimited',
    'freePlan': 'Free Plan',
    'youAreUsingFreePlan': 'You are using the free plan',
    'dailyGenerations': 'Daily generations',
    'free': 'free',
    'upgradeToPremium': 'Upgrade to Premium',
    'selectService': 'Select a service',
    'generating': 'Generating...',
    'youDontHaveActivePlan': 'You do not have an active plan',
    'youHave2FreeGenerations': '💡 You have 2 free generations per day!',
    'accountGeneratedSuccess': 'Account Generated Successfully! ✅',
    'accountFormat': 'Account (format: account:pass):',
    'copyFullAccount': 'Copy full account',
    'emailUser': 'Email/Username:',
    'usernameLabel': 'Username:',
    'emailUserCopied': 'Email/Username copied!',
    'password': 'Password:',
    'passwordCopied': 'Password copied!',
    'copy': '📋 Copy',
    'importantInfo': 'ℹ️ Important Information:',
    'accountNotWorkingInfo': 'If the account does not work, no problem! You can generate again. Sometimes the stock may be expiring or someone may have changed the password.',
    'saveCredentials': '⚠️ Important: Save these credentials in a safe place. They will not be displayed again.',
    'yourAffiliateLink': 'Your Affiliate Link',
    'linkToShare': 'Link to share:',
    'copyLink': '📋 Copy Link',
    'affiliateTip': '💡 Tip: Share this link with your friends! When they register through your link, you get 2 free generations and they also get 2 free generations!',
    'viewFullAffiliateStats': 'View full affiliate statistics →',
    'availableServices': 'Available Services',
    'available': 'available',
    'noServicesAvailable': 'No services available at the moment.',
    'errorLoadingServices': 'Error loading services',
    'errorGeneratingAccount': 'Error generating account',
    'affiliateLinkCopied': 'Affiliate link copied!',
    // Admin Dashboard
    'adminPanel': 'Administrative Panel',
    'update': 'Update',
    'totalUsers': 'Total Users',
    'totalRevenue': 'Total Revenue',
    'confirmedPayments': 'Confirmed Payments',
    'availableStocks': 'Available Stocks',
    'activeServices': 'Active Services',
    'plans': 'Plans',
    'generatedAccounts': 'Generated Accounts',
    'availableKeys': 'Available Keys',
    'quickActions': 'Quick Actions',
    'services': 'Services',
    'stocks': 'Stocks',
    'keys': 'Keys',
    'users': 'Users',
    'broadcast': 'Broadcast',
    'raffles': 'Raffles',
    'feedbacks': 'Feedbacks',
    'settings': 'Settings',
    'maintenance': 'Maintenance',
    'recentUsers': 'Recent Users',
    'recentPayments': 'Recent Payments',
    'noEmail': 'No email',
    'noPlan': 'No plan',
    'noRecentUsers': 'No recent users',
    'noRecentPayments': 'No recent payments',
    'paid': 'Paid',
    'pending': 'Pending',
    'cancelled': 'Cancelled',
    'errorLoadingStats': 'Error loading statistics',
    'loading': 'Loading...',
    // Feedback Page
    'shareYourExperience': 'Share your experience with us! Your feedback helps improve our services.',
    'sendFeedback': 'Send Feedback',
    'nameOrUsername': 'Name (or use your username)',
    'yourName': 'Your name',
    'ratingOptional': 'Rating (optional)',
    'message': 'Message *',
    'shareExperiencePlaceholder': 'Share your experience, suggestions or compliments...',
    'charactersCount': 'characters (minimum 10)',
    'sending': 'Sending...',
    'sendFeedbackButton': 'Send Feedback',
    'feedbackWillBeReviewed': '⚠️ Your feedback will be reviewed before being published',
    'approvedFeedbacks': 'Approved Feedbacks',
    'noFeedbackYet': 'No feedback yet',
    'beFirstToShare': 'Be the first to share your experience!',
    'errorLoadingFeedbacks': 'Error loading feedbacks',
    'pleaseFillAllFields': 'Please fill in all required fields',
    'messageMinLength': 'The message must be at least 10 characters',
    'feedbackSentSuccess': 'Feedback sent successfully! Wait for administrator approval.',
    'errorSendingFeedback': 'Error sending feedback',
    // Login
    'enterYourAccount': 'Enter your account to continue',
    'enterUsername': 'Enter your username',
    'enterPassword': 'Enter your password',
    'loggingIn': 'Logging in...',
    'invalidCredentials': 'Invalid credentials',
    'loginSuccess': 'Login successful!',
    'errorLoggingIn': 'Error logging in',
    'dontHaveAccount': "Don't have an account?",
    'backToHome': '← Back to home page',
    // Register
    'joinUs': 'Join us and start now',
    'youWillGet2FreeGenerations': '🎁 You will get 2 free generations when you register through this link!',
    'emailOptional': '(Optional)',
    'enterEmail': 'Enter your email',
    'confirmPassword': 'Confirm Password',
    'enterConfirmPassword': 'Enter your password again',
    'passwordsDontMatch': 'Passwords do not match',
    'passwordMinLength': 'Password must be at least 6 characters',
    'accountCreatedSuccess': 'Account created successfully!',
    'accountCreatedButLoginError': 'Account created, but error during automatic login. Please login manually.',
    'errorCreatingAccount': 'Error creating account',
    'checkMongoDB': 'Check if MongoDB is accessible and DATABASE_URL is correct in .env',
    'configureMongoDB': 'Configure MongoDB in .env file and run: npm run db:push',
    // Tickets
    'errorLoadingTickets': 'Error loading tickets',
    'ticketCreatedSuccess': 'Ticket created successfully!',
    'errorCreatingTicket': 'Error creating ticket',
    'enterMessage': 'Enter a message',
    'replySent': 'Reply sent!',
    'errorSendingReply': 'Error sending reply',
    'errorLoadingTicketDetails': 'Error loading ticket details',
    'open': 'Open',
    'inProgress': 'In Progress',
    'resolved': 'Resolved',
    'closed': 'Closed',
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'urgent': 'Urgent',
    'subject': 'Subject',
    'priority': 'Priority',
    'status': 'Status',
    'createTicket': 'Create Ticket',
    'newTicket': 'New Ticket',
    'myTickets': 'My Tickets',
    'noTickets': 'No tickets found',
    'createFirstTicket': 'Create your first support ticket',
    'reply': 'Reply',
    'sendReply': 'Send Reply',
    'replies': 'Replies',
    'noReplies': 'No replies yet',
    'creating': 'Creating account...',
    'alreadyHaveAccount': 'Already have an account?'
  }
}

// Função para traduzir texto dinâmico (como mensagens de feedback)
export function useDynamicTranslation() {
  const router = useRouter()
  const locale = (router?.locale || 'pt-BR') as keyof typeof translations
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({})
  const translatingRef = useRef<Set<string>>(new Set())

  const translate = useCallback(async (text: string): Promise<string> => {
    if (!text || locale !== 'en') {
      return text
    }

    // Verificar cache
    if (translatedTexts[text]) {
      return translatedTexts[text]
    }

    // Se já está traduzindo, retornar original
    if (translatingRef.current.has(text)) {
      return text
    }

    // Iniciar tradução
    translatingRef.current.add(text)
    try {
      const translated = await translateText(text, 'pt', 'en')
      setTranslatedTexts(prev => ({ ...prev, [text]: translated }))
      translatingRef.current.delete(text)
      return translated
    } catch (error) {
      translatingRef.current.delete(text)
      return text
    }
  }, [locale, translatedTexts])

  return { translate }
}

export function useTranslation() {
  const router = useRouter()
  const locale = (router?.locale || 'pt-BR') as keyof typeof translations
  const [translatedKeys, setTranslatedKeys] = useState<Record<string, string>>({})
  const [translatingKeys, setTranslatingKeys] = useState<Set<string>>(new Set())
  const translatingRef = useRef<Set<string>>(new Set())

  // Limpar cache quando o idioma mudar
  useEffect(() => {
    if (locale !== 'en') {
      setTranslatedKeys({})
      translatingRef.current.clear()
      setTranslatingKeys(new Set())
    }
  }, [locale])

  const t = useCallback((key: string) => {
    // Se não for inglês, usar tradução estática
    if (locale !== 'en') {
    return translations[locale]?.[key] || key
  }

    // Se for inglês, verificar se já tem tradução dinâmica
    if (translatedKeys[key]) {
      return translatedKeys[key]
    }

    // Verificar se já tem tradução estática em inglês
    const enTranslation = translations['en']?.[key]
    if (enTranslation && enTranslation !== key) {
      return enTranslation
    }

    // Se não tem tradução e não está traduzindo, iniciar tradução
    if (!translatingRef.current.has(key)) {
      const ptText = translations['pt-BR']?.[key]
      if (ptText && ptText !== key) {
        translatingRef.current.add(key)
        setTranslatingKeys(prev => new Set(prev).add(key))
        
        // Traduzir de forma assíncrona
        translateText(ptText, 'pt', 'en')
          .then(translated => {
            setTranslatedKeys(prev => ({ ...prev, [key]: translated }))
            translatingRef.current.delete(key)
            setTranslatingKeys(prev => {
              const newSet = new Set(prev)
              newSet.delete(key)
              return newSet
            })
          })
          .catch(() => {
            // Em caso de erro, usar tradução estática ou texto original
            setTranslatedKeys(prev => ({ ...prev, [key]: enTranslation || ptText }))
            translatingRef.current.delete(key)
            setTranslatingKeys(prev => {
              const newSet = new Set(prev)
              newSet.delete(key)
              return newSet
            })
          })
      }
    }

    // Retornar tradução estática enquanto traduz ou texto original
    return enTranslation || translations['pt-BR']?.[key] || key
  }, [locale, translatedKeys])

  return {
    t,
    locale,
    translating: translatingKeys.size > 0,
    changeLanguage: (newLocale: string) => {
      router.push(router.asPath, router.asPath, { locale: newLocale })
    }
  }
}
