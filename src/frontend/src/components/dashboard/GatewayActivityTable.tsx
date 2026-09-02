import { ArrowUpLeft, MoreHorizontal } from 'lucide-react'

import type { GatewaySummary } from '../../types'
import { Panel } from '../shared/Panel'
import { StatusBadge } from '../shared/StatusBadge'

export function GatewayActivityTable({
  gateways,
  onViewAll,
}: {
  gateways: GatewaySummary[]
  onViewAll: () => void
}) {
  return (
    <Panel
      className="gateway-panel"
      title="فعالیت درگاه‌ها"
      description="وضعیت رجیستری و آخرین پیام دریافت‌شده"
      action={
        <button className="text-button" type="button" onClick={onViewAll}>
          مشاهدهٔ همه
          <ArrowUpLeft size={15} aria-hidden="true" />
        </button>
      }
    >
      <div className="gateway-table-wrap">
        <table className="gateway-table">
          <thead>
            <tr>
              <th scope="col">درگاه</th>
              <th scope="col">وضعیت</th>
              <th scope="col">دستگاه‌ها</th>
              <th scope="col">آخرین رویداد</th>
              <th scope="col">خطا</th>
              <th scope="col"><span className="sr-only">عملیات</span></th>
            </tr>
          </thead>
          <tbody>
            {gateways.map((gateway) => (
              <tr key={gateway.id}>
                <td>
                  <strong>{gateway.title}</strong>
                  <code dir="ltr">{gateway.uid}</code>
                </td>
                <td><StatusBadge status={gateway.status} /></td>
                <td>
                  <span className="device-count">
                    <b>{gateway.activeDevices.toLocaleString('fa-IR')}</b>
                    <small>از {gateway.totalDevices.toLocaleString('fa-IR')}</small>
                  </span>
                </td>
                <td>{gateway.lastEvent}</td>
                <td>
                  <span className={gateway.failures ? 'failure-count' : 'quiet-count'}>
                    {gateway.failures.toLocaleString('fa-IR')}
                  </span>
                </td>
                <td>
                  <button
                    className="row-action"
                    type="button"
                    aria-label={`مشاهدهٔ ${gateway.title}`}
                    onClick={onViewAll}
                  >
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="gateway-cards">
        {gateways.map((gateway) => (
          <article className="gateway-card" key={gateway.id}>
            <div className="gateway-card__heading">
              <div>
                <strong>{gateway.title}</strong>
                <code dir="ltr">{gateway.uid}</code>
              </div>
              <StatusBadge status={gateway.status} />
            </div>
            <dl>
              <div><dt>دستگاه فعال</dt><dd>{gateway.activeDevices.toLocaleString('fa-IR')} از {gateway.totalDevices.toLocaleString('fa-IR')}</dd></div>
              <div><dt>آخرین رویداد</dt><dd>{gateway.lastEvent}</dd></div>
              <div><dt>خطا</dt><dd>{gateway.failures.toLocaleString('fa-IR')}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </Panel>
  )
}
