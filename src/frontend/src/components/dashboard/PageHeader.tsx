import { CalendarDays, Database } from 'lucide-react'

import type { TimeRange } from '../../types'

const rangeLabels: Record<TimeRange, string> = {
  '6h': '۶ ساعت',
  '24h': '۲۴ ساعت',
  '7d': '۷ روز',
}

interface PageHeaderProps {
  range: TimeRange
  onRangeChange: (range: TimeRange) => void
}

export function PageHeader({ range, onRangeChange }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        <div className="eyebrow-row">
          <span className="eyebrow">مرکز عملیات</span>
          <span className="demo-label">
            <Database size={13} aria-hidden="true" />
            دادهٔ نمایشی
          </span>
        </div>
        <h1>نمای کلی سامانه</h1>
        <p>نمای عملیاتی جریان رویدادها و سلامت رجیستری دستگاه‌ها</p>
      </div>

      <div className="range-control" role="group" aria-label="بازهٔ زمانی">
        <span className="range-control__label">
          <CalendarDays size={16} aria-hidden="true" />
          بازه
        </span>
        <div className="range-control__options">
          {(Object.keys(rangeLabels) as TimeRange[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => onRangeChange(value)}
            >
              {rangeLabels[value]}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
