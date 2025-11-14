import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import { useTranslation } from '@/lib/i18n-helper'

interface Coupon {
  id: string
  code: string
  description: string | null
  discountType: 'PERCENTAGE' | 'VALUE'
  discountValue: number
  maxUses: number | null
  usedCount: number
  minAmount: number | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

export default function AdminCoupons() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  const { t } = useTranslation()

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    maxUses: '',
    minAmount: '',
    expiresAt: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session && session.user.role !== 'OWNER' && session.user.role !== 'ADMIN') {
      router.push('/dashboard')
    } else if (session) {
      loadCoupons()
    }
  }, [session, status, router])

  const loadCoupons = async () => {
    try {
      const response = await axios.get('/api/admin/coupons')
      setCoupons(response.data)
    } catch (error) {
      toast.error('Erro ao carregar cupons')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.discountValue) {
      toast.error(t('invalidCoupon'))
      return
    }

    setCreating(true)
    try {
      await axios.post('/api/admin/coupons', {
        code: formData.code,
        description: formData.description,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        maxUses: formData.maxUses ? Number(formData.maxUses) : undefined,
        minAmount: formData.minAmount ? Number(formData.minAmount) : undefined,
        expiresAt: formData.expiresAt || undefined
      })
      toast.success(t('couponCreatedSuccess'))
      setFormData({
        code: '',
        description: '',
        discountType: 'PERCENTAGE',
        discountValue: '',
        maxUses: '',
        minAmount: '',
        expiresAt: ''
      })
      loadCoupons()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar cupom')
    } finally {
      setCreating(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className={`admin-shell min-h-screen ${themeClasses.loading} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-purple-500' : 'border-primary-600'}`}></div>
          <p className={`mt-4 ${themeClasses.text.secondary}`}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session || (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN')) {
    return null
  }

  return (
    <div className={`admin-shell min-h-screen ${themeClasses.bg} py-10 px-4 sm:px-6 lg:px-10`}>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.6em] text-white/40">{t('couponManager')}</p>
            <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>{t('coupons')}</h1>
            <p className={`${themeClasses.text.secondary} text-sm`}>{t('couponDescription')}</p>
          </div>
        </div>

        <div className={`${themeClasses.card} rounded-3xl p-6`}>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="text-sm font-semibold mb-2 block">{t('couponCode')}</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl uppercase tracking-[0.5em]`}
                placeholder="PROMO50"
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">{t('couponDiscountType')}</label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
              >
                <option value="PERCENTAGE">{t('couponTypePercentage')}</option>
                <option value="VALUE">{t('couponTypeValue')}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">{t('couponDiscountValue')}</label>
              <input
                type="number"
                min="1"
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                placeholder={formData.discountType === 'PERCENTAGE' ? '30 (%)' : '50 (R$)'}
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">{t('couponMaxUses')}</label>
              <input
                type="number"
                min="1"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                placeholder="50"
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">{t('couponMinAmount')}</label>
              <input
                type="number"
                min="0"
                value={formData.minAmount}
                onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">{t('couponExpiresAt')}</label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="text-sm font-semibold mb-2 block">{t('couponDescription')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                placeholder="Ex: Válido apenas para planos mensais"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
              >
                {creating ? 'Salvando...' : t('createCoupon')}
              </button>
            </div>
          </form>
        </div>

        <div className={`${themeClasses.card} rounded-3xl p-6`}>
          <h3 className={`text-xl font-semibold mb-4 ${themeClasses.text.primary}`}>{t('coupons')}</h3>
          {coupons.length === 0 ? (
            <p className={themeClasses.text.secondary}>Nenhum cupom criado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-white/50">
                    <th className="py-3 pr-4">Código</th>
                    <th className="py-3 pr-4">Tipo</th>
                    <th className="py-3 pr-4">Valor</th>
                    <th className="py-3 pr-4">{t('couponUses')}</th>
                    <th className="py-3 pr-4">{t('couponExpiresAt')}</th>
                    <th className="py-3 pr-4">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id}>
                      <td className="py-3 pr-4 font-mono">{coupon.code}</td>
                      <td className="py-3 pr-4 text-sm">
                        {coupon.discountType === 'PERCENTAGE' ? t('couponTypePercentage') : t('couponTypeValue')}
                      </td>
                      <td className="py-3 pr-4">
                        {coupon.discountType === 'PERCENTAGE'
                          ? `${coupon.discountValue}%`
                          : `${t('currencySymbol')} ${coupon.discountValue.toFixed(2)}`}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        {coupon.usedCount}/{coupon.maxUses || '∞'}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          coupon.isActive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {coupon.isActive ? t('couponActive') : t('couponInactive')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

