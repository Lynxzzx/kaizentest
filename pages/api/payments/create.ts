import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { createAsaasPayment, createAsaasCustomer, getAsaasCustomerByEmail, updateAsaasCustomer, getAsaasCustomer, getAsaasPayment, getAsaasPixQrCode } from '@/lib/asaas'
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
      // Criar registro de pagamento com link do Telegram
      const telegramLink = `https://t.me/lynxdevz`
      
      const payment = await prisma.payment.create({
        data: {
          userId: session.user.id,
          planId: plan.id,
          amount: plan.price,
          method: 'BITCOIN',
          status: 'PENDING',
          telegramLink
        }
      })

      return res.json({
        id: payment.id,
        telegramLink,
        message: 'Contact lynxdevz on Telegram to complete payment'
      })
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
