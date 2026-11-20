import { useThemeStore } from '../store/themeStore'

type Variant = 'mark' | 'full'

export function BrandLogo({ variant = 'mark', height = 36, white, className = '' }: { variant?: Variant; height?: number; white?: boolean; className?: string }) {
  const theme = useThemeStore((s) => s.theme)
  const useWhite = white ?? theme === 'dark'
  return (
    <img
      src={`/brand/logo-${variant}${useWhite ? '-white' : ''}.png`}
      alt="Altus Vera"
      style={{ height }}
      className={`w-auto shrink-0 select-none ${className}`}
      draggable={false}
    />
  )
}
