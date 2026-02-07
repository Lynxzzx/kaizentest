import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'

interface UserItem {
  id: string
  username: string
  email: string | null
  planId: string | null
  planExpiresAt: string | null
  apiPlanId: string | null
  apiPlanExpiresAt: string | null
  plan?: { id: string; name: string } | null
}

interface Plan {
  id: string
  name: string
}

export default function CoOwnerUsers() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<UserItem[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [apiPlans, setApiPlans] = useState<Plan[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserItem | null>(null)
  const [form, setForm] = useState<{ planId: string; apiPlanId: string; planExpiresAt: string; apiPlanExpiresAt: string }>({
    planId: '',
    apiPlanId: '',
    planExpiresAt: '',
    apiPlanExpiresAt: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      const rawRole = String(session?.user?.role || '').toUpperCase()
      const isCoOwner = rawRole === 'CO_OWNER' || rawRole === 'CO-OWNER' || rawRole === 'CO OWNER'
      if (!isCoOwner) {
        router.push('/dashboard')
        return
      }
      load()
    }
  }, [session, status])

  const load = async () => {
    try {
      const res = await axios.get('/api/admin/users', { params: { search } })
      setUsers(res.data)
      const sitePlans = await axios.get('/api/plans?type=SITE')
      setPlans(sitePlans.data)
      const apiPlansRes = await axios.get('/api/plans?type=API')
      setApiPlans(apiPlansRes.data)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao carregar usuários')
    }
  }

  const startEdit = (u: UserItem) => {
    setEditing(u)
    setForm({
      planId: u.planId || '',
      apiPlanId: u.apiPlanId || '',
      planExpiresAt: u.planExpiresAt ? new Date(u.planExpiresAt).toISOString().slice(0, 16) : '',
      apiPlanExpiresAt: u.apiPlanExpiresAt ? new Date(u.apiPlanExpiresAt).toISOString().slice(0, 16) : ''
    })
  }

  const save = async () => {
    if (!editing) return
    try {
      await axios.put('/api/admin/users', {
        userId: editing.id,
        planId: form.planId || null,
        apiPlanId: form.apiPlanId || null,
        planExpiresAt: form.planExpiresAt || null,
        apiPlanExpiresAt: form.apiPlanExpiresAt || null
      })
      toast.success('Planos atualizados!')
      setEditing(null)
      await load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao salvar')
    }
  }

  return (
    <Layout>
      <div className="min-h-screen pt-12 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-extrabold text-white mb-6">Usuários (Co‑Owner)</h1>
          <div className="glass-panel p-6 rounded-2xl border border-white/10 mb-6">
            <div className="flex gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por username…"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500/50 outline-none"
              />
              <button onClick={load} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500">
                Buscar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((u) => (
              <div key={u.id} className="glass-card p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold">{u.username}</p>
                  <p className="text-gray-400 text-sm">{u.email || '-'}</p>
                  <p className="text-xs text-gray-500 mt-1">Plano: {u.plan?.name || 'Nenhum'}</p>
                </div>
                <button
                  onClick={() => startEdit(u)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Editar Planos
                </button>
              </div>
            ))}
          </div>

          {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="glass-panel p-6 rounded-2xl max-w-xl w-full border border-white/10">
                <h2 className="text-xl font-bold text-white mb-4">Editar Planos: {editing.username}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Plano do Site</label>
                    <select
                      value={form.planId}
                      onChange={(e) => setForm({ ...form, planId: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500/50 outline-none"
                    >
                      <option value="">Nenhum</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Plano de API</label>
                    <select
                      value={form.apiPlanId}
                      onChange={(e) => setForm({ ...form, apiPlanId: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500/50 outline-none"
                    >
                      <option value="">Nenhum</option>
                      {apiPlans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Expira (Site)</label>
                    <input
                      type="datetime-local"
                      value={form.planExpiresAt}
                      onChange={(e) => setForm({ ...form, planExpiresAt: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Expira (API)</label>
                    <input
                      type="datetime-local"
                      value={form.apiPlanExpiresAt}
                      onChange={(e) => setForm({ ...form, apiPlanExpiresAt: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500/50 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={save} className="px-5 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500">
                    Salvar
                  </button>
                  <button onClick={() => setEditing(null)} className="px-5 py-3 rounded-xl bg-white/10 text-white border border-white/10 hover:bg-white/20">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
