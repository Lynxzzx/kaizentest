import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { useTheme } from '@/contexts/ThemeContext'
import { getThemeClasses } from '@/lib/theme-utils'
import axios from 'axios'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { translatePlanName } from '@/lib/i18n-helper'

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
  const locale = (router?.locale || 'pt-BR') as string
  const { username } = router.query
  const { data: session } = useSession()
  const { theme } = useTheme()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({ bio: '', profilePicture: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const themeClasses = getThemeClasses(theme)

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Use JPEG, PNG, GIF ou WebP')
      return
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Tamanho máximo: 5MB')
      return
    }

    setUploading(true)
    const reader = new FileReader()
    
    reader.onloadend = async () => {
      const base64String = reader.result as string
      try {
        const response = await axios.post('/api/profile/upload', {
          image: base64String
        })
        setEditData({ ...editData, profilePicture: response.data.profilePicture })
        toast.success('Foto de perfil atualizada!')
        if (username && typeof username === 'string') {
          loadProfile(username)
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Erro ao fazer upload da foto')
      } finally {
        setUploading(false)
      }
    }

    reader.onerror = () => {
      toast.error('Erro ao ler arquivo')
      setUploading(false)
    }

    reader.readAsDataURL(file)
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
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center text-white/55">
        <svg className="h-5 w-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"/></svg>
        Carregando perfil...
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 text-center">
        <p className="eyebrow">404</p>
        <h2 className="mt-2 text-display text-3xl text-white">Perfil não encontrado</h2>
        <button onClick={() => router.push('/dashboard')} className="btn btn-primary btn-sm mt-6">Voltar ao dashboard</button>
      </div>
    )
  }

  const roleInfo = getRoleInfo(profile.role)
  const isOwnProfile = session?.user.id === profile.id

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[450px] w-[450px] rounded-full bg-aurora-violet/10 blur-[140px]" />
        <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-aurora-cyan/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="surface-card-elevated p-7 sm:p-9 mb-6 animate-fade-up">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="relative shrink-0">
              {profile.profilePicture ? (
                <div className="h-32 w-32 md:h-36 md:w-36 overflow-hidden rounded-full ring-2 ring-white/10">
                  <Image src={profile.profilePicture} alt={profile.username} width={144} height={144} className="object-cover" />
                </div>
              ) : (
                <div className="flex h-32 w-32 md:h-36 md:w-36 items-center justify-center rounded-full bg-gradient-to-br from-aurora-violet to-aurora-cyan text-5xl font-bold text-white ring-2 ring-white/10">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
              )}
              {isOwnProfile && (
                <button onClick={() => setIsEditing(!isEditing)} className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-aurora-violet text-white text-sm shadow-glow-violet ring-2 ring-[#0a0a12]">✎</button>
              )}
            </div>

            <div className="flex-1 text-center md:text-left min-w-0">
              <h1 className="text-display text-3xl md:text-4xl font-bold text-white">{profile.username}</h1>
              <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${roleInfo.color} px-3 py-1 text-[11px] font-bold text-white`}>
                <span>{roleInfo.icon}</span><span>{roleInfo.name}</span>
              </div>

              {isEditing ? (
                <div className="mt-5 space-y-4 text-left">
                  <div>
                    <label className="eyebrow block mb-2">Foto de perfil</label>
                    <div className="space-y-2">
                      <input type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handleFileSelect} className="hidden" id="profile-picture-upload" disabled={uploading} />
                      <label htmlFor="profile-picture-upload" className={`btn btn-primary btn-sm w-full cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                        {uploading ? 'Enviando...' : 'Enviar foto'}
                      </label>
                      <input type="text" value={editData.profilePicture} onChange={e => setEditData({ ...editData, profilePicture: e.target.value })} placeholder="ou cole uma URL" className="input-premium text-xs" />
                    </div>
                    <p className="mt-1 text-[10px] text-white/40">Máx 5MB (JPEG, PNG, GIF, WebP)</p>
                  </div>
                  <div>
                    <label className="eyebrow block mb-2">Biografia</label>
                    <textarea value={editData.bio} onChange={e => setEditData({ ...editData, bio: e.target.value })} placeholder="Conte um pouco sobre você..." maxLength={500} rows={4} className="input-premium" />
                    <p className="mt-1 text-[10px] text-white/40">{editData.bio.length}/500</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary btn-sm flex-1">{saving ? 'Salvando...' : 'Salvar'}</button>
                    <button onClick={() => setIsEditing(false)} className="btn btn-ghost btn-sm flex-1">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  {profile.bio ? (
                    <p className="text-base text-white/80">{profile.bio}</p>
                  ) : isOwnProfile ? (
                    <p className="text-sm italic text-white/40">Adicione uma biografia para personalizar seu perfil.</p>
                  ) : null}
                  <p className="mt-3 text-xs text-white/40">
                    Membro desde {format(new Date(profile.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-px overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10 animate-fade-up delay-100">
          <div className="bg-[#0c0c15]/95 p-6"><p className="eyebrow">Contas geradas</p><p className="num-display mt-2 text-3xl text-gradient">{profile._count.generatedAccounts}</p></div>
          <div className="bg-[#0c0c15]/95 p-6"><p className="eyebrow">Pagamentos</p><p className="num-display mt-2 text-3xl text-gradient">{profile._count.payments}</p></div>
          <div className="bg-[#0c0c15]/95 p-6"><p className="eyebrow">Mensagens</p><p className="num-display mt-2 text-3xl text-gradient">{profile._count.chatMessages}</p></div>
        </div>

        {profile.plan && (
          <div className="surface-card p-6 animate-fade-up delay-200">
            <p className="eyebrow">Plano atual</p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-display text-xl font-bold text-white">{translatePlanName(profile.plan.name, locale)}</p>
                {profile.planExpiresAt && (
                  <p className="mt-1 text-xs text-white/40">
                    Expira em {format(new Date(profile.planExpiresAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
              <span className="pill pill-violet">Ativo</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

