/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ['pt-BR', 'en', 'es'],
    defaultLocale: 'pt-BR',
    localeDetection: true,
  },
  images: {
    domains: [],
  },
}

module.exports = nextConfig
