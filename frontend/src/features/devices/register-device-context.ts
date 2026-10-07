import { createContext, useContext } from 'react'

export interface RegisterDeviceContextValue {
  openRegisterDevice: () => void
}

export const RegisterDeviceContext = createContext<RegisterDeviceContextValue | null>(null)

export function useRegisterDevice(): RegisterDeviceContextValue {
  const value = useContext(RegisterDeviceContext)
  if (!value) throw new Error('useRegisterDevice must be used inside <RegisterDeviceProvider>')
  return value
}
