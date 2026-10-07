import {
  Battery,
  Bell,
  Cpu,
  Info,
  MemoryStick,
  OctagonAlert,
  Thermometer,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'


/**
 * Presentation metadata for alert severities and types.
 *
 * The backend (ALERT_RULES in app/services/alert_service.py) produces exactly
 * two severities — CRITICAL (temperature) and HIGH (battery, CPU, RAM) — and
 * four types. `severity` and `alert_type` are free-text columns, so anything
 * else is still rendered, generically, without inventing new levels.
 */

interface SeverityMeta {
  label: string
  rank: number
  icon: LucideIcon
  badge: string
  accent: string
}

const SEVERITIES: Record<string, SeverityMeta> = {
  CRITICAL: {
    label: 'Critical',
    rank: 0,
    icon: OctagonAlert,
    badge: 'border-status-critical/40 bg-status-critical/12 text-status-critical',
    accent: 'bg-status-critical',
  },
  HIGH: {
    label: 'High',
    rank: 1,
    icon: TriangleAlert,
    badge: 'border-status-warning/40 bg-status-warning/12 text-foreground',
    accent: 'bg-status-warning',
  },
}

const OTHER_SEVERITY: Omit<SeverityMeta, 'label'> = {
  rank: 9,
  icon: Info,
  badge: 'border-border bg-muted/60 text-muted-foreground',
  accent: 'bg-muted-foreground',
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

export function severityMeta(severity: string): SeverityMeta {
  return SEVERITIES[severity.toUpperCase()] ?? { ...OTHER_SEVERITY, label: titleCase(severity) || 'Unknown' }
}

interface TypeMeta {
  label: string
  icon: LucideIcon
}

const TYPES: Record<string, TypeMeta> = {
  TEMPERATURE: { label: 'Temperature', icon: Thermometer },
  BATTERY: { label: 'Battery', icon: Battery },
  CPU: { label: 'CPU', icon: Cpu },
  RAM: { label: 'Memory (RAM)', icon: MemoryStick },
}

export function alertTypeMeta(type: string): TypeMeta {
  return TYPES[type.toUpperCase()] ?? { label: titleCase(type) || 'Unknown', icon: Bell }
}

/** Severities and types the backend's alert rules produce (filter options). */
export const KNOWN_SEVERITIES = ['CRITICAL', 'HIGH'] as const
export const KNOWN_TYPES = ['TEMPERATURE', 'BATTERY', 'CPU', 'RAM'] as const

export const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
}
