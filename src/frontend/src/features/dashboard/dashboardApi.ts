import { apiRequest } from '../../lib/api/http'

export type DashboardChartType = 'line' | 'bar' | 'area'

export interface DashboardParameter {
  id: number
  code: string
  title: string
  valueType: 'integer' | 'datetime' | 'string' | 'boolean'
  unit: string | null
}

export interface DashboardDevice {
  id: number
  localId: string
  isActive: boolean
  gatewayUid: string
  gatewayTitle: string
  deviceTypeId: number
  deviceTypeCode: string
  deviceTypeTitle: string
}

export interface DashboardPoint {
  x: string
  y: number
  observedAt: string
}

export interface DashboardVisualization {
  id: number
  title: string
  chartType: DashboardChartType
  xAxis: string
  yAxis: DashboardParameter
  points: DashboardPoint[]
}

export interface DashboardTab {
  id: number
  code: string
  title: string
  sortOrder: number
  visualizations: DashboardVisualization[]
}

export interface BinaryHistoryPoint {
  value: boolean
  observedAt: string
}

export interface DashboardBinaryParameter {
  parameter: DashboardParameter
  latestValue: boolean | null
  latestAt: string | null
  history: BinaryHistoryPoint[]
}

export interface DashboardEvent {
  id: string
  deviceLocalId: string
  gatewayUid: string
  eventTypeTitle: string
  status: 'received' | 'processed' | 'failed'
  receivedAt: string
  rawPayload: string
  parsingError: string
}

export interface DashboardResponse {
  devices: DashboardDevice[]
  selectedDeviceId: number | null
  rangeHours: number
  tabs: DashboardTab[]
  binaryParameters: DashboardBinaryParameter[]
  recentEvents: DashboardEvent[]
}

export function loadDashboard(
  deviceId: number | null,
  hours: number,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  const query = new URLSearchParams({ hours: String(hours) })
  if (deviceId !== null) query.set('deviceId', String(deviceId))
  return apiRequest<DashboardResponse>(`/dashboard?${query.toString()}`, { signal })
}
