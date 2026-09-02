import type { SectionId } from '../../types'
import type { AuthUser } from '../../features/auth/authContext'
import { Brand } from './Brand'
import { Navigation } from './Navigation'
import { SidebarAccount } from './SidebarAccount'

interface DesktopSidebarProps {
  activeSection: SectionId
  user: AuthUser
  onLogout: () => Promise<void>
  onSelect: (section: SectionId) => void
}

export function DesktopSidebar({
  activeSection,
  user,
  onLogout,
  onSelect,
}: DesktopSidebarProps) {
  return (
    <aside className="sidebar">
      <Brand />
      <Navigation
        activeSection={activeSection}
        isSuperuser={user.isSuperuser}
        onSelect={onSelect}
      />

      <SidebarAccount user={user} onLogout={onLogout} />

      <p className="sidebar__version">نسخه نمایشی ۰٫۱</p>
    </aside>
  )
}
