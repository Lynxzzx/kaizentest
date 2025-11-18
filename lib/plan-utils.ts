import { prisma } from './prisma'

/**
 * Verifica se um usuário tem um plano ativo
 * Um plano é considerado ativo se:
 * 1. O usuário tem um planId definido
 * 2. E (não tem data de expiração OU a data de expiração é MAIOR que agora)
 * 
 * @param userId ID do usuário
 * @param planId ID do plano (opcional, se não fornecido busca do usuário)
 * @param planExpiresAt Data de expiração (opcional, se não fornecido busca do usuário)
 * @returns true se o plano está ativo, false caso contrário
 */
export function isUserPlanActive(
  planId: string | null | undefined,
  planExpiresAt: Date | null | undefined
): boolean {
  // Se não tem plano, não está ativo
  if (!planId) {
    return false
  }

  // Se não tem data de expiração, é plano vitalício (sempre ativo)
  if (!planExpiresAt) {
    return true
  }

  // Verifica se a data de expiração é MAIOR que agora (ainda não expirou)
  const now = new Date()
  return planExpiresAt > now
}

/**
 * Remove planos expirados do banco de dados
 * Define planId e planExpiresAt como null para usuários com planos expirados
 * 
 * @returns Número de usuários atualizados
 */
export async function cleanExpiredPlans(): Promise<number> {
  const now = new Date()
  
  try {
    // Busca usuários com planos expirados
    const expiredUsers = await prisma.user.findMany({
      where: {
        planId: { not: null },
        planExpiresAt: {
          not: null,
          lt: now // Menor que agora = expirado
        }
      },
      select: {
        id: true,
        username: true,
        planId: true,
        planExpiresAt: true
      }
    })

    if (expiredUsers.length === 0) {
      console.log('✅ Nenhum plano expirado encontrado')
      return 0
    }

    console.log(`🔍 Encontrados ${expiredUsers.length} planos expirados:`)
    expiredUsers.forEach(user => {
      console.log(`   - Usuário: ${user.username} (${user.id}) - Expirou em: ${user.planExpiresAt?.toISOString()}`)
    })

    // Remove os planos expirados (define como null)
    const result = await prisma.user.updateMany({
      where: {
        planId: { not: null },
        planExpiresAt: {
          not: null,
          lt: now
        }
      },
      data: {
        planId: null,
        planExpiresAt: null
      }
    })

    console.log(`✅ ${result.count} planos expirados removidos com sucesso`)
    return result.count

  } catch (error) {
    console.error('❌ Erro ao limpar planos expirados:', error)
    throw error
  }
}

/**
 * Verifica e limpa o plano de um usuário específico se estiver expirado
 * 
 * @param userId ID do usuário
 * @returns true se o plano foi removido, false caso contrário
 */
export async function checkAndCleanUserPlan(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        planId: true,
        planExpiresAt: true
      }
    })

    if (!user || !user.planId) {
      return false
    }

    // Se é plano vitalício, não fazer nada
    if (!user.planExpiresAt) {
      return false
    }

    // Verifica se está expirado
    const now = new Date()
    if (user.planExpiresAt <= now) {
      console.log(`🔄 Removendo plano expirado do usuário ${user.username} (${user.id})`)
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          planId: null,
          planExpiresAt: null
        }
      })

      console.log(`✅ Plano removido com sucesso`)
      return true
    }

    return false
  } catch (error) {
    console.error('❌ Erro ao verificar e limpar plano do usuário:', error)
    throw error
  }
}

