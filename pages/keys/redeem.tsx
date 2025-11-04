import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function RedeemKey() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const { theme } = useTheme()
  const router = useRouter()
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const themeClasses = getThemeClasses(theme)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await axios.post('/api/keys/redeem', { key })
      toast.success('Chave resgatada com sucesso!')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao resgatar chave')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`max-w-md mx-auto mt-12 px-4 ${themeClasses.bg} min-h-screen py-12`}>
      <div className={`${themeClasses.card} px-8 pt-6 pb-8 mb-4`}>
        <h2 className={`text-2xl font-bold mb-6 text-center ${themeClasses.text.primary}`}>Resgatar Chave</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className={`block text-sm font-bold mb-2 ${themeClasses.text.primary}`}>
              Chave
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              className={`${themeClasses.input} shadow appearance-none rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline font-mono`}
              placeholder="Digite a chave"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !session}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {loading ? 'Resgatando...' : 'Resgatar Chave'}
          </button>
          {!session && (
            <p className="mt-4 text-sm text-gray-600 text-center">
              <a href="/login" className="text-primary-600 hover:underline">
                Faça login para resgatar uma chave
              </a>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
