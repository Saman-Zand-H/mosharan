import { CheckCircle2, Clock3, Inbox, Trash2, TriangleAlert } from 'lucide-react'

import type { SimulationReceipt } from './simulatorTypes'

interface SimulationHistoryProps {
  activeReceiptId?: string
  selectionDisabled: boolean
  receipts: readonly SimulationReceipt[]
  onClear: () => void
  onSelect: (receipt: SimulationReceipt) => void
}

export function SimulationHistory({
  activeReceiptId,
  selectionDisabled,
  receipts,
  onClear,
  onSelect,
}: SimulationHistoryProps) {
  return (
    <section className="simulator-card history-card" aria-labelledby="history-title">
      <header className="simulator-card__header">
        <div>
          <span className="simulator-kicker">حافظهٔ نشست</span>
          <h2 id="history-title">رویدادهای شبیه‌سازی‌شده</h2>
          <p>حداکثر هشت دریافت اخیر در مرورگر نگه داشته می‌شود.</p>
        </div>
        <button className="history-clear" type="button" onClick={onClear} disabled={!receipts.length}>
          <Trash2 size={15} aria-hidden="true" />
          پاک‌کردن
        </button>
      </header>

      {!receipts.length ? (
        <div className="simulator-empty simulator-empty--compact">
          <Inbox size={25} aria-hidden="true" />
          <strong>نشست خالی است</strong>
          <p>اولین دریافت در این فهرست ثبت خواهد شد.</p>
        </div>
      ) : (
        <ol className="simulation-log">
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <button
                type="button"
                disabled={selectionDisabled}
                aria-current={receipt.id === activeReceiptId ? 'true' : undefined}
                onClick={() => onSelect(receipt)}
              >
                <span className={`simulation-log__status simulation-log__status--${receipt.status}`}>
                  {receipt.status === 'processed' ? <CheckCircle2 size={17} aria-hidden="true" /> : <TriangleAlert size={17} aria-hidden="true" />}
                </span>
                <span className="simulation-log__copy">
                  <span><strong>{receipt.eventTitle}</strong><time>{receipt.receivedAt}</time></span>
                  <small>
                    <code dir="ltr">
                      {receipt.envelope.gatewayUid}/{receipt.envelope.deviceLocalId}
                    </code>
                    {' · '}
                    <code dir="ltr">{receipt.rawEventId}</code>
                  </small>
                </span>
                <span className="simulation-log__meta">
                  <b dir="ltr">{receipt.byteLength === undefined ? '—' : `${receipt.byteLength} B`}</b>
                  <small><Clock3 size={11} aria-hidden="true" />{receipt.latencyMs.toLocaleString('fa-IR')} ms</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
