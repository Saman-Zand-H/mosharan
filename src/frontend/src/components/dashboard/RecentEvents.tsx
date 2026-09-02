import { ChevronLeft } from 'lucide-react'

import type { EventRecord } from '../../types'
import { Panel } from '../shared/Panel'
import { StatusBadge } from '../shared/StatusBadge'

interface RecentEventsProps {
  events: EventRecord[]
  onSelect: (event: EventRecord) => void
}

export function RecentEvents({ events, onSelect }: RecentEventsProps) {
  return (
    <Panel
      className="events-panel"
      title="رویدادهای اخیر"
      description="آخرین پیام‌های ورودی به سامانه"
      action={<span className="live-label"><i />نمونه</span>}
    >
      <ul className="event-list">
        {events.map((event) => (
          <li key={event.id}>
            <button type="button" onClick={() => onSelect(event)}>
              <span className={`event-list__marker event-list__marker--${event.status}`} />
              <span className="event-list__content">
                <span className="event-list__title-row">
                  <strong>{event.type}</strong>
                  <time>{event.occurredAt}</time>
                </span>
                <span className="event-list__meta">
                  <code dir="ltr">{event.device}</code>
                  <i aria-hidden="true">·</i>
                  <span>{event.gateway}</span>
                </span>
                <span className="event-list__footer">
                  <StatusBadge status={event.status} />
                  {event.value ? <b>{event.value}</b> : null}
                </span>
              </span>
              <ChevronLeft className="event-list__chevron" size={17} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
