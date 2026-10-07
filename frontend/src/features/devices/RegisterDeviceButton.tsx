import type { ComponentProps } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useRegisterDevice } from '@/features/devices/register-device-context'

/** Opens the app-level register-device flow (see RegisterDeviceProvider). */
export function RegisterDeviceButton({
  children = 'Register device',
  ...buttonProps
}: ComponentProps<typeof Button>) {
  const { openRegisterDevice } = useRegisterDevice()

  return (
    <Button {...buttonProps} onClick={openRegisterDevice}>
      <Plus aria-hidden="true" />
      {children}
    </Button>
  )
}
