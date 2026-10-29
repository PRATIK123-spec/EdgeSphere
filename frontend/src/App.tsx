import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'

import { ServerWakeNotice } from '@/components/common/ServerWakeNotice'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { queryClient } from '@/lib/query-client'
import { router } from '@/router'

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <RouterProvider router={router} />
          <ServerWakeNotice />
          <Toaster position="bottom-right" richColors={false} closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
