import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // Verificar autenticação e permissão
        const session = await getServerSession(req, res, authOptions)
        if (!session || session.user.role !== 'OWNER') {
            return res.status(403).json({ error: 'Não autorizado' })
        }

        if (req.method === 'GET') {
            // Buscar serviços com problema (URL no nome)
            const services = await prisma.service.findMany()
            const problematic = services.filter(s => s.name.includes('http') || s.name.includes('//'))

            return res.json({
                total: services.length,
                problematic: problematic.map(s => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    icon: s.icon
                }))
            })
        }

        if (req.method === 'POST') {
            const { serviceId, newName, newDescription, newIcon } = req.body

            if (!serviceId || !newName) {
                return res.status(400).json({ error: 'serviceId e newName são obrigatórios' })
            }

            // Atualizar serviço
            const updated = await prisma.service.update({
                where: { id: serviceId },
                data: {
                    name: newName,
                    description: newDescription || null,
                    icon: newIcon || null
                }
            })

            return res.json({
                success: true,
                service: {
                    id: updated.id,
                    name: updated.name,
                    description: updated.description,
                    icon: updated.icon
                }
            })
        }

        return res.status(405).json({ error: 'Método não permitido' })
    } catch (error: any) {
        console.error('Erro em fix-service-names:', error)
        return res.status(500).json({ error: error.message || 'Erro interno' })
    } finally {
        await prisma.$disconnect()
    }
}
