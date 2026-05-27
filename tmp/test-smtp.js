
const nodemailer = require('nodemailer')
require('dotenv').config()

const smtpPort = parseInt(process.env.SMTP_PORT || '587')
const isSSL = smtpPort === 465

const isGmail = process.env.SMTP_USER?.includes('@gmail.com')
const gmailConfig = isGmail && isSSL ? {
  service: 'gmail', // Usar serviço predefinido do Gmail
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
} : {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: isSSL, // true para SSL (465), false para TLS (587)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}

console.log('Testing SMTP with config:', {
  host: gmailConfig.host || 'gmail-service',
  port: gmailConfig.port || 'default',
  secure: gmailConfig.secure || 'default',
  user: gmailConfig.auth.user ? 'SET' : 'NOT SET',
  pass: gmailConfig.auth.pass ? 'SET' : 'NOT SET'
})

const transporter = nodemailer.createTransport({
  ...gmailConfig,
  logger: true,
  debug: true
})

transporter.verify(function (error, success) {
  if (error) {
    console.error('SMTP Connection Error:');
    console.error(error);
  } else {
    console.log('SMTP Server is ready to take our messages');
  }
});
