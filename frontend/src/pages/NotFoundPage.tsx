import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { AlertOctagon, ArrowLeft, Compass } from 'lucide-react'

import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'

function Frame({ code, title, description, icon: Icon }: {
  code: string
  title: string
  description: string
  icon: typeof Compass
}) {
  return (
    <div className="bg-grid flex min-h-svh flex-col items-center justify-center p-6 text-center">
      <Logo className="mb-12" />
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border bg-card">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="font-mono text-xs tracking-[0.2em] text-primary uppercase">{code}</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-8">
        <Link to="/dashboard">
          <ArrowLeft aria-hidden="true" /> Back to dashboard
        </Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <Frame
      code="Error 404"
      icon={Compass}
      title="Page not found"
      description="The page you are looking for does not exist or has been moved."
    />
  )
}

/** Router-level error boundary for unexpected render errors. */
export function RouteErrorPage() {
  const error = useRouteError()
  const is404 = isRouteErrorResponse(error) && error.status === 404

  if (is404) return <NotFoundPage />

  return (
    <Frame
      code="Application error"
      icon={AlertOctagon}
      title="Something went wrong"
      description={
        error instanceof Error ? error.message : 'An unexpected error occurred while rendering this page.'
      }
    />
  )
}
