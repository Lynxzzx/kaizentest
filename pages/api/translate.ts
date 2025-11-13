import { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

// Cache de traduções para evitar chamadas repetidas à API
const translationCache = new Map<string, string>()

// MyMemory Translation API - Gratuita, até 10.000 palavras/dia
const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, from = 'pt', to = 'en' } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' })
  }

  // Verificar cache primeiro
  const cacheKey = `${from}-${to}-${text}`
  if (translationCache.has(cacheKey)) {
    return res.json({ translatedText: translationCache.get(cacheKey) })
  }

  try {
    // Chamar API MyMemory
    const response = await axios.get(MYMEMORY_API_URL, {
      params: {
        q: text,
        langpair: `${from}|${to}`
      },
      timeout: 10000 // 10 segundos de timeout
    })

    if (response.data && response.data.responseData && response.data.responseData.translatedText) {
      const translatedText = response.data.responseData.translatedText
      
      // Salvar no cache
      translationCache.set(cacheKey, translatedText)
      
      // Limitar cache a 1000 entradas para não consumir muita memória
      if (translationCache.size > 1000) {
        const firstKey = translationCache.keys().next().value
        translationCache.delete(firstKey)
      }

      return res.json({ translatedText })
    } else {
      // Se a API falhar, retornar o texto original
      console.error('Translation API error:', response.data)
      return res.json({ translatedText: text })
    }
  } catch (error: any) {
    console.error('Error translating text:', error.message)
    // Em caso de erro, retornar o texto original
    return res.json({ translatedText: text })
  }
}

