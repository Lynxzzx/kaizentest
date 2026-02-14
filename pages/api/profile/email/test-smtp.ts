import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import nodemailer from 'nodemailer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apenas para teste - remover em produção
  if (req.method === 'GET') {
    try {
      console.log('🧪 Testando conexão SMTP...')
      
      // Verificar variáveis de ambiente
      console.log('📋 Variáveis SMTP disponíveis:')
      console.log('- SMTP_HOST:', process.env.SMTP_HOST)
      console.log('- SMTP_PORT:', process.env.SMTP_PORT)
      console.log('- SMTP_USER:', process.env.SMTP_USER)
      console.log('- SMTP_PASS:', process.env.SMTP_PASS ? '✅ Configurada' : '❌ Ausente')

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(400).json({ 
          error: 'Credenciais SMTP não configuradas',
          details: 'SMTP_USER ou SMTP_PASS ausentes'
        })
      }

      // Criar transporte
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        logger: true,
        debug: true
      })

      // Testar conexão
      console.log('🔍 Verificando conexão...')
      const result = await transporter.verify()
      console.log('✅ Conexão SMTP bem-sucedida:', result)

      // Tentar enviar email de teste
      console.log('📧 Enviando email de teste...')
      const testResult = await transporter.sendMail({
        from: `"Kaizen Gens Test" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER, // Enviar para o próprio email
        subject: 'Teste SMTP - Kaizen Gens',
        text: 'Este é um email de teste para verificar se a conexão SMTP está funcionando corretamente.',
        html: '<p>Este é um email de teste para verificar se a conexão SMTP está funcionando corretamente.</p>'
      })

      console.log('✅ Email de teste enviado:', testResult.messageId)

      return res.status(200).json({ 
        message: 'Teste SMTP realizado com sucesso',
        connection: result,
        emailSent: true,
        messageId: testResult.messageId
      })

    } catch (error: any) {
      console.error('❌ Erro no teste SMTP:')
      console.error('Mensagem:', error.message)
      console.error('Código:', error.code)
      console.error('Resposta:', error.response)
      console.error('Stack:', error.stack)

      return res.status(500).json({ 
        error: 'Falha no teste SMTP',
        details: error.message,
        code: error.code,
        response: error.response
      })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}