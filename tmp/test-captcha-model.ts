
import { prisma } from './lib/prisma';
import crypto from 'crypto';

async function testCaptcha() {
  console.log('Testing CaptchaChallenge creation...');
  try {
    const id = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    const result = await prisma.captchaChallenge.create({
      data: {
        id,
        code: 'TEST12',
        attempts: 0,
        expiresAt
      }
    });
    
    console.log('✅ Successfully created captcha challenge:', result);
    
    const count = await prisma.captchaChallenge.count();
    console.log('Current captcha count:', count);
    
    await prisma.captchaChallenge.delete({ where: { id } });
    console.log('✅ Successfully cleaned up test captcha');
  } catch (error: any) {
    console.error('❌ Error testing captcha:', error);
    if (error.code === 'P2021') {
      console.error('MODEL NOT FOUND IN DB - Need to run npx prisma db push');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testCaptcha();
