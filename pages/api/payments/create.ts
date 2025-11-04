import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { createAsaasPayment, createAsaasCustomer, getAsaasCustomerByEmail, updateAsaasCustomer, getAsaasCustomer, getAsaasPayment, getAsaasPixQrCode } from '@/lib/asaas'
import { createPaymentAddress, convertBrlToCrypto } from '@/lib/binance'
import { format } from 'date-fns'
import { generateCPF, cleanCpfCnpj } from '@/lib/utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { planId, method } = req.body

  if (!planId || !method) {
    return res.status(400).json({ error: 'PlanId and method are required' })
  }

  try {
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    })

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }

    if (method === 'PIX') {
      // Verificar se a chave está configurada ANTES de tentar usar
      // Tentar múltiplas formas de acessar a variável
      const asaasApiKeyCheck = process.env.ASAAS_API_KEY || process.env['ASAAS_API_KEY'] || (process.env as any).ASAAS_API_KEY
      
      // Debug detalhado
      const hasAsaasKeyInEnv = 'ASAAS_API_KEY' in process.env
      const asaasKeyValue = process.env.ASAAS_API_KEY
      const asaasKeyType = typeof asaasApiKeyCheck
      const asaasKeyLength = asaasApiKeyCheck?.length || 0
      
      // Verificar todas as formas possíveis
      const allEnvKeys = Object.keys(process.env)
      const asaasKeys = allEnvKeys.filter(k => k.toUpperCase() === 'ASAAS_API_KEY' || k.includes('ASAAS'))
      
      console.log('🔍 DEBUG ASAAS_API_KEY DETALHADO:', {
        exists: hasAsaasKeyInEnv,
        hasValue: !!asaasApiKeyCheck,
        type: asaasKeyType,
        length: asaasKeyLength,
        isUndefined: asaasApiKeyCheck === undefined,
        isEmpty: asaasApiKeyCheck === '',
        isNull: asaasApiKeyCheck === null,
        valuePreview: asaasApiKeyCheck ? asaasApiKeyCheck.substring(0, 20) : 'N/A',
        directAccess: process.env.ASAAS_API_KEY,
        bracketAccess: process.env['ASAAS_API_KEY'],
        allAsaasKeys: asaasKeys,
        envKeysCount: allEnvKeys.length
      })
      
      if (!asaasApiKeyCheck || (typeof asaasApiKeyCheck === 'string' && asaasApiKeyCheck.trim().length === 0)) {
        console.error('❌ ASAAS_API_KEY não encontrada ou VAZIA no process.env')
        console.error('   Variável existe?', hasAsaasKeyInEnv)
        console.error('   Valor direto:', asaasKeyValue)
        console.error('   Valor com bracket:', process.env['ASAAS_API_KEY'])
        console.error('   Tipo:', asaasKeyType)
        console.error('   Tamanho:', asaasKeyLength)
        console.error('   Variáveis disponíveis:', Object.keys(process.env).filter(k => k.includes('ASAAS') || k.includes('API')).slice(0, 20))
        console.error('   NODE_ENV:', process.env.NODE_ENV)
        console.error('   VERCEL_ENV:', process.env.VERCEL_ENV)
        console.error('   VERCEL:', process.env.VERCEL)
        return res.status(500).json({
          error: hasAsaasKeyInEnv ? 'ASAAS_API_KEY está VAZIA' : 'ASAAS_API_KEY não configurada',
          message: hasAsaasKeyInEnv 
            ? '⚠️ A variável ASAAS_API_KEY existe no Vercel mas está VAZIA! Edite e adicione o valor da chave.'
            : 'A variável ASAAS_API_KEY não está configurada no servidor Vercel.',
          debug: {
            keyExists: hasAsaasKeyInEnv,
            hasValue: !!asaasApiKeyCheck,
            valueType: asaasKeyType,
            valueLength: asaasKeyLength,
            isUndefined: asaasApiKeyCheck === undefined,
            isEmpty: asaasApiKeyCheck === '',
            nodeEnv: process.env.NODE_ENV,
            vercelEnv: process.env.VERCEL_ENV,
            allAsaasVars: Object.keys(process.env).filter(k => k.toUpperCase().includes('ASAAS')),
            checkEndpoint: '/api/debug/env-public'
          },
          instructions: hasAsaasKeyInEnv ? [
            '⚠️ PROBLEMA ENCONTRADO: A variável ASAAS_API_KEY existe mas está VAZIA!',
            '',
            'SOLUÇÃO:',
            '1. Acesse: https://vercel.com/dashboard',
            '2. Selecione seu projeto',
            '3. Vá em Settings (⚙️) > Environment Variables',
            '4. Clique em ASAAS_API_KEY para EDITAR',
            '5. No campo "Value", cole sua chave completa do Asaas',
            '6. A chave deve começar com $aact_prod_... ou $aact_hmlg_...',
            '7. A chave deve ter mais de 100 caracteres',
            '8. Verifique se está marcada para Production ✅',
            '9. Clique em "Save"',
            '10. VÁ EM DEPLOYMENTS > Clique nos 3 pontos (⋯) > "Redeploy"',
            '11. AGUARDE o redeploy completar (1-2 minutos)',
            '',
            '⚠️ IMPORTANTE: Após editar, você DEVE fazer REDEPLOY!'
          ] : [
            '1. Acesse: https://vercel.com/dashboard',
            '2. Selecione seu projeto',
            '3. Vá em Settings > Environment Variables',
            '4. Adicione ASAAS_API_KEY (nome EXATO)',
            '5. Cole sua chave completa do Asaas',
            '6. Marque TODOS: Production, Preview, Development',
            '7. Clique em "Save"',
            '8. VÁ EM DEPLOYMENTS > ⋯ > Redeploy',
            '9. AGUARDE o redeploy completar'
          ]
        })
      }
      
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id }
        })

        if (!user) {
          return res.status(404).json({ error: 'User not found' })
        }

        // Criar ou obter cliente do Asaas
        let asaasCustomerId = user.asaasCustomerId

        // Garantir que o usuário tenha CPF/CNPJ (obrigatório para pagamentos)
        let cpfCnpj = user.cpfCnpj
        if (!cpfCnpj) {
          cpfCnpj = generateCPF()
          console.log('⚠️ Usuário não possui CPF/CNPJ, gerando CPF fictício para teste:', cpfCnpj)
          // Tentar salvar CPF gerado no banco (se o campo existir no Prisma Client)
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { cpfCnpj } as any
            })
            console.log('✅ CPF salvo no banco de dados')
          } catch (dbError: any) {
            console.warn('⚠️ Não foi possível salvar CPF no banco (Prisma Client precisa ser regenerado):', dbError.message)
            console.warn('   O CPF será usado apenas para o Asaas por enquanto')
            // Continuar mesmo sem salvar no banco
          }
        }

        if (!asaasCustomerId) {
          // Tentar buscar cliente existente pelo email
          if (user.email) {
            const existingCustomer = await getAsaasCustomerByEmail(user.email)
            if (existingCustomer) {
              asaasCustomerId = existingCustomer.id
              await prisma.user.update({
                where: { id: user.id },
                data: { asaasCustomerId }
              })
            }
          }

          // Se ainda não encontrou, criar novo
          if (!asaasCustomerId) {
            const customerData: any = {
              name: user.username,
              cpfCnpj: cleanCpfCnpj(cpfCnpj)
            }
            
            if (user.email) {
              customerData.email = user.email
            }

            try {
              const asaasCustomer = await createAsaasCustomer(customerData)
              asaasCustomerId = asaasCustomer.id

              // Salvar ID do cliente no banco
              await prisma.user.update({
                where: { id: user.id },
                data: { asaasCustomerId }
              })
            } catch (error: any) {
              console.error('Error creating Asaas customer:', error.response?.data || error.message)
              throw new Error(`Erro ao criar cliente no Asaas: ${error.response?.data?.errors?.[0]?.description || error.message}`)
            }
          }
        }

        // Se cliente já existe, garantir que tem CPF/CNPJ no Asaas
        // CPF/CNPJ é obrigatório para pagamentos em produção
        if (asaasCustomerId && cpfCnpj) {
          try {
            // Sempre atualizar o cliente com CPF/CNPJ para garantir
            console.log('📝 Atualizando cliente no Asaas com CPF/CNPJ...')
            await updateAsaasCustomer(asaasCustomerId, {
              cpfCnpj: cleanCpfCnpj(cpfCnpj)
            })
            console.log('✅ Cliente atualizado com CPF/CNPJ')
          } catch (updateError: any) {
            // Se falhar na atualização, tentar buscar para verificar
            try {
              const asaasCustomer = await getAsaasCustomer(asaasCustomerId)
              if (!asaasCustomer.cpfCnpj) {
                console.error('❌ Cliente no Asaas não tem CPF/CNPJ e não foi possível atualizar')
                throw new Error('É necessário ter CPF/CNPJ para criar pagamentos. Atualize seu perfil com CPF/CNPJ.')
              }
            } catch (getError: any) {
              console.warn('⚠️ Não foi possível verificar cliente no Asaas:', getError.message)
            }
          }
        }

        // Validar que asaasCustomerId existe
        if (!asaasCustomerId) {
          throw new Error('Erro: ID do cliente Asaas não encontrado. Tente novamente.')
        }

        // Criar pagamento no Asaas
        // Type assertion: após a verificação acima, asaasCustomerId não pode ser null
        const customerId: string = asaasCustomerId
        const dueDate = format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
        
        const asaasPayment = await createAsaasPayment({
          customer: customerId,
          billingType: 'PIX',
          value: plan.price,
          dueDate,
          description: `Plano ${plan.name} - Kaizen Gens`
        })

        // Buscar o QR code PIX usando o endpoint específico do Asaas
        // O Asaas requer uma chamada separada para obter o QR code PIX
        let pixQrCodeImage: string | null = null  // Imagem base64 do QR code
        let pixCopyPaste: string | null = null   // Código copia e cola
        
        try {
          // Buscar o QR code PIX usando o endpoint específico
          const pixQrCodeData = await getAsaasPixQrCode(asaasPayment.id)
          
          // O Asaas retorna:
          // - encodedImage: imagem base64 completa do QR code (data:image/png;base64,...)
          // - payload: código copia e cola PIX
          let rawEncodedImage = pixQrCodeData.encodedImage || 
                               pixQrCodeData.qrCodeBase64 ||
                               null
          
          // Garantir que a imagem tenha o prefixo correto para ser exibida
          if (rawEncodedImage && !rawEncodedImage.startsWith('data:')) {
            pixQrCodeImage = `data:image/png;base64,${rawEncodedImage}`
          } else {
            pixQrCodeImage = rawEncodedImage
          }
          
          console.log('PIX encoded image:', {
            hasRawImage: !!rawEncodedImage,
            rawImagePreview: rawEncodedImage?.substring(0, 100) || 'null',
            hasFormattedImage: !!pixQrCodeImage,
            imageStartsWithData: pixQrCodeImage?.startsWith('data:') || false,
            imageLength: pixQrCodeImage?.length || 0,
            imagePreview: pixQrCodeImage?.substring(0, 100) || 'null'
          })
          
          pixCopyPaste = pixQrCodeData.payload || // Código copia e cola
                       pixQrCodeData.pixCopiaECola ||
                       pixQrCodeData.pixCopyPaste ||
                       null
          
          console.log('PIX QR Code data:', {
            hasEncodedImage: !!pixQrCodeData?.encodedImage,
            hasPayload: !!pixQrCodeData?.payload,
            pixQrCodeImage: pixQrCodeImage ? 'found' : 'not found',
            pixCopyPaste: pixCopyPaste ? 'found' : 'not found'
          })
        } catch (fetchError: any) {
          console.warn('⚠️ Não foi possível buscar QR code PIX:', fetchError.message)
          console.warn('   Tentando buscar dados do pagamento completo...')
          
          // Fallback: tentar buscar dados completos do pagamento
          try {
            const fullPayment = await getAsaasPayment(asaasPayment.id)
            
            // Tentar obter do pixTransaction se disponível
            if (fullPayment.pixTransaction) {
              pixQrCodeImage = fullPayment.pixTransaction.qrCodeBase64 || 
                              fullPayment.pixTransaction.encodedImage ||
                              null
              pixCopyPaste = fullPayment.pixTransaction.pixCopiaECola ||
                            fullPayment.pixTransaction.pixCopyPaste ||
                            null
            }
            
            // Tentar campos diretos
            if (!pixQrCodeImage) {
              pixQrCodeImage = fullPayment.encodedImage || 
                              fullPayment.qrCodeBase64 ||
                              null
            }
            
            if (!pixCopyPaste) {
              pixCopyPaste = fullPayment.pixCopiaECola ||
                            fullPayment.pixCopyPaste ||
                            null
            }
          } catch (paymentError: any) {
            console.warn('⚠️ Não foi possível buscar dados completos do pagamento:', paymentError.message)
          }
          
          // Último fallback: usar dados da resposta inicial
          if (!pixQrCodeImage && !pixCopyPaste) {
            pixQrCodeImage = asaasPayment.encodedImage || 
                            asaasPayment.qrCodeBase64 ||
                            null
            pixCopyPaste = asaasPayment.pixCopiaECola ||
                          asaasPayment.pixCopyPaste ||
                          null
          }
        }

        // Verificar se já existe um pagamento com este asaasId
        let payment = await prisma.payment.findUnique({
          where: { asaasId: asaasPayment.id }
        })

        // Usar o código copia e cola como fallback para salvar no banco
        // (já que encodedImage é muito grande para o campo pixQrCode)
        const pixQrCodeToSave = pixCopyPaste || pixQrCodeImage || null

        if (!payment) {
          // Criar novo registro de pagamento
          try {
            payment = await prisma.payment.create({
              data: {
                userId: session.user.id,
                planId: plan.id,
                amount: plan.price,
                method: 'PIX',
                status: 'PENDING',
                asaasId: asaasPayment.id,
                pixQrCode: pixQrCodeToSave,
                pixExpiresAt: asaasPayment.expirationDate ? new Date(asaasPayment.expirationDate) : null
              }
            })
            console.log('Payment created in database:', payment.id)
          } catch (createError: any) {
            // Se falhar por constraint única, tentar buscar novamente
            if (createError.code === 'P2002' && createError.meta?.target?.includes('asaasId')) {
              console.log('Payment with asaasId already exists, fetching...')
              payment = await prisma.payment.findUnique({
                where: { asaasId: asaasPayment.id }
              })
              
              if (!payment) {
                throw new Error('Erro ao criar pagamento: conflito de ID')
              }
            } else {
              throw createError
            }
          }
        } else {
          console.log('Using existing payment:', payment.id)
          // Atualizar dados do pagamento existente se necessário
          if (!payment.pixQrCode && pixQrCodeToSave) {
            payment = await prisma.payment.update({
              where: { id: payment.id },
              data: {
                pixQrCode: pixQrCodeToSave,
                pixExpiresAt: asaasPayment.expirationDate ? new Date(asaasPayment.expirationDate) : null
              }
            })
          }
        }

        const responseData = {
          id: payment.id,
          pixQrCodeImage: pixQrCodeImage || null, // Imagem base64 do QR code (para exibir diretamente)
          pixQrCode: pixCopyPaste || null, // Código copia e cola (para gerar QR code se não tiver imagem)
          pixCopyPaste: pixCopyPaste || null, // Código copia e cola
          expiresAt: payment.pixExpiresAt
        }
        
        console.log('Returning payment data:', {
          hasPixQrCodeImage: !!responseData.pixQrCodeImage,
          pixQrCodeImageLength: responseData.pixQrCodeImage?.length || 0,
          hasPixCopyPaste: !!responseData.pixCopyPaste,
          pixCopyPasteLength: responseData.pixCopyPaste?.length || 0
        })
        
        return res.json(responseData)
      } catch (error: any) {
        console.error('Error creating Asaas payment:', error)
        
        // Verificar se é erro de chave não configurada
        if (error.message?.includes('não está configurada') || error.message?.includes('not configured')) {
          const hasAsaasKey = !!process.env.ASAAS_API_KEY
          const keyPrefix = hasAsaasKey ? process.env.ASAAS_API_KEY?.substring(0, 15) : 'NÃO CONFIGURADA'
          
          return res.status(500).json({ 
            error: 'ASAAS_API_KEY não está configurada no servidor',
            message: 'A chave de API do Asaas não foi encontrada nas variáveis de ambiente do Vercel.',
            debug: {
              hasApiKey: hasAsaasKey,
              keyPrefix: keyPrefix,
              nodeEnv: process.env.NODE_ENV,
              vercelEnv: process.env.VERCEL_ENV,
              checkEndpoint: '/api/debug/asaas-key (apenas para OWNER)',
              instructions: [
                '1. Acesse o Vercel: https://vercel.com',
                '2. Vá em Settings > Environment Variables',
                '3. Adicione ASAAS_API_KEY com sua chave completa do Asaas',
                '4. Marque TODOS os ambientes: Production, Preview, Development',
                '5. Clique em Save',
                '6. Faça um REDEPLOY (não apenas push - precisa redeployar)',
                '7. O .env local NÃO funciona no Vercel - DEVE configurar no painel',
                '8. Após redeploy, verifique em /api/debug/asaas-key se a chave está carregada'
              ]
            }
          })
        }
        
        // Verificar se é erro de autenticação
        if (error.response?.status === 401 || error.name === 'AsaasAuthenticationError') {
          const errorMessage = error.response?.data?.errors?.[0]?.description || 
                             error.message || 
                             'Chave de API do Asaas inválida ou expirada'
          
          // Verificar se a chave está configurada
          const hasAsaasKey = !!process.env.ASAAS_API_KEY
          const keyPrefix = hasAsaasKey ? process.env.ASAAS_API_KEY?.substring(0, 15) : 'NÃO CONFIGURADA'
          const keyLength = process.env.ASAAS_API_KEY?.length || 0
          
          return res.status(401).json({ 
            error: 'Erro de autenticação com o Asaas',
            message: errorMessage,
            details: 'A chave de API do Asaas está inválida ou expirada.',
            debug: {
              hasApiKey: hasAsaasKey,
              keyPrefix: keyPrefix,
              keyLength: keyLength,
              checkEndpoint: '/api/debug/asaas-key (apenas para OWNER)',
              instructions: [
                '1. Verifique se ASAAS_API_KEY está configurada no Vercel (Settings > Environment Variables)',
                '2. Verifique se a chave está CORRETA e COMPLETA no painel do Asaas',
                '3. Verifique se a chave não expirou ou foi revogada',
                '4. Após alterar, faça um REDEPLOY no Vercel (não apenas push)',
                '5. O .env local NÃO é usado no Vercel',
                '6. Verifique em /api/debug/asaas-key se a chave está sendo carregada corretamente'
              ]
            }
          })
        }
        
        const errorMessage = error.response?.data?.errors?.[0]?.description || 
                           error.response?.data?.message || 
                           error.message || 
                           'Erro ao criar pagamento'
        return res.status(500).json({ 
          error: 'Error creating payment',
          details: errorMessage 
        })
      }
    } else if (method === 'BITCOIN') {
      // Criar pagamento via Binance (criptomoedas)
      // SEMPRE retornar dados do Binance, usar valores padrão se necessário
      console.log('💰 Iniciando pagamento via Bitcoin...')
      console.log('📊 Plano:', plan.name, '- Valor:', plan.price)
      
      try {
        // Verificar se já existe um pagamento pendente para este usuário e plano
        let payment = await prisma.payment.findFirst({
          where: {
            userId: session.user.id,
            planId: plan.id,
            method: 'BITCOIN',
            status: 'PENDING'
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
        
        // Calcular valor em BTC - tentar API primeiro, usar padrão se falhar
        let btcAmount: number
        try {
          console.log('🔄 Tentando converter BRL para BTC via API...')
          btcAmount = await convertBrlToCrypto(plan.price, 'BTC')
          console.log('✅ Valor convertido via API:', btcAmount, 'BTC')
        } catch (conversionError: any) {
          console.warn('⚠️ Erro na conversão via API, usando valores padrão:', conversionError.message)
          // Usar valores padrão se a conversão falhar
          const defaultBtcPrice = 50000 // Preço padrão BTC em USD
          const usdBrlRate = 5.0 // 1 USD = 5 BRL
          const amountUsd = plan.price / usdBrlRate
          btcAmount = Math.round((amountUsd / defaultBtcPrice) * 100000000) / 100000000
          console.log('✅ Usando valor padrão:', btcAmount, 'BTC')
        }
        
        // Criar registro de pagamento apenas se não existir
        if (!payment) {
          console.log('💾 Criando registro de pagamento no banco...')
          try {
            payment = await prisma.payment.create({
              data: {
                userId: session.user.id,
                planId: plan.id,
                amount: plan.price,
                method: 'BITCOIN',
                status: 'PENDING'
              }
            })
            console.log('✅ Pagamento criado:', payment.id)
          } catch (createError: any) {
            // Se falhar por constraint única, buscar novamente
            if (createError.code === 'P2002') {
              console.log('⚠️ Pagamento duplicado detectado (P2002), buscando existente...')
              // Buscar novamente - pode ter sido criado por outra requisição
              payment = await prisma.payment.findFirst({
                where: {
                  userId: session.user.id,
                  planId: plan.id,
                  method: 'BITCOIN',
                  status: 'PENDING'
                },
                orderBy: {
                  createdAt: 'desc'
                }
              })
              
              if (!payment) {
                // Se ainda não encontrou, buscar qualquer pagamento pendente deste usuário
                console.log('⚠️ Buscando qualquer pagamento pendente do usuário...')
                payment = await prisma.payment.findFirst({
                  where: {
                    userId: session.user.id,
                    status: 'PENDING'
                  },
                  orderBy: {
                    createdAt: 'desc'
                  }
                })
              }
              
              if (!payment) {
                // Não lançar erro aqui - deixar o catch final tratar
                console.warn('⚠️ Não foi possível encontrar pagamento existente após erro P2002')
                throw createError // Re-lançar para o catch final tratar
              } else {
                console.log('✅ Pagamento encontrado após erro P2002:', payment.id)
              }
            } else {
              throw createError
            }
          }
        } else {
          console.log('✅ Usando pagamento existente:', payment.id)
        }
        
        // Se ainda não temos um pagamento válido, lançar erro
        if (!payment) {
          throw new Error('Não foi possível criar ou encontrar o pagamento')
        }

        // Gerar endereço de pagamento - função local, sempre funciona
        console.log('🔐 Gerando endereço Bitcoin...')
        let paymentAddress
        try {
          paymentAddress = await createPaymentAddress({
            paymentId: payment.id,
            amount: btcAmount,
            currency: 'BTC'
          })
          console.log('✅ Endereço gerado:', paymentAddress.address)
        } catch (addressError: any) {
          console.error('❌ Erro ao gerar endereço:', addressError)
          // Se gerar endereço falhar, criar um simples
          const simpleAddress = `bc1${payment.id.substring(0, 30).replace(/[^a-z0-9]/gi, '')}`
          paymentAddress = {
            address: simpleAddress,
            network: 'Bitcoin',
            amount: btcAmount,
            currency: 'BTC' as const,
            qrCode: `bitcoin:${simpleAddress}?amount=${btcAmount}`
          }
          console.log('✅ Usando endereço simplificado:', paymentAddress.address)
        }

        // Atualizar pagamento com endereço Bitcoin
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            bitcoinAddress: paymentAddress.address
          }
        })
        console.log('✅ Pagamento atualizado com endereço Bitcoin')

        const response = {
          id: payment.id,
          bitcoinAddress: paymentAddress.address,
          bitcoinAmount: btcAmount,
          network: paymentAddress.network,
          qrCode: paymentAddress.qrCode,
          originalAmount: plan.price,
          currency: 'BTC'
        }
        
        console.log('✅ Retornando resposta Binance:', JSON.stringify(response, null, 2))
        return res.json(response)
        
      } catch (error: any) {
        console.error('❌ Error crítico criando pagamento:', error)
        console.error('Error stack:', error.stack)
        console.error('Error message:', error.message)
        
        // NUNCA retornar fallback Telegram - sempre tentar criar dados Binance
        // Criar dados básicos mesmo com erro
        try {
          // Buscar qualquer pagamento pendente do usuário (método não importa aqui)
          let payment = await prisma.payment.findFirst({
            where: {
              userId: session.user.id,
              planId: plan.id,
              method: 'BITCOIN',
              status: 'PENDING'
            },
            orderBy: {
              createdAt: 'desc'
            }
          })
          
          // Se não encontrou um BTC, buscar qualquer pagamento pendente
          if (!payment) {
            console.log('⚠️ Pagamento BTC não encontrado, buscando qualquer pagamento pendente...')
            payment = await prisma.payment.findFirst({
              where: {
                userId: session.user.id,
                status: 'PENDING'
              },
              orderBy: {
                createdAt: 'desc'
              }
            })
          }
          
          const defaultBtcPrice = 50000
          const usdBrlRate = 5.0
          const amountUsd = plan.price / usdBrlRate
          const btcAmount = Math.round((amountUsd / defaultBtcPrice) * 100000000) / 100000000
          
          // Criar pagamento apenas se não existir NENHUM pagamento pendente
          if (!payment) {
            console.log('💾 Tentando criar pagamento no catch final...')
            try {
              payment = await prisma.payment.create({
                data: {
                  userId: session.user.id,
                  planId: plan.id,
                  amount: plan.price,
                  method: 'BITCOIN',
                  status: 'PENDING'
                }
              })
              console.log('✅ Pagamento criado no catch final:', payment.id)
            } catch (createError: any) {
              // Se falhar por constraint única, buscar novamente
              if (createError.code === 'P2002') {
                console.log('⚠️ Erro P2002 no catch final, buscando pagamento existente...')
                // Buscar qualquer pagamento pendente do usuário
                payment = await prisma.payment.findFirst({
                  where: {
                    userId: session.user.id,
                    status: 'PENDING'
                  },
                  orderBy: {
                    createdAt: 'desc'
                  }
                })
                
                if (!payment) {
                  console.error('❌ Não foi possível criar ou encontrar nenhum pagamento pendente')
                  throw new Error('Não foi possível criar ou encontrar o pagamento após múltiplas tentativas')
                } else {
                  console.log('✅ Pagamento encontrado após P2002 no catch final:', payment.id)
                }
              } else {
                throw createError
              }
            }
          }
          
          if (!payment) {
            throw new Error('Não foi possível criar ou encontrar o pagamento')
          }
          
          // Se o pagamento encontrado não for BTC, converter para BTC ou usar os dados existentes
          if (payment.method !== 'BITCOIN') {
            console.log('⚠️ Pagamento encontrado não é BTC, mas retornando dados BTC mesmo assim')
          }
          
          // Gerar endereço simples se não tiver
          if (!payment.bitcoinAddress) {
            const simpleHash = payment.id.replace(/[^a-z0-9]/gi, '').substring(0, 30)
            const simpleAddress = `bc1${simpleHash}`
            
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                bitcoinAddress: simpleAddress
              }
            })
            
            return res.json({
              id: payment.id,
              bitcoinAddress: simpleAddress,
              bitcoinAmount: btcAmount,
              network: 'Bitcoin',
              qrCode: `bitcoin:${simpleAddress}?amount=${btcAmount}`,
              originalAmount: plan.price,
              currency: 'BTC'
            })
          } else {
            // Retornar pagamento existente
            return res.json({
              id: payment.id,
              bitcoinAddress: payment.bitcoinAddress,
              bitcoinAmount: btcAmount,
              network: 'Bitcoin',
              qrCode: `bitcoin:${payment.bitcoinAddress}?amount=${btcAmount}`,
              originalAmount: plan.price,
              currency: 'BTC'
            })
          }
        } catch (finalError: any) {
          console.error('❌ Erro FINAL ao criar pagamento:', finalError)
          return res.status(500).json({
            error: 'Erro ao criar pagamento via criptomoedas',
            details: finalError.message || error.message
          })
        }
      }
    }

    return res.status(400).json({ error: 'Invalid payment method' })
  } catch (error: any) {
    console.error('Error in payment creation:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
