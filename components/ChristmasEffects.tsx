import { useEffect, useState } from 'react'
import { useChristmas } from '@/contexts/ChristmasContext'

interface Snowflake {
  id: number
  left: number
  animationDuration: number
  animationDelay: number
  size: number
  opacity: number
}

export default function ChristmasEffects() {
  const { isChristmasMode, loading } = useChristmas()
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isChristmasMode || !mounted) return

    // Gerar flocos de neve
    const flakes: Snowflake[] = []
    for (let i = 0; i < 50; i++) {
      flakes.push({
        id: i,
        left: Math.random() * 100,
        animationDuration: 10 + Math.random() * 20,
        animationDelay: Math.random() * 10,
        size: 10 + Math.random() * 20,
        opacity: 0.3 + Math.random() * 0.7
      })
    }
    setSnowflakes(flakes)

    return () => {
      setSnowflakes([])
    }
  }, [isChristmasMode, mounted])

  if (loading || !isChristmasMode || !mounted) return null

  return (
    <>
      {/* Flocos de neve caindo */}
      <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="absolute animate-snowfall"
            style={{
              left: `${flake.left}%`,
              top: '-30px',
              fontSize: `${flake.size}px`,
              opacity: flake.opacity,
              animationDuration: `${flake.animationDuration}s`,
              animationDelay: `${flake.animationDelay}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite'
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* Decorações de canto */}
      <div className="fixed top-0 left-0 pointer-events-none z-[99]">
        <div className="relative">
          <span className="text-6xl opacity-80 transform -rotate-45 inline-block">🎄</span>
        </div>
      </div>

      <div className="fixed top-0 right-0 pointer-events-none z-[99]">
        <div className="relative">
          <span className="text-6xl opacity-80 transform rotate-45 inline-block">🎄</span>
        </div>
      </div>

      {/* Luzes de natal no topo */}
      <div className="fixed top-0 left-0 right-0 pointer-events-none z-[98] flex justify-center">
        <div className="flex gap-4 mt-2 animate-pulse">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full animate-christmas-lights"
              style={{
                backgroundColor: ['#ff0000', '#00ff00', '#ffff00', '#ff00ff', '#00ffff'][i % 5],
                animationDelay: `${i * 0.2}s`,
                boxShadow: `0 0 10px ${['#ff0000', '#00ff00', '#ffff00', '#ff00ff', '#00ffff'][i % 5]}`
              }}
            />
          ))}
        </div>
      </div>

      {/* Guirlanda nos cantos inferiores */}
      <div className="fixed bottom-4 left-4 pointer-events-none z-[99]">
        <span className="text-4xl opacity-70">🎁</span>
      </div>

      <div className="fixed bottom-4 right-4 pointer-events-none z-[99]">
        <span className="text-4xl opacity-70">🎅</span>
      </div>

      {/* Banner festivo opcional */}
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-[97]">
        <div className="flex justify-center pb-2">
          <div className="bg-gradient-to-r from-red-600/20 via-green-600/20 to-red-600/20 backdrop-blur-sm px-6 py-2 rounded-t-xl border border-white/10">
            <span className="text-white/80 text-sm font-medium flex items-center gap-2">
              <span>🎄</span>
              <span>Feliz Natal e Boas Festas!</span>
              <span>🎅</span>
            </span>
          </div>
        </div>
      </div>

      {/* Estilos CSS para animações */}
      <style jsx global>{`
        @keyframes snowfall {
          0% {
            transform: translateY(-10px) rotate(0deg);
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
          }
        }

        @keyframes christmas-lights {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(0.8);
          }
        }

        .animate-snowfall {
          animation: snowfall linear infinite;
        }

        .animate-christmas-lights {
          animation: christmas-lights 1.5s ease-in-out infinite;
        }

        /* Overlay festivo sutil */
        body.christmas-mode::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 90;
          background: linear-gradient(
            135deg,
            rgba(220, 38, 38, 0.03) 0%,
            transparent 25%,
            transparent 75%,
            rgba(34, 197, 94, 0.03) 100%
          );
        }
      `}</style>
    </>
  )
}

