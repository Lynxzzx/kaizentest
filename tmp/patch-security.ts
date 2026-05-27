
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'lib/security.ts');
let content = fs.readFileSync(filePath, 'utf8');

const registerTarget = `    // reCAPTCHA v3 passou - sucesso!
  } else if (process.env.RECAPTCHA_SECRET_KEY && process.env.NODE_ENV === 'production') {
    // reCAPTCHA obrigatório em produção se configurado
    return {
      allowed: false,
      reason: 'Verificação de segurança obrigatória.',
      warnings: [],
      botScore: 50
    }
  }`;

const registerReplacement = `    // reCAPTCHA v3 passou - sucesso!
  } else if (data.captchaId && data.captchaCode) {
    // Fallback: Validar CAPTCHA Visual
    const captchaResult = await validateCaptcha(data.captchaId, data.captchaCode)
    if (!captchaResult.valid) {
      await logSecurityEvent({
        type: 'bot_detected',
        ip,
        userAgent,
        username: data.username,
        success: false,
        reason: \`CAPTCHA Visual falhou: \${captchaResult.error}\`
      })

      return {
        allowed: false,
        reason: captchaResult.error || 'Verificação de segurança falhou.',
        warnings: [],
        botScore: 40
      }
    }
    // CAPTCHA Visual passou!
  } else if (process.env.RECAPTCHA_SECRET_KEY && process.env.NODE_ENV === 'production') {
    // reCAPTCHA obrigatório em produção se configurado
    return {
      allowed: false,
      reason: 'Verificação de segurança obrigatória.',
      warnings: [],
      botScore: 50
    }
  }`;

// Note: Using replace multiple times for each instance
content = content.replace(registerTarget, registerReplacement);

// For the login part (identical logic but different context if needed, but here it's the same block)
// Actually, since I'm using replace without 'g', I can do it twice.
content = content.replace(registerTarget, registerReplacement.replace('CAPTCHA Visual falhou:', 'CAPTCHA Visual falhou (login):'));

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched lib/security.ts');
