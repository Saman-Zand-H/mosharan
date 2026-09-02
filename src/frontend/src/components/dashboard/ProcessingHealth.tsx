import { CircleCheck, CircleDashed, CircleX } from 'lucide-react'

import { Panel } from '../shared/Panel'

const healthRows = [
  {
    label: 'پردازش‌شده',
    value: '۱۸٬۶۰۵',
    percentage: '۹۹٫۸۰٪',
    className: 'processed',
    icon: CircleCheck,
  },
  {
    label: 'ناموفق',
    value: '۳۴',
    percentage: '۰٫۱۸٪',
    className: 'failed',
    icon: CircleX,
  },
  {
    label: 'در انتظار',
    value: '۳',
    percentage: '۰٫۰۲٪',
    className: 'received',
    icon: CircleDashed,
  },
]

export function ProcessingHealth() {
  return (
    <Panel
      className="health-panel"
      title="سلامت پردازش"
      description="خروجی نمونهٔ خط پردازش در ۲۴ ساعت"
      action={<span className="health-indicator">پایدار</span>}
    >
      <div className="health-summary">
        <strong>۹۹٫۸۲٪</strong>
        <span>نرخ موفقیت</span>
      </div>
      <ul className="health-list">
        {healthRows.map((row) => {
          const Icon = row.icon
          return (
            <li key={row.label}>
              <span className={`health-list__icon health-list__icon--${row.className}`}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <small>{row.percentage}</small>
            </li>
          )
        })}
      </ul>
      <p className="health-note">آخرین پردازش موفق در دادهٔ نمونه: ۱۲ ثانیه پیش</p>
    </Panel>
  )
}
