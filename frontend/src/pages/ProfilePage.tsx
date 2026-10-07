import { useEffect, useState, type ReactNode } from 'react'
import { BadgeCheck, CircleSlash, Clock, LogOut, ShieldCheck, UserRound } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { getSession } from '@/lib/auth-storage'
import { formatDate, formatDateTime, initials } from '@/lib/format'

function useSessionExpiry(): number | null {
  const [expiresAt] = useState(() => getSession()?.expiresAt ?? null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return expiresAt === null ? null : Math.max(0, expiresAt - now)
}

function formatRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'less than a minute'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function ProfilePage() {
  const { user, logout } = useAuth()
  const remaining = useSessionExpiry()

  if (!user) return null

  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Full name', value: user.full_name },
    { label: 'Email', value: user.email },
    {
      label: 'Role',
      value: user.is_admin ? (
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" /> Administrator
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="size-4 text-muted-foreground" aria-hidden="true" /> Operator
        </span>
      ),
    },
    {
      label: 'Account status',
      value: user.is_active ? (
        <span className="inline-flex items-center gap-1.5">
          <BadgeCheck className="size-4 text-status-online" aria-hidden="true" /> Active
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <CircleSlash className="size-4 text-muted-foreground" aria-hidden="true" /> Inactive
        </span>
      ),
    },
    { label: 'Member since', value: formatDateTime(user.created_at) },
    { label: 'User ID', value: <span className="font-mono text-xs">{user.id}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Profile" description="Your EdgeSphere operator account." />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="surface p-6 lg:col-span-2" aria-labelledby="account-heading">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
                {initials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 id="account-heading" className="truncate text-lg font-semibold">
                {user.full_name}
              </h2>
              <p className="truncate text-sm text-muted-foreground">
                Joined {formatDate(user.created_at)}
              </p>
            </div>
          </div>

          <dl className="mt-6 divide-y border-t">
            {rows.map(({ label, value }) => (
              <div key={label} className="grid gap-1 py-3 text-sm sm:grid-cols-3 sm:gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 truncate sm:col-span-2">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs text-muted-foreground">
            Profile editing and password changes are not yet supported by the API.
          </p>
        </section>

        <section className="surface self-start p-6" aria-labelledby="session-heading">
          <h2 id="session-heading" className="text-sm font-semibold">
            Session
          </h2>
          <div className="mt-4 flex items-start gap-3 rounded-lg border bg-background/40 p-4">
            <Clock className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <div className="text-sm">
              <div className="font-medium">
                {remaining === null ? 'Session active' : `Expires in ${formatRemaining(remaining)}`}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Sessions end when the access token expires. You will be asked to sign in again.
              </div>
            </div>
          </div>
          <Button variant="outline" className="mt-6 w-full" onClick={logout}>
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </section>
      </div>
    </div>
  )
}
