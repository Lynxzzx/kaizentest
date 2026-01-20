import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const session = await getServerSession(req, res, authOptions)
        if (!session || session.user.role !== 'OWNER') {
            return res.status(403).json({ error: 'Não autorizado' })
        }

        // Buscar TODOS os serviços
        const allServices = await prisma.service.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                icon: true
            }
        })

        // Encontrar serviços com URL no nome
        const problematicServices = allServices.filter(s =>
            s.name && (s.name.includes('http') || s.name.includes('//') || s.name.includes('play.google.com'))
        )

        if (problematicServices.length === 0) {
            return res.json({
                success: true,
                message: 'Nenhum serviço com problema encontrado',
                allServices: allServices.map(s => ({ id: s.id, name: s.name }))
            })
        }

        // Corrigir cada serviço
        const fixed = []
        for (const service of problematicServices) {
            const updated = await prisma.service.update({
                where: { id: service.id },
                data: {
                    name: 'ClaroTV',
                    description: service.description || 'Claro TV+ - Streaming de TV ao vivo',
                    icon: service.icon || '📺'
                }
            })

            fixed.push({
                id: updated.id,
                oldName: service.name,
                newName: updated.name
            })
        }

        return res.json({
            success: true,
            message: `${fixed.length} serviço(s) corrigido(s)!`,
            fixed
        })

    } catch (error: any) {
        console.error('Erro:', error)
        return res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        })
    }
}
