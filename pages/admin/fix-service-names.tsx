import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'

interface ProblematicService {
    id: string
    name: string
    description: string | null
    icon: string | null
}

export default function FixServiceNames() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [services, setServices] = useState<ProblematicService[]>([])
    const [loading, setLoading] = useState(true)
    const [fixing, setFixing] = useState<string | null>(null)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
        } else if (session?.user?.role !== 'OWNER') {
            router.push('/dashboard')
        }
    }, [session, status, router])

    useEffect(() => {
        if (session?.user?.role === 'OWNER') {
            loadProblematicServices()
        }
    }, [session])

    const loadProblematicServices = async () => {
        try {
            setLoading(true)
            const response = await axios.get('/api/admin/fix-service-names')
            setServices(response.data.problematic || [])
        } catch (error: any) {
            toast.error('Erro ao carregar serviços')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleFix = async (serviceId: string, suggestedName: string) => {
        const newName = prompt('Digite o nome correto do serviço:', suggestedName)
        if (!newName) return

        const newDescription = prompt('Digite a descrição (opcional):') || ''
        const newIcon = prompt('Digite o ícone emoji ou URL (opcional):', '📺') || '📺'

        try {
            setFixing(serviceId)
            await axios.post('/api/admin/fix-service-names', {
                serviceId,
                newName,
                newDescription,
                newIcon
            })
            toast.success('Serviço corrigido com sucesso!')
            await loadProblematicServices()
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao corrigir serviço')
        } finally {
            setFixing(null)
        }
    }

    const extractNameFromURL = (url: string): string => {
        // Tentar extrair o nome da URL
        if (url.includes('Claro_tv') || url.includes('claro')) return 'ClaroTV'
        if (url.includes('netflix')) return 'Netflix'
        if (url.includes('spotify')) return 'Spotify'
        if (url.includes('disney')) return 'Disney+'

        // Fallback: tentar pegar do parâmetro 'id'
        const match = url.match(/[?&]id=([^&]+)/)
        if (match && match[1]) {
            const id = match[1]
            // br.com.netcombo.now -> Claro Now
            if (id.includes('netcombo') || id.includes('claro')) return 'ClaroTV'
            return id.split('.').pop() || 'Serviço'
        }

        return 'Serviço'
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
                    <p className="mt-4 text-gray-600">Carregando...</p>
                </div>
            </div>
        )
    }

    if (session?.user?.role !== 'OWNER') {
        return null
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow rounded-lg p-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        🔧 Corrigir Nomes de Serviços
                    </h1>

                    {services.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">✅</div>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                                Tudo certo!
                            </h2>
                            <p className="text-gray-600">
                                Nenhum serviço com problema encontrado.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-start">
                                    <span className="text-2xl mr-3">⚠️</span>
                                    <div>
                                        <h3 className="font-semibold text-yellow-900 mb-1">
                                            {services.length} serviço(s) com problema encontrado(s)
                                        </h3>
                                        <p className="text-sm text-yellow-700">
                                            Os serviços abaixo estão com URL no campo de nome. Clique em "Corrigir" para atualizar.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {services.map((service) => (
                                    <div
                                        key={service.id}
                                        className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-3xl">{service.icon || '📦'}</span>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900 text-lg">
                                                            Nome problemático:
                                                        </h3>
                                                        <p className="text-sm text-red-600 break-all font-mono">
                                                            {service.name}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                    <p className="text-sm font-medium text-green-900 mb-1">
                                                        ✨ Sugestão de nome:
                                                    </p>
                                                    <p className="text-lg font-bold text-green-700">
                                                        {extractNameFromURL(service.name)}
                                                    </p>
                                                </div>

                                                {service.description && (
                                                    <div className="mt-2 text-sm text-gray-600">
                                                        <strong>Descrição:</strong> {service.description}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => handleFix(service.id, extractNameFromURL(service.name))}
                                                disabled={fixing === service.id}
                                                className={`ml-4 px-4 py-2 rounded-lg font-medium transition-colors ${fixing === service.id
                                                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                    }`}
                                            >
                                                {fixing === service.id ? (
                                                    <span className="flex items-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        Corrigindo...
                                                    </span>
                                                ) : (
                                                    '🔧 Corrigir'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    <strong>💡 Dica:</strong> Ao clicar em "Corrigir", você poderá editar manualmente o nome, descrição e ícone do serviço.
                                </p>
                            </div>
                        </>
                    )}

                    <div className="mt-6 flex gap-3">
                        <button
                            onClick={() => router.push('/admin/services')}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                            ← Voltar para Serviços
                        </button>
                        <button
                            onClick={loadProblematicServices}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700"
                        >
                            🔄 Recarregar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
