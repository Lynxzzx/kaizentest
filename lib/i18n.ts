import { useRouter } from 'next/router'
import { useTranslation as useNextTranslation } from 'next-i18next'

export function useTranslation() {
  const router = useRouter()
  const { t, i18n } = useNextTranslation('common')
  
  const changeLanguage = (locale: string) => {
    router.push(router.asPath, router.asPath, { locale })
  }

  return {
    t,
    locale: router.locale || 'pt-BR',
    changeLanguage
  }
}

export const locales = {
  'pt-BR': 'Português',
  'en': 'English'
}
