import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { getCooldownRemaining, GENERATION_PROTECTION } from '@/lib/generation-protection'

/**
 * API para verificar cooldown de geração
 * 
 * GET: Retorna o tempo restante de cooldown
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userId = session.user.id
  const cooldownRemaining = getCooldownRemaining(userId)

  return res.json({
    cooldownRemaining, // em segundos
    cooldownTotal: GENERATION_PROTECTION.COOLDOWN_SECONDS,
    canGenerate: cooldownRemaining === 0,
    message: cooldownRemaining > 0 
      ? `Aguarde ${cooldownRemaining} segundos antes de gerar novamente.`
      : 'Você pode gerar agora!'
  })
}

