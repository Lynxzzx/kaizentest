import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ChristmasContextType {
  isChristmasMode: boolean
  setChristmasMode: (value: boolean) => void
  loading: boolean
  refreshChristmasMode: () => Promise<void>
}

const ChristmasContext = createContext<ChristmasContextType>({
  isChristmasMode: false,
  setChristmasMode: () => {},
  loading: true,
  refreshChristmasMode: async () => {}
})

export function ChristmasProvider({ children }: { children: ReactNode }) {
  const [isChristmasMode, setIsChristmasMode] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchChristmasMode = async () => {
    try {
      const res = await fetch('/api/christmas/status')
      if (res.ok) {
        const data = await res.json()
        setIsChristmasMode(data.enabled)
      }
    } catch (error) {
      console.error('Erro ao verificar modo natalino:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChristmasMode()
  }, [])

  const setChristmasMode = (value: boolean) => {
    setIsChristmasMode(value)
  }

  const refreshChristmasMode = async () => {
    await fetchChristmasMode()
  }

  return (
    <ChristmasContext.Provider value={{ isChristmasMode, setChristmasMode, loading, refreshChristmasMode }}>
      {children}
    </ChristmasContext.Provider>
  )
}

export function useChristmas() {
  return useContext(ChristmasContext)
}

