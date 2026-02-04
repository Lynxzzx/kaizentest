import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/api-key-utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    // Listar API keys do usuário
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      include: {
        plan: {
          select: { name: true, price: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(apiKeys)
  }

  if (req.method === 'POST') {
    // Criar nova API key
    const { planId: bodyPlanId, name, usageType, identifier } = req.body
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { apiPlanId: true, apiPlanExpiresAt: true }
    })
    const now = new Date()
    const hasActiveAssignedApiPlan =
      !!user?.apiPlanId && (user?.apiPlanExpiresAt === null || (user?.apiPlanExpiresAt as Date) > now)
    const effectivePlanId: string | null = bodyPlanId || (hasActiveAssignedApiPlan ? (user!.apiPlanId as string) : null)
    if (!effectivePlanId) {
      return res.status(400).json({ error: 'Sem plano de API ativo. Selecione um plano ou peça atribuição ao Owner.' })
    }
 
    // Verificar se o plano existe e é de API (compatível com registros antigos)
    const plan = await prisma.plan.findUnique({ where: { id: effectivePlanId } })
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }
    const isApiPlan = (plan as any)?.type === 'API' || plan.name.toLowerCase().includes('api')
    if (!isApiPlan) {
      return res.status(400).json({ error: 'O plano selecionado não é de API' })
    }
 
    // Permissões
    const isOwner = session.user.role === 'OWNER'
    if (!isOwner) {
      let allowed = false
      if (hasActiveAssignedApiPlan && user!.apiPlanId === effectivePlanId) {
        allowed = true
      } else {
        const activePayment = await prisma.payment.findFirst({
          where: { userId: session.user.id, planId: effectivePlanId, status: 'PAID' },
          orderBy: { createdAt: 'desc' }
        })
        allowed = !!activePayment
      }
      if (!allowed) {
        return res.status(403).json({ error: 'Plano de API não ativo para o usuário. Faça um pagamento ou peça atribuição ao Owner.' })
      }
    }
 
    // Nome amigável com tipo de uso
    let computedName: string | undefined = name || undefined
    const normalizedUsage = typeof usageType === 'string' ? usageType.toUpperCase() : null
    const idLabel = typeof identifier === 'string' && identifier.trim().length > 0 ? identifier.trim() : undefined
    if (!computedName) {
      if (normalizedUsage === 'BOT' && idLabel) computedName = `bot:${idLabel}`
      else if (normalizedUsage === 'BOT') computedName = 'bot:unnamed'
      else if (normalizedUsage === 'SITE' && idLabel) computedName = `site:${idLabel}`
      else if (normalizedUsage === 'SITE') computedName = 'site:unknown'
    }
 
    const isApiProPlan = plan.name.toLowerCase().includes('api') && plan.name.toLowerCase().includes('pro')
    const rateLimit = isApiProPlan ? 120 : (plan.name.toLowerCase().includes('creator') ? 90 : 60)
 
    const apiKey = await prisma.apiKey.create({
      data: {
        key: generateApiKey(),
        userId: session.user.id,
        planId: effectivePlanId,
        name: computedName,
        monthlyGenerations: plan.maxGenerations || 0,
        rateLimit
      },
      include: {
        plan: { select: { name: true } }
      }
    })
 
    return res.json(apiKey)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
