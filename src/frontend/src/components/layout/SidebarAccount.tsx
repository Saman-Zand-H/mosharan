import { useState } from 'react'
import { Building2, LogOut, ShieldCheck } from 'lucide-react'

import type { AuthUser } from '../../features/auth/authContext'

export function SidebarAccount({
  user,
  onLogout,
}: {
  user: AuthUser
  onLogout: () => Promise<void>
}) {
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.username
  const initial = fullName.charAt(0).toLocaleUpperCase('fa-IR')

  const logout = async () => {
    setLoggingOut(true)
    setError(null)
    try {
      await onLogout()
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : 'خروج از حساب ممکن نشد.',
      )
      setLoggingOut(false)
    }
  }

  return (
    <div className="sidebar-account">
      <span className="sidebar-account__avatar" aria-hidden="true">{initial}</span>
      <span className="sidebar-account__copy">
        <strong>{fullName}</strong>
        <small>
          {user.isSuperuser ? (
            <><ShieldCheck size={12} aria-hidden="true" />مدیر سکو</>
          ) : (
            <><Building2 size={12} aria-hidden="true" />{user.company?.name ?? 'بدون شرکت'}</>
          )}
        </small>
      </span>
      <button
        type="button"
        aria-label="خروج از حساب"
        title={error ?? 'خروج از حساب'}
        disabled={loggingOut}
        onClick={() => void logout()}
      >
        <LogOut size={16} aria-hidden="true" />
      </button>
      {error ? <span className="sidebar-account__error" role="alert">{error}</span> : null}
    </div>
  )
}
