import { Database, Info } from 'lucide-react'

export function SchemaSourceNotice() {
  return (
    <aside className="protocol-assumptions schema-source-notice" aria-label="منبع schema">
      <span className="protocol-assumptions__icon"><Info size={17} aria-hidden="true" /></span>
      <span>
        <strong>پایگاه داده تنها مرجع PayloadSchema است</strong>
        <small>
          رکوردهای PayloadSchema، PayloadField و ProjectionRule از API پایگاه داده بارگذاری شده‌اند.
        </small>
      </span>
      <span className="schema-source-notice__source"><Database size={15} aria-hidden="true" />database API</span>
    </aside>
  )
}
