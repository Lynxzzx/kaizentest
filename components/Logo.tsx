import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function Logo({ className = '', showText = true, size = 'md' }: LogoProps) {
  const [imageError, setImageError] = useState(false)
  
  const sizeClasses = {
    sm: { image: 'h-6 w-auto', text: 'text-lg', dimensions: { width: 120, height: 40 }, icon: 'w-6 h-6' },
    md: { image: 'h-8 md:h-10 w-auto', text: 'text-lg md:text-2xl', dimensions: { width: 160, height: 50 }, icon: 'w-8 h-8 md:w-10 md:h-10' },
    lg: { image: 'h-12 md:h-16 w-auto', text: 'text-2xl md:text-4xl', dimensions: { width: 200, height: 65 }, icon: 'w-12 h-12 md:w-16 md:h-16' }
  }

  const currentSize = sizeClasses[size]

  return (
    <Link href="/" className={`flex items-center space-x-2 md:space-x-3 group ${className}`}>
      <div className="relative flex items-center">
        {!imageError ? (
          <Image
            src="/logo.png"
            alt="Kaizen Logo"
            width={currentSize.dimensions.width}
            height={currentSize.dimensions.height}
            className={`${currentSize.image} object-contain filter group-hover:opacity-90 transition-opacity`}
            priority
            onError={() => setImageError(true)}
          />
        ) : (
          <div className={`${currentSize.icon} bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center transform group-hover:scale-110 transition-transform`}>
            <span className="text-white font-bold text-sm md:text-base lg:text-lg">K</span>
          </div>
        )}
      </div>
      {showText && (
        <span className={`${currentSize.text} font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent hidden sm:block`}>
          Kaizen
        </span>
      )}
    </Link>
  )
}

