import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, Database, Eye, Pencil, RefreshCw, Search } from 'lucide-react'

import { StatusBadge } from '../components/shared/StatusBadge'
import { useAuth } from '../features/auth/authContext'
import {
  loadWorkspaceCatalog,
  type SimulatorCatalog,
} from '../features/packet-simulator/schemaCatalog'
import {
  getManagementSnapshot,
  updateManagementRecord,
} from '../features/platform-admin/managementApi'
import type {
  ManagementPayload,
  ManagementRecord,
  ManagementResource,
  ManagementSnapshot,
  ParameterRecord,
} from '../features/platform-admin/managementTypes'
import { RecordFormDialog } from '../features/platform-admin/RecordFormDialog'
import { ApiError, apiRequest } from '../lib/api/http'
import type {
  EventStatus,
  ModuleSectionId,
  ModuleSummary,
  RegistryStatus,
} from '../types'

interface WorkspaceEvent {
  id: string
  gatewayUid: string
  deviceLocalId: string
  eventTypeCode: string
  eventTypeTitle: string
  schemaVersion: number
  messageId: string
  status: EventStatus
  receivedAt: string
  rawPayload: string
  parsingError: string
}

interface ModuleCell {
  value: string
  ltr?: boolean
}

interface ModuleRow {
  id: string
  primary: ModuleCell
  cells: ModuleCell[]
  status?: RegistryStatus | EventStatus
  statusColumn?: number
  resource?: ManagementResource
  record?: ManagementRecord
}

interface ModuleTable {
  primaryHeading: string
  columns: string[]
  rows: ModuleRow[]
}

interface ModuleData {
  snapshot: ManagementSnapshot | null
  catalog: SimulatorCatalog | null
  events: WorkspaceEvent[]
}

type LoadState = 'loading' | 'ready' | 'error'

const emptyData: ModuleData = { snapshot: null, catalog: null, events: [] }

async function fetchModuleData(
  isSuperuser: boolean,
  signal?: AbortSignal,
): Promise<ModuleData> {
  const sourcePromise = isSuperuser
    ? getManagementSnapshot(signal)
    : loadWorkspaceCatalog({ signal })
  const [events, source] = await Promise.all([
    apiRequest<WorkspaceEvent[]>('/events/recent', { signal }),
    sourcePromise,
  ])
  return isSuperuser
    ? { events, snapshot: source as ManagementSnapshot, catalog: null }
    : { events, snapshot: null, catalog: source as SimulatorCatalog }
}

export function ModulePage({
  section,
  summary,
}: {
  section: ModuleSectionId
  summary: ModuleSummary
}) {
  const { user } = useAuth()
  const isSuperuser = user?.isSuperuser ?? false
  const [data, setData] = useState<ModuleData>(emptyData)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<{ section: ModuleSectionId; id: string } | null>(null)
  const [editor, setEditor] = useState<{ resource: ManagementResource; record: ManagementRecord } | null>(null)
  const [mutationBusy, setMutationBusy] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoadState('loading')
      setError(null)
      try {
        setData(await fetchModuleData(isSuperuser, signal))
        setLoadState('ready')
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === 'AbortError'
        ) {
          return
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'دریافت داده‌ها ممکن نشد.',
        )
        setLoadState('error')
      }
    },
    [isSuperuser],
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchModuleData(isSuperuser, controller.signal)
      .then((nextData) => {
        setData(nextData)
        setLoadState('ready')
      })
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === 'AbortError'
        ) {
          return
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'دریافت داده‌ها ممکن نشد.',
        )
        setLoadState('error')
      })
    return () => controller.abort()
  }, [isSuperuser])

  const allRows = useMemo(() => buildRows(section, data), [data, section])
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fa-IR')
    if (!query) return allRows.rows
    return allRows.rows.filter((row) => {
      const text = [row.primary.value, ...row.cells.map((cell) => cell.value)]
        .join(' ')
        .toLocaleLowerCase('fa-IR')
      return text.includes(query)
    })
  }, [allRows.rows, search])

  const selectedRow = selected?.section === section
    ? allRows.rows.find((row) => row.id === selected.id) ?? null
    : null

  const saveEdit = async (payload: ManagementPayload) => {
    if (!editor) return
    setMutationBusy(true)
    setMutationError(null)
    setFieldErrors({})
    try {
      await updateManagementRecord(editor.resource, editor.record.id, payload)
      setEditor(null)
      setMutationBusy(false)
      await load()
    } catch (requestError) {
      setMutationBusy(false)
      setMutationError(
        requestError instanceof Error ? requestError.message : 'ذخیرهٔ تغییرات ممکن نشد.',
      )
      if (requestError instanceof ApiError) setFieldErrors(requestError.fields)
    }
  }

  if (selectedRow) {
    return (
      <>
        <ModuleDetailPage
          section={section}
          summary={summary}
          table={allRows}
          row={selectedRow}
          canEdit={isSuperuser}
          onBack={() => setSelected(null)}
          onEdit={
            selectedRow.record && selectedRow.resource
              ? () => {
                  setMutationError(null)
                  setFieldErrors({})
                  setEditor({ resource: selectedRow.resource!, record: selectedRow.record! })
                }
              : undefined
          }
        />
        {editor && data.snapshot ? (
          <RecordFormDialog
            resource={editor.resource}
            snapshot={data.snapshot}
            record={editor.record}
            saving={mutationBusy}
            serverError={mutationError}
            serverFields={fieldErrors}
            onClose={() => !mutationBusy && setEditor(null)}
            onSubmit={(payload) => void saveEdit(payload)}
          />
        ) : null}
      </>
    )
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <div className="eyebrow-row">
            <span className="eyebrow">ماژول سامانه</span>
            <span className="demo-label">
              <Database size={13} aria-hidden="true" />دادهٔ زنده
            </span>
          </div>
          <h1>{summary.title}</h1>
          <p>{summary.description}</p>
        </div>
      </header>

      <section className="module-primary module-primary--live">
        <div className="module-live-toolbar">
          <div>
            <span className="module-count__label">نمایش فعلی</span>
            <strong>{allRows.rows.length.toLocaleString('fa-IR')}</strong>
            <small>رکورد قابل مشاهده</small>
          </div>
          <div className="module-live-actions">
            <label>
              <span className="sr-only">جست‌وجو در {summary.title}</span>
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={search}
                disabled={loadState !== 'ready'}
                placeholder={`جست‌وجو در ${summary.title}…`}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={loadState === 'loading'}
              onClick={() => void load()}
            >
              <RefreshCw size={15} aria-hidden="true" />تازه‌سازی
            </button>
          </div>
        </div>

        {loadState === 'loading' ? (
          <div
            className="admin-skeleton"
            aria-busy="true"
            aria-label="در حال دریافت داده‌ها"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : loadState === 'error' ? (
          <div className="admin-empty admin-empty--error" role="alert">
            <AlertCircle size={27} aria-hidden="true" />
            <h3>دریافت اطلاعات ممکن نشد</h3>
            <p>{error}</p>
            <button type="button" onClick={() => void load()}>
              تلاش دوباره
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="admin-empty">
            <Search size={25} aria-hidden="true" />
            <h3>{search ? 'نتیجه‌ای پیدا نشد' : 'هنوز داده‌ای ثبت نشده است'}</h3>
            <p>
              {search
                ? 'عبارت جست‌وجو را تغییر دهید.'
                : 'با اجرای seed_demo_data دادهٔ نمونه اضافه کنید.'}
            </p>
            {search ? (
              <button type="button" onClick={() => setSearch('')}>
                پاک کردن جست‌وجو
              </button>
            ) : null}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{allRows.primaryHeading}</th>
                  {allRows.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td dir={row.primary.ltr ? 'ltr' : undefined}>
                      <span className="admin-cell">
                        <strong>{row.primary.value}</strong>
                      </span>
                    </td>
                    {row.cells.map((cell, index) => (
                      <td
                        key={`${row.id}-${index}`}
                        dir={cell.ltr ? 'ltr' : undefined}
                      >
                        {row.statusColumn === index && row.status ? (
                          <StatusBadge status={row.status} />
                        ) : (
                          <span className="admin-cell">
                            <strong>{cell.value}</strong>
                          </span>
                        )}
                      </td>
                    ))}
                    <td>
                      <button
                        className="module-row-details"
                        type="button"
                        onClick={() => setSelected({ section, id: row.id })}
                      >
                        <Eye size={14} aria-hidden="true" />جزئیات
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function ModuleDetailPage({
  section,
  summary,
  table,
  row,
  canEdit,
  onBack,
  onEdit,
}: {
  section: ModuleSectionId
  summary: ModuleSummary
  table: ModuleTable
  row: ModuleRow
  canEdit: boolean
  onBack: () => void
  onEdit?: () => void
}) {
  return (
    <div className="module-page module-detail-page">
      <header className="module-detail-header">
        <button className="module-back-button" type="button" onClick={onBack}>
          <ArrowRight size={16} aria-hidden="true" />بازگشت به {summary.title}
        </button>
        <div className="module-detail-heading">
          <span className="eyebrow">جزئیات {summary.title}</span>
          <h1>{row.primary.value}</h1>
          <p>شناسهٔ رکورد: <code dir="ltr">{row.id}</code></p>
        </div>
        {canEdit && onEdit ? (
          <button className="admin-button admin-button--primary" type="button" onClick={onEdit}>
            <Pencil size={15} aria-hidden="true" />ویرایش
          </button>
        ) : section === 'events' ? (
          <span className="module-immutable-note">رویداد خام تغییرناپذیر است</span>
        ) : null}
      </header>

      <section className="module-detail-card" aria-labelledby="module-detail-fields-title">
        <header className="module-detail-card__header">
          <div>
            <span className="eyebrow">نمایش کامل</span>
            <h2 id="module-detail-fields-title">اطلاعات رکورد</h2>
          </div>
          {row.status ? <StatusBadge status={row.status} /> : null}
        </header>
        <dl className="module-detail-fields">
          <div>
            <dt>{table.primaryHeading}</dt>
            <dd dir={row.primary.ltr ? 'ltr' : undefined}>{row.primary.value}</dd>
          </div>
          {row.cells.map((cell, index) => (
            <div key={`${row.id}-detail-${index}`}>
              <dt>{table.columns[index]}</dt>
              <dd dir={cell.ltr ? 'ltr' : undefined}>
                {row.statusColumn === index && row.status ? <StatusBadge status={row.status} /> : cell.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

function buildRows(section: ModuleSectionId, data: ModuleData): ModuleTable {
  if (section === 'events') return eventRows(data.events)
  if (data.snapshot) return snapshotRows(section, data.snapshot)
  return catalogRows(section, data.catalog)
}

function snapshotRows(
  section: ModuleSectionId,
  snapshot: ManagementSnapshot,
): ModuleTable {
  const companies = new Map(snapshot.companies.map((item) => [item.id, item.name]))
  const gateways = new Map(snapshot.gateways.map((item) => [item.id, item]))
  const devicesByGateway = new Map<number, typeof snapshot.devices>()
  snapshot.devices.forEach((device) => {
    const devices = devicesByGateway.get(device.gatewayId) ?? []
    devices.push(device)
    devicesByGateway.set(device.gatewayId, devices)
  })
  const types = new Map(snapshot.deviceTypes.map((item) => [item.id, item]))
  const eventTypes = new Map(snapshot.eventTypes.map((item) => [item.id, item]))

  if (section === 'gateways') {
    return {
      primaryHeading: 'درگاه',
      columns: ['مالک', 'دستگاه‌ها', 'وضعیت'],
      rows: snapshot.gateways.map((gateway) => {
        const devices = devicesByGateway.get(gateway.id) ?? []
        return {
          id: String(gateway.id),
          primary: { value: gateway.title },
          cells: [
            {
              value: gateway.companyId
                ? companies.get(gateway.companyId) ?? '—'
                : 'بدون مالک',
            },
            {
              value: `${devices.filter((device) => device.isActive).length} / ${devices.length}`,
            },
            { value: gateway.isActive ? 'فعال' : 'غیرفعال' },
          ],
          status: gateway.isActive ? 'active' : 'inactive',
          statusColumn: 2,
          resource: 'gateways',
          record: gateway,
        }
      }),
    }
  }

  if (section === 'devices') {
    return {
      primaryHeading: 'دستگاه محلی',
      columns: ['درگاه', 'نوع دستگاه', 'وضعیت'],
      rows: snapshot.devices.map((device) => ({
        id: String(device.id),
        primary: { value: device.localId, ltr: true },
        cells: [
          {
            value: gateways.get(device.gatewayId)?.uid ?? '—',
            ltr: true,
          },
          { value: types.get(device.deviceTypeId)?.title ?? '—' },
          { value: device.isActive ? 'فعال' : 'غیرفعال' },
        ],
        status: device.isActive ? 'active' : 'inactive',
        statusColumn: 2,
        resource: 'devices',
        record: device,
      })),
    }
  }

  if (section === 'parameters') {
    const assignmentCounts = new Map<number, number>()
    snapshot.deviceTypeParameters.forEach((assignment) => {
      assignmentCounts.set(
        assignment.parameterId,
        (assignmentCounts.get(assignment.parameterId) ?? 0) + 1,
      )
    })
    return {
      primaryHeading: 'پارامتر',
      columns: ['نوع مقدار', 'واحد', 'تخصیص به نوع دستگاه'],
      rows: snapshot.parameters.map((parameter) => ({
        id: String(parameter.id),
        primary: { value: parameter.title },
        cells: [
          { value: parameter.valueType, ltr: true },
          { value: parameter.unit ?? '—', ltr: true },
          { value: String(assignmentCounts.get(parameter.id) ?? 0) },
        ],
        resource: 'parameters',
        record: parameter,
      })),
    }
  }

  return {
    primaryHeading: 'طرح‌واره',
    columns: ['رویداد / دستگاه', 'نسخه و طول', 'ساختار'],
    rows: snapshot.payloadSchemas.map((schema) => ({
      id: String(schema.id),
      primary: {
        value: `${eventTypes.get(schema.eventTypeId)?.title ?? `event #${schema.eventTypeId}`} / ${types.get(schema.deviceTypeId)?.title ?? `device #${schema.deviceTypeId}`}`,
      },
      cells: [
        {
          value: `${eventTypes.get(schema.eventTypeId)?.code ?? `event-${schema.eventTypeId}`} / ${types.get(schema.deviceTypeId)?.code ?? `device-${schema.deviceTypeId}`}`,
          ltr: true,
        },
        {
          value: `v${schema.version} · ${schema.expectedLength ?? 'dynamic'} B`,
          ltr: true,
        },
        {
          value: `${snapshot.payloadFields.filter((field) => field.payloadSchemaId === schema.id).length} فیلد · ${snapshot.projectionRules.filter((rule) => rule.payloadSchemaId === schema.id).length} نگاشت`,
        },
      ],
      resource: 'payloadSchemas',
      record: schema,
    })),
  }
}

function catalogRows(
  section: ModuleSectionId,
  catalog: SimulatorCatalog | null,
): ModuleTable {
  if (!catalog) return { primaryHeading: 'رکورد', columns: [], rows: [] }

  const gateways = new Map<
    string,
    { title: string; active: boolean; total: number; activeDevices: number }
  >()
  catalog.devices.forEach((device) => {
    const current = gateways.get(device.gateway.uid) ?? {
      title: device.gateway.title,
      active: device.gateway.isActive,
      total: 0,
      activeDevices: 0,
    }
    current.total += 1
    if (device.isActive) current.activeDevices += 1
    gateways.set(device.gateway.uid, current)
  })

  if (section === 'gateways') {
    return {
      primaryHeading: 'درگاه',
      columns: ['UID', 'دستگاه‌ها', 'وضعیت'],
      rows: [...gateways.entries()].map(([uid, gateway]) => ({
        id: uid,
        primary: { value: gateway.title },
        cells: [
          { value: uid, ltr: true },
          { value: `${gateway.activeDevices} / ${gateway.total}` },
          { value: gateway.active ? 'فعال' : 'غیرفعال' },
        ],
        status: gateway.active ? 'active' : 'inactive',
        statusColumn: 2,
      })),
    }
  }

  if (section === 'devices') {
    return {
      primaryHeading: 'دستگاه محلی',
      columns: ['درگاه', 'نوع دستگاه', 'وضعیت'],
      rows: catalog.devices.map((device) => ({
        id: device.id,
        primary: { value: device.localId, ltr: true },
        cells: [
          { value: device.gateway.uid, ltr: true },
          { value: device.deviceTypeCode, ltr: true },
          { value: device.isActive ? 'فعال' : 'غیرفعال' },
        ],
        status: device.isActive ? 'active' : 'inactive',
        statusColumn: 2,
      })),
    }
  }

  if (section === 'parameters') {
    const parameterMap = new Map<string, ParameterRecord>()
    catalog.schemas.forEach((schema) =>
      schema.projectionRules.forEach((rule) => {
        parameterMap.set(rule.parameter.code, {
          id: Number(rule.id),
          code: rule.parameter.code,
          title: rule.parameter.title,
          valueType: rule.parameter.valueType,
          unit: rule.parameter.unit ?? null,
          dateCreated: '',
          dateUpdated: '',
        })
      }),
    )
    return {
      primaryHeading: 'پارامتر',
      columns: ['کد', 'نوع مقدار', 'واحد'],
      rows: [...parameterMap.values()].map((parameter) => ({
        id: parameter.code,
        primary: { value: parameter.title },
        cells: [
          { value: parameter.code, ltr: true },
          { value: parameter.valueType, ltr: true },
          { value: parameter.unit ?? '—', ltr: true },
        ],
      })),
    }
  }

  return {
    primaryHeading: 'طرح‌واره',
    columns: ['رویداد / دستگاه', 'نسخه و طول', 'ساختار'],
    rows: catalog.schemas.map((schema) => ({
      id: schema.id,
      primary: { value: `${schema.eventType.title} / ${schema.deviceType.title}` },
      cells: [
        {
          value: `${schema.eventType.code} / ${schema.deviceType.code}`,
          ltr: true,
        },
        {
          value: `v${schema.version} · ${schema.expectedLength ?? 'dynamic'} B`,
          ltr: true,
        },
        { value: `${schema.fields.length} فیلد · ${schema.projectionRules.length} نگاشت` },
      ],
    })),
  }
}

function eventRows(events: WorkspaceEvent[]): ModuleTable {
  return {
    primaryHeading: 'رویداد',
    columns: ['دستگاه', 'درگاه', 'نسخه', 'وضعیت', 'زمان', 'شناسه پیام', 'payload خام', 'خطا'],
    rows: events.map((event) => ({
      id: event.id,
      primary: { value: event.eventTypeTitle },
      cells: [
        { value: event.deviceLocalId, ltr: true },
        { value: event.gatewayUid, ltr: true },
        { value: `${event.eventTypeCode} / v${event.schemaVersion}`, ltr: true },
        { value: event.status },
        { value: formatDate(event.receivedAt), ltr: true },
        { value: event.messageId, ltr: true },
        { value: event.rawPayload, ltr: true },
        { value: event.parsingError || '—' },
      ],
      status: event.status,
      statusColumn: 3,
    })),
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
