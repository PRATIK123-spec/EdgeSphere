import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchNotificationSettings,
  sendTestNotification,
  updateNotificationSettings,
} from '@/features/notifications/api'
import type { NotificationSettingsUpdate } from '@/types/api'

export const notificationKeys = {
  settings: ['notifications', 'settings'] as const,
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationKeys.settings,
    queryFn: ({ signal }) => fetchNotificationSettings(signal),
  })
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: NotificationSettingsUpdate) => updateNotificationSettings(data),
    onSuccess: (settings) => queryClient.setQueryData(notificationKeys.settings, settings),
  })
}

export function useSendTestNotification() {
  return useMutation({ mutationFn: sendTestNotification })
}
