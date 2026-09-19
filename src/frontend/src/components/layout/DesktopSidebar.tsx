import type { AuthUser } from '../../features/auth/authContext'
import { Brand } from './Brand'
import { Navigation } from './Navigation'
import { SidebarAccount } from './SidebarAccount'

interface DesktopSidebarProps {
  user: AuthUser
  onLogout: () => Promise<void>
}

export function DesktopSidebar({ user, onLogout }: DesktopSidebarProps) {
  return (
    <aside className="sidebar">
      <Brand />
      <Navigation isSuperuser={user.isSuperuser} />

      <SidebarAccount user={user} onLogout={onLogout} />

      <p className="sidebar__version">نسخه نمایشی ۰٫۱</p>
    </aside>
  )
}
