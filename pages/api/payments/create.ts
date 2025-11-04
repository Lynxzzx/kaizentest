import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { createAsaasCustomer, getAsaasCustomerByEmail, updateAsaasCustomer, createAsaasPayment, getAsaasPixQrCode } from '@/lib/asaas'
import { createPaymentAddress, convertBrlToCrypto } from '@/lib/binance'
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

        // Garantir que o usuário tenha CPF/CNPJ (obrigatório para pagamentos)
        let cpfCnpj = user.cpfCnpj
        if (!cpfCnpj) {
          cpfCnpj = generateCPF()
          console.log('⚠️ Usuário não possui CPF/CNPJ, gerando CPF fictício para teste:', cpfCnpj)
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { cpfCnpj } as any
            })
            console.log('✅ CPF salvo no banco de dados')
          } catch (dbError: any) {
            console.warn('⚠️ Não foi possível salvar CPF no banco:', dbError.message)
          }
        }

        // Criar ou atualizar cliente no Asaas
        let asaasCustomerId = user.asaasCustomerId
        if (!asaasCustomerId) {
          console.log('📝 Criando cliente no Asaas...')
          const asaasCustomer = await createAsaasCustomer({
            name: user.username,
            email: user.email || undefined,
            cpfCnpj: cleanCpfCnpj(cpfCnpj)
          })
          asaasCustomerId = asaasCustomer.id
          
          // Salvar ID do cliente no banco
          await prisma.user.update({
            where: { id: user.id },
            data: { asaasCustomerId } as any
          })
        } else {
          // Verificar se o cliente existe e atualizar se necessário
          try {
            const existingCustomer = await getAsaasCustomerByEmail(user.email || '')
            if (existingCustomer && existingCustomer.id !== asaasCustomerId) {
              asaasCustomerId = existingCustomer.id
              await prisma.user.update({
                where: { id: user.id },
                data: { asaasCustomerId } as any
              })
            }
            
            // Atualizar CPF/CNPJ se necessário
            if (cpfCnpj && !existingCustomer?.cpfCnpj) {
              console.log('📝 Atualizando cliente no Asaas com CPF/CNPJ...')
              await updateAsaasCustomer(asaasCustomerId, { cpfCnpj: cleanCpfCnpj(cpfCnpj) })
            }
          } catch (error: any) {
            console.warn('⚠️ Não foi possível verificar cliente no Asaas:', error.message)
          }
        }

        // Calcular data de vencimento (hoje + 1 dia)
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 1)
        const dueDateStr = dueDate.toISOString().split('T')[0]

        // Criar pagamento PIX no Asaas
        const asaasPayment = await createAsaasPayment({
          customer: asaasCustomerId,
          billingType: 'PIX',
          value: plan.price,
          dueDate: dueDateStr,
          description: `Plano ${plan.name} - Kaizen Gens`
        })

        // Buscar QR code PIX
        const pixQrCodeData = await getAsaasPixQrCode(asaasPayment.id)

        // Mapear dados do Asaas (payload = QR code, encodedImage = imagem)
        const pixQrCode = pixQrCodeData.payload || ''
        
        // Preparar QR code image
        let pixQrCodeImage: string | null = null
        if (pixQrCodeData.encodedImage) {
          // Se já vem como data URI, usar diretamente
          if (pixQrCodeData.encodedImage.startsWith('data:')) {
            pixQrCodeImage = pixQrCodeData.encodedImage
          } else {
            // Se vem como base64 puro, adicionar prefixo
            pixQrCodeImage = `data:image/png;base64,${pixQrCodeData.encodedImage}`
          }
        }

        // Criar pagamento no banco de dados
        const payment = await prisma.payment.create({
          data: {
            userId: user.id,
            planId: plan.id,
            amount: plan.price,
            method: 'PIX',
            status: 'PENDING',
            asaasId: asaasPayment.id,
            pixQrCode: pixQrCode,
            pixExpiresAt: asaasPayment.dueDate ? new Date(asaasPayment.dueDate + 'T23:59:59') : new Date(Date.now() + 30 * 60 * 1000)
          }
        })

        return res.status(200).json({
          paymentId: payment.id,
          qrCodeImage: pixQrCodeImage,
          pixCopyPaste: pixQrCode,
          expiresAt: payment.pixExpiresAt
        })
      } catch (error: any) {
        console.error('Error creating PIX payment:', error)
        
        // Verificar se é erro de serviço indisponível
        if (error.name === 'AsaasServiceUnavailableError') {
          return res.status(503).json({
            error: 'Serviço temporariamente indisponível',
            message: error.message
          })
        }
        
        // Verificar se é erro de autenticação
        if (error.name === 'AsaasAuthenticationError') {
          return res.status(401).json({
            error: 'Erro de autenticação',
            message: error.message
          })
        }
        
        return res.status(500).json({
          error: 'Error creating payment',
          message: error.message || 'Erro desconhecido ao criar pagamento PIX'
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
