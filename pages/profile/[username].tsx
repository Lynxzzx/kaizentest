import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import axios from 'axios'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import Layout from '@/components/Layout'

interface UserProfile {
  id: string
  username: string
  bio: string | null
  profilePicture: string | null
  role: string
  createdAt: string
  plan: {
    id: string
    name: string
  } | null
  planExpiresAt: string | null
  _count: {
    generatedAccounts: number
    payments: number
    chatMessages: number
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const { username } = router.query
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({ bio: '', profilePicture: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (username && typeof username === 'string') {
      loadProfile(username)
    }
  }, [username])

  const loadProfile = async (usernameParam: string) => {
    try {
      const response = await axios.get(`/api/profile/${usernameParam}`)
      setProfile(response.data.user)
      if (response.data.user.id === session?.user.id) {
        setEditData({
          bio: response.data.user.bio || '',
          profilePicture: response.data.user.profilePicture || ''
        })
      }
    } catch (error: any) {
      toast.error('Erro ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!session) return

    setSaving(true)
    try {
      await axios.put('/api/profile/update', editData)
      toast.success('Perfil atualizado!')
      setIsEditing(false)
      if (username && typeof username === 'string') {
        loadProfile(username)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar perfil')
    } finally {
      setSaving(false)
    }
  }

  const getRoleInfo = (role: string) => {
    const roles: Record<string, { name: string; color: string; icon: string }> = {
      OWNER: { name: 'Owner', color: 'from-yellow-400 via-yellow-500 to-yellow-600', icon: '👑' },
      ADMIN: { name: 'Administrador', color: 'from-red-500 via-red-600 to-red-700', icon: '🔧' },
      MODERATOR: { name: 'Moderador', color: 'from-blue-500 via-blue-600 to-blue-700', icon: '🛡️' },
      USER: { name: 'Usuário', color: 'from-gray-500 via-gray-600 to-gray-700', icon: '👤' }
    }
    return roles[role] || roles.USER
  }

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
            <p className="mt-4 text-gray-300 text-lg">Carregando perfil...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!profile) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">😕</div>
            <p className="text-gray-300 text-xl mb-2">Perfil não encontrado</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-bold hover:from-blue-600 hover:to-purple-700 transition-all"
            >
              Voltar
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  const roleInfo = getRoleInfo(profile.role)
  const isOwnProfile = session?.user.id === profile.id

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Card */}
          <div className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 rounded-3xl shadow-2xl p-8 mb-8 border border-gray-600">
            <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
              {/* Avatar */}
              <div className="relative">
                {profile.profilePicture ? (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-gradient-to-r from-blue-500 to-purple-600 shadow-2xl">
                    <Image
                      src={profile.profilePicture}
                      alt={profile.username}
                      width={160}
                      height={160}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-5xl md:text-6xl font-bold shadow-2xl border-4 border-gradient-to-r from-blue-500 to-purple-600">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                )}
                {isOwnProfile && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="absolute bottom-0 right-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
                  >
                    ✏️
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center md:items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{profile.username}</h1>
                    <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r ${roleInfo.color} text-white font-bold text-sm mb-3`}>
                      <span>{roleInfo.icon}</span>
                      <span>{roleInfo.name}</span>
                    </div>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Foto de Perfil (URL)</label>
                      <input
                        type="text"
                        value={editData.profilePicture}
                        onChange={(e) => setEditData({ ...editData, profilePicture: e.target.value })}
                        placeholder="https://exemplo.com/foto.jpg"
                        className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Biografia</label>
                      <textarea
                        value={editData.bio}
                        onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                        placeholder="Conte um pouco sobre você..."
                        maxLength={500}
                        rows={4}
                        className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-400 mt-1">{editData.bio.length}/500</p>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-2 rounded-lg font-bold hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50"
                      >
                        {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-gray-700 text-white py-2 rounded-lg font-bold hover:bg-gray-600 transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {profile.bio ? (
                      <p className="text-gray-300 text-lg mb-4">{profile.bio}</p>
                    ) : (
                      isOwnProfile && (
                        <p className="text-gray-500 italic mb-4">Adicione uma biografia para personalizar seu perfil!</p>
                      )
                    )}
                    <p className="text-gray-400 text-sm">
                      Membro desde {format(new Date(profile.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-xl border border-blue-500">
              <div className="text-blue-100 text-3xl mb-2">🎮</div>
              <div className="text-white text-3xl font-bold mb-1">{profile._count.generatedAccounts}</div>
              <div className="text-blue-100 text-sm">Contas Geradas</div>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 shadow-xl border border-purple-500">
              <div className="text-purple-100 text-3xl mb-2">💳</div>
              <div className="text-white text-3xl font-bold mb-1">{profile._count.payments}</div>
              <div className="text-purple-100 text-sm">Pagamentos</div>
            </div>
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 shadow-xl border border-green-500">
              <div className="text-green-100 text-3xl mb-2">💬</div>
              <div className="text-white text-3xl font-bold mb-1">{profile._count.chatMessages}</div>
              <div className="text-green-100 text-sm">Mensagens no Chat</div>
            </div>
          </div>

          {/* Plan Card */}
          {profile.plan && (
            <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-2xl p-6 shadow-xl border border-gray-600 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">📦 Plano Atual</h2>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white text-xl font-bold mb-1">{profile.plan.name}</div>
                  {profile.planExpiresAt && (
                    <div className="text-gray-400 text-sm">
                      Expira em {format(new Date(profile.planExpiresAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </div>
                  )}
                </div>
                <div className="text-4xl">✨</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

