import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function RedeemKey() {
  const { data: session } = useSession()
  const router = useRouter()
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.post('/api/keys/redeem', { key })
      toast.success('Chave resgatada com sucesso!')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao resgatar chave')
    } finally { setLoading(false) }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-aurora-gold/12 blur-[140px]" />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 text-center">
          <p className="eyebrow">Resgate</p>
          <h1 className="mt-2 text-display text-4xl sm:text-5xl font-bold text-gradient-gold">Resgatar chave</h1>
          <p className="mt-3 text-sm text-white/55">Digite o código da chave para ativar seu plano.</p>
        </div>

        <div className="surface-card-elevated p-7 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-white/55">Chave</label>
              <input
                type="text" value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                className="input-premium text-mono text-center tracking-[0.25em]"
                placeholder="XXXX-XXXX-XXXX" required autoFocus
              />
            </div>
            <button type="submit" disabled={loading || !session} className="btn btn-gold btn-lg w-full">
              {loading ? 'Resgatando...' : 'Resgatar chave'}
            </button>
            {!session && (
              <p className="text-center text-xs text-white/55">
                <Link href="/login" className="text-aurora-violet hover:underline font-semibold">Faça login</Link> para resgatar.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
