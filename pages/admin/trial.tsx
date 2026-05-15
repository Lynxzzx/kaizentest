import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'

interface TrialConfig {
  enabled: boolean
  planId: string
  durationDays: number
  title: string
  description: string
  buttonText: string
}

interface PlanOption {
  id: string
  name: string
  description: string | null
  price: number
  duration: number
  maxGenerations: number
  generationCooldownSeconds: number
}

const defaultConfig: TrialConfig = {
  enabled: false,
  planId: '',
  durationDays: 1,
  title: 'Teste premium liberado',
  description: 'Resgate seu acesso premium temporario ao gerador e experimente os servicos pagos.',
  buttonText: 'Resgatar trial premium'
}

export default function AdminTrial() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [config, setConfig] = useState<TrialConfig>(defaultConfig)
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [totalRedemptions, setTotalRedemptions] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated' && session?.user?.role !== 'OWNER') {
      router.push('/dashboard')
      return
    }

    if (status === 'authenticated') {
      loadTrial()
    }
  }, [status, session, router])

  const loadTrial = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get('/api/admin/trial')
      setConfig({ ...defaultConfig, ...data.config })
      setPlans(data.plans || [])
      setTotalRedemptions(data.totalRedemptions || 0)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao carregar trial')
    } finally {
      setLoading(false)
    }
  }

  const saveTrial = async (event: React.FormEvent) => {
    event.preventDefault()

    if (config.enabled && !config.planId) {
      toast.error('Selecione um plano antes de ativar o trial.')
      return
    }

    if (config.durationDays < 1 || config.durationDays > 365) {
      toast.error('A duração deve ficar entre 1 e 365 dias.')
      return
    }

    setSaving(true)
    try {
      const { data } = await axios.post('/api/admin/trial', config)
      setConfig(data.config)
      toast.success('Trial premium atualizado com sucesso!')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar trial')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="admin-shell text-center py-12">Carregando...</div>
  }

  if (session?.user?.role !== 'OWNER') {
    return null
  }

  const selectedPlan = plans.find((plan) => plan.id === config.planId)

  return (
    <div className="admin-shell max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Owner</p>
          <h1 className="text-3xl font-bold">Trial Premium</h1>
          <p className="mt-2 text-sm text-gray-500">
            Configure um resgate unico de plano premium para usuarios sem assinatura ativa.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
          <span className="text-gray-400">Resgates feitos: </span>
          <strong>{totalRedemptions}</strong>
        </div>
      </div>

      <form onSubmit={saveTrial} className="rounded-2xl bg-white p-6 shadow-lg text-gray-900">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div>
            <h2 className="text-lg font-bold">Status do trial</h2>
            <p className="text-sm text-gray-500">
              Quando ativo, usuarios elegiveis recebem um convite ao entrar no site.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <span className="text-sm font-semibold">{config.enabled ? 'Ativo' : 'Inativo'}</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="h-5 w-5"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Plano entregue no trial</label>
            <select
              value={config.planId}
              onChange={(e) => setConfig({ ...config, planId: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">Selecione um plano...</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {plan.maxGenerations === 0 ? 'Ilimitado' : `${plan.maxGenerations} geracoes`}
                </option>
              ))}
            </select>
            {selectedPlan && (
              <p className="mt-2 text-xs text-gray-500">
                Cooldown: {selectedPlan.generationCooldownSeconds}s. Preco original: R$ {selectedPlan.price.toFixed(2)}.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Duracao do trial em dias</label>
            <input
              type="number"
              min={1}
              max={365}
              value={config.durationDays}
              onChange={(e) => setConfig({ ...config, durationDays: Number(e.target.value) })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
            <p className="mt-2 text-xs text-gray-500">
              O plano expira automaticamente ao fim desse periodo.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Titulo do convite</label>
            <input
              type="text"
              maxLength={80}
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Texto do botao</label>
            <input
              type="text"
              maxLength={40}
              value={config.buttonText}
              onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">Descricao do convite</label>
          <textarea
            rows={4}
            maxLength={300}
            value={config.description}
            onChange={(e) => setConfig({ ...config, description: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Protecoes ativas: um resgate por conta, bloqueio por dispositivo/IP ja usado e recusas para usuarios banidos ou com plano ativo.
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-600 px-5 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar trial'}
          </button>
        </div>
      </form>
    </div>
  )
}
