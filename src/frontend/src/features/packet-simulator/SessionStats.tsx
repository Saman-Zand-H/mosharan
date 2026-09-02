import { Activity, CheckCheck, Clock3, TriangleAlert } from 'lucide-react'

import type { SimulationReceipt } from './simulatorTypes'

export function SessionStats({
  receipts,
  streaming,
}: {
  receipts: readonly SimulationReceipt[]
  streaming: boolean
}) {
  const processed = receipts.filter((receipt) => receipt.status === 'processed').length
  const failed = receipts.length - processed
  const averageLatency = receipts.length
    ? Math.round(receipts.reduce((total, receipt) => total + receipt.latencyMs, 0) / receipts.length)
    : 0

  const stats = [
    { label: 'دریافت‌شده', value: receipts.length.toLocaleString('fa-IR'), detail: streaming ? 'جریان خودکار فعال' : 'در این نشست', icon: Activity, tone: 'neutral' },
    { label: 'پردازش‌شده', value: processed.toLocaleString('fa-IR'), detail: 'بستهٔ معتبر', icon: CheckCheck, tone: 'success' },
    { label: 'ناموفق', value: failed.toLocaleString('fa-IR'), detail: 'خام حفظ شده', icon: TriangleAlert, tone: 'failure' },
    { label: 'میانگین زمان', value: `${averageLatency.toLocaleString('fa-IR')} ms`, detail: 'تا پایان شبیه‌سازی', icon: Clock3, tone: 'neutral' },
  ] as const

  return (
    <section className="session-stats" aria-label="خلاصهٔ نشست شبیه‌سازی">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <article key={stat.label}>
            <span className={`session-stat__icon session-stat__icon--${stat.tone}`}><Icon size={17} aria-hidden="true" /></span>
            <div><span>{stat.label}</span><strong dir={stat.label === 'میانگین زمان' ? 'ltr' : undefined}>{stat.value}</strong><small>{stat.detail}</small></div>
          </article>
        )
      })}
    </section>
  )
}
