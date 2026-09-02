import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

import type { SectionId } from '../../types'
import type { AuthUser } from '../../features/auth/authContext'
import { Brand } from './Brand'
import { Navigation } from './Navigation'
import { SidebarAccount } from './SidebarAccount'

interface MobileNavigationProps {
  activeSection: SectionId
  user: AuthUser
  open: boolean
  onClose: () => void
  onLogout: () => Promise<void>
  onSelect: (section: SectionId) => void
}

export function MobileNavigation({
  activeSection,
  user,
  open,
  onClose,
  onLogout,
  onSelect,
}: MobileNavigationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const selectSection = (section: SectionId) => {
    onSelect(section)
    onClose()
  }

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
      <Navigation
        activeSection={activeSection}
        isSuperuser={user.isSuperuser}
        onSelect={selectSection}
      />
      <SidebarAccount user={user} onLogout={onLogout} />
    </dialog>
  )
}
