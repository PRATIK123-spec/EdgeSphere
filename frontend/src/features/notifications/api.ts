import { apiRequest } from '@/lib/api-client'
import type {
  NotificationSettingsResponse,
  NotificationSettingsUpdate,
  NotificationTestResponse,
} from '@/types/api'

/** GET /users/me/notifications — the caller's settings plus which channels the server supports. */
export function fetchNotificationSettings(signal?: AbortSignal): Promise<NotificationSettingsResponse> {
  return apiRequest<NotificationSettingsResponse>('/users/me/notifications', { signal })
}

/** PUT /users/me/notifications — replaces all settings; 409 if a channel is not configured on the server. */
export function updateNotificationSettings(data: NotificationSettingsUpdate): Promise<NotificationSettingsResponse> {
  return apiRequest<NotificationSettingsResponse>('/users/me/notifications', {
    method: 'PUT',
    body: { json: data },
  })
}

/** POST /users/me/notifications/test → 202; 409 with no enabled channel, 429 if repeated within 30 s. */
export function sendTestNotification(): Promise<NotificationTestResponse> {
  return apiRequest<NotificationTestResponse>('/users/me/notifications/test', { method: 'POST' })
}
