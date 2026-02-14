// Script para verificar configurações SMTP
// Execute: node scripts/check-smtp-config.js

console.log('🔍 Verificando configurações SMTP...\n')

// Lista de variáveis SMTP necessárias
const smtpVars = [
  'SMTP_HOST',
  'SMTP_PORT', 
  'SMTP_USER',
  'SMTP_PASS'
]

console.log('📋 Status das variáveis SMTP:')
smtpVars.forEach(varName => {
  const value = process.env[varName]
  const status = value ? '✅ Configurada' : '❌ Ausente'
  const displayValue = varName === 'SMTP_PASS' 
    ? (value ? '••••••••' : 'N/A')
    : (value || 'N/A')
  
  console.log(`${varName}: ${displayValue} ${status}`)
})

console.log('\n📧 Configuração atual:')
console.log(`Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`)
console.log(`Port: ${process.env.SMTP_PORT || '587'}`)
console.log(`User: ${process.env.SMTP_USER || 'Não configurado'}`)
console.log(`Pass: ${process.env.SMTP_PASS ? '••••••••' : 'Não configurado'}`)

// Verificar se é Gmail
if (process.env.SMTP_USER?.includes('@gmail.com')) {
  console.log('\n⚠️  Configuração Gmail detectada!')
  console.log('1. Verifique se a verificação em 2 etapas está ativada')
  console.log('2. Gere uma senha de app em: https://myaccount.google.com/apppasswords')
  console.log('3. Use a senha de app no campo SMTP_PASS')
}

console.log('\n🌐 Para testar, acesse:')
console.log('http://localhost:3000/api/profile/email/test-smtp')