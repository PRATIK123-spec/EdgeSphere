import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { useAuth } from '@/features/auth/auth-context'
import { FormField, PasswordField } from '@/components/common/FormField'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { getErrorMessage, isApiError } from '@/lib/api-client'

export function LoginPage() {
  const { login } = useAuth()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      const user = await login(email, password)
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}`)
      // PublicOnlyRoute redirects to the originally requested page.
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        setError('password', { message: 'Invalid email or password' })
        return
      }
      toast.error('Sign in failed', { description: getErrorMessage(error) })
    }
  })

  return (
    <AuthLayout
      title="Sign in"
      description="Access your EdgeSphere operations console."
      footer={
        <>
          New to EdgeSphere?{' '}
          <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="operator@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
