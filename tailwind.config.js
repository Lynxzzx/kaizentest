/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Kaizen Aurora palette
        obsidian: {
          950: '#040407',
          900: '#06060c',
          800: '#0a0a13',
          700: '#101020',
          600: '#16162a',
          500: '#1d1d36',
          400: '#26264a'
        },
        aurora: {
          violet: '#a78bfa',
          magenta: '#e879f9',
          cyan: '#22d3ee',
          mint: '#34d399',
          gold: '#fbbf24',
          rose: '#fb7185'
        },
        primary: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95'
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Outfit', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace']
      },
      fontSize: {
        '10xl': ['10rem', { lineHeight: '0.9', letterSpacing: '-0.05em' }],
        '11xl': ['12rem', { lineHeight: '0.9', letterSpacing: '-0.06em' }]
      },
      backgroundImage: {
        'aurora-mesh': 'radial-gradient(at 27% 37%, rgba(167,139,250,0.18) 0px, transparent 50%), radial-gradient(at 97% 21%, rgba(34,211,238,0.12) 0px, transparent 50%), radial-gradient(at 52% 99%, rgba(232,121,249,0.12) 0px, transparent 50%), radial-gradient(at 10% 90%, rgba(251,191,36,0.06) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(52,211,153,0.08) 0px, transparent 50%)',
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.15 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glow-violet': '0 0 60px -10px rgba(167, 139, 250, 0.5)',
        'glow-cyan': '0 0 60px -10px rgba(34, 211, 238, 0.4)',
        'glow-gold': '0 0 60px -10px rgba(251, 191, 36, 0.4)',
        'card': '0 10px 40px -10px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255,255,255,0.04)',
        'card-hover': '0 20px 60px -10px rgba(124, 58, 237, 0.25), inset 0 1px 0 0 rgba(255,255,255,0.06)',
        'inset-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 32px 0 rgba(167,139,250,0.04)'
      },
      animation: {
        'aurora': 'aurora 20s ease infinite',
        'aurora-fast': 'aurora 8s ease infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'marquee': 'marquee 40s linear infinite',
        'marquee-slow': 'marquee 60s linear infinite',
        'float-slow': 'floatSlow 12s ease-in-out infinite',
        'gradient-x': 'gradientX 8s ease infinite',
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scaleIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'spin-slow': 'spin 20s linear infinite'
      },
      keyframes: {
        aurora: {
          '0%, 100%': { transform: 'translate(0%, 0%) rotate(0deg) scale(1)' },
          '25%':       { transform: 'translate(2%, -3%) rotate(2deg) scale(1.05)' },
          '50%':       { transform: 'translate(-2%, 2%) rotate(-2deg) scale(0.97)' },
          '75%':       { transform: 'translate(3%, 1%) rotate(1deg) scale(1.03)' }
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.5', filter: 'blur(40px)' },
          '50%':       { opacity: '1', filter: 'blur(60px)' }
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%':       { transform: 'translateY(-30px) translateX(20px)' }
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':       { backgroundPosition: '100% 50%' }
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' }
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' }
        }
      }
    },
  },
  plugins: [],
}
