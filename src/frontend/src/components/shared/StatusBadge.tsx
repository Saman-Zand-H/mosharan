import { CircleCheck, CircleDashed, CircleX } from 'lucide-react'

import type { EventStatus, RegistryStatus } from '../../types'

type Status = EventStatus | RegistryStatus

const labels: Record<Status, string> = {
  processed: 'پردازش‌شده',
  failed: 'ناموفق',
  received: 'در انتظار پردازش',
  active: 'فعال',
  inactive: 'غیرفعال',
}

export function StatusBadge({ status }: { status: Status }) {
  const Icon =
    status === 'processed' || status === 'active'
      ? CircleCheck
      : status === 'failed'
        ? CircleX
        : CircleDashed

  return (
    <span className={`status-badge status-badge--${status}`}>
      <Icon size={13} aria-hidden="true" />
      {labels[status]}
    </span>
  )
}
