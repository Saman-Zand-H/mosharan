import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { AppShell } from './components/layout/AppShell'
import { moduleSummaries, navigationItems } from './data/mockData'
import { LoginPage } from './features/auth/LoginPage'
import { RequireSuperuser } from './features/auth/RequireSuperuser'
import { useAuth } from './features/auth/authContext'
import { AdminWorkspace } from './features/platform-admin/AdminWorkspace'
import { ModulePage } from './pages/ModulePage'
import { OverviewPage } from './pages/OverviewPage'
import { PacketSimulatorPage } from './pages/PacketSimulatorPage'
import { sectionFromPath, sectionPaths } from './routes'
import type { ModuleSectionId, SectionId } from './types'

const moduleSections: ModuleSectionId[] = [
  'gateways',
  'devices',
  'events',
  'parameters',
  'protocols',
]

function App() {
  const { status, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const mainContentRef = useRef<HTMLElement>(null)
  const activeSection = sectionFromPath(location.pathname)
  const firstRenderRef = useRef(true)

  useEffect(() => {
    if (status === 'anonymous' || status === 'error') {
      document.title = 'ورود | پایش'
      return
    }
    const sectionTitle = navigationItems.find(
      (item) => item.id === activeSection,
    )?.label
    document.title = `${sectionTitle ?? 'پایش'} | پایش`
  }, [activeSection, status])

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0 })
      mainContentRef.current?.focus({ preventScroll: true })
    })
  }, [location.pathname])

  const changeSection = (section: SectionId) => {
    navigate(sectionPaths[section])
  }

  if (status === 'loading') {
    return (
      <main className="auth-loading" aria-busy="true" aria-label="در حال بررسی نشست کاربری">
        <div>
          <img src="/telemetry-mark.svg" alt="" />
          <span>در حال آماده‌سازی فضای کاری…</span>
        </div>
      </main>
    )
  }

  if (status === 'anonymous' || status === 'error') return <LoginPage />
  if (!user) return null

  return (
    <AppShell mainContentRef={mainContentRef} user={user} onLogout={logout}>
      <Routes>
        <Route
          path={sectionPaths.overview}
          element={<OverviewPage onSectionChange={changeSection} />}
        />
        <Route
          path={sectionPaths.simulator}
          element={
            <RequireSuperuser user={user} onLeave={() => changeSection('overview')}>
              <PacketSimulatorPage />
            </RequireSuperuser>
          }
        />
        <Route
          path={sectionPaths.management}
          element={
            <RequireSuperuser user={user} onLeave={() => changeSection('overview')}>
              <AdminWorkspace />
            </RequireSuperuser>
          }
        />
        {moduleSections.map((section) => (
          <Route
            key={section}
            path={sectionPaths[section]}
            element={<ModulePage section={section} summary={moduleSummaries[section]} />}
          />
        ))}
        <Route path="*" element={<Navigate to={sectionPaths.overview} replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
