import { z } from 'zod'

// Lengths mirror the database columns in app/models/user.py.

export const loginSchema = z.object({
  email: z.email('Enter a valid email address').max(255),
  password: z.string().min(1, 'Password is required'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(1, 'Full name is required')
      .max(100, 'Full name must be 100 characters or fewer'),
    email: z.email('Enter a valid email address').max(255),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm_password: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match',
  })

export type RegisterValues = z.infer<typeof registerSchema>
