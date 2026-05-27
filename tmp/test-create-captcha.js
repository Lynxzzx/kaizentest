
const { createCaptcha } = require('./lib/captcha');

async function testCreate() {
  console.log('Testing createCaptcha...');
  try {
    const result = await createCaptcha();
    console.log('✅ id:', result.id);
    console.log('✅ svg length:', result.svg.length);
    console.log('✅ dataUrl starts with:', result.dataUrl.substring(0, 30));
  } catch (error) {
    console.error('❌ Error in createCaptcha:', error);
  } finally {
    process.exit();
  }
}

testCreate();
