import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import axios from 'axios'
import { prisma } from '@/lib/prisma'

// Função para obter o token do PagSeguro
async function getPagSeguroKey(): Promise<string> {
    const PAGSEGURO_APP_KEY = process.env.PAGSEGURO_APP_KEY
    const PAGSEGURO_TOKEN = process.env.PAGSEGURO_TOKEN
    let key = PAGSEGURO_APP_KEY || PAGSEGURO_TOKEN

    if (!key || key.trim().length === 0) {
        try {
            let config = await prisma.systemConfig.findUnique({ where: { key: 'PAGSEGURO_APP_KEY' } })
            if (config?.value?.trim()) {
                key = config.value.trim()
            } else {
                config = await prisma.systemConfig.findUnique({ where: { key: 'PAGSEGURO_TOKEN' } })
                if (config?.value?.trim()) key = config.value.trim()
            }
        } catch (e) { }
    }

    if (!key || key.trim().length === 0) {
        throw new Error('PAGSEGURO_TOKEN não está configurado')
    }
    return key.trim()
}

// Função para obter a URL da API
async function getPagSeguroApiUrl(): Promise<string> {
    let customUrl = process.env.PAGSEGURO_API_URL
    if (!customUrl || customUrl.trim().length === 0) {
        try {
            const config = await prisma.systemConfig.findUnique({ where: { key: 'PAGSEGURO_API_URL' } })
            if (config?.value?.trim()) customUrl = config.value.trim()
        } catch (e) { }
    }
    if (customUrl && customUrl.trim().length > 0) {
        try { new URL(customUrl.trim()); return customUrl.trim() } catch (e) { }
    }

    // Checar sandbox
    let isSandbox = false
    try {
        const config = await prisma.systemConfig.findUnique({ where: { key: 'PAGSEGURO_SANDBOX' } })
        if (config?.value?.trim()) isSandbox = config.value.trim().toLowerCase() === 'true'
        else {
            const envSandbox = process.env.PAGSEGURO_SANDBOX
            if (envSandbox) isSandbox = envSandbox.trim().toLowerCase() === 'true'
        }
    } catch (e) {
        const envSandbox = process.env.PAGSEGURO_SANDBOX
        if (envSandbox) isSandbox = envSandbox.trim().toLowerCase() === 'true'
    }

    return isSandbox ? 'https://sandbox.api.pagseguro.com' : 'https://api.pagseguro.com'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const session = await getServerSession(req, res, authOptions)
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
        // 1. Checar se já temos a chave pública salva
        let publicKey = process.env.PAGSEGURO_PUBLIC_KEY

        if (!publicKey || publicKey.trim().length === 0) {
            try {
                const config = await prisma.systemConfig.findUnique({ where: { key: 'PAGSEGURO_PUBLIC_KEY' } })
                if (config?.value?.trim()) {
                    publicKey = config.value.trim()
                }
            } catch (e) { }
        }

        // 2. Se já temos, retornar
        if (publicKey && publicKey.trim().length > 10) {
            return res.status(200).json({ publicKey: publicKey.trim() })
        }

        // 3. Se não temos, buscar/criar via API do PagBank
        const token = await getPagSeguroKey()
        const apiUrl = await getPagSeguroApiUrl()

        console.log('🔑 Buscando chave pública do PagBank...')

        // Primeiro tentar consultar chave existente
        try {
            const getResponse = await axios.get(`${apiUrl}/public-keys/card`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (getResponse.data?.public_key) {
                publicKey = getResponse.data.public_key
                console.log('✅ Chave pública encontrada via GET /public-keys/card')
            }
        } catch (getError: any) {
            console.log('⚠️ GET /public-keys/card falhou, tentando criar nova chave...')

            // Criar nova chave pública
            try {
                const createResponse = await axios.post(`${apiUrl}/public-keys`, {
                    type: 'card'
                }, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })

                if (createResponse.data?.public_key) {
                    publicKey = createResponse.data.public_key
                    console.log('✅ Nova chave pública criada via POST /public-keys')
                }
            } catch (createError: any) {
                console.error('❌ Erro ao criar chave pública:', createError.response?.data || createError.message)
                return res.status(500).json({
                    error: 'Não foi possível obter a chave pública do PagBank',
                    details: createError.response?.data?.error_messages || createError.message
                })
            }
        }

        if (!publicKey || publicKey.trim().length === 0) {
            return res.status(500).json({ error: 'Chave pública do PagBank não disponível' })
        }

        // 4. Salvar no SystemConfig para cache
        try {
            await prisma.systemConfig.upsert({
                where: { key: 'PAGSEGURO_PUBLIC_KEY' },
                update: { value: publicKey.trim() },
                create: {
                    key: 'PAGSEGURO_PUBLIC_KEY',
                    value: publicKey.trim(),
                    description: 'Chave pública do PagBank para criptografia de cartão (gerada automaticamente)'
                }
            })
            console.log('💾 Chave pública salva no SystemConfig')
        } catch (saveError: any) {
            console.warn('⚠️ Não foi possível salvar chave pública no banco:', saveError.message)
        }

        return res.status(200).json({ publicKey: publicKey.trim() })

    } catch (error: any) {
        console.error('❌ Erro ao obter chave pública:', error.message)
        return res.status(500).json({
            error: 'Erro ao obter chave pública do PagBank',
            message: error.message
        })
    }
}
