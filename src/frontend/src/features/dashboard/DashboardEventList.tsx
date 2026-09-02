import { ChevronLeft, FileJson } from 'lucide-react'

import { Panel } from '../../components/shared/Panel'
import { StatusBadge } from '../../components/shared/StatusBadge'
import type { DashboardEvent } from './dashboardApi'

export function DashboardEventList({ events }: { events: DashboardEvent[] }) {
  return (
    <Panel
      className="dashboard-events-panel"
      title="رویدادهای اخیر دستگاه"
      description="آخرین پیام‌های خام ثبت‌شده برای دستگاه انتخابی"
    >
      {!events.length ? (
        <div className="dashboard-chart-empty" role="status">
          <FileJson size={21} aria-hidden="true" />
          <span>در این بازه رویدادی ثبت نشده است.</span>
        </div>
      ) : (
        <ul className="dashboard-event-list">
          {events.map((event) => (
            <li key={event.id}>
              <div className="dashboard-event-list__heading">
                <strong>{event.eventTypeTitle}</strong>
                <time dateTime={event.receivedAt}>{formatDate(event.receivedAt)}</time>
              </div>
              <div className="dashboard-event-list__meta">
                <code dir="ltr">{event.deviceLocalId}</code>
                <span>{event.gatewayUid}</span>
                <StatusBadge status={event.status} />
              </div>
              <code className="dashboard-event-list__payload" dir="ltr">{event.rawPayload}</code>
              {event.parsingError ? <p>{event.parsingError}</p> : null}
              <ChevronLeft size={15} aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
