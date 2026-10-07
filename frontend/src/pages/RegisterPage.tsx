import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { useAuth } from '@/features/auth/auth-context'
import { FormField, PasswordField } from '@/components/common/FormField'
import { registerSchema, type RegisterValues } from '@/features/auth/schemas'
import { getErrorMessage, isApiError } from '@/lib/api-client'

const SERVER_FIELDS = ['email', 'password', 'full_name'] as const

export function RegisterPage() {
  const { register: registerAccount } = useAuth()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', email: '', password: '', confirm_password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await registerAccount(values)
      toast.success('Account created', { description: `Signed in as ${user.email}` })
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setError('email', { message: 'An account with this email already exists' })
        return
      }
      if (isApiError(error) && error.status === 422) {
        let mapped = false
        for (const field of SERVER_FIELDS) {
          const message = error.fieldErrors[field]
          if (message) {
            setError(field, { message })
            mapped = true
          }
        }
        if (mapped) return
      }
      toast.error('Registration failed', { description: getErrorMessage(error) })
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      description="Register as an operator to start provisioning devices."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormField
          id="full_name"
          label="Full name"
          autoComplete="name"
          autoFocus
          placeholder="Ada Lovelace"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="operator@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          id="confirm_password"
          label="Confirm password"
          autoComplete="new-password"
          error={errors.confirm_password?.message}
          {...register('confirm_password')}
        />
        <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
