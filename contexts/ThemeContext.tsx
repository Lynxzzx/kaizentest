import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import axios from 'axios'

type Theme = 'dark' | 'light' | 'default'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [theme, setThemeState] = useState<Theme>('dark') // Tema padrão: dark (da landing page)
  const [isLoading, setIsLoading] = useState(true)

  // Carregar tema do usuário ou localStorage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Primeiro, tentar carregar do localStorage (para usuários não logados)
        const savedTheme = localStorage.getItem('theme') as Theme | null
        if (savedTheme && ['dark', 'light', 'default'].includes(savedTheme)) {
          setThemeState(savedTheme)
          applyTheme(savedTheme)
          setIsLoading(false)
          return
        }

        // Se usuário está logado, carregar do banco
        if (session) {
          const response = await axios.get('/api/users/me')
          const userTheme = response.data.theme || 'dark'
          setThemeState(userTheme as Theme)
          applyTheme(userTheme as Theme)
          localStorage.setItem('theme', userTheme)
        } else {
          // Tema padrão para não logados
          setThemeState('dark')
          applyTheme('dark')
        }
      } catch (error) {
        console.error('Error loading theme:', error)
        // Fallback para dark
        setThemeState('dark')
        applyTheme('dark')
      } finally {
        setIsLoading(false)
      }
    }

    loadTheme()
  }, [session])

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    
    // Remover classes anteriores
    root.classList.remove('theme-dark', 'theme-light', 'theme-default')
    
    // Adicionar classe do tema atual
    root.classList.add(`theme-${newTheme}`)
    
    // Salvar no localStorage
    localStorage.setItem('theme', newTheme)
  }

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)

    // Salvar no banco de dados se usuário estiver logado
    if (session) {
      try {
        await axios.put('/api/users/theme', { theme: newTheme })
      } catch (error) {
        console.error('Error saving theme:', error)
      }
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

