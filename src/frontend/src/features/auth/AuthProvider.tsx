import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { ApiError, apiRequest, resetCsrfToken } from '../../lib/api/http'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type AuthUser,
} from './authContext'

function resolveSessionError(requestError: unknown): string {
  return requestError instanceof Error
    ? requestError.message
    : 'بررسی نشست کاربری ممکن نشد.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void apiRequest<AuthUser>('/auth/me')
      .then((currentUser) => {
        if (!active) return
        setUser(currentUser)
        setStatus('authenticated')
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setUser(null)
        if (requestError instanceof ApiError && requestError.status === 401) {
          setStatus('anonymous')
          return
        }
        setError(resolveSessionError(requestError))
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [])

  const loadSession = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const currentUser = await apiRequest<AuthUser>('/auth/me')
      setUser(currentUser)
      setStatus('authenticated')
    } catch (requestError) {
      setUser(null)
      if (requestError instanceof ApiError && requestError.status === 401) {
        setStatus('anonymous')
        return
      }
      setError(resolveSessionError(requestError))
      setStatus('error')
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const authenticatedUser = await apiRequest<AuthUser>('/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    resetCsrfToken()
    setUser(authenticatedUser)
    setError(null)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    await apiRequest<void>('/auth/logout', { method: 'POST' })
    resetCsrfToken()
    setUser(null)
    setError(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, login, logout, retry: loadSession }),
    [error, loadSession, login, logout, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
