/**
 * Gera um CPF válido (apenas para fins de teste)
 * ATENÇÃO: Este CPF é fictício e não deve ser usado em produção real
 */
export function generateCPF(): string {
  // Gerar 9 dígitos aleatórios
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  
  // Calcular primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i)
  }
  let firstDigit = 11 - (sum % 11)
  if (firstDigit >= 10) firstDigit = 0
  digits.push(firstDigit)
  
  // Calcular segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i)
  }
  let secondDigit = 11 - (sum % 11)
  if (secondDigit >= 10) secondDigit = 0
  digits.push(secondDigit)
  
  // Formatar como CPF (000.000.000-00)
  return digits.join('').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Remove formatação de CPF/CNPJ (remove pontos, traços e barras)
 */
export function cleanCpfCnpj(cpfCnpj: string): string {
  return cpfCnpj.replace(/[.\-\/]/g, '')
}

