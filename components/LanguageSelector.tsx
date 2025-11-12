import { useRouter } from 'next/router'
import { useTheme } from '@/contexts/ThemeContext'

export default function LanguageSelector() {
  const router = useRouter()
  const { theme } = useTheme()
  const locale = router.locale || 'pt-BR'

  const changeLanguage = (newLocale: string) => {
    router.push(router.asPath, router.asPath, { locale: newLocale })
  }

  return (
    <div className={`flex items-center gap-1 rounded-lg overflow-hidden border ${
      theme === 'dark'
        ? 'border-white/20'
        : 'border-gray-300'
    }`}>
      <button
        onClick={() => changeLanguage('pt-BR')}
        className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium transition-all flex items-center gap-2 ${
          locale === 'pt-BR'
            ? theme === 'dark'
              ? 'bg-primary-600 text-white'
              : 'bg-primary-600 text-white'
            : theme === 'dark'
              ? 'bg-white/10 text-white hover:bg-white/20'
              : 'bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="text-base">🇧🇷</span>
        <span className="hidden sm:inline">PT-BR</span>
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium transition-all flex items-center gap-2 border-l ${
          locale === 'en'
            ? theme === 'dark'
              ? 'bg-primary-600 text-white border-white/20'
              : 'bg-primary-600 text-white border-gray-300'
            : theme === 'dark'
              ? 'bg-white/10 text-white hover:bg-white/20 border-white/20'
              : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
        }`}
      >
        <span className="text-base">🇺🇸</span>
        <span className="hidden sm:inline">EN</span>
      </button>
    </div>
  )
}
