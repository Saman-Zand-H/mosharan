import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

import type { AuthUser } from '../../features/auth/authContext'
import { Brand } from './Brand'
import { Navigation } from './Navigation'
import { SidebarAccount } from './SidebarAccount'

interface MobileNavigationProps {
  user: AuthUser
  open: boolean
  onClose: () => void
  onLogout: () => Promise<void>
}

export function MobileNavigation({
  user,
  open,
  onClose,
  onLogout,
}: MobileNavigationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="mobile-navigation"
      aria-label="فهرست اصلی"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="mobile-navigation__header">
        <Brand />
        <button
          className="icon-button icon-button--dark"
          type="button"
          aria-label="بستن فهرست"
          onClick={onClose}
        >
          <X size={21} aria-hidden="true" />
        </button>
      </div>
      <Navigation isSuperuser={user.isSuperuser} onNavigate={onClose} />
      <SidebarAccount user={user} onLogout={onLogout} />
    </dialog>
  )
}
