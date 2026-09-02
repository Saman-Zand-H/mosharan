import { API_BASE_URL } from '../../lib/api/http'

export type WireCodec = 'integer' | 'utf8' | 'boolean'
export type FieldRole = 'metric' | 'timestamp' | 'sequence' | 'checksum'
export type ParameterValueType = 'integer' | 'datetime' | 'string' | 'boolean'
export type CatalogSource = 'database_api'

export interface CatalogField {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly startByte: number
  readonly endByte: number
  readonly wireCodec: WireCodec
  readonly role: FieldRole
}

export interface CatalogParameter {
  readonly code: string
  readonly title: string
  readonly valueType: ParameterValueType
  readonly unit?: string
}

export type CatalogConversionConfig = Readonly<Record<string, unknown>> & {
  readonly timestampUnit?: unknown
}

export interface CatalogProjectionRule {
  readonly id: string
  readonly parameter: CatalogParameter
  readonly sourceKind: 'field' | 'constant'
  readonly sourceFieldId?: string
  // Integer and datetime constants cross the interface as decimal strings so
  // values outside JavaScript's safe-number range remain exact.
  readonly constantValue?: string | boolean
  readonly conversionConfig: CatalogConversionConfig
}

export interface CatalogPayloadSchema {
  readonly id: string
  readonly eventType: { readonly code: string; readonly title: string }
  readonly deviceType: { readonly code: string; readonly title: string }
  readonly version: number
  readonly encoding: 'utf-8'
  readonly expectedLength: number | null
  readonly fields: readonly CatalogField[]
  readonly projectionRules: readonly CatalogProjectionRule[]
}

export interface CatalogDevice {
  readonly id: string
  readonly localId: string
  readonly isActive: boolean
  readonly deviceTypeCode: string
  readonly gateway: {
    readonly uid: string
    readonly title: string
    readonly isActive: boolean
  }
}

export interface SimulatorCatalog {
  readonly source: CatalogSource
  readonly schemas: readonly CatalogPayloadSchema[]
  readonly devices: readonly CatalogDevice[]
}

export interface LoadSimulatorCatalogOptions {
  readonly endpoint?: string
  readonly signal?: AbortSignal
  readonly fetchImplementation?: typeof fetch
}

export type CatalogLoadErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'request_failed'
  | 'invalid_response'

export class CatalogLoadError extends Error {
  readonly code: CatalogLoadErrorCode
  readonly status?: number

  constructor(code: CatalogLoadErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'CatalogLoadError'
    this.code = code
    this.status = status
  }
}

export const DEFAULT_CATALOG_ENDPOINT = `${API_BASE_URL}/simulator/catalog`
export const DEFAULT_WORKSPACE_CATALOG_ENDPOINT = `${API_BASE_URL}/workspace/catalog`
const WIRE_CODECS = new Set<WireCodec>(['integer', 'utf8', 'boolean'])
const FIELD_ROLES = new Set<FieldRole>([
  'metric',
  'timestamp',
  'sequence',
  'checksum',
])
const VALUE_TYPES = new Set<ParameterValueType>([
  'integer',
  'datetime',
  'string',
  'boolean',
])

type JsonObject = Record<string, unknown>

const invalidResponse = (detail: string): never => {
  throw new CatalogLoadError(
    'invalid_response',
    `Simulator catalog response is invalid: ${detail}.`,
  )
}

const objectValue = (value: unknown, path: string): JsonObject => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalidResponse(`${path} must be an object`)
  }
  return value as JsonObject
}

const arrayValue = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) return invalidResponse(`${path} must be an array`)
  return value
}

const stringValue = (value: unknown, path: string): string => {
  if (typeof value !== 'string') return invalidResponse(`${path} must be a string`)
  return value
}

const nonEmptyString = (value: unknown, path: string): string => {
  const parsed = stringValue(value, path)
  if (!parsed) return invalidResponse(`${path} must not be empty`)
  return parsed
}

const identifier = (value: unknown, path: string): string => {
  if (typeof value === 'string' && value) return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
  return invalidResponse(`${path} must be a string or safe integer`)
}

const integerValue = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    return invalidResponse(`${path} must be a safe integer`)
  }
  return value
}

const booleanValue = (value: unknown, path: string): boolean => {
  if (typeof value !== 'boolean') return invalidResponse(`${path} must be boolean`)
  return value
}

const enumValue = <Value extends string>(
  value: unknown,
  allowed: ReadonlySet<Value>,
  path: string,
): Value => {
  if (typeof value !== 'string' || !allowed.has(value as Value)) {
    return invalidResponse(`${path} has an unsupported value`)
  }
  return value as Value
}

const mapConversionConfig = (value: unknown, path: string): CatalogConversionConfig => {
  const source = objectValue(value, path)
  const mapped: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(source)) {
    mapped[key === 'timestamp_unit' ? 'timestampUnit' : key] = item
  }
  return mapped
}

const mapParameter = (value: unknown, path: string): CatalogParameter => {
  const source = objectValue(value, path)
  const unit = source.unit
  if (unit !== undefined && unit !== null && typeof unit !== 'string') {
    return invalidResponse(`${path}.unit must be a string or null`)
  }
  return {
    code: nonEmptyString(source.code, `${path}.code`),
    title: nonEmptyString(source.title, `${path}.title`),
    valueType: enumValue(source.valueType, VALUE_TYPES, `${path}.valueType`),
    ...(typeof unit === 'string' ? { unit } : {}),
  }
}

const mapField = (value: unknown, path: string): CatalogField => {
  const source = objectValue(value, path)
  return {
    id: identifier(source.id, `${path}.id`),
    code: nonEmptyString(source.code, `${path}.code`),
    name: nonEmptyString(source.name, `${path}.name`),
    startByte: integerValue(source.startByte, `${path}.startByte`),
    endByte: integerValue(source.endByte, `${path}.endByte`),
    wireCodec: enumValue(source.wireCodec, WIRE_CODECS, `${path}.wireCodec`),
    role: enumValue(source.role, FIELD_ROLES, `${path}.role`),
  }
}

const mapConstantValue = (
  value: unknown,
  valueType: ParameterValueType,
  path: string,
): string | boolean => {
  if (valueType === 'boolean') return booleanValue(value, path)
  // Strings also carry integer and datetime constants. The server must emit
  // decimal strings for those types rather than lossy JSON numbers.
  return stringValue(value, path)
}

const mapProjectionRule = (value: unknown, path: string): CatalogProjectionRule => {
  const source = objectValue(value, path)
  const parameter = mapParameter(source.parameter, `${path}.parameter`)
  const sourceKind = enumValue(
    source.sourceKind,
    new Set<'field' | 'constant'>(['field', 'constant']),
    `${path}.sourceKind`,
  )
  const base = {
    id: identifier(source.id, `${path}.id`),
    parameter,
    sourceKind,
    conversionConfig: mapConversionConfig(
      source.conversionConfig,
      `${path}.conversionConfig`,
    ),
  }
  if (sourceKind === 'field') {
    if (source.constantValue !== null && source.constantValue !== undefined) {
      return invalidResponse(`${path}.constantValue must be null for a field source`)
    }
    return {
      ...base,
      sourceFieldId: identifier(source.sourceFieldId, `${path}.sourceFieldId`),
    }
  }
  if (source.sourceFieldId !== null && source.sourceFieldId !== undefined) {
    return invalidResponse(`${path}.sourceFieldId must be null for a constant source`)
  }
  return {
    ...base,
    constantValue: mapConstantValue(
      source.constantValue,
      parameter.valueType,
      `${path}.constantValue`,
    ),
  }
}

const mapNamedCode = (
  value: unknown,
  path: string,
): { readonly code: string; readonly title: string } => {
  const source = objectValue(value, path)
  return {
    code: nonEmptyString(source.code, `${path}.code`),
    title: nonEmptyString(source.title, `${path}.title`),
  }
}

const mapSchema = (value: unknown, path: string): CatalogPayloadSchema => {
  const source = objectValue(value, path)
  const expectedLength = source.expectedLength
  if (
    expectedLength !== null &&
    (typeof expectedLength !== 'number' || !Number.isSafeInteger(expectedLength))
  ) {
    return invalidResponse(`${path}.expectedLength must be an integer or null`)
  }
  const encoding = stringValue(source.encoding, `${path}.encoding`)
  if (encoding !== 'utf-8') return invalidResponse(`${path}.encoding must be utf-8`)
  return {
    id: identifier(source.id, `${path}.id`),
    eventType: mapNamedCode(source.eventType, `${path}.eventType`),
    deviceType: mapNamedCode(source.deviceType, `${path}.deviceType`),
    version: integerValue(source.version, `${path}.version`),
    encoding,
    expectedLength,
    fields: arrayValue(source.fields, `${path}.fields`).map((field, index) =>
      mapField(field, `${path}.fields[${index}]`),
    ),
    projectionRules: arrayValue(
      source.projectionRules,
      `${path}.projectionRules`,
    ).map((rule, index) =>
      mapProjectionRule(rule, `${path}.projectionRules[${index}]`),
    ),
  }
}

const mapDevice = (value: unknown, path: string): CatalogDevice => {
  const source = objectValue(value, path)
  const gateway = objectValue(source.gateway, `${path}.gateway`)
  return {
    id: identifier(source.id, `${path}.id`),
    localId: nonEmptyString(source.localId, `${path}.localId`),
    isActive: booleanValue(source.isActive, `${path}.isActive`),
    deviceTypeCode: nonEmptyString(
      source.deviceTypeCode,
      `${path}.deviceTypeCode`,
    ),
    gateway: {
      uid: nonEmptyString(gateway.uid, `${path}.gateway.uid`),
      title: nonEmptyString(gateway.title, `${path}.gateway.title`),
      isActive: booleanValue(gateway.isActive, `${path}.gateway.isActive`),
    },
  }
}

const mapCatalog = (value: unknown): SimulatorCatalog => {
  const source = objectValue(value, 'catalog')
  return {
    source: 'database_api',
    schemas: arrayValue(source.schemas, 'catalog.schemas').map((schema, index) =>
      mapSchema(schema, `catalog.schemas[${index}]`),
    ),
    devices: arrayValue(source.devices, 'catalog.devices').map((device, index) =>
      mapDevice(device, `catalog.devices[${index}]`),
    ),
  }
}

async function loadCatalog(
  endpoint: string,
  options: LoadSimulatorCatalogOptions,
  label: 'simulator' | 'workspace',
): Promise<SimulatorCatalog> {
  const request = options.fetchImplementation ?? fetch
  let response: Response
  try {
    response = await request(endpoint, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new CatalogLoadError(
      'request_failed',
      `Could not connect to the ${label} catalog endpoint.`,
    )
  }
  if (!response.ok) {
    const code = response.status === 401
      ? 'unauthenticated'
      : response.status === 403
        ? 'forbidden'
        : 'request_failed'
    throw new CatalogLoadError(
      code,
      `Could not load ${label} catalog (HTTP ${response.status}).`,
      response.status,
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new CatalogLoadError(
      'invalid_response',
      `${label[0].toUpperCase()}${label.slice(1)} catalog response is not valid JSON.`,
      response.status,
    )
  }
  return mapCatalog(body)
}

export function loadSimulatorCatalog(
  options: LoadSimulatorCatalogOptions = {},
): Promise<SimulatorCatalog> {
  return loadCatalog(
    options.endpoint ?? DEFAULT_CATALOG_ENDPOINT,
    options,
    'simulator',
  )
}

/**
 * Load the read-only catalog used by workspace/module pages.
 *
 * It intentionally has a separate endpoint from the packet simulator: the
 * simulator is an administrator-only action, while regular users still need
 * to inspect their own devices and protocol metadata.
 */
export function loadWorkspaceCatalog(
  options: LoadSimulatorCatalogOptions = {},
): Promise<SimulatorCatalog> {
  return loadCatalog(
    options.endpoint ?? DEFAULT_WORKSPACE_CATALOG_ENDPOINT,
    options,
    'workspace',
  )
}
