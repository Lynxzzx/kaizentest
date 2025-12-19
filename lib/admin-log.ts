import { prisma } from '@/lib/prisma'
import { AdminAction } from '@prisma/client'

interface LogOptions {
  userId: string
  action: AdminAction
  targetType?: string
  targetId?: string
  targetName?: string
  details?: Record<string, any>
  ipAddress?: string
}

/**
 * Registra uma ação administrativa no log
 * Apenas OWNER pode visualizar estes logs
 */
export async function logAdminAction(options: LogOptions): Promise<void> {
  try {
    await prisma.adminLog.create({
      data: {
        userId: options.userId,
        action: options.action,
        targetType: options.targetType,
        targetId: options.targetId,
        targetName: options.targetName,
        details: options.details ? JSON.stringify(options.details) : null,
        ipAddress: options.ipAddress
      }
    })
  } catch (error) {
    // Não bloquear a operação principal se o log falhar
    console.error('Erro ao registrar log de admin:', error)
  }
}

/**
 * Obtém o IP do request
 */
export function getIpFromRequest(req: any): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded 
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.socket?.remoteAddress
  return ip
}

/**
 * Formata a descrição da ação para exibição
 */
export function formatAdminAction(action: AdminAction): string {
  const actionLabels: Record<AdminAction, string> = {
    USER_BAN: 'Banir usuário',
    USER_UNBAN: 'Desbanir usuário',
    USER_SET_PLAN: 'Definir plano',
    USER_SET_ROLE: 'Alterar cargo',
    USER_DELETE: 'Deletar usuário',
    USER_EDIT: 'Editar usuário',
    PLAN_CREATE: 'Criar plano',
    PLAN_EDIT: 'Editar plano',
    PLAN_DELETE: 'Deletar plano',
    SERVICE_CREATE: 'Criar serviço',
    SERVICE_EDIT: 'Editar serviço',
    SERVICE_DELETE: 'Deletar serviço',
    STOCK_ADD: 'Adicionar estoque',
    STOCK_DELETE: 'Deletar estoque',
    KEY_CREATE: 'Criar chave',
    KEY_DELETE: 'Deletar chave',
    COUPON_CREATE: 'Criar cupom',
    COUPON_EDIT: 'Editar cupom',
    COUPON_DELETE: 'Deletar cupom',
    RAFFLE_CREATE: 'Criar sorteio',
    RAFFLE_EDIT: 'Editar sorteio',
    RAFFLE_DELETE: 'Deletar sorteio',
    RAFFLE_DRAW: 'Sortear vencedor',
    WITHDRAWAL_APPROVE: 'Aprovar saque',
    WITHDRAWAL_REJECT: 'Rejeitar saque',
    CONFIG_UPDATE: 'Atualizar configuração',
    OTHER: 'Outra ação'
  }
  return actionLabels[action] || action
}

/**
 * Obtém a cor do badge baseado na ação
 */
export function getActionColor(action: AdminAction): string {
  if (action.includes('DELETE') || action.includes('BAN') || action.includes('REJECT')) {
    return 'red'
  }
  if (action.includes('CREATE') || action.includes('ADD') || action.includes('APPROVE') || action.includes('UNBAN')) {
    return 'green'
  }
  if (action.includes('EDIT') || action.includes('UPDATE') || action.includes('SET')) {
    return 'yellow'
  }
  return 'blue'
}

