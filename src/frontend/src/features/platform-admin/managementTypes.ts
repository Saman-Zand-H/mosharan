export type ManagementResource =
  | 'users'
  | 'companies'
  | 'gateways'
  | 'devices'
  | 'deviceTypes'
  | 'parameters'
  | 'deviceTypeParameters'
  | 'eventTypes'
  | 'payloadSchemas'
  | 'payloadFields'
  | 'projectionRules'
  | 'visualizationTabs'
  | 'visualizations'

interface TimestampedRecord {
  id: number
  dateCreated: string
  dateUpdated: string
}

export interface UserRecord {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  isSuperuser: boolean
  dateJoined: string
}

export interface CompanyRecord extends TimestampedRecord {
  name: string
  userId: number
}

export interface GatewayRecord extends TimestampedRecord {
  companyId: number | null
  uid: string
  title: string
  isActive: boolean
}

export interface DeviceRecord extends TimestampedRecord {
  gatewayId: number
  deviceTypeId: number
  localId: string
  isActive: boolean
}

export interface DeviceTypeRecord extends TimestampedRecord {
  code: string
  title: string
}

export interface ParameterRecord extends TimestampedRecord {
  code: string
  title: string
  valueType: 'integer' | 'datetime' | 'string' | 'boolean'
  unit: string | null
}

export interface DeviceTypeParameterRecord extends TimestampedRecord {
  deviceTypeId: number
  parameterId: number
}

export interface EventTypeRecord extends TimestampedRecord {
  code: string
  title: string
}

export interface PayloadSchemaRecord extends TimestampedRecord {
  eventTypeId: number
  deviceTypeId: number
  version: number
  encoding: 'utf-8'
  expectedLength: number | null
}

export interface PayloadFieldRecord extends TimestampedRecord {
  payloadSchemaId: number
  code: string
  name: string
  startByte: number
  endByte: number
  wireCodec: 'integer' | 'utf8' | 'boolean'
  role: 'metric' | 'timestamp' | 'sequence' | 'checksum'
}

export interface ProjectionRuleRecord extends TimestampedRecord {
  payloadSchemaId: number
  parameterId: number
  sourceKind: 'field' | 'constant'
  sourceFieldId: number | null
  constantValue: unknown
  conversionConfig: Record<string, unknown>
}

export interface VisualizationTabRecord extends TimestampedRecord {
  deviceTypeId: number
  code: string
  title: string
  sortOrder: number
  isActive: boolean
}

export interface VisualizationRecord extends TimestampedRecord {
  tabId: number
  title: string
  chartType: 'line' | 'bar' | 'area'
  xAxisId: number | null
  yAxisId: number
  sortOrder: number
  isActive: boolean
}

export interface ManagementSnapshot {
  users: UserRecord[]
  companies: CompanyRecord[]
  gateways: GatewayRecord[]
  devices: DeviceRecord[]
  deviceTypes: DeviceTypeRecord[]
  parameters: ParameterRecord[]
  deviceTypeParameters: DeviceTypeParameterRecord[]
  eventTypes: EventTypeRecord[]
  payloadSchemas: PayloadSchemaRecord[]
  payloadFields: PayloadFieldRecord[]
  projectionRules: ProjectionRuleRecord[]
  visualizationTabs: VisualizationTabRecord[]
  visualizations: VisualizationRecord[]
}

export type ManagementRecord =
  | UserRecord
  | CompanyRecord
  | GatewayRecord
  | DeviceRecord
  | DeviceTypeRecord
  | ParameterRecord
  | DeviceTypeParameterRecord
  | EventTypeRecord
  | PayloadSchemaRecord
  | PayloadFieldRecord
  | ProjectionRuleRecord
  | VisualizationTabRecord
  | VisualizationRecord

export type ManagementPayload = Record<string, unknown>
