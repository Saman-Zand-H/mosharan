import { useEffect, useRef, useState } from 'react'

import { AppShell } from './components/layout/AppShell'
import { moduleSummaries, navigationItems } from './data/mockData'
import { LoginPage } from './features/auth/LoginPage'
import { RequireSuperuser } from './features/auth/RequireSuperuser'
import { useAuth } from './features/auth/authContext'
import { AdminWorkspace } from './features/platform-admin/AdminWorkspace'
import { ModulePage } from './pages/ModulePage'
import { OverviewPage } from './pages/OverviewPage'
import { PacketSimulatorPage } from './pages/PacketSimulatorPage'
import type { SectionId } from './types'

function App() {
  const { status, user, logout } = useAuth()
  const [activeSection, setActiveSection] = useState<SectionId>('overview')
  const mainContentRef = useRef<HTMLElement>(null)

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

  const changeSection = (section: SectionId) => {
    if (
      (section === 'management' || section === 'simulator') &&
      !user?.isSuperuser
    ) {
      return
    }
    setActiveSection(section)
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0 })
      mainContentRef.current?.focus({ preventScroll: true })
    })
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
    <AppShell
      activeSection={activeSection}
      mainContentRef={mainContentRef}
      user={user}
      onLogout={logout}
      onSectionChange={changeSection}
    >
      {activeSection === 'overview' ? (
        <OverviewPage onSectionChange={changeSection} />
      ) : activeSection === 'simulator' ? (
        <RequireSuperuser user={user} onLeave={() => changeSection('overview')}>
          <PacketSimulatorPage />
        </RequireSuperuser>
      ) : activeSection === 'management' ? (
        <RequireSuperuser user={user} onLeave={() => changeSection('overview')}>
          <AdminWorkspace />
        </RequireSuperuser>
      ) : (
        <ModulePage
          section={activeSection}
          summary={moduleSummaries[activeSection]}
        />
      )}
    </AppShell>
  )
}

export default App
