import type { ReactNode } from 'react'
import { Activity, BellRing, Cpu, KeyRound, ShieldCheck } from 'lucide-react'

import { Logo } from '@/components/common/Logo'
import { ThemeToggle } from '@/components/common/ThemeToggle'

const capabilities = [
  { icon: Cpu, title: 'Device fleet', text: 'Register edge devices, each with its own API key.' },
  { icon: Activity, title: 'Telemetry', text: 'Temperature, battery, CPU and memory from every device.' },
  { icon: BellRing, title: 'Alerting', text: 'Readings past a threshold raise an alert immediately.' },
  { icon: ShieldCheck, title: 'Isolation', text: 'Each operator sees only the devices they own.' },
]

/** Hub-and-spoke schematic: decorative, carries no data. */
function FleetSchematic() {
  const nodes = [
    [60, 40],
    [300, 30],
    [350, 150],
    [290, 250],
    [70, 240],
    [20, 140],
  ] as const
  return (
    <svg viewBox="0 0 380 280" className="h-auto w-full max-w-md" aria-hidden="true">
      {nodes.map(([x, y], i) => (
        <line
          key={i}
          x1={190}
          y1={140}
          x2={x}
          y2={y}
          className="stroke-primary/30"
          strokeWidth={1.25}
          strokeDasharray={i % 2 ? '3 5' : undefined}
        />
      ))}
      <circle cx={190} cy={140} r={58} className="fill-none stroke-primary/15" />
      <circle cx={190} cy={140} r={100} className="fill-none stroke-primary/10" />
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 11} y={y - 11} width={22} height={22} rx={6} className="fill-card stroke-border-strong" />
          <circle cx={x} cy={y} r={3} className={i === 2 ? 'fill-status-warning' : 'fill-status-online'} />
        </g>
      ))}
      <rect x={166} y={116} width={48} height={48} rx={12} className="fill-primary/15 stroke-primary/50" />
      <circle cx={190} cy={140} r={9} className="fill-none stroke-primary" strokeWidth={2} />
      <circle cx={190} cy={140} r={3.5} className="fill-primary" />
    </svg>
  )
}

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden border-r bg-sidebar lg:flex lg:flex-col">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

        <div className="relative flex flex-1 flex-col justify-between gap-10 p-10 xl:p-14">
          <Logo />

          <div className="max-w-lg">
            <FleetSchematic />
            <h2 className="mt-10 text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
              Every edge device, one control plane.
            </h2>
            <p className="mt-3 max-w-md text-base text-pretty text-muted-foreground">
              See device health, follow telemetry and act on alerts across your whole fleet.
            </p>

            <dl className="mt-8 grid border-t sm:grid-cols-2">
              {capabilities.map(({ icon: Icon, title: capTitle, text }, i) => (
                <div
                  key={capTitle}
                  className={`flex gap-3 border-b py-4 ${i % 2 === 0 ? 'sm:border-r sm:pr-5' : 'sm:pl-5'}`}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <dt className="text-sm font-medium">{capTitle}</dt>
                    <dd className="mt-0.5 text-xs text-pretty text-muted-foreground">{text}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <KeyRound className="size-3.5" aria-hidden="true" />
            Device keys are shown once and stored only as hashes.
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:px-6 sm:pt-0">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            <div className="elevation-1 mt-8 rounded-2xl border bg-card p-5 sm:p-6">{children}</div>
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
