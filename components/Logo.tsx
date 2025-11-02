import Image from 'next/image'
import Link from 'next/link'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function Logo({ className = '', showText = true, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: { image: 'h-6 w-auto', text: 'text-lg', dimensions: { width: 120, height: 40 } },
    md: { image: 'h-8 md:h-10 w-auto', text: 'text-lg md:text-2xl', dimensions: { width: 160, height: 50 } },
    lg: { image: 'h-12 md:h-16 w-auto', text: 'text-2xl md:text-4xl', dimensions: { width: 200, height: 65 } }
  }

  const currentSize = sizeClasses[size]

  return (
    <Link href="/" className={`flex items-center space-x-2 md:space-x-3 group ${className}`}>
      <div className="relative flex items-center">
        {/* Fallback para caso a logo não exista ainda */}
        <div className="relative">
          <Image
            src="/logo.png"
            alt="Kaizen Logo"
            width={currentSize.dimensions.width}
            height={currentSize.dimensions.height}
            className={`${currentSize.image} object-contain filter group-hover:opacity-90 transition-opacity`}
            priority
            onError={(e) => {
              // Se a logo não existir, mostra um placeholder
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              if (target.parentElement) {
                const placeholder = document.createElement('div')
                placeholder.className = `${currentSize.image} bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center`
                placeholder.innerHTML = '<span class="text-white font-bold text-sm md:text-base">K</span>'
                target.parentElement.appendChild(placeholder)
              }
            }}
          />
        </div>
      </div>
      {showText && (
        <span className={`${currentSize.text} font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent hidden sm:block`}>
          Kaizen
        </span>
      )}
    </Link>
  )
}

