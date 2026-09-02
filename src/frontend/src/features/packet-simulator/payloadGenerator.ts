import { bytesToHex, parsePayload } from './packetProtocol'
import type {
  CatalogField,
  CatalogPayloadSchema,
  FieldRole,
  WireCodec,
} from './schemaCatalog'

export type FieldDrafts = Readonly<Record<string, string>>
export type GapByte = 0x20 | 0x30

export interface PayloadGenerationOptions {
  readonly gapByte?: GapByte
}

export type GenerationIssueCode =
  | 'invalid_schema'
  | 'overlap'
  | 'out_of_bounds'
  | 'missing_value'
  | 'invalid_value'
  | 'width_mismatch'
  | 'invalid_utf8'
  | 'parser_rejected'

export interface GenerationIssue {
  readonly code: GenerationIssueCode
  readonly message: string
  readonly fieldId?: string
}

export interface GeneratedField {
  readonly field: CatalogField
  readonly bytes: Uint8Array
  readonly rawHex: string
  readonly text: string
  readonly decodedValue: string | boolean
}

export type PayloadGenerationResult =
  | {
      readonly ok: true
      readonly payload: string
      readonly bytes: Uint8Array
      readonly hex: string
      readonly fields: readonly GeneratedField[]
      readonly length: number
    }
  | {
      readonly ok: false
      readonly issues: readonly GenerationIssue[]
    }

export type DraftExtractionResult =
  | { readonly ok: true; readonly drafts: FieldDrafts }
  | { readonly ok: false; readonly issues: readonly GenerationIssue[] }

export interface CurrentTimestampDraft {
  readonly value: string
  readonly unit: 'seconds' | 'milliseconds'
}

const encoder = new TextEncoder()
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
const INTEGER_PATTERN = /^[+-]?\d(?:_?\d)*$/
const BOOLEAN_TOKENS = new Set(['0', '1', 'false', 'true'])
const WIRE_CODECS = new Set<WireCodec>(['integer', 'utf8', 'boolean'])
const FIELD_ROLES = new Set<FieldRole>([
  'metric',
  'timestamp',
  'sequence',
  'checksum',
])
export const MAX_GENERATED_PAYLOAD_BYTES = 64 * 1024

const issue = (
  code: GenerationIssueCode,
  message: string,
  fieldId?: string,
): GenerationIssue => ({ code, message, ...(fieldId ? { fieldId } : {}) })

const orderedFields = (schema: CatalogPayloadSchema): readonly CatalogField[] =>
  [...schema.fields].sort(
    (left, right) =>
      left.startByte - right.startByte || left.id.localeCompare(right.id),
  )

const hasUnpairedSurrogate = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const following = value.charCodeAt(index + 1)
      if (following < 0xdc00 || following > 0xdfff) return true
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true
    }
  }
  return false
}

export const validatePayloadSchemaForGeneration = (
  schema: CatalogPayloadSchema,
): readonly GenerationIssue[] => {
  const issues: GenerationIssue[] = []
  if (schema.encoding !== 'utf-8') {
    issues.push(issue('invalid_schema', 'تنها encoding از نوع UTF-8 پشتیبانی می‌شود.'))
  }
  if (
    schema.expectedLength !== null &&
    (!Number.isSafeInteger(schema.expectedLength) || schema.expectedLength <= 0)
  ) {
    issues.push(issue('invalid_schema', 'طول مورد انتظار schema باید عددی مثبت یا null باشد.'))
  }

  const ids = new Set<string>()
  const codes = new Set<string>()
  let timestampCount = 0
  for (const field of orderedFields(schema)) {
    if (ids.has(field.id)) {
      issues.push(issue('invalid_schema', `شناسهٔ فیلد «${field.id}» تکراری است.`, field.id))
    }
    ids.add(field.id)
    if (codes.has(field.code)) {
      issues.push(issue('invalid_schema', `کد فیلد «${field.code}» تکراری است.`, field.id))
    }
    codes.add(field.code)
    if (
      !Number.isSafeInteger(field.startByte) ||
      !Number.isSafeInteger(field.endByte) ||
      field.startByte < 0 ||
      field.endByte <= field.startByte
    ) {
      issues.push(issue('invalid_schema', `بازهٔ فیلد «${field.name}» معتبر نیست.`, field.id))
    }
    if (!WIRE_CODECS.has(field.wireCodec)) {
      issues.push(issue('invalid_schema', `codec فیلد «${field.name}» پشتیبانی نمی‌شود.`, field.id))
    }
    if (!FIELD_ROLES.has(field.role)) {
      issues.push(issue('invalid_schema', `نقش فیلد «${field.name}» پشتیبانی نمی‌شود.`, field.id))
    }
    if (field.role === 'timestamp') {
      timestampCount += 1
      if (field.wireCodec !== 'integer') {
        issues.push(issue('invalid_schema', 'فیلد timestamp باید codec عدد صحیح داشته باشد.', field.id))
      }
    }
    if (
      schema.expectedLength !== null &&
      Number.isInteger(field.endByte) &&
      field.endByte > schema.expectedLength
    ) {
      issues.push(issue('out_of_bounds', `فیلد «${field.name}» از طول schema عبور می‌کند.`, field.id))
    }
  }
  if (timestampCount > 1) {
    issues.push(issue('invalid_schema', 'هر schema حداکثر یک فیلد timestamp می‌تواند داشته باشد.'))
  }

  const generatedLength = schema.expectedLength ?? orderedFields(schema).reduce(
    (maximum, field) => Math.max(maximum, field.endByte),
    0,
  )
  if (generatedLength > MAX_GENERATED_PAYLOAD_BYTES) {
    issues.push(
      issue(
        'out_of_bounds',
        `طول payload از سقف ${MAX_GENERATED_PAYLOAD_BYTES} بایتی دریافت رویداد بیشتر است.`,
      ),
    )
  }

  let furthestEnd = -1
  let furthestField: CatalogField | undefined
  for (const field of orderedFields(schema)) {
    if (field.startByte < furthestEnd) {
      issues.push(
        issue(
          'overlap',
          `فیلد «${field.name}» با فیلد «${furthestField?.name ?? 'قبلی'}» هم‌پوشانی دارد.`,
          field.id,
        ),
      )
    }
    if (field.endByte > furthestEnd) {
      furthestEnd = field.endByte
      furthestField = field
    }
  }
  return issues
}

const defaultDraft = (field: CatalogField): string => {
  const width = Math.max(0, field.endByte - field.startByte)
  if (field.wireCodec === 'utf8') return ' '.repeat(width)
  if (field.wireCodec === 'boolean') return '0'.padStart(width, ' ')
  return '0'.repeat(width)
}

export const createFieldDrafts = (schema: CatalogPayloadSchema): FieldDrafts =>
  Object.fromEntries(schema.fields.map((field) => [field.id, defaultDraft(field)]))

export const fieldDraftByteLength = (value: string): number =>
  encoder.encode(value).length

export function extractFieldDrafts(
  schema: CatalogPayloadSchema,
  payload: string,
): DraftExtractionResult {
  const issues = [...validatePayloadSchemaForGeneration(schema)]
  if (hasUnpairedSurrogate(payload)) {
    issues.push(issue('invalid_utf8', 'payload شامل نویسهٔ ناقص UTF-16 است و در UTF-8 قابل تولید نیست.'))
  }
  if (issues.length) return { ok: false, issues }

  const bytes = encoder.encode(payload)
  if (schema.expectedLength !== null && bytes.length !== schema.expectedLength) {
    return {
      ok: false,
      issues: [
        issue(
          'width_mismatch',
          `طول payload باید ${schema.expectedLength} بایت باشد؛ ${bytes.length} بایت دریافت شد.`,
        ),
      ],
    }
  }

  const drafts: Record<string, string> = {}
  const extractionIssues: GenerationIssue[] = []
  for (const field of orderedFields(schema)) {
    if (field.endByte > bytes.length) {
      extractionIssues.push(
        issue('out_of_bounds', `payload برای فیلد «${field.name}» کوتاه است.`, field.id),
      )
      continue
    }
    try {
      drafts[field.id] = utf8Decoder.decode(bytes.slice(field.startByte, field.endByte))
    } catch {
      extractionIssues.push(
        issue(
          'invalid_utf8',
          `offset فیلد «${field.name}» یک نویسهٔ چندبایتی UTF-8 را نصف می‌کند.`,
          field.id,
        ),
      )
    }
  }
  return extractionIssues.length
    ? { ok: false, issues: extractionIssues }
    : { ok: true, drafts }
}

const decodeDraftValue = (
  field: CatalogField,
  draft: string,
): string | boolean | GenerationIssue => {
  if (field.wireCodec === 'utf8') return draft
  const token = draft.trim()
  if (field.wireCodec === 'integer') {
    if (!INTEGER_PATTERN.test(token)) {
      return issue('invalid_value', `فیلد «${field.name}» باید عدد صحیح ASCII باشد.`, field.id)
    }
    try {
      return String(BigInt(token.replaceAll('_', '')))
    } catch {
      return issue('invalid_value', `عدد فیلد «${field.name}» معتبر نیست.`, field.id)
    }
  }
  const normalized = token.toLowerCase()
  return BOOLEAN_TOKENS.has(normalized)
    ? normalized === '1' || normalized === 'true'
    : issue(
        'invalid_value',
        `فیلد «${field.name}» فقط 0، 1، false یا true می‌پذیرد.`,
        field.id,
      )
}

export function generatePayload(
  schema: CatalogPayloadSchema,
  drafts: FieldDrafts,
  options: PayloadGenerationOptions = {},
): PayloadGenerationResult {
  const issues = [...validatePayloadSchemaForGeneration(schema)]
  const gapByte = options.gapByte ?? 0x20
  if (gapByte !== 0x20 && gapByte !== 0x30) {
    issues.push(issue('invalid_schema', 'بایت پرکننده فقط می‌تواند space یا 0 باشد.'))
  }
  if (issues.length) return { ok: false, issues }

  const generatedFields: GeneratedField[] = []
  for (const field of orderedFields(schema)) {
    if (!Object.prototype.hasOwnProperty.call(drafts, field.id)) {
      issues.push(issue('missing_value', `برای فیلد «${field.name}» مقداری وارد نشده است.`, field.id))
      continue
    }
    const draft = drafts[field.id]
    if (typeof draft !== 'string') {
      issues.push(issue('invalid_value', `مقدار فیلد «${field.name}» باید متن باشد.`, field.id))
      continue
    }
    if (hasUnpairedSurrogate(draft)) {
      issues.push(issue('invalid_utf8', `فیلد «${field.name}» شامل نویسهٔ ناقص است.`, field.id))
      continue
    }
    const bytes = encoder.encode(draft)
    const width = field.endByte - field.startByte
    if (bytes.length !== width) {
      issues.push(
        issue(
          'width_mismatch',
          `فیلد «${field.name}» باید دقیقاً ${width} بایت باشد؛ مقدار فعلی ${bytes.length} بایت است.`,
          field.id,
        ),
      )
      continue
    }
    const decodedValue = decodeDraftValue(field, draft)
    if (typeof decodedValue === 'object') {
      issues.push(decodedValue)
      continue
    }
    generatedFields.push({
      field,
      bytes,
      rawHex: bytesToHex(bytes),
      text: draft,
      decodedValue,
    })
  }
  if (issues.length) return { ok: false, issues }

  const maximumFieldEnd = orderedFields(schema).reduce(
    (maximum, field) => Math.max(maximum, field.endByte),
    0,
  )
  const length = schema.expectedLength ?? maximumFieldEnd
  const bytes = new Uint8Array(length)
  bytes.fill(gapByte)
  for (const generated of generatedFields) {
    bytes.set(generated.bytes, generated.field.startByte)
  }

  let payload: string
  try {
    payload = utf8Decoder.decode(bytes)
  } catch {
    return {
      ok: false,
      issues: [issue('invalid_utf8', 'بایت‌های تولیدشده یک payload معتبر UTF-8 نمی‌سازند.')],
    }
  }
  const parsed = parsePayload(schema, payload)
  if (!parsed.ok) {
    return {
      ok: false,
      issues: [issue('parser_rejected', parsed.error)],
    }
  }
  return {
    ok: true,
    payload,
    bytes,
    hex: bytesToHex(bytes),
    fields: generatedFields,
    length,
  }
}

export function createCurrentTimestampDraft(
  schema: CatalogPayloadSchema,
  fieldId: string,
  now: Date = new Date(),
): CurrentTimestampDraft {
  const field = schema.fields.find((item) => item.id === fieldId)
  const projection = schema.projectionRules.find(
    (rule) =>
      rule.sourceKind === 'field' &&
      rule.sourceFieldId === fieldId &&
      rule.parameter.valueType === 'datetime',
  )
  const unit = projection?.conversionConfig.timestampUnit === 'milliseconds'
    ? 'milliseconds'
    : 'seconds'
  const timestamp = unit === 'milliseconds'
    ? BigInt(now.getTime())
    : BigInt(Math.floor(now.getTime() / 1000))
  const raw = String(timestamp)
  const width = field ? field.endByte - field.startByte : raw.length
  return {
    value: raw.length < width ? raw.padStart(width, '0') : raw,
    unit,
  }
}
