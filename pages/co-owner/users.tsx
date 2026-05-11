import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'

interface UserItem {
  id: string; username: string; email: string | null
  planId: string | null; planExpiresAt: string | null
  apiPlanId: string | null; apiPlanExpiresAt: string | null
  plan?: { id: string; name: string } | null
}

interface Plan { id: string; name: string }

export default function CoOwnerUsers() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<UserItem[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [apiPlans, setApiPlans] = useState<Plan[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserItem | null>(null)
  const [form, setForm] = useState({ planId: '', apiPlanId: '', planExpiresAt: '', apiPlanExpiresAt: '' })

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      const role = String(session?.user?.role || '').toUpperCase()
      const isCo = role === 'CO_OWNER' || role === 'CO-OWNER' || role === 'CO OWNER'
      if (!isCo) { router.push('/dashboard'); return }
      load()
    }
  }, [session, status])

  const load = async () => {
    try {
      const r = await axios.get('/api/admin/users', { params: { search } })
      setUsers(r.data)
      const s = await axios.get('/api/plans?type=SITE'); setPlans(s.data)
      const a = await axios.get('/api/plans?type=API'); setApiPlans(a.data)
    } catch (e: any) { toast.error(e.response?.data?.error || 'Erro') }
  }

  const startEdit = (u: UserItem) => {
    setEditing(u)
    setForm({
      planId: u.planId || '', apiPlanId: u.apiPlanId || '',
      planExpiresAt: u.planExpiresAt ? new Date(u.planExpiresAt).toISOString().slice(0, 16) : '',
      apiPlanExpiresAt: u.apiPlanExpiresAt ? new Date(u.apiPlanExpiresAt).toISOString().slice(0, 16) : ''
    })
  }

  const save = async () => {
    if (!editing) return
    try {
      await axios.put('/api/admin/users', {
        userId: editing.id, planId: form.planId || null, apiPlanId: form.apiPlanId || null,
        planExpiresAt: form.planExpiresAt || null, apiPlanExpiresAt: form.apiPlanExpiresAt || null
      })
      toast.success('Planos atualizados!'); setEditing(null); await load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Erro') }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-aurora-violet/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-8 animate-fade-up">
          <p className="eyebrow">Co-Owner</p>
          <h1 className="mt-2 text-display text-3xl sm:text-4xl font-bold text-gradient-aurora">Usuários</h1>
        </div>

        <div className="surface-card-elevated p-5 mb-6 animate-fade-up delay-100">
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por username…" className="input-premium flex-1" />
            <button onClick={load} className="btn btn-primary btn-sm shrink-0">Buscar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-up delay-200">
          {users.map((u) => (
            <div key={u.id} className="surface-card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{u.username}</p>
                <p className="text-xs text-white/40 truncate">{u.email || '-'}</p>
                <p className="mt-1 text-[10px] text-white/50">Plano: <span className="text-white/80">{u.plan?.name || 'Nenhum'}</span></p>
              </div>
              <button onClick={() => startEdit(u)} className="btn btn-ghost btn-sm shrink-0">Editar</button>
            </div>
          ))}
        </div>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="surface-card-elevated w-full max-w-xl p-6 animate-scale-in">
              <h2 className="text-display text-xl font-bold text-white mb-5">Editar planos: <span className="text-gradient-aurora">{editing.username}</span></h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="eyebrow block mb-1.5">Plano do site</label>
                  <select value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })} className="input-premium">
                    <option value="">Nenhum</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="eyebrow block mb-1.5">Plano de API</label>
                  <select value={form.apiPlanId} onChange={e => setForm({ ...form, apiPlanId: e.target.value })} className="input-premium">
                    <option value="">Nenhum</option>
                    {apiPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="eyebrow block mb-1.5">Expira (site)</label>
                  <input type="datetime-local" value={form.planExpiresAt} onChange={e => setForm({ ...form, planExpiresAt: e.target.value })} className="input-premium" />
                </div>
                <div>
                  <label className="eyebrow block mb-1.5">Expira (API)</label>
                  <input type="datetime-local" value={form.apiPlanExpiresAt} onChange={e => setForm({ ...form, apiPlanExpiresAt: e.target.value })} className="input-premium" />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={save} className="btn btn-primary btn-md flex-1">Salvar</button>
                <button onClick={() => setEditing(null)} className="btn btn-ghost btn-md flex-1">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
