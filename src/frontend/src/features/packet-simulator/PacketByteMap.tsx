import { useState } from 'react'
import { Braces, Database } from 'lucide-react'

import { bytesToHex, type DecodedField } from './packetProtocol'
import type { PayloadGenerationResult } from './payloadGenerator'
import type { CatalogField, CatalogPayloadSchema } from './schemaCatalog'

export interface PacketByteMapProps {
  readonly generation: PayloadGenerationResult
  readonly schema: CatalogPayloadSchema
  readonly decodedFields?: readonly DecodedField[]
}

const codecLabels = {
  integer: 'integer · ASCII',
  utf8: 'UTF-8 string',
  boolean: 'boolean · ASCII',
} as const

type FieldTone = 'timestamp' | 'sequence' | 'checksum' | 'state' | 'text' | 'data'

const toneFor = (field: CatalogField | undefined): FieldTone => {
  if (!field) return 'data'
  if (field.role === 'timestamp') return 'timestamp'
  if (field.role === 'sequence') return 'sequence'
  if (field.role === 'checksum') return 'checksum'
  if (field.wireCodec === 'boolean') return 'state'
  if (field.wireCodec === 'utf8') return 'text'
  return 'data'
}

const toneLegend: readonly { tone: FieldTone; label: string }[] = [
  { tone: 'timestamp', label: 'زمان' },
  { tone: 'sequence', label: 'توالی' },
  { tone: 'checksum', label: 'چک‌سام' },
  { tone: 'state', label: 'وضعیت' },
  { tone: 'text', label: 'متن' },
  { tone: 'data', label: 'داده' },
]

export function PacketByteMap({ generation, schema, decodedFields }: PacketByteMapProps) {
  const [selectedFieldId, setSelectedFieldId] = useState(schema.fields[0]?.id ?? '')
  const bytes = generation.ok ? generation.bytes : new Uint8Array()
  const hexBytes = bytesToHex(bytes).split(' ').filter(Boolean)
  const selectedSchema =
    schema.fields.find((field) => field.id === selectedFieldId) ?? schema.fields[0]
  const selectedDecoded = decodedFields?.find((field) => field.id === selectedSchema?.id)

  return (
    <section className="simulator-card byte-inspector" aria-labelledby="byte-inspector-title">
      <header className="simulator-card__header simulator-card__header--dark">
        <div>
          <span className="simulator-kicker">بازرس بایت‌ها</span>
          <h2 id="byte-inspector-title">نقشهٔ بایت‌های payload</h2>
          <p>
            <code dir="ltr">{schema.eventType.code}/{schema.deviceType.code}/v{schema.version}</code>
            {' · '}{bytes.length.toLocaleString('fa-IR')} بایت UTF-8
          </p>
        </div>
        <Database size={22} aria-hidden="true" />
      </header>

      <div className="byte-inspector__body">
        <div className="byte-grid" dir="ltr" aria-label="بایت‌های UTF-8 payload به ترتیب offset">
          {hexBytes.map((byte, index) => {
            const field = schema.fields.find(
              (item) => index >= item.startByte && index < item.endByte,
            )
            return (
              <span
                className={`byte-cell byte-cell--${toneFor(field)}`}
                key={`${index}-${byte}`}
                title={`${field?.name ?? 'خارج از فیلدها'} · offset ${index}`}
              >
                <small>{index % 4 === 0 ? index.toString().padStart(2, '0') : ''}</small>
                <b>{byte}</b>
              </span>
            )
          })}
        </div>

        <div className="byte-legend" aria-label="راهنمای رنگ نقشهٔ بایت‌ها">
          {toneLegend.map((item) => (
            <span key={item.tone}>
              <i className={`byte-legend__swatch byte-legend__swatch--${item.tone}`} />
              {item.label}
            </span>
          ))}
        </div>

        <div className="segment-selector" aria-label="فیلدهای schema">
          {schema.fields.map((field) => (
            <button
              className={`segment-chip segment-chip--${toneFor(field)}`}
              type="button"
              key={field.id}
              aria-pressed={field.id === selectedSchema?.id}
              onClick={() => setSelectedFieldId(field.id)}
            >
              <span>{field.name}</span>
              <code dir="ltr">[{field.startByte}, {field.endByte})</code>
            </button>
          ))}
        </div>

        {selectedSchema ? (
          <div className="segment-detail">
            <span className={`segment-detail__icon segment-detail__icon--${toneFor(selectedSchema)}`}>
              <Braces size={17} aria-hidden="true" />
            </span>
            <div>
              <span>PayloadField انتخاب‌شده</span>
              <strong>{selectedSchema.name}</strong>
              <small dir="ltr">{selectedSchema.code}</small>
            </div>
            <dl>
              <div><dt>codec</dt><dd dir="ltr">{codecLabels[selectedSchema.wireCodec]}</dd></div>
              <div><dt>مقدار</dt><dd dir="ltr">{selectedDecoded === undefined ? '—' : String(selectedDecoded.value)}</dd></div>
              <div><dt>raw hex</dt><dd dir="ltr">{selectedDecoded?.rawHex ?? '—'}</dd></div>
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  )
}
