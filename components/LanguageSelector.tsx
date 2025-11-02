import { useRouter } from 'next/router'

export default function LanguageSelector() {
  const router = useRouter()

  const changeLanguage = (locale: string) => {
    router.push(router.asPath, router.asPath, { locale })
  }

  return (
    <select
      value={router.locale}
      onChange={(e) => changeLanguage(e.target.value)}
      className="px-3 py-1 border border-gray-300 rounded-md text-sm"
    >
      <option value="pt-BR">PT-BR</option>
      <option value="en">EN</option>
    </select>
  )
}
