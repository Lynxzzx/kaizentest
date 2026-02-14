import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Verificar variáveis de ambiente (sem expor senhas)
      const envStatus = {
        SMTP_HOST: process.env.SMTP_HOST || 'Não configurado',
        SMTP_PORT: process.env.SMTP_PORT || 'Não configurado',
        SMTP_USER: process.env.SMTP_USER || 'Não configurado',
        SMTP_PASS: process.env.SMTP_PASS ? '✅ Configurada' : '❌ Ausente',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'Não configurado',
        DATABASE_URL: process.env.DATABASE_URL ? '✅ Configurada' : '❌ Ausente'
      }

      console.log('🔍 Verificação de ambiente:', envStatus)

      // Verificar se é ambiente de produção
      const isProduction = process.env.NODE_ENV === 'production'
      
      return res.status(200).json({
        environment: process.env.NODE_ENV,
        isProduction,
        smtpConfig: {
          host: envStatus.SMTP_HOST,
          port: envStatus.SMTP_PORT,
          user: envStatus.SMTP_USER,
          passwordConfigured: envStatus.SMTP_PASS !== '❌ Ausente'
        },
        message: isProduction 
          ? 'Ambiente de produção - variáveis do Vercel ativas'
          : 'Ambiente de desenvolvimento - usando .env local',
        timestamp: new Date().toISOString()
      })

    } catch (error: any) {
      console.error('❌ Erro ao verificar ambiente:', error)
      return res.status(500).json({ 
        error: 'Erro ao verificar configurações',
        details: error.message 
      })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}