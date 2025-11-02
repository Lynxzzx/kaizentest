import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

interface ChatMessage {
  id: string
  message: string
  createdAt: string
  user: {
    id: string
    username: string
    profilePicture: string | null
    role: string
    bio: string | null
  }
}

interface ChatboxProps {
  isOpen: boolean
  onToggle: () => void
}

export default function Chatbox({ isOpen, onToggle }: ChatboxProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && session) {
      loadMessages()
      const interval = setInterval(loadMessages, 3000) // Atualizar a cada 3 segundos
      return () => clearInterval(interval)
    }
  }, [isOpen, session])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      const response = await axios.get('/api/chat/messages')
      setMessages(response.data.messages || [])
    } catch (error: any) {
      if (!loading) {
        console.error('Error loading messages:', error)
      }
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const response = await axios.post('/api/chat/messages', {
        message: newMessage.trim()
      })
      setNewMessage('')
      setMessages(prev => [...prev, response.data.message])
      setTimeout(scrollToBottom, 100)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      OWNER: { text: '👑 Owner', color: 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white' },
      ADMIN: { text: '🔧 Admin', color: 'bg-gradient-to-r from-red-500 to-red-700 text-white' },
      MODERATOR: { text: '🛡️ Moderador', color: 'bg-gradient-to-r from-blue-500 to-blue-700 text-white' },
      USER: { text: '👤 User', color: 'bg-gradient-to-r from-gray-500 to-gray-700 text-white' }
    }
    return badges[role] || badges.USER
  }

  if (!session) return null

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={onToggle}
        className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center ${
          isOpen
            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
            : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
        }`}
      >
        {isOpen ? (
          <span className="text-2xl text-white">✕</span>
        ) : (
          <span className="text-2xl text-white">💬</span>
        )}
      </button>

      {/* Chatbox */}
      {isOpen && (
        <div className="fixed bottom-24 right-0 md:right-6 z-50 w-full md:w-full md:max-w-md h-[600px] md:h-[600px] max-h-[85vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-blue-600">
                💬
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Chat Global</h3>
                <p className="text-blue-100 text-xs">{messages.length} mensagens</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
          >
            {messages.map((msg) => {
              const badge = getRoleBadge(msg.user.role)
              const isOwnMessage = msg.user.id === session.user.id

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} items-start space-x-2`}
                >
                  {!isOwnMessage && (
                    <div className="flex-shrink-0">
                      {msg.user.profilePicture ? (
                        <Image
                          src={msg.user.profilePicture}
                          alt={msg.user.username}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                          {msg.user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!isOwnMessage && (
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-semibold text-gray-300">{msg.user.username}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.color}`}>
                          {badge.text}
                        </span>
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isOwnMessage
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                          : 'bg-gray-700 text-gray-100'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    </div>
                    <span className="text-xs text-gray-400 mt-1">
                      {format(new Date(msg.createdAt), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                  {isOwnMessage && (
                    <div className="flex-shrink-0">
                      {msg.user.profilePicture ? (
                        <Image
                          src={msg.user.profilePicture}
                          alt={msg.user.username}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs">
                          {msg.user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 bg-gray-800 border-t border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                maxLength={1000}
                className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? '⏳' : '➤'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {newMessage.length}/1000 caracteres
            </p>
          </form>
        </div>
      )}
    </>
  )
}

