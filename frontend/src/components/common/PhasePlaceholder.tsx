import type { ReactNode } from 'react'
import { Construction, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/common/states'

/**
 * Marks a section that is intentionally not wired up yet in this phase.
 * Names the real backend endpoint(s) it will use, so nothing is faked.
 */
export function PhasePlaceholder({
  icon = Construction,
  title,
  description,
  endpoints,
  className,
}: {
  icon?: LucideIcon
  title: string
  description: ReactNode
  endpoints?: string[]
  className?: string
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      className={className}
      description={
        <>
          {description}
          {endpoints && endpoints.length > 0 && (
            <span className="mt-3 flex flex-wrap justify-center gap-1.5">
              {endpoints.map((endpoint) => (
                <code
                  key={endpoint}
                  className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground/80"
                >
                  {endpoint}
                </code>
              ))}
            </span>
          )}
        </>
      }
    />
  )
}
