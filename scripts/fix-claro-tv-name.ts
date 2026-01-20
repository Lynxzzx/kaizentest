import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        console.log('🔍 Procurando serviço com URL no nome...')

        // Buscar serviço que tem URL no nome
        const services = await prisma.service.findMany()

        for (const service of services) {
            if (service.name.includes('http') || service.name.includes('play.google.com')) {
                console.log(`\n❌ Encontrado serviço com problema:`)
                console.log(`   ID: ${service.id}`)
                console.log(`   Nome atual: ${service.name}`)
                console.log(`   Descrição: ${service.description}`)
                console.log(`   Icon: ${service.icon}`)

                // Corrigir para ClaroTV
                const updated = await prisma.service.update({
                    where: { id: service.id },
                    data: {
                        name: 'ClaroTV',
                        description: 'Claro TV - Streaming de TV ao vivo e on demand',
                        icon: '📺' // ou pode usar um emoji/URL diferente
                    }
                })

                console.log(`\n✅ Serviço corrigido com sucesso!`)
                console.log(`   Novo nome: ${updated.name}`)
                console.log(`   Nova descrição: ${updated.description}`)
                console.log(`   Novo ícone: ${updated.icon}`)
            }
        }

        console.log('\n✨ Verificação completa!')

    } catch (error) {
        console.error('❌ Erro:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
