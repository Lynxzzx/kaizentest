import { NextApiRequest, NextApiResponse } from 'next'
import { createCaptcha, validateCaptcha } from '@/lib/captcha'

/**
 * API para gerar e validar CAPTCHA visual
 * 
 * GET: Gerar novo CAPTCHA
 * POST: Validar CAPTCHA
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Gerar novo CAPTCHA
    try {
      const captcha = await createCaptcha()
      
      return res.status(200).json({
        id: captcha.id,
        image: captcha.dataUrl
      })
    } catch (error: any) {
      console.error('Erro ao gerar CAPTCHA:', error)
      return res.status(500).json({ error: 'Erro ao gerar CAPTCHA' })
    }
  }
  
  if (req.method === 'POST') {
    // Validar CAPTCHA
    try {
      const { id, code } = req.body
      
      if (!id || !code) {
        return res.status(400).json({ 
          valid: false, 
          error: 'ID e código do CAPTCHA são obrigatórios' 
        })
      }
      
      const result = await validateCaptcha(id, code)
      
      return res.status(200).json(result)
    } catch (error: any) {
      console.error('Erro ao validar CAPTCHA:', error)
      return res.status(500).json({ 
        valid: false, 
        error: 'Erro ao validar CAPTCHA' 
      })
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}

