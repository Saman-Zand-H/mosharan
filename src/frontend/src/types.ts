import type { LucideIcon } from 'lucide-react'

export type SectionId =
  | 'overview'
  | 'gateways'
  | 'devices'
  | 'events'
  | 'simulator'
  | 'parameters'
  | 'protocols'
  | 'management'

export type ModuleSectionId = Exclude<
  SectionId,
  'overview' | 'simulator' | 'management'
>

export type EventStatus = 'processed' | 'failed' | 'received'
export type RegistryStatus = 'active' | 'inactive'
export type TimeRange = '6h' | '24h' | '7d'

export interface NavigationItem {
  id: SectionId
  label: string
  icon: LucideIcon
  superuserOnly?: boolean
}

export interface KpiMetric {
  label: string
  value: string
  detail: string
  trend: string
  tone: 'neutral' | 'positive' | 'warning'
}

export interface ChartPoint {
  label: string
  processed: number
  failed: number
}

export interface GatewaySummary {
  id: string
  title: string
  uid: string
  status: RegistryStatus
  activeDevices: number
  totalDevices: number
  lastEvent: string
  failures: number
}

export interface EventRecord {
  id: string
  type: string
  device: string
  gateway: string
  occurredAt: string
  status: EventStatus
  value?: string
  schema: string
  rawPayload: string
  error?: string
}

export interface ModuleSummary {
  title: string
  description: string
}
