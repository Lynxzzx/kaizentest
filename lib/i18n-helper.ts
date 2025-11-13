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
      clientTranslationCache.delete(firstKey)
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
    'qrCodePixAlt': 'QR Code PIX'
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
    'qrCodePixAlt': 'PIX QR Code'
  }
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
