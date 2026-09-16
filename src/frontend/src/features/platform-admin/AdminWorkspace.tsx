import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Database,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'

import { useAuth } from '../auth/authContext'
import { ApiError } from '../../lib/api/http'
import {
  changeUserPassword,
  createManagementRecord,
  deleteManagementRecord,
  getManagementSnapshot,
  rotateGatewayIngestToken,
  updateManagementRecord,
} from './managementApi'
import type {
  GatewayRecord,
  ManagementPayload,
  ManagementRecord,
  ManagementResource,
  ManagementSnapshot,
} from './managementTypes'
import {
  DeleteConfirmDialog,
  GatewayTokenDialog,
  PasswordDialog,
} from './ConfirmDialog'
import { RecordFormDialog } from './RecordFormDialog'
import { ResourceTable } from './ResourceTable'
import { getRecordSearchText, getRecordTitle } from './recordPresentation'
import {
  managementOverviewIcon,
  resourceDefinitions,
  resourceGroups,
} from './resourceConfig'

type LoadState = 'loading' | 'ready' | 'error'
type EditorState =
  | { type: 'create' }
  | { type: 'edit'; record: ManagementRecord }
  | { type: 'delete'; record: ManagementRecord }
  | { type: 'password'; record: ManagementRecord }
  | null

const emptySnapshot: ManagementSnapshot = {
  users: [],
  companies: [],
  gateways: [],
  devices: [],
  deviceTypes: [],
  parameters: [],
  deviceTypeParameters: [],
  eventTypes: [],
  payloadSchemas: [],
  payloadFields: [],
  projectionRules: [],
  visualizationTabs: [],
  visualizations: [],
}

export function AdminWorkspace() {
  const { user } = useAuth()
  const [activeResource, setActiveResource] =
    useState<ManagementResource>('companies')
  const [snapshot, setSnapshot] = useState<ManagementSnapshot>(emptySnapshot)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<EditorState>(null)
  const [mutationBusy, setMutationBusy] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [tokenGateway, setTokenGateway] = useState<GatewayRecord | null>(null)
  const [tokenValue, setTokenValue] = useState<string | null>(null)
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null)
    try {
      const currentSnapshot = await getManagementSnapshot(signal)
      setSnapshot(currentSnapshot)
      setLoadState('ready')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setLoadError(
        error instanceof Error ? error.message : 'دریافت داده‌های مدیریت ممکن نشد.',
      )
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void getManagementSnapshot(controller.signal)
      .then((currentSnapshot) => {
        setSnapshot(currentSnapshot)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLoadError(
          error instanceof Error ? error.message : 'دریافت داده‌های مدیریت ممکن نشد.',
        )
        setLoadState('error')
      })
    return () => controller.abort()
  }, [])

  const definition = resourceDefinitions[activeResource]
  const allRecords = snapshot[activeResource] as ManagementRecord[]
  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fa-IR')
    if (!query) return allRecords
    return allRecords.filter((record) =>
      getRecordSearchText(activeResource, record, snapshot).includes(query),
    )
  }, [activeResource, allRecords, search, snapshot])

  const openEditor = (next: EditorState) => {
    setMutationError(null)
    setFieldErrors({})
    setEditor(next)
  }

  const selectResource = (resource: ManagementResource) => {
    setActiveResource(resource)
    setSearch('')
    setEditor(null)
    setMutationError(null)
  }

  const reloadAfterMutation = async (message: string) => {
    await load()
    setEditor(null)
    setMutationBusy(false)
    setNotice(message)
    window.setTimeout(() => setNotice(null), 4500)
  }

  const handleMutationError = (error: unknown) => {
    setMutationBusy(false)
    setMutationError(
      error instanceof Error ? error.message : 'ذخیرهٔ تغییرات ممکن نشد.',
    )
    if (error instanceof ApiError) setFieldErrors(error.fields)
  }

  const saveRecord = async (payload: ManagementPayload) => {
    setMutationBusy(true)
    setMutationError(null)
    setFieldErrors({})
    try {
      if (editor?.type === 'edit') {
        await updateManagementRecord(activeResource, editor.record.id, payload)
        await reloadAfterMutation(`${definition.singular} با موفقیت ویرایش شد.`)
      } else {
        await createManagementRecord(activeResource, payload)
        await reloadAfterMutation(`${definition.singular} با موفقیت افزوده شد.`)
      }
    } catch (error) {
      handleMutationError(error)
    }
  }

  const deleteRecord = async () => {
    if (editor?.type !== 'delete') return
    setMutationBusy(true)
    setMutationError(null)
    try {
      await deleteManagementRecord(activeResource, editor.record.id)
      await reloadAfterMutation(`${definition.singular} حذف شد.`)
    } catch (error) {
      handleMutationError(error)
    }
  }

  const updatePassword = async (password: string) => {
    if (editor?.type !== 'password') return
    setMutationBusy(true)
    setMutationError(null)
    setFieldErrors({})
    try {
      await changeUserPassword(editor.record.id, password)
      setEditor(null)
      setMutationBusy(false)
      setNotice('گذرواژه با موفقیت تغییر کرد.')
      window.setTimeout(() => setNotice(null), 4500)
    } catch (error) {
      handleMutationError(error)
    }
  }

  const issueGatewayToken = async (record: ManagementRecord) => {
    if (activeResource !== 'gateways') return
    const gateway = record as GatewayRecord
    if (
      gateway.ingestTokenConfigured &&
      !window.confirm(
        'توکن فعلی این درگاه باطل می‌شود. برای صدور توکن جدید ادامه می‌دهید؟',
      )
    ) {
      return
    }
    setTokenGateway(gateway)
    setTokenValue(null)
    setTokenError(null)
    setTokenBusy(true)
    try {
      const result = await rotateGatewayIngestToken(gateway.id)
      setTokenValue(result.token)
      await load()
    } catch (error) {
      setTokenError(
        error instanceof Error ? error.message : 'صدور توکن ممکن نشد.',
      )
    } finally {
      setTokenBusy(false)
    }
  }

  const OverviewIcon = managementOverviewIcon
  const ResourceIcon = definition.icon

  return (
    <div className="admin-workspace">
      <header className="admin-page-header">
        <div>
          <div className="eyebrow-row">
            <span className="eyebrow"><ShieldCheck size={14} aria-hidden="true" />کنترل سکو</span>
            <span className="admin-live-label"><Database size={13} aria-hidden="true" />دادهٔ زنده</span>
          </div>
          <h1>مدیریت سکو</h1>
          <p>تنظیم حساب‌ها، ناوگان، کاتالوگ دستگاه و قراردادهای پردازش payload.</p>
        </div>
        <div className="admin-page-header__identity">
          <OverviewIcon size={18} aria-hidden="true" />
          <span><small>نشست مدیر</small><strong>{user?.username}</strong></span>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-resource-nav" aria-label="بخش‌های مدیریت">
          {resourceGroups.map((group) => (
            <section key={group.id}>
              <h2>{group.label}</h2>
              <ul>
                {group.resources.map((resource) => {
                  const item = resourceDefinitions[resource]
                  const Icon = item.icon
                  const count = snapshot[resource].length
                  return (
                    <li key={resource}>
                      <button
                        type="button"
                        aria-current={activeResource === resource ? 'page' : undefined}
                        onClick={() => selectResource(resource)}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span>{item.label}</span>
                        <small>{count.toLocaleString('fa-IR')}</small>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </aside>

        <main className="admin-resource-panel" aria-labelledby="admin-resource-title">
          <header className="admin-resource-header">
            <div className="admin-resource-header__icon"><ResourceIcon size={21} aria-hidden="true" /></div>
            <div>
              <p className="eyebrow">{loadState === 'ready' ? `${allRecords.length.toLocaleString('fa-IR')} رکورد` : 'در حال همگام‌سازی'}</p>
              <h2 id="admin-resource-title">{definition.label}</h2>
              <p>{definition.description}</p>
            </div>
            <button className="admin-button admin-button--primary" type="button" disabled={loadState !== 'ready'} onClick={() => openEditor({ type: 'create' })}>
              <Plus size={16} aria-hidden="true" />افزودن {definition.singular}
            </button>
          </header>

          <div className="admin-toolbar">
            <label>
              <span className="sr-only">جست‌وجو در {definition.label}</span>
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder={`جست‌وجو در ${definition.label}…`} value={search} disabled={loadState !== 'ready'} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <button type="button" disabled={loadState === 'loading'} onClick={() => { setLoadState('loading'); void load() }}>
              <RefreshCw size={15} aria-hidden="true" />تازه‌سازی
            </button>
          </div>

          {loadState === 'loading' ? (
            <AdminLoadingState />
          ) : loadState === 'error' ? (
            <AdminErrorState message={loadError} onRetry={() => { setLoadState('loading'); void load() }} />
          ) : allRecords.length === 0 ? (
            <AdminEmptyState resource={definition.singular} onCreate={() => openEditor({ type: 'create' })} />
          ) : visibleRecords.length === 0 ? (
            <div className="admin-empty"><Search size={25} aria-hidden="true" /><h3>نتیجه‌ای پیدا نشد</h3><p>عبارت جست‌وجو را تغییر دهید یا فیلتر را پاک کنید.</p><button type="button" onClick={() => setSearch('')}>پاک کردن جست‌وجو</button></div>
          ) : (
            <ResourceTable
              resource={activeResource}
              records={visibleRecords}
              snapshot={snapshot}
              onEdit={(record) => openEditor({ type: 'edit', record })}
              onDelete={(record) => openEditor({ type: 'delete', record })}
              onPassword={(record) => openEditor({ type: 'password', record })}
              onToken={(record) => void issueGatewayToken(record)}
            />
          )}
        </main>
      </div>

      {(editor?.type === 'create' || editor?.type === 'edit') ? (
        <RecordFormDialog
          key={`${activeResource}-${editor.type === 'edit' ? editor.record.id : 'new'}`}
          resource={activeResource}
          snapshot={snapshot}
          record={editor.type === 'edit' ? editor.record : undefined}
          saving={mutationBusy}
          serverError={mutationError}
          serverFields={fieldErrors}
          onClose={() => !mutationBusy && setEditor(null)}
          onSubmit={(payload) => void saveRecord(payload)}
        />
      ) : null}

      {editor?.type === 'delete' ? (
        <DeleteConfirmDialog
          title={getRecordTitle(activeResource, editor.record, snapshot)}
          busy={mutationBusy}
          error={mutationError}
          onClose={() => !mutationBusy && setEditor(null)}
          onConfirm={() => void deleteRecord()}
        />
      ) : null}

      {editor?.type === 'password' ? (
        <PasswordDialog
          username={getRecordTitle('users', editor.record, snapshot)}
          busy={mutationBusy}
          error={mutationError}
          serverValidationErrors={[
            ...(fieldErrors.password ?? []),
            ...(fieldErrors.__all__ ?? []),
          ]}
          onClose={() => !mutationBusy && setEditor(null)}
          onConfirm={(password) => void updatePassword(password)}
        />
      ) : null}

      {tokenGateway ? (
        <GatewayTokenDialog
          gatewayUid={tokenGateway.uid}
          token={tokenValue}
          busy={tokenBusy}
          error={tokenError}
          onClose={() => {
            if (tokenBusy) return
            setTokenGateway(null)
            setTokenValue(null)
            setTokenError(null)
          }}
        />
      ) : null}

      {notice ? <div className="admin-toast" role="status"><ShieldCheck size={16} aria-hidden="true" />{notice}</div> : null}
    </div>
  )
}

function AdminLoadingState() {
  return (
    <div className="admin-skeleton" aria-busy="true" aria-label="در حال دریافت رکوردها">
      {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
    </div>
  )
}

function AdminErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="admin-empty admin-empty--error" role="alert">
      <AlertCircle size={27} aria-hidden="true" />
      <h3>دریافت اطلاعات ممکن نشد</h3>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>تلاش دوباره</button>
    </div>
  )
}

function AdminEmptyState({ resource, onCreate }: { resource: string; onCreate: () => void }) {
  return (
    <div className="admin-empty">
      <Database size={27} aria-hidden="true" />
      <h3>هنوز {resource} ثبت نشده است</h3>
      <p>اولین رکورد را بسازید تا در این فهرست نمایش داده شود.</p>
      <button type="button" onClick={onCreate}><Plus size={15} aria-hidden="true" />افزودن {resource}</button>
    </div>
  )
}
