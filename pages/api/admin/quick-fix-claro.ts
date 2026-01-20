import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // Verificar autenticação
        const session = await getServerSession(req, res, authOptions)
        if (!session || session.user.role !== 'OWNER') {
            return res.status(403).json({ error: 'Não autorizado' })
        }

        // Buscar todos os serviços
        const services = await prisma.service.findMany()

        const results = []

        for (const service of services) {
            // Verificar se tem URL no nome
            if (service.name.includes('http') || service.name.includes('play.google.com') || service.name.includes('//')) {
                console.log(`Corrigindo serviço: ${service.name}`)

                // Determinar o nome correto
                let correctName = 'ClaroTV'
                let correctDescription = 'Claro TV - Streaming de TV ao vivo e on demand'
                let correctIcon = '📺'

                if (service.name.includes('Claro') || service.name.includes('netcombo')) {
                    correctName = 'ClaroTV'
                    correctDescription = 'Claro TV - Streaming de TV ao vivo e on demand'
                    correctIcon = '📺'
                } else if (service.name.includes('netflix')) {
                    correctName = 'Netflix'
                    correctDescription = 'Netflix - Filmes e séries online'
                    correctIcon = '🎬'
                } else if (service.name.includes('spotify')) {
                    correctName = 'Spotify'
                    correctDescription = 'Spotify - Música para todos'
                    correctIcon = '🎵'
                }

                // Corrigir o serviço
                const updated = await prisma.service.update({
                    where: { id: service.id },
                    data: {
                        name: correctName,
                        description: service.description || correctDescription,
                        icon: service.icon || correctIcon
                    }
                })

                results.push({
                    id: updated.id,
                    oldName: service.name,
                    newName: updated.name,
                    description: updated.description,
                    icon: updated.icon
                })
            }
        }

        if (results.length === 0) {
            return res.json({
                success: true,
                message: 'Nenhum serviço com problema encontrado',
                fixed: []
            })
        }

        return res.json({
            success: true,
            message: `${results.length} serviço(s) corrigido(s) com sucesso!`,
            fixed: results
        })

    } catch (error: any) {
        console.error('Erro ao corrigir serviços:', error)
        return res.status(500).json({
            error: error.message || 'Erro interno',
            stack: error.stack
        })
    } finally {
        await prisma.$disconnect()
    }
}
