import { KeyRound, Pencil, Trash2 } from 'lucide-react'

import { getRecordCells, getRecordTitle } from './recordPresentation'
import { resourceDefinitions } from './resourceConfig'
import type {
  ManagementRecord,
  ManagementResource,
  ManagementSnapshot,
  UserRecord,
} from './managementTypes'

interface ResourceTableProps {
  resource: ManagementResource
  records: ManagementRecord[]
  snapshot: ManagementSnapshot
  onEdit: (record: ManagementRecord) => void
  onDelete: (record: ManagementRecord) => void
  onPassword: (record: ManagementRecord) => void
  onToken: (record: ManagementRecord) => void
}

export function ResourceTable({
  resource,
  records,
  snapshot,
  onEdit,
  onDelete,
  onPassword,
  onToken,
}: ResourceTableProps) {
  const definition = resourceDefinitions[resource]

  const actions = (record: ManagementRecord) => {
    const platformAdmin =
      resource === 'users' && (record as UserRecord).isSuperuser
    if (platformAdmin) {
      return (
        <div className="admin-row-actions">
          <span
            className="admin-cell-badge admin-cell-badge--admin"
            title="حساب مدیر سکو فقط خواندنی است."
          >
            <strong>فقط خواندنی</strong>
          </span>
        </div>
      )
    }

    return (
      <div className="admin-row-actions">
        {resource === 'gateways' ? (
          <button
            type="button"
            aria-label={`صدور توکن دریافت ${getRecordTitle(resource, record, snapshot)}`}
            title="صدور یا چرخش توکن دریافت"
            onClick={() => onToken(record)}
          >
            <KeyRound size={15} aria-hidden="true" />
          </button>
        ) : null}
        {resource === 'users' ? (
          <button type="button" aria-label={`تغییر گذرواژهٔ ${getRecordTitle(resource, record, snapshot)}`} onClick={() => onPassword(record)}>
            <KeyRound size={15} aria-hidden="true" />
          </button>
        ) : null}
        <button type="button" aria-label={`ویرایش ${getRecordTitle(resource, record, snapshot)}`} onClick={() => onEdit(record)}>
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          className="admin-row-actions__danger"
          type="button"
          aria-label={`حذف ${getRecordTitle(resource, record, snapshot)}`}
          onClick={() => onDelete(record)}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {definition.columns.map((column) => <th key={column}>{column}</th>)}
              <th><span className="sr-only">عملیات</span></th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                {getRecordCells(resource, record, snapshot).map((cell, index) => (
                  <td key={`${record.id}-${definition.columns[index]}`} dir={cell.ltr ? 'ltr' : undefined}>
                    <span className={cell.tone ? `admin-cell-badge admin-cell-badge--${cell.tone}` : 'admin-cell'}>
                      <strong>{cell.primary}</strong>
                      {cell.secondary ? <small>{cell.secondary}</small> : null}
                    </span>
                  </td>
                ))}
                <td>{actions(record)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-record-cards">
        {records.map((record) => {
          const cells = getRecordCells(resource, record, snapshot)
          return (
            <article key={record.id}>
              <header>
                <div><strong>{cells[0].primary}</strong>{cells[0].secondary ? <small>{cells[0].secondary}</small> : null}</div>
                {actions(record)}
              </header>
              <dl>
                {cells.slice(1).map((cell, index) => (
                  <div key={`${record.id}-mobile-${definition.columns[index + 1]}`}>
                    <dt>{definition.columns[index + 1]}</dt>
                    <dd>{cell.primary}</dd>
                  </div>
                ))}
              </dl>
            </article>
          )
        })}
      </div>
    </>
  )
}
