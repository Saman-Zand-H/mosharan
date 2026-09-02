import type {
  CatalogField,
  CatalogPayloadSchema,
  CatalogProjectionRule,
  ParameterValueType,
} from './schemaCatalog'

export interface DecodedField extends CatalogField {
  readonly rawHex: string
  readonly rawText: string
  readonly value: string | boolean
}

export interface ProjectedReading {
  readonly code: string
  readonly title: string
  readonly valueType: ParameterValueType
  readonly value: string | boolean
  readonly displayValue: string
  readonly unit?: string
}

export interface ParsedPayload {
  readonly payloadBytes: Uint8Array
  readonly payloadHex: string
  readonly fields: readonly DecodedField[]
  readonly readings: readonly ProjectedReading[]
  readonly deviceTimestamp?: string
}

export type PayloadParseResult =
  | { readonly ok: true; readonly parsed: ParsedPayload }
  | { readonly ok: false; readonly error: string }

const encoder = new TextEncoder()
const asciiDecoder = new TextDecoder('ascii', { fatal: true })
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
const BIGINT_MIN = -(2n ** 63n)
const BIGINT_MAX = 2n ** 63n - 1n

export const bytesToHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')

const decodeField = (field: CatalogField, bytes: Uint8Array): DecodedField => {
  const segment = bytes.slice(field.startByte, field.endByte)
  let rawText: string
  let value: string | boolean

  try {
    if (field.wireCodec === 'utf8') {
      rawText = utf8Decoder.decode(segment)
      value = rawText
    } else {
      if (segment.some((byte) => byte > 0x7f)) throw new Error('invalid ASCII')
      rawText = asciiDecoder.decode(segment)
      const token = rawText.trim()
      if (field.wireCodec === 'integer') {
        if (!/^[+-]?\d(?:_?\d)*$/.test(token)) throw new Error('invalid integer')
        value = String(BigInt(token.replaceAll('_', '')))
      } else if (field.wireCodec === 'boolean') {
        const normalized = token.toLowerCase()
        if (normalized === '1' || normalized === 'true') value = true
        else if (normalized === '0' || normalized === 'false') value = false
        else throw new Error('invalid boolean')
      } else {
        throw new Error('unsupported codec')
      }
    }
  } catch {
    throw new Error(`فیلد «${field.name}» با codec تعریف‌شده در پایگاه داده قابل خواندن نیست.`)
  }

  return {
    ...field,
    rawHex: bytesToHex(segment),
    rawText,
    value,
  }
}

const datetimeReading = (
  value: string | boolean,
  rule: CatalogProjectionRule,
): { value: string; displayValue: string } => {
  const timestamp = value
  if (typeof timestamp !== 'string' || !/^[+-]?\d+$/.test(timestamp)) {
    throw new Error(`خوانش «${rule.parameter.title}» به timestamp عددی نیاز دارد.`)
  }
  const integer = BigInt(timestamp)
  const limit = BigInt(Number.MAX_SAFE_INTEGER)
  if (integer > limit || integer < -limit) {
    throw new Error(`timestamp خوانش «${rule.parameter.title}» خارج از محدوده است.`)
  }
  const configuredUnit = rule.conversionConfig.timestampUnit
  const unknownKeys = Object.keys(rule.conversionConfig).filter(
    (key) => key !== 'timestampUnit',
  )
  if (
    unknownKeys.length ||
    (configuredUnit !== undefined &&
      configuredUnit !== 'seconds' &&
      configuredUnit !== 'milliseconds')
  ) {
    throw new Error(`تنظیم تبدیل خوانش «${rule.parameter.title}» معتبر نیست.`)
  }
  const unit = configuredUnit ?? 'seconds'
  const milliseconds = Number(integer) * (unit === 'milliseconds' ? 1 : 1000)
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`timestamp خوانش «${rule.parameter.title}» معتبر نیست.`)
  }
  const year = date.getUTCFullYear()
  if (year < 1 || year > 9999) {
    throw new Error(`timestamp خوانش «${rule.parameter.title}» خارج از محدوده است.`)
  }
  return {
    value: date.toISOString(),
    displayValue: new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'UTC',
    }).format(date),
  }
}

const projectRule = (
  rule: CatalogProjectionRule,
  fieldsById: ReadonlyMap<string, DecodedField>,
): ProjectedReading => {
  if (!['field', 'constant'].includes(rule.sourceKind)) {
    throw new Error(`نوع منبع خوانش «${rule.parameter.title}» پشتیبانی نمی‌شود.`)
  }
  if (
    typeof rule.conversionConfig !== 'object' ||
    rule.conversionConfig === null ||
    Array.isArray(rule.conversionConfig)
  ) {
    throw new Error(`تنظیم تبدیل خوانش «${rule.parameter.title}» باید یک object باشد.`)
  }
  if (!['integer', 'datetime', 'string', 'boolean'].includes(rule.parameter.valueType)) {
    throw new Error(`نوع خوانش «${rule.parameter.title}» پشتیبانی نمی‌شود.`)
  }
  const sourceValue =
    rule.sourceKind === 'constant'
      ? rule.constantValue
      : fieldsById.get(rule.sourceFieldId ?? '')?.value
  if (sourceValue === undefined || sourceValue === null) {
    throw new Error(`منبع خوانش «${rule.parameter.title}» در schema پیدا نشد.`)
  }
  const sourceField = rule.sourceKind === 'field'
    ? fieldsById.get(rule.sourceFieldId ?? '')
    : undefined
  if (
    sourceField?.role === 'timestamp' &&
    rule.parameter.valueType !== 'datetime'
  ) {
    throw new Error(`فیلد timestamp باید در خوانش datetime استفاده شود.`)
  }

  if (rule.parameter.valueType === 'datetime') {
    const projected = datetimeReading(sourceValue, rule)
    return { ...rule.parameter, ...projected }
  }
  if (rule.parameter.valueType === 'integer') {
    if (Object.keys(rule.conversionConfig).length) {
      throw new Error(`خوانش integer «${rule.parameter.title}» تنظیم تبدیل نمی‌پذیرد.`)
    }
    const integer = sourceValue
    if (typeof integer !== 'string' || !/^[+-]?\d+$/.test(integer)) {
      throw new Error(`خوانش «${rule.parameter.title}» به مقدار integer نیاز دارد.`)
    }
    const normalizedInteger = BigInt(integer)
    if (normalizedInteger < BIGINT_MIN || normalizedInteger > BIGINT_MAX) {
      throw new Error(`خوانش «${rule.parameter.title}» از محدودهٔ BigInteger خارج است.`)
    }
    return {
      ...rule.parameter,
      value: String(normalizedInteger),
      displayValue: `${normalizedInteger}${rule.parameter.unit ? ` ${rule.parameter.unit}` : ''}`,
    }
  }
  if (rule.parameter.valueType === 'boolean') {
    if (Object.keys(rule.conversionConfig).length) {
      throw new Error(`خوانش boolean «${rule.parameter.title}» تنظیم تبدیل نمی‌پذیرد.`)
    }
    if (typeof sourceValue !== 'boolean') {
      throw new Error(`خوانش «${rule.parameter.title}» به مقدار boolean نیاز دارد.`)
    }
    return {
      ...rule.parameter,
      value: sourceValue,
      displayValue: sourceValue ? 'بله' : 'خیر',
    }
  }
  if (Object.keys(rule.conversionConfig).length) {
    throw new Error(`خوانش string «${rule.parameter.title}» تنظیم تبدیل نمی‌پذیرد.`)
  }
  if (typeof sourceValue !== 'string') {
    throw new Error(`خوانش «${rule.parameter.title}» به مقدار string نیاز دارد.`)
  }
  if (rule.parameter.valueType !== 'string') {
    throw new Error(`نوع خوانش «${rule.parameter.title}» پشتیبانی نمی‌شود.`)
  }
  return { ...rule.parameter, value: sourceValue, displayValue: sourceValue }
}

export function parsePayload(
  schema: CatalogPayloadSchema,
  payload: string,
): PayloadParseResult {
  if (schema.encoding !== 'utf-8') {
    return { ok: false, error: 'encoding این schema پشتیبانی نمی‌شود.' }
  }
  const payloadBytes = encoder.encode(payload)
  if (
    schema.expectedLength !== null &&
    (!Number.isInteger(schema.expectedLength) || schema.expectedLength <= 0)
  ) {
    return { ok: false, error: 'طول مورد انتظار schema معتبر نیست.' }
  }
  if (
    schema.expectedLength !== null &&
    payloadBytes.length !== schema.expectedLength
  ) {
    return {
      ok: false,
      error: `طول payload برای schema «${schema.eventType.title}» باید ${schema.expectedLength.toLocaleString('fa-IR')} بایت باشد؛ ${payloadBytes.length.toLocaleString('fa-IR')} بایت دریافت شد.`,
    }
  }

  try {
    const fields = [...schema.fields]
      .sort((left, right) => left.startByte - right.startByte || left.id.localeCompare(right.id))
      .map((field) => {
        if (
          !Number.isInteger(field.startByte) ||
          !Number.isInteger(field.endByte) ||
          field.startByte < 0 ||
          field.endByte <= field.startByte ||
          field.endByte > payloadBytes.length
        ) {
          throw new Error(`بازهٔ بایتی فیلد «${field.name}» با payload سازگار نیست.`)
        }
        return decodeField(field, payloadBytes)
      })
    const fieldsById = new Map(fields.map((field) => [field.id, field]))
    const readings = schema.projectionRules.map((rule) => projectRule(rule, fieldsById))
    const timestampRuleIndex = schema.projectionRules.findIndex(
      (rule) =>
        rule.sourceKind === 'field' &&
        rule.parameter.valueType === 'datetime' &&
        fieldsById.get(rule.sourceFieldId ?? '')?.role === 'timestamp',
    )
    const timestampReading = readings[timestampRuleIndex]
    const deviceTimestamp = timestampReading?.valueType === 'datetime'
      ? String(timestampReading.value)
      : undefined

    return {
      ok: true,
      parsed: {
        payloadBytes,
        payloadHex: bytesToHex(payloadBytes),
        fields,
        readings,
        deviceTimestamp,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'تجزیهٔ payload ناموفق بود.',
    }
  }
}
