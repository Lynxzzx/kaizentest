
import { PrismaClient } from '@prisma/client'
import { getCooldownRemaining } from '../lib/generation-protection'

const prisma = new PrismaClient()

async function main() {
    console.log('🧪 Starting DB Cooldown Verification...')

    // 1. Create dependencies
    console.log('📦 Creating dummy User, Service, and Stock...')

    const user = await prisma.user.create({
        data: {
            username: `test-cooldown-${Date.now()}`,
            password: 'hash',
            email: `test-${Date.now()}@example.com`
        }
    })

    // Check initial cooldown
    const initialCooldown = await getCooldownRemaining(user.id)
    console.log(`1️⃣ Cooldown before generation: ${initialCooldown}s (Expected: 0)`)

    const service = await prisma.service.create({
        data: {
            name: 'Test Service',
            description: 'Test',
            icon: '🧪'
        }
    })

    const stock = await prisma.stock.create({
        data: {
            serviceId: service.id,
            username: 'test-stock-user',
            password: 'test-stock-pass',
            isUsed: true
        }
    })

    // 2. Simulate generation
    console.log('⚡ Simulating account generation (inserting into DB)...')
    // We manually specify createdAt to be NOW
    await prisma.generatedAccount.create({
        data: {
            userId: user.id,
            stockId: stock.id,
            createdAt: new Date()
        }
    })

    // 3. Check cooldown
    const cooldownAfter = await getCooldownRemaining(user.id)
    console.log(`2️⃣ Cooldown after generation: ${cooldownAfter}s (Expected: ~120)`)

    if (cooldownAfter > 0) {
        console.log('✅ Cooldown active!')
    } else {
        console.error('❌ Failed: Cooldown should be active (> 0) after generation.')
    }

    // 4. Verify persistence
    console.log('🔄 Verifying persistence (DB query)...')
    const cooldownAgain = await getCooldownRemaining(user.id)
    console.log(`3️⃣ Cooldown check again: ${cooldownAgain}s`)

    if (cooldownAgain > 0) {
        console.log('✅ Persistence verified!')
    } else {
        console.error('❌ Failed: Cooldown persistence check failed.')
        process.exit(1)
    }

    // Cleanup
    console.log('🧹 Cleaning up...')
    await prisma.generatedAccount.deleteMany({ where: { userId: user.id } })
    await prisma.stock.delete({ where: { id: stock.id } })
    await prisma.service.delete({ where: { id: service.id } })
    await prisma.user.delete({ where: { id: user.id } })
    console.log('✨ Done.')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
