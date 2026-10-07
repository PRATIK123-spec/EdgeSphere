import type { ReactNode } from 'react'
import { Activity, BellRing, Cpu, ShieldCheck } from 'lucide-react'

import { Logo } from '@/components/common/Logo'
import { ThemeToggle } from '@/components/common/ThemeToggle'

const capabilities = [
  { icon: Cpu, title: 'Device fleet', text: 'Provision edge devices with per-device API keys.' },
  { icon: Activity, title: 'Telemetry', text: 'Temperature, battery, CPU and memory from every node.' },
  { icon: BellRing, title: 'Alerting', text: 'Threshold rules raise alerts the moment readings drift.' },
  { icon: ShieldCheck, title: 'Isolation', text: 'Every operator sees only the devices they own.' },
]

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
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_75%)]" />
        <div
          aria-hidden="true"
          className="absolute -top-40 -left-40 size-[36rem] rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <Logo />

          <div className="max-w-lg">
            <div className="mb-4 font-mono text-[11px] font-medium tracking-[0.18em] text-primary uppercase">
              IoT · Edge Infrastructure
            </div>
            <h2 className="text-4xl font-semibold tracking-tight text-balance xl:text-5xl">
              Every edge node, one control plane.
            </h2>
            <p className="mt-4 text-base text-pretty text-muted-foreground">
              Monitor device health, stream telemetry and respond to alerts across your entire
              edge fleet.
            </p>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {capabilities.map(({ icon: Icon, title: capTitle, text }) => (
                <li key={capTitle} className="surface p-4">
                  <Icon className="size-4 text-primary" aria-hidden="true" />
                  <div className="mt-3 text-sm font-medium">{capTitle}</div>
                  <div className="mt-1 text-xs text-pretty text-muted-foreground">{text}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="font-mono text-[11px] text-muted-foreground">EdgeSphere API v1.0.0</div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
