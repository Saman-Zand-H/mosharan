import {
  CirclePlay,
  Clock3,
  Radio,
  RotateCcw,
  Square,
  TriangleAlert,
} from 'lucide-react'

import {
  fieldDraftByteLength,
  type FieldDrafts,
  type GapByte,
  type PayloadGenerationResult,
} from './payloadGenerator'
import type {
  CatalogField,
  CatalogPayloadSchema,
} from './schemaCatalog'

export interface PacketComposerProps {
  readonly schemas: readonly CatalogPayloadSchema[]
  readonly schemaId: string
  readonly drafts: FieldDrafts
  readonly generation: PayloadGenerationResult
  readonly gapByte: GapByte
  readonly busy: boolean
  readonly streaming: boolean
  readonly canReceive: boolean
  readonly onDraftChange: (fieldId: string, value: string) => void
  readonly onFillTimestamp: (fieldId: string) => void
  readonly onGapByteChange: (gapByte: GapByte) => void
  readonly onReceive: () => void
  readonly onReset: () => void
  readonly onSchemaChange: (schemaId: string) => void
  readonly onToggleStream: () => void
}

const orderedFields = (schema: CatalogPayloadSchema | undefined) =>
  [...(schema?.fields ?? [])].sort(
    (left, right) =>
      left.startByte - right.startByte || left.id.localeCompare(right.id),
  )

const booleanOptions = (field: CatalogField): readonly { value: string; label: string }[] => {
  const width = field.endByte - field.startByte
  return ['0', '1', 'false', 'true']
    .filter((token) => token.length <= width)
    .map((token) => ({
      value: token.padStart(width, ' '),
      label: token === '0'
        ? '0 · false'
        : token === '1'
          ? '1 · true'
          : token,
    }))
}

const fieldDetail = (field: CatalogField, usedBytes: number): string => {
  const width = field.endByte - field.startByte
  return `${field.code} · ${field.wireCodec} · ${field.role} · [${field.startByte}, ${field.endByte}) · ${usedBytes}/${width} B`
}

export function PacketComposer({
  schemas,
  schemaId,
  drafts,
  generation,
  gapByte,
  busy,
  streaming,
  canReceive,
  onDraftChange,
  onFillTimestamp,
  onGapByteChange,
  onReceive,
  onReset,
  onSchemaChange,
  onToggleStream,
}: PacketComposerProps) {
  const schema = schemas.find((item) => item.id === schemaId) ?? schemas[0]
  const fields = orderedFields(schema)
  const issues = generation.ok ? [] : generation.issues
  const globalIssues = issues.filter((item) => item.fieldId === undefined)
  const generatedLength = generation.ok ? generation.length : undefined

  return (
    <section className="simulator-card packet-composer" aria-labelledby="packet-composer-title">
      <header className="simulator-card__header">
        <div>
          <span className="simulator-kicker">مولد مبتنی بر PayloadField</span>
          <h2 id="packet-composer-title">ساخت payload آزمایشی</h2>
          <p>هر مقدار در بازهٔ بایتی ثبت‌شده در پایگاه داده نوشته می‌شود.</p>
        </div>
        <span className="packet-size" dir="ltr">
          {generatedLength ?? '—'} / {schema?.expectedLength ?? 'dynamic'} B
        </span>
      </header>

      <div className="packet-form">
        <label className="packet-field">
          <span>PayloadSchema پایگاه داده</span>
          <select
            value={schemaId}
            disabled={busy || streaming}
            onChange={(event) => onSchemaChange(event.target.value)}
          >
            {schemas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.eventType.title} · {item.deviceType.title} · v{item.version}
              </option>
            ))}
          </select>
          <small>
            <code dir="ltr">{schema?.id}</code> از API پایگاه داده
          </small>
        </label>

        <label className="packet-field">
          <span>پرکنندهٔ فاصله‌ها</span>
          <select
            value={String(gapByte)}
            disabled={busy || streaming}
            onChange={(event) => onGapByteChange(Number(event.target.value) as GapByte)}
          >
            <option value="32">space · 0x20</option>
            <option value="48">zero · 0x30</option>
          </select>
          <small>فاصله‌ها و دنبالهٔ خارج از PayloadField با یک بایت ASCII امن پر می‌شوند.</small>
        </label>

        {fields.map((field) => {
          const value = drafts[field.id] ?? ''
          const usedBytes = fieldDraftByteLength(value)
          const fieldIssues = issues.filter((item) => item.fieldId === field.id)
          const controlId = `payload-field-${field.id}`
          return (
            <div className="packet-field" key={field.id}>
              <label htmlFor={controlId}>{field.name}</label>
              {field.wireCodec === 'boolean' ? (
                <select
                  id={controlId}
                  value={value}
                  disabled={busy || streaming}
                  onChange={(event) => onDraftChange(field.id, event.target.value)}
                >
                  {booleanOptions(field).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  id={controlId}
                  dir="ltr"
                  rows={2}
                  spellCheck={false}
                  value={value}
                  disabled={busy || streaming}
                  onChange={(event) => onDraftChange(field.id, event.target.value)}
                />
              )}
              <small dir="ltr">{fieldDetail(field, usedBytes)}</small>
              {field.role === 'timestamp' ? (
                <button
                  className="history-clear"
                  type="button"
                  disabled={busy || streaming}
                  onClick={() => onFillTimestamp(field.id)}
                >
                  <Clock3 size={14} aria-hidden="true" />
                  زمان اکنون
                </button>
              ) : null}
              {fieldIssues.map((item) => (
                <small key={`${item.code}-${item.message}`} role="alert">
                  {item.message}
                </small>
              ))}
            </div>
          )
        })}

        <label className="packet-field packet-field--hex">
          <span>payload خام تولیدشده</span>
          <textarea
            dir="ltr"
            rows={4}
            spellCheck={false}
            readOnly
            value={generation.ok ? generation.payload : ''}
            aria-describedby={globalIssues.length ? 'payload-generation-errors' : undefined}
          />
          <small>این متن دقیقاً به بایت‌های UTF-8 قابل مشاهده در بازرس تبدیل می‌شود.</small>
        </label>
      </div>

      {globalIssues.length ? (
        <div className="decoded-failure" id="payload-generation-errors" role="alert">
          <TriangleAlert size={20} aria-hidden="true" />
          <div>
            <strong>schema قابل تولید نیست</strong>
            {globalIssues.map((item) => <p key={`${item.code}-${item.message}`}>{item.message}</p>)}
          </div>
        </div>
      ) : null}

      <div className="packet-utilities">
        <button type="button" onClick={onReset} disabled={busy || streaming}>
          <RotateCcw size={15} aria-hidden="true" />
          بازنشانی فیلدها
        </button>
      </div>

      <div className="packet-actions">
        <button
          className="button button--primary"
          type="button"
          onClick={onReceive}
          disabled={busy || streaming || !generation.ok || !canReceive}
        >
          <CirclePlay size={18} aria-hidden="true" />
          {busy ? 'در حال پردازش…' : 'دریافت payload تولیدشده'}
        </button>
        <button
          className={`button ${streaming ? 'button--danger' : 'button--secondary'}`}
          type="button"
          onClick={onToggleStream}
          disabled={!generation.ok || !canReceive}
        >
          {streaming
            ? <Square size={16} aria-hidden="true" />
            : <Radio size={17} aria-hidden="true" />}
          {streaming ? 'توقف جریان' : 'شروع جریان خودکار'}
        </button>
      </div>
    </section>
  )
}
