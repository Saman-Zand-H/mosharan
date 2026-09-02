import { useEffect, useRef, useState } from 'react'
import { Check, Copy, FileJson, X } from 'lucide-react'

import type { EventRecord } from '../../types'
import { StatusBadge } from '../shared/StatusBadge'

interface EventDetailDrawerProps {
  event: EventRecord
  onClose: () => void
}

export function EventDetailDrawer({ event, onClose }: EventDetailDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(event.rawPayload)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="event-drawer"
      aria-labelledby="event-detail-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="event-drawer__bar">
        <span>جزئیات رویداد</span>
        <button className="icon-button" type="button" aria-label="بستن" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="event-drawer__content">
        <div className="event-drawer__heading">
          <span className="event-drawer__icon"><FileJson size={22} aria-hidden="true" /></span>
          <div>
            <p>رویداد خام</p>
            <h2 id="event-detail-title">{event.type}</h2>
          </div>
          <StatusBadge status={event.status} />
        </div>

        {event.error ? (
          <div className="event-error" role="alert">
            <strong>علت پردازش ناموفق</strong>
            <p>{event.error}</p>
          </div>
        ) : null}

        <dl className="event-details">
          <div><dt>شناسه دستگاه</dt><dd><code dir="ltr">{event.device}</code></dd></div>
          <div><dt>درگاه</dt><dd>{event.gateway}</dd></div>
          <div><dt>زمان رویداد</dt><dd>{event.occurredAt}</dd></div>
          <div><dt>طرح‌واره</dt><dd><code dir="ltr">{event.schema}</code></dd></div>
        </dl>

        <section className="payload-block" aria-labelledby="payload-title">
          <div className="payload-block__header">
            <div>
              <h3 id="payload-title">Payload خام</h3>
              <span>UTF-8 · منبع تغییرناپذیر</span>
            </div>
            <button type="button" onClick={copyPayload}>
              {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              {copied ? 'کپی شد' : 'کپی'}
            </button>
          </div>
          <pre dir="ltr"><code>{event.rawPayload}</code></pre>
        </section>

        <p className="drawer-note">
          این نما فقط دادهٔ خام و نتیجهٔ پردازش را نمایش می‌دهد. بازپردازش پس از اتصال API فعال خواهد شد.
        </p>
      </div>
    </dialog>
  )
}
