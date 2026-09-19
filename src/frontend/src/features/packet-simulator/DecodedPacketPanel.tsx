import {
  Binary,
  Braces,
  CalendarClock,
  CircleCheck,
  Database,
  ToggleLeft,
  TriangleAlert,
  Type,
} from 'lucide-react'

import { PipelineStrip } from './PipelineStrip'
import type { ProjectedReading } from './packetProtocol'
import type { SimulationPhase, SimulationReceipt } from './simulatorTypes'

const readingIcons = {
  integer: Binary,
  datetime: CalendarClock,
  string: Type,
  boolean: ToggleLeft,
} as const

function ReadingCard({ reading }: { reading: ProjectedReading }) {
  const Icon = readingIcons[reading.valueType]
  return (
    <article>
      <Icon size={18} aria-hidden="true" />
      <span>{reading.title}</span>
      <strong dir={reading.valueType === 'string' ? undefined : 'ltr'}>{reading.displayValue}</strong>
      <small dir="ltr">{reading.code} · {reading.valueType}</small>
    </article>
  )
}

export function DecodedPacketPanel({
  phase,
  receipt,
}: {
  phase: SimulationPhase
  receipt?: SimulationReceipt
}) {
  return (
    <section className="simulator-card decoded-card" aria-labelledby="decoded-title">
      <header className="simulator-card__header">
        <div>
          <span className="simulator-kicker">نتیجهٔ دریافت</span>
          <h2 id="decoded-title">payload رمزگشایی‌شده</h2>
          <p>مقادیر از همان payload بازخوانی و خوانش‌ها ساخته می‌شوند.</p>
        </div>
        {receipt ? (
          <span className={`receipt-status receipt-status--${receipt.status}`}>
            {receipt.status === 'processed' ? <CircleCheck size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}
            {receipt.status === 'processed' ? 'پردازش‌شده' : 'ناموفق'}
          </span>
        ) : null}
      </header>

      <div className="pipeline-strip-wrap">
        <PipelineStrip phase={phase} />
      </div>

      {!receipt ? (
        <div className="simulator-empty">
          <Braces size={28} aria-hidden="true" />
          <strong>هنوز payloadی دریافت نشده است</strong>
          <p>با دکمهٔ «دریافت payload تولیدشده» نتیجهٔ تجزیهٔ همین schema اینجا دیده می‌شود.</p>
        </div>
      ) : receipt.status === 'failed' ? (
        <div className="decoded-failure" role="alert">
          <TriangleAlert size={24} aria-hidden="true" />
          <div>
            <strong>payload با schema پایگاه داده منطبق نشد</strong>
            <p>{receipt.error}</p>
            <span><Database size={14} aria-hidden="true" />{receipt.rawEventId} در حافظهٔ این نشست حفظ شد.</span>
          </div>
        </div>
      ) : (
        <div className="decoded-body">
          <dl className="decoded-envelope">
            <div><dt>شناسهٔ درگاه</dt><dd><code dir="ltr">{receipt.envelope.gatewayUid}</code></dd></div>
            <div><dt>شناسهٔ دستگاه</dt><dd><code dir="ltr">{receipt.envelope.deviceLocalId}</code></dd></div>
            <div><dt>schema</dt><dd><code dir="ltr">{receipt.schemaId}</code></dd></div>
            <div><dt>رویداد خام (شبیه‌سازی‌شده)</dt><dd><code dir="ltr">{receipt.rawEventId}</code></dd></div>
          </dl>

          <h3 className="decoded-section-title">بازخوانی فیلدها از payload</h3>
          <div className="decoded-fields" aria-label="بازخوانی فیلدها از payload">
            {receipt.fields?.map((field) => (
              <article key={field.id}>
                <span>{field.name}</span>
                <strong dir="ltr">{String(field.value)}</strong>
                <small dir="ltr">{field.code} · [{field.startByte}, {field.endByte})</small>
              </article>
            ))}
          </div>

          <h3 className="decoded-section-title">خوانش‌های ساخته‌شده</h3>
          <div className="projected-readings" aria-label="خوانش‌های ساخته‌شده">
            {receipt.readings?.map((reading) => <ReadingCard key={reading.code} reading={reading} />)}
          </div>
        </div>
      )}
    </section>
  )
}
