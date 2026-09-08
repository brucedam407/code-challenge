interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
})

export function ReverseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 4v16" />
      <path d="m4 16 4 4 4-4" />
      <path d="M16 20V4" />
      <path d="m20 8-4-4-4 4" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  )
}

export function CloseIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function SwitchIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />
    </svg>
  )
}

export function SunIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function MoonIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  )
}
