import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Cpu, Database, RefreshCw } from 'lucide-react'

import { DashboardChart } from '../features/dashboard/DashboardChart'
import { DashboardEventList } from '../features/dashboard/DashboardEventList'
import {
  loadDashboard,
  type DashboardResponse,
} from '../features/dashboard/dashboardApi'
import { BinaryStatusPanel } from '../features/dashboard/BinaryStatusPanel'
import type { SectionId, TimeRange } from '../types'

const rangeHours: Record<TimeRange, number> = {
  '6h': 6,
  '24h': 24,
  '7d': 168,
}

const rangeLabels: Record<TimeRange, string> = {
  '6h': '۶ ساعت',
  '24h': '۲۴ ساعت',
  '7d': '۷ روز',
}

type LoadState = 'loading' | 'ready' | 'error'

export function OverviewPage({
  onSectionChange,
}: {
  onSectionChange: (section: SectionId) => void
}) {
  const [range, setRange] = useState<TimeRange>('24h')
  const [deviceId, setDeviceId] = useState<number | null>(null)
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [activeTabCode, setActiveTabCode] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void loadDashboard(deviceId, rangeHours[range], controller.signal)
      .then((nextDashboard) => {
        setDashboard(nextDashboard)
        setLoadState('ready')
        setError(null)
        if (deviceId === null && nextDashboard.selectedDeviceId !== null) {
          setDeviceId(nextDashboard.selectedDeviceId)
        }
        setActiveTabCode((currentTabCode) =>
          nextDashboard.tabs.some((tab) => tab.code === currentTabCode)
            ? currentTabCode
            : nextDashboard.tabs[0]?.code ?? '',
        )
      })
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === 'AbortError'
        ) {
          return
        }
        setLoadState('error')
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'دریافت داشبورد ممکن نشد.',
        )
      })
    return () => controller.abort()
  }, [deviceId, range, reloadKey])

  const activeTab = useMemo(
    () => dashboard?.tabs.find((tab) => tab.code === activeTabCode) ?? dashboard?.tabs[0],
    [activeTabCode, dashboard],
  )
  const selectedDeviceId = deviceId ?? dashboard?.selectedDeviceId ?? null
  const selectedDevice = dashboard?.devices.find(
    (device) => device.id === selectedDeviceId,
  )

  const changeRange = (nextRange: TimeRange) => {
    setRange(nextRange)
    setLoadState('loading')
  }

  const changeDevice = (nextDeviceId: string) => {
    setDeviceId(nextDeviceId ? Number(nextDeviceId) : null)
    setLoadState('loading')
  }

  return (
    <div className="dashboard-workspace">
      <header className="page-header dashboard-page-header">
        <div className="page-header__copy">
          <div className="eyebrow-row">
            <span className="eyebrow">مرکز عملیات</span>
            <span className="demo-label dashboard-live-label">
              <Database size={13} aria-hidden="true" />دادهٔ زنده
            </span>
          </div>
          <h1>داشبورد تله‌متری</h1>
          <p>نمودارها و وضعیت دستگاه بر اساس تنظیمات ذخیره‌شده در پایگاه داده.</p>
        </div>

        <div className="dashboard-controls">
          <label className="dashboard-device-select">
            <span><Cpu size={15} aria-hidden="true" />دستگاه</span>
            <select
              value={selectedDeviceId ?? ''}
              disabled={loadState === 'loading' || !dashboard?.devices.length}
              onChange={(event) => changeDevice(event.target.value)}
            >
              {!dashboard?.devices.length ? <option value="">دستگاهی نیست</option> : null}
              {dashboard?.devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.localId} · {device.gatewayTitle}
                </option>
              ))}
            </select>
          </label>
          <div className="range-control" role="group" aria-label="بازهٔ زمانی">
            <span className="range-control__label">بازه</span>
            <div className="range-control__options">
              {(Object.keys(rangeLabels) as TimeRange[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={range === value}
                  onClick={() => changeRange(value)}
                >
                  {rangeLabels[value]}
                </button>
              ))}
            </div>
          </div>
          <button
            className="dashboard-refresh"
            type="button"
            disabled={loadState === 'loading'}
            onClick={() => {
              setLoadState('loading')
              setReloadKey((current) => current + 1)
            }}
          >
            <RefreshCw size={15} aria-hidden="true" />تازه‌سازی
          </button>
        </div>
      </header>

      {loadState === 'error' ? (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={21} aria-hidden="true" />
          <div><strong>داشبورد بارگذاری نشد</strong><p>{error}</p></div>
          <button type="button" onClick={() => { setLoadState('loading'); setReloadKey((current) => current + 1) }}>تلاش دوباره</button>
        </div>
      ) : null}

      {selectedDevice ? (
        <section className="dashboard-device-banner" aria-label="دستگاه انتخابی">
          <div>
            <span className="eyebrow">دستگاه انتخابی</span>
            <strong dir="ltr">{selectedDevice.localId}</strong>
            <small>{selectedDevice.deviceTypeTitle} · {selectedDevice.gatewayTitle}</small>
          </div>
          <div className="dashboard-device-banner__stats">
            <span><b>{dashboard?.tabs.reduce((sum, tab) => sum + tab.visualizations.length, 0).toLocaleString('fa-IR')}</b> نمودار فعال</span>
            <span><b>{dashboard?.binaryParameters.length.toLocaleString('fa-IR')}</b> پارامتر بولی</span>
          </div>
        </section>
      ) : null}

      {loadState === 'loading' && !dashboard ? (
        <div className="dashboard-loading" aria-busy="true" aria-label="در حال دریافت داشبورد">
          <span /><span /><span />
        </div>
      ) : activeTab ? (
        <>
          <nav className="dashboard-tabs" aria-label="گروه‌های داشبورد" role="tablist">
            {dashboard?.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab.code === tab.code}
                onClick={() => setActiveTabCode(tab.code)}
              >
                {tab.title}
                <small>{tab.visualizations.length.toLocaleString('fa-IR')}</small>
              </button>
            ))}
          </nav>
          {activeTab.visualizations.length ? (
            <section className="dashboard-chart-grid" aria-label={`نمودارهای ${activeTab.title}`}>
              {activeTab.visualizations.map((visualization) => (
                <DashboardChart key={visualization.id} visualization={visualization} />
              ))}
            </section>
          ) : (
            <div className="dashboard-empty" role="status">
              <Database size={28} aria-hidden="true" />
              <h2>برای این تب نموداری فعال نیست</h2>
              <p>از بخش «مدیریت سکو → داشبورد» یک نمودار اضافه کنید.</p>
              <button type="button" onClick={() => onSectionChange('management')}>مدیریت داشبورد</button>
            </div>
          )}
        </>
      ) : loadState === 'ready' ? (
        <div className="dashboard-empty" role="status">
          <Database size={28} aria-hidden="true" />
          <h2>هنوز داشبوردی تنظیم نشده است</h2>
          <p>یک تب و نمودار از بخش «مدیریت سکو» بسازید.</p>
          <button type="button" onClick={() => onSectionChange('management')}>رفتن به مدیریت سکو</button>
        </div>
      ) : null}

      {dashboard ? <BinaryStatusPanel parameters={dashboard.binaryParameters} /> : null}
      {dashboard ? <DashboardEventList events={dashboard.recentEvents} /> : null}
    </div>
  )
}
