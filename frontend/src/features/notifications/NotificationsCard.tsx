import { useId, useState, type FormEvent } from 'react'
import { AlertCircle, BellRing, Loader2, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/common/FormField'
import { SegmentedControl } from '@/components/common/SegmentedControl'
import { CardSkeleton, ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  useNotificationSettings,
  useSendTestNotification,
  useUpdateNotificationSettings,
} from '@/features/notifications/hooks'
import { getErrorMessage, isApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { NotificationSettingsResponse, NotificationSeverity } from '@/types/api'

/** Mirrors TelegramChatId in app/schemas/notification.py. */
const CHAT_ID_PATTERN = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/

const SEVERITY_OPTIONS: { value: NotificationSeverity; label: string }[] = [
  { value: 'HIGH', label: 'High and critical' },
  { value: 'CRITICAL', label: 'Critical only' },
]

/**
 * Alert notification settings (GET/PUT /users/me/notifications). Channels the
 * server has not configured are shown disabled with the reason.
 */
export function NotificationsCard() {
  const query = useNotificationSettings()

  return (
    <section className="surface p-6" aria-labelledby="notifications-heading">
      <h2 id="notifications-heading" className="flex items-center gap-2 text-sm font-semibold">
        <BellRing className="size-4 text-muted-foreground" aria-hidden="true" /> Notifications
      </h2>
      <p className="mb-5 text-xs text-muted-foreground">
        Get a message when a device raises a new alert. Repeat alerts within the cooldown are not re-sent.
      </p>
      {query.isPending ? (
        <CardSkeleton lines={4} />
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        // Remount with the saved values whenever they change on the server.
        <NotificationsForm key={JSON.stringify(query.data)} saved={query.data} />
      )}
    </section>
  )
}

function ChannelRow({
  id,
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
  available,
  unavailableHint,
}: {
  id: string
  icon: typeof Mail
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  available: boolean
  unavailableHint: string
}) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border bg-background/40 p-4', !available && 'opacity-70')}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={!available}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
        aria-describedby={`${id}-desc`}
      />
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="flex items-center gap-1.5">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" /> {title}
        </Label>
        <p id={`${id}-desc`} className="mt-1 text-xs break-words text-muted-foreground">
          {available ? description : unavailableHint}
        </p>
      </div>
    </div>
  )
}

function NotificationsForm({ saved }: { saved: NotificationSettingsResponse }) {
  const formId = useId()
  const update = useUpdateNotificationSettings()
  const sendTest = useSendTestNotification()

  const [emailEnabled, setEmailEnabled] = useState(saved.email_enabled)
  const [telegramEnabled, setTelegramEnabled] = useState(saved.telegram_enabled)
  const [chatId, setChatId] = useState(saved.telegram_chat_id ?? '')
  const [minSeverity, setMinSeverity] = useState<NotificationSeverity>(saved.min_severity)
  const [chatIdError, setChatIdError] = useState<string>()
  const [rootError, setRootError] = useState<string>()

  const trimmedChatId = chatId.trim()
  const dirty =
    emailEnabled !== saved.email_enabled ||
    telegramEnabled !== saved.telegram_enabled ||
    trimmedChatId !== (saved.telegram_chat_id ?? '') ||
    minSeverity !== saved.min_severity
  const savedChannels = saved.email_enabled || saved.telegram_enabled

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setRootError(undefined)
    setChatIdError(undefined)
    if (trimmedChatId && !CHAT_ID_PATTERN.test(trimmedChatId)) {
      setChatIdError('Use a numeric chat ID (e.g. 123456789 or -100…) or a public @channel name')
      return
    }
    if (telegramEnabled && !trimmedChatId) {
      setChatIdError('Enter the chat ID to send Telegram messages to')
      return
    }
    try {
      await update.mutateAsync({
        email_enabled: emailEnabled,
        telegram_enabled: telegramEnabled,
        telegram_chat_id: trimmedChatId || null,
        min_severity: minSeverity,
      })
      toast.success('Notification settings saved')
    } catch (error) {
      if (isApiError(error) && error.status === 422 && error.fieldErrors.telegram_chat_id) {
        setChatIdError(error.fieldErrors.telegram_chat_id)
        return
      }
      setRootError(getErrorMessage(error))
    }
  }

  const test = async () => {
    try {
      const result = await sendTest.mutateAsync()
      toast.success('Test notification sent', {
        description: `Via ${result.queued_channels.join(' and ')}. It may take a minute to arrive.`,
      })
    } catch (error) {
      toast.error('Could not send a test notification', { description: getErrorMessage(error) })
    }
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-4">
      {rootError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {rootError}
        </div>
      )}

      <ChannelRow
        id={`${formId}-email`}
        icon={Mail}
        title="Email"
        description={`Sent to ${saved.email_address}`}
        checked={emailEnabled}
        onCheckedChange={setEmailEnabled}
        available={saved.email_available}
        unavailableHint="Not configured on this server (set the SMTP_* environment variables)."
      />

      <div className="space-y-3">
        <ChannelRow
          id={`${formId}-telegram`}
          icon={Send}
          title="Telegram"
          description="Sent by the EdgeSphere bot to the chat below. Start a chat with the bot first."
          checked={telegramEnabled}
          onCheckedChange={setTelegramEnabled}
          available={saved.telegram_available}
          unavailableHint="Not configured on this server (set TELEGRAM_BOT_TOKEN)."
        />
        {saved.telegram_available && (telegramEnabled || chatId) && (
          <FormField
            id={`${formId}-chat`}
            label="Telegram chat ID"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="123456789"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            error={chatIdError}
            hint="Your numeric chat ID (ask @userinfobot), a group ID starting with -100, or a public @channel."
          />
        )}
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Notify for</span>
        <SegmentedControl
          label="Minimum alert severity"
          value={minSeverity}
          onChange={setMinSeverity}
          options={SEVERITY_OPTIONS}
          className="flex w-full"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void test()}
          disabled={!savedChannels || dirty || sendTest.isPending}
          title={dirty ? 'Save your changes first' : !savedChannels ? 'Enable and save a channel first' : undefined}
        >
          {sendTest.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          Send test
        </Button>
        <Button type="submit" size="sm" disabled={!dirty || update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Save
        </Button>
      </div>
    </form>
  )
}
