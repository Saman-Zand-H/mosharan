import { useRef, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowLeft, LockKeyhole, RadioTower } from 'lucide-react'

import { useAuth } from './authContext'

export function LoginPage() {
  const { error: sessionError, login, retry, status } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      setFormError('نام کاربری و گذرواژه را وارد کنید.')
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await login(username.trim(), password)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'ورود به سامانه ممکن نشد.',
      )
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro" aria-labelledby="login-intro-title">
        <div className="login-intro__brand">
          <img src="/telemetry-mark.svg" alt="" />
          <span><strong>پایش</strong><small>مدیریت تله‌متری صنعتی</small></span>
        </div>
        <div className="login-intro__copy">
          <span className="login-intro__eyebrow"><RadioTower size={15} aria-hidden="true" />مرکز عملیات دستگاه‌ها</span>
          <h1 id="login-intro-title">از رویداد خام تا تصمیم قابل اعتماد</h1>
          <p>درگاه‌ها، دستگاه‌ها و طرح‌واره‌های دریافت را در یک فضای امن و یکپارچه مدیریت کنید.</p>
        </div>
        <p className="login-intro__footnote">دسترسی هر شرکت به داده‌های خودش محدود است.</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <form className="login-form" onSubmit={submit} noValidate>
          <span className="login-form__icon"><LockKeyhole size={22} aria-hidden="true" /></span>
          <p className="eyebrow">ورود امن</p>
          <h2 id="login-title">خوش آمدید</h2>
          <p className="login-form__lead">برای ورود به فضای کاری، اطلاعات حساب خود را وارد کنید.</p>

          {sessionError || formError ? (
            <div className="login-error" ref={errorRef} role="alert" tabIndex={-1}>
              <AlertCircle size={17} aria-hidden="true" />
              <span>{formError ?? sessionError}</span>
            </div>
          ) : null}

          {status === 'error' ? (
            <button className="login-retry" type="button" onClick={() => void retry()}>
              تلاش دوباره برای اتصال
            </button>
          ) : (
            <>
              <label className="form-field" htmlFor="login-username">
                <span>نام کاربری</span>
                <input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={submitting}
                  autoFocus
                />
              </label>
              <label className="form-field" htmlFor="login-password">
                <span>گذرواژه</span>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                />
              </label>
              <button className="login-submit" type="submit" disabled={submitting}>
                <span>{submitting ? 'در حال بررسی…' : 'ورود به سامانه'}</span>
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </form>
      </section>
    </main>
  )
}
