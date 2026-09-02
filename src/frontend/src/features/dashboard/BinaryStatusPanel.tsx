import { Activity, CheckCircle2, Circle, XCircle } from 'lucide-react'

import { Panel } from '../../components/shared/Panel'
import type { DashboardBinaryParameter } from './dashboardApi'
import { BooleanHistoryChart } from './BooleanHistoryChart'

export function BinaryStatusPanel({ parameters }: { parameters: DashboardBinaryParameter[] }) {
  return (
    <Panel
      className="binary-panel"
      title="وضعیت پارامترهای بولی"
      description="آخرین مقدار و نمودار تاریخچهٔ اتصال؛ ۱ متصل و ۰ قطع"
      action={<span className="dashboard-live-label"><Activity size={13} aria-hidden="true" />زنده</span>}
    >
      {!parameters.length ? (
        <div className="dashboard-chart-empty" role="status">
          <Circle size={20} aria-hidden="true" />
          <span>پارامتر بولی برای این دستگاه تعریف نشده است.</span>
        </div>
      ) : (
        <>
          <div className="binary-latest-grid" aria-label="آخرین وضعیت پارامترها">
            {parameters.map((item) => <BinaryLatestTile key={item.parameter.id} item={item} />)}
          </div>
          <div className="binary-history" aria-label="تاریخچه پارامترهای بولی">
            {parameters.map((item) => (
              <section className="binary-history__row" key={item.parameter.id}>
                <header>
                  <strong>{item.parameter.title}</strong>
                  <code dir="ltr">{item.parameter.code}</code>
                </header>
                <BooleanHistoryChart item={item} />
                {item.history.length ? (
                  <ol>
                    {item.history.map((point, index) => (
                      <li key={`${point.observedAt}-${index}`}>
                        <span className={`binary-history__dot binary-history__dot--${point.value ? 'true' : 'false'}`} />
                        <b>{point.value ? '۱ · متصل' : '۰ · قطع'}</b>
                        <time dateTime={point.observedAt}>{formatDate(point.observedAt)}</time>
                      </li>
                    ))}
                  </ol>
                ) : <p>در این بازه داده‌ای نیست.</p>}
              </section>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}

function BinaryLatestTile({ item }: { item: DashboardBinaryParameter }) {
  const state = item.latestValue === null ? 'unknown' : item.latestValue ? 'true' : 'false'
  const Icon = state === 'true' ? CheckCircle2 : state === 'false' ? XCircle : Circle
  return (
    <article className={`binary-tile binary-tile--${state}`}>
      <span className="binary-tile__light" aria-hidden="true" />
      <div>
        <strong>{item.parameter.title}</strong>
        <code dir="ltr">{item.parameter.code}</code>
      </div>
      <span className="binary-tile__value">
        <Icon size={16} aria-hidden="true" />
        {state === 'unknown' ? '—' : state === 'true' ? 'متصل · ۱' : 'قطع · ۰'}
      </span>
      {item.latestAt ? <time dateTime={item.latestAt}>{formatDate(item.latestAt)}</time> : <small>بدون خوانش</small>}
    </article>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
