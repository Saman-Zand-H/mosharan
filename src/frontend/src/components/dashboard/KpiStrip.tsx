import {
  Activity,
  CheckCheck,
  Cpu,
  RadioTower,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import type { KpiMetric } from '../../types'

const metricIcons = [RadioTower, Cpu, Activity, CheckCheck]

export function KpiStrip({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <section className="kpi-strip" aria-label="شاخص‌های کلیدی">
      {metrics.map((metric, index) => {
        const Icon = metricIcons[index]
        const TrendIcon = metric.trend.includes('−') ? TrendingDown : TrendingUp

        return (
          <article className="kpi" key={metric.label}>
            <div className="kpi__heading">
              <span className="kpi__icon">
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span>{metric.label}</span>
            </div>
            <strong dir="ltr">{metric.value}</strong>
            <div className="kpi__footer">
              <span>{metric.detail}</span>
              <span className={`trend trend--${metric.tone}`}>
                {metric.trend === 'بدون تغییر' ? null : (
                  <TrendIcon size={12} aria-hidden="true" />
                )}
                {metric.trend}
              </span>
            </div>
          </article>
        )
      })}
    </section>
  )
}
