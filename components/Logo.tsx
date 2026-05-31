import Link from 'next/link'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES = {
  sm: { mark: 'h-8', text: 'text-base' },
  md: { mark: 'h-10', text: 'text-xl' },
  lg: { mark: 'h-14', text: 'text-2xl' },
  xl: { mark: 'h-20', text: 'text-4xl' }
}

export default function Logo({ className = '', showText = false, size = 'md' }: LogoProps) {
  const s = SIZES[size]
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className={`relative inline-flex ${s.mark} overflow-hidden`}>
        <img
          src="/logo.png"
          alt="Kaizen Logo"
          className="h-full w-auto object-contain"
        />
      </span>
      {showText && (
        <span className={`text-display font-bold tracking-tight text-white ${s.text} group-hover:tracking-normal transition-all`}>
          Kaizen<span className="text-gradient-aurora">.</span>
        </span>
      )}
    </Link>
  )
}
