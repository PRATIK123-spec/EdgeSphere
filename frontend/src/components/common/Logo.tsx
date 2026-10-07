import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('size-8 shrink-0', className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary/15" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" className="fill-none stroke-primary/40" />
      {/* Orbit + edge nodes */}
      <circle cx="16" cy="16" r="8" className="fill-none stroke-primary" strokeWidth="1.75" />
      <circle cx="16" cy="16" r="3" className="fill-primary" />
      <circle cx="24" cy="16" r="2" className="fill-primary" />
      <circle cx="10.3" cy="10.3" r="1.6" className="fill-primary/70" />
      <circle cx="10.3" cy="21.7" r="1.6" className="fill-primary/70" />
    </svg>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-tight">EdgeSphere</div>
          <div className="mt-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Edge Ops
          </div>
        </div>
      )}
    </div>
  )
}
