import { useState, type ReactNode, type RefObject } from 'react'
import { Menu } from 'lucide-react'

import type { SectionId } from '../../types'
import type { AuthUser } from '../../features/auth/authContext'
import { DesktopSidebar } from './DesktopSidebar'
import { MobileNavigation } from './MobileNavigation'

interface AppShellProps {
  activeSection: SectionId
  children: ReactNode
  mainContentRef: RefObject<HTMLElement | null>
  user: AuthUser
  onLogout: () => Promise<void>
  onSectionChange: (section: SectionId) => void
}

export function AppShell({
  activeSection,
  children,
  mainContentRef,
  user,
  onLogout,
  onSectionChange,
}: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>
      <DesktopSidebar
        activeSection={activeSection}
        user={user}
        onLogout={onLogout}
        onSelect={onSectionChange}
      />
      <MobileNavigation
        activeSection={activeSection}
        user={user}
        open={mobileNavigationOpen}
        onClose={() => setMobileNavigationOpen(false)}
        onLogout={onLogout}
        onSelect={onSectionChange}
      />

      <div className="app-shell__content">
        <div className="mobile-topbar">
          <button
            className="icon-button"
            type="button"
            aria-label="باز کردن فهرست"
            onClick={() => setMobileNavigationOpen(true)}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <div>
            <strong>پایش</strong>
            <span>مدیریت تله‌متری</span>
          </div>
          <span className="mobile-topbar__pulse" title={user.username} aria-hidden="true" />
        </div>
        <main
          ref={mainContentRef}
          id="main-content"
          className="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
