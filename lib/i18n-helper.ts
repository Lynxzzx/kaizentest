import { useRouter } from 'next/router'

// Helper functions for i18n translations
// For now, we'll use simple translations until next-i18next is properly configured

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
    'updatedAt': 'Atualizado em'
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
    'updatedAt': 'Updated at'
  }
}

export function useTranslation() {
  const router = useRouter()
  const locale = (router?.locale || 'pt-BR') as keyof typeof translations
  
  const t = (key: string) => {
    return translations[locale]?.[key] || key
  }

  return {
    t,
    locale,
    changeLanguage: (newLocale: string) => {
      router.push(router.asPath, router.asPath, { locale: newLocale })
    }
  }
}
