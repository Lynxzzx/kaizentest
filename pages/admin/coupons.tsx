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
  createdBy?: { id: string; username: string } | null
  _count?: { payments: number }
}

const emptyForm = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxUses: '',
  minAmount: '',
  expiresAt: ''
}

export default function AdminCoupons() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  const { t } = useTranslation()

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ ...emptyForm })
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({ ...emptyForm })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

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
      toast.error('Preencha o código e o valor do desconto')
      return
    }

    setSaving(true)
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
      toast.success('Cupom criado com sucesso!')
      setFormData({ ...emptyForm })
      loadCoupons()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar cupom')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setEditFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      maxUses: coupon.maxUses ? String(coupon.maxUses) : '',
      minAmount: coupon.minAmount ? String(coupon.minAmount) : '',
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : ''
    })
    setShowEditModal(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCoupon) return
    if (!editFormData.code.trim() || !editFormData.discountValue) {
      toast.error('Preencha o código e o valor do desconto')
      return
    }

    setSaving(true)
    try {
      await axios.put('/api/admin/coupons', {
        id: editingCoupon.id,
        code: editFormData.code,
        description: editFormData.description,
        discountType: editFormData.discountType,
        discountValue: Number(editFormData.discountValue),
        maxUses: editFormData.maxUses ? Number(editFormData.maxUses) : null,
        minAmount: editFormData.minAmount ? Number(editFormData.minAmount) : null,
        expiresAt: editFormData.expiresAt || null
      })
      toast.success('Cupom atualizado com sucesso!')
      setShowEditModal(false)
      setEditingCoupon(null)
      loadCoupons()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar cupom')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      await axios.put('/api/admin/coupons', {
        id: coupon.id,
        isActive: !coupon.isActive
      })
      toast.success(coupon.isActive ? 'Cupom desativado' : 'Cupom ativado')
      loadCoupons()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao alterar status')
    }
  }

  const handleDelete = async (coupon: Coupon) => {
    if (deletingId === coupon.id) {
      // Second click — confirm
      try {
        const res = await axios.delete(`/api/admin/coupons?id=${coupon.id}`)
        if (res.data.deactivated) {
          toast.success('Cupom desativado (possui pagamentos vinculados)')
        } else {
          toast.success('Cupom excluído com sucesso!')
        }
        setDeletingId(null)
        loadCoupons()
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Erro ao excluir cupom')
        setDeletingId(null)
      }
    } else {
      // First click — ask for confirmation
      setDeletingId(coupon.id)
      setTimeout(() => setDeletingId(null), 4000) // Reset after 4s
    }
  }

  const filteredCoupons = coupons.filter((c) => {
    const matchSearch =
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && c.isActive) ||
      (filterStatus === 'inactive' && !c.isActive)
    return matchSearch && matchStatus
  })

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.6em] text-white/40">Gerenciador de Cupons</p>
            <h1 className={`text-3xl font-bold ${themeClasses.text.primary}`}>Cupons de Desconto</h1>
            <p className={`${themeClasses.text.secondary} text-sm`}>
              Crie, edite e gerencie cupons de desconto para seus clientes
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-2xl">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-green-300 font-medium">{coupons.filter(c => c.isActive).length} ativos</span>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
              <span className={themeClasses.text.secondary}>{coupons.length} total</span>
            </div>
          </div>
        </div>

        {/* Create Form */}
        <div className={`${themeClasses.card} rounded-3xl p-6`}>
          <h3 className={`text-lg font-semibold mb-4 ${themeClasses.text.primary} flex items-center gap-2`}>
            <span className="text-xl">➕</span> Criar Novo Cupom
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="text-sm font-semibold mb-2 block">Código do Cupom</label>
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
              <label className="text-sm font-semibold mb-2 block">Tipo de Desconto</label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
              >
                <option value="PERCENTAGE">Porcentagem (%)</option>
                <option value="VALUE">Valor Fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Valor do Desconto</label>
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
              <label className="text-sm font-semibold mb-2 block">Usos Máximos</label>
              <input
                type="number"
                min="1"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                placeholder="Ilimitado"
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Valor Mínimo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.minAmount}
                onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                placeholder="Sem mínimo"
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Expira em</label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="text-sm font-semibold mb-2 block">Descrição (opcional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                placeholder="Ex: Válido apenas para planos mensais"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
              >
                {saving ? 'Salvando...' : '✨ Criar Cupom'}
              </button>
            </div>
          </form>
        </div>

        {/* Coupon List */}
        <div className={`${themeClasses.card} rounded-3xl p-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className={`text-xl font-semibold ${themeClasses.text.primary} flex items-center gap-2`}>
              <span className="text-xl">🏷️</span> Cupons Cadastrados
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cupom..."
                className={`${themeClasses.input} px-4 py-2 rounded-xl text-sm w-full sm:w-48`}
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className={`${themeClasses.input} px-4 py-2 rounded-xl text-sm`}
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
          </div>

          {filteredCoupons.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🎫</p>
              <p className={themeClasses.text.secondary}>
                {searchTerm || filterStatus !== 'all' ? 'Nenhum cupom encontrado com esses filtros.' : 'Nenhum cupom criado ainda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCoupons.map((coupon) => {
                const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date()
                const isMaxedOut = coupon.maxUses && coupon.usedCount >= coupon.maxUses
                const effectivelyInactive = !coupon.isActive || isExpired || isMaxedOut

                return (
                  <div
                    key={coupon.id}
                    className={`relative rounded-2xl border p-4 sm:p-5 transition-all ${effectivelyInactive
                        ? 'border-white/5 bg-white/[0.02] opacity-60'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Left: Code & Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-lg font-bold tracking-[0.3em] text-indigo-300">
                            {coupon.code}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${coupon.isActive
                              ? isExpired
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : isMaxedOut
                                  ? 'bg-orange-500/20 text-orange-300'
                                  : 'bg-green-500/20 text-green-300'
                              : 'bg-red-500/20 text-red-300'
                            }`}>
                            {!coupon.isActive ? 'Inativo' : isExpired ? 'Expirado' : isMaxedOut ? 'Esgotado' : 'Ativo'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className={`${themeClasses.text.secondary} flex items-center gap-1`}>
                            💰 {coupon.discountType === 'PERCENTAGE'
                              ? `${coupon.discountValue}%`
                              : `R$ ${coupon.discountValue.toFixed(2)}`}
                          </span>
                          <span className={`${themeClasses.text.muted} flex items-center gap-1`}>
                            📊 {coupon.usedCount}/{coupon.maxUses || '∞'} usos
                          </span>
                          {coupon.minAmount ? (
                            <span className={`${themeClasses.text.muted} flex items-center gap-1`}>
                              🛒 Mín. R$ {coupon.minAmount.toFixed(2)}
                            </span>
                          ) : null}
                          {coupon.expiresAt ? (
                            <span className={`${themeClasses.text.muted} flex items-center gap-1`}>
                              📅 {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}
                            </span>
                          ) : null}
                          {coupon.createdBy ? (
                            <span className={`${themeClasses.text.muted} flex items-center gap-1`}>
                              👤 {coupon.createdBy.username}
                            </span>
                          ) : null}
                        </div>

                        {coupon.description && (
                          <p className={`${themeClasses.text.muted} text-xs mt-1.5 italic`}>
                            {coupon.description}
                          </p>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleActive(coupon)}
                          title={coupon.isActive ? 'Desativar' : 'Ativar'}
                          className={`p-2.5 rounded-xl transition-all text-sm ${coupon.isActive
                              ? 'bg-green-500/10 hover:bg-green-500/20 text-green-300'
                              : 'bg-red-500/10 hover:bg-red-500/20 text-red-300'
                            }`}
                        >
                          {coupon.isActive ? '🟢' : '🔴'}
                        </button>
                        <button
                          onClick={() => openEditModal(coupon)}
                          title="Editar cupom"
                          className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-all text-sm"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(coupon)}
                          title={deletingId === coupon.id ? 'Clique novamente para confirmar' : 'Excluir cupom'}
                          className={`p-2.5 rounded-xl transition-all text-sm ${deletingId === coupon.id
                              ? 'bg-red-500/30 text-red-200 animate-pulse ring-2 ring-red-500/50'
                              : 'bg-red-500/10 hover:bg-red-500/20 text-red-300'
                            }`}
                        >
                          {deletingId === coupon.id ? '⚠️' : '🗑️'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowEditModal(false)}>
          <div
            className={`${themeClasses.card} rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${themeClasses.text.primary} flex items-center gap-2`}>
                ✏️ Editar Cupom
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-xl hover:bg-white/10 transition-all text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Código do Cupom</label>
                <input
                  type="text"
                  value={editFormData.code}
                  onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value.toUpperCase() })}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-xl uppercase tracking-[0.5em]`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Tipo</label>
                  <select
                    value={editFormData.discountType}
                    onChange={(e) => setEditFormData({ ...editFormData, discountType: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                  >
                    <option value="PERCENTAGE">Porcentagem (%)</option>
                    <option value="VALUE">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Valor</label>
                  <input
                    type="number"
                    min="1"
                    value={editFormData.discountValue}
                    onChange={(e) => setEditFormData({ ...editFormData, discountValue: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Usos Máximos</label>
                  <input
                    type="number"
                    min="1"
                    value={editFormData.maxUses}
                    onChange={(e) => setEditFormData({ ...editFormData, maxUses: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                    placeholder="Ilimitado"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Valor Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editFormData.minAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, minAmount: e.target.value })}
                    className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                    placeholder="Sem mínimo"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Expira em</label>
                <input
                  type="datetime-local"
                  value={editFormData.expiresAt}
                  onChange={(e) => setEditFormData({ ...editFormData, expiresAt: e.target.value })}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Descrição</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={2}
                  className={`${themeClasses.input} w-full px-4 py-3 rounded-xl`}
                  placeholder="Descrição do cupom..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-3 rounded-2xl border border-white/10 text-white/60 hover:bg-white/5 transition-all font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : '💾 Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
