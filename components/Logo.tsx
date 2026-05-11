import Link from 'next/link'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES = {
  sm: { mark: 'h-7 w-7', text: 'text-base' },
  md: { mark: 'h-9 w-9', text: 'text-xl' },
  lg: { mark: 'h-12 w-12', text: 'text-2xl' },
  xl: { mark: 'h-16 w-16', text: 'text-4xl' }
}

export default function Logo({ className = '', showText = true, size = 'md' }: LogoProps) {
  const s = SIZES[size]
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className={`relative inline-flex ${s.mark} rounded-xl overflow-hidden`}>
        <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="k-grad-a" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="50%" stopColor="#e879f9" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient id="k-grad-b" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.5" />
            </linearGradient>
            <radialGradient id="k-grad-c" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#k-grad-a)" />
          <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#k-grad-c)" />
          {/* Stylized K */}
          <path
            d="M12 9.5h3.5v9.4l7.6-9.4h4.3l-7.8 9.5 8.4 11.5h-4.6L17.2 22l-1.7 2v6.5H12V9.5z"
            fill="url(#k-grad-b)"
          />
          <circle cx="32" cy="9" r="2" fill="#fbbf24" />
        </svg>
        <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/15" />
      </span>
      {showText && (
        <span className={`text-display font-bold tracking-tight text-white ${s.text} group-hover:tracking-normal transition-all`}>
          Kaizen<span className="text-gradient-aurora">.</span>
        </span>
      )}
    </Link>
  )
}
