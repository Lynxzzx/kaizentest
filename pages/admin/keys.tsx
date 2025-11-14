import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@/lib/i18n-helper'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import toast from 'react-hot-toast'

interface Key {
  id: string
  key: string
  planId: string
  isUsed: boolean
  plan: {
    name: string
  }
}

interface Plan {
  id: string
  name: string
}

export default function AdminKeys() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  const router = useRouter()
  const [keys, setKeys] = useState<Key[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    planId: '',
    count: '1'
  })
  const [expiresInEnabled, setExpiresInEnabled] = useState(false)
  const [expiresInValue, setExpiresInValue] = useState('1')
  const [expiresInUnit, setExpiresInUnit] = useState<'minutes' | 'hours' | 'days' | 'months' | 'years'>('days')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'OWNER') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      loadKeys()
      loadPlans()
    }
  }, [session])

  const loadKeys = async () => {
    try {
      const response = await axios.get('/api/keys')
      setKeys(response.data)
    } catch (error) {
      toast.error('Erro ao carregar chaves')
    }
  }

  const loadPlans = async () => {
    try {
      const response = await axios.get('/api/plans')
      setPlans(response.data)
    } catch (error) {
      toast.error('Erro ao carregar planos')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post('/api/keys', {
        ...formData,
        expiresIn: expiresInEnabled && Number(expiresInValue) > 0
          ? { value: Number(expiresInValue), unit: expiresInUnit }
          : undefined
      })
      toast.success('Chaves criadas com sucesso!')
      setShowForm(false)
      setFormData({ planId: '', count: '1' })
      setExpiresInEnabled(false)
      setExpiresInValue('1')
      setExpiresInUnit('days')
      loadKeys()
    } catch (error) {
      toast.error('Erro ao criar chaves')
    }
  }

  if (status === 'loading') {
    return (
      <div className={`admin-shell min-h-screen ${themeClasses.loading} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${themeClasses.text.secondary}`}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  return (
    <div className={`admin-shell min-h-screen ${themeClasses.bg} py-10 px-4 sm:px-6 lg:px-10`}>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.6em] text-white/40">{t('keys')}</p>
            <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>Gerar Keys</h1>
            <p className={`${themeClasses.text.secondary} text-sm`}>Crie chaves com expiração personalizada</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white px-5 py-2 rounded-2xl font-semibold hover:opacity-90 transition-all"
          >
            {showForm ? t('cancel') : `${t('create')} ${t('keys')}`}
          </button>
        </div>

        {showForm && (
          <div className={`${themeClasses.card} rounded-3xl p-6`}>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm font-semibold mb-2">{t('plans')}</label>
                <select
                  value={formData.planId}
                  onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                  required
                >
                  <option value="">{t('selectService')}</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={formData.count}
                  onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('expirationSettings')}</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={!expiresInEnabled}
                    onChange={(e) => setExpiresInEnabled(!e.target.checked)}
                  />
                  <span className="text-sm">{t('noExpiration')}</span>
                </div>
                {expiresInEnabled && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={expiresInValue}
                      onChange={(e) => setExpiresInValue(e.target.value)}
                      className={`${themeClasses.input} flex-1 px-4 py-3 rounded-xl`}
                    />
                    <select
                      value={expiresInUnit}
                      onChange={(e) => setExpiresInUnit(e.target.value as any)}
                      className={`${themeClasses.input} w-32 px-4 py-3 rounded-xl`}
                    >
                      <option value="minutes">{t('minutes')}</option>
                      <option value="hours">{t('hours')}</option>
                      <option value="days">{t('days')}</option>
                      <option value="months">{t('months')}</option>
                      <option value="years">{t('years')}</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="col-span-1 sm:col-span-2">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white py-3 rounded-2xl font-bold hover:opacity-90 transition-all"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={`${themeClasses.card} rounded-3xl overflow-hidden`}>
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-white/50">
                <th className="px-6 py-3">Key</th>
                <th className="px-6 py-3">{t('plans')}</th>
                <th className="px-6 py-3">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {keys.map((key) => (
                <tr key={key.id}>
                  <td className="px-6 py-4 font-mono">{key.key}</td>
                  <td className="px-6 py-4">{key.plan.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      key.isUsed ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'
                    }`}>
                      {key.isUsed ? 'Usada' : 'Disponível'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
