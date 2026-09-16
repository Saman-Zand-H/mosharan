import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, Copy, KeyRound, Trash2, X } from 'lucide-react'

export function DeleteConfirmDialog({
  title,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  title: string
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => dialogRef.current?.showModal(), [])

  return (
    <dialog ref={dialogRef} className="admin-confirm" aria-labelledby="delete-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
      <span className="admin-confirm__icon admin-confirm__icon--danger"><AlertTriangle size={24} aria-hidden="true" /></span>
      <button className="admin-confirm__close" type="button" aria-label="بستن" disabled={busy} onClick={onClose}><X size={18} aria-hidden="true" /></button>
      <p className="eyebrow">عملیات حساس</p>
      <h2 id="delete-title">حذف «{title}»؟</h2>
      <p>این عملیات فقط زمانی انجام می‌شود که رکورد وابسته‌ای وجود نداشته باشد. داده‌های محافظت‌شده حذف نخواهند شد.</p>
      {error ? <div className="admin-form-error" role="alert">{error}</div> : null}
      <footer>
        <button className="admin-button admin-button--ghost" type="button" disabled={busy} onClick={onClose}>انصراف</button>
        <button className="admin-button admin-button--danger" type="button" disabled={busy} onClick={onConfirm}><Trash2 size={15} aria-hidden="true" />{busy ? 'در حال حذف…' : 'حذف رکورد'}</button>
      </footer>
    </dialog>
  )
}

export function PasswordDialog({
  username,
  busy,
  error,
  serverValidationErrors,
  onClose,
  onConfirm,
}: {
  username: string
  busy: boolean
  error: string | null
  serverValidationErrors: readonly string[]
  onClose: () => void
  onConfirm: (password: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const passwordErrors = validationError
    ? [validationError]
    : serverValidationErrors
  const passwordError = passwordErrors.join('؛ ')
  useEffect(() => dialogRef.current?.showModal(), [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8) {
      setValidationError('گذرواژه باید دست‌کم ۸ نویسه داشته باشد.')
      return
    }
    onConfirm(password)
  }

  return (
    <dialog ref={dialogRef} className="admin-confirm" aria-labelledby="password-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
      <form onSubmit={submit}>
        <span className="admin-confirm__icon"><KeyRound size={23} aria-hidden="true" /></span>
        <button className="admin-confirm__close" type="button" aria-label="بستن" disabled={busy} onClick={onClose}><X size={18} aria-hidden="true" /></button>
        <p className="eyebrow">امنیت حساب</p>
        <h2 id="password-title">گذرواژهٔ جدید برای {username}</h2>
        <p>گذرواژهٔ تازه را از مسیر امن در اختیار کاربر قرار دهید.</p>
        <label className="admin-form-field admin-form-field--wide" htmlFor="new-password">
          <span>گذرواژهٔ جدید</span>
          <input
            id="new-password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            autoFocus
            value={password}
            disabled={busy}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? 'new-password-error' : undefined}
            onChange={(event) => {
              setPassword(event.target.value)
              setValidationError(null)
            }}
          />
          {passwordError ? (
            <small
              className="admin-field-error"
              id="new-password-error"
              role="alert"
            >
              {passwordError}
            </small>
          ) : null}
        </label>
        {error && !serverValidationErrors.length ? (
          <div className="admin-form-error" role="alert">{error}</div>
        ) : null}
        <footer>
          <button className="admin-button admin-button--ghost" type="button" disabled={busy} onClick={onClose}>انصراف</button>
          <button className="admin-button admin-button--primary" type="submit" disabled={busy}>{busy ? 'در حال ذخیره…' : 'تغییر گذرواژه'}</button>
        </footer>
      </form>
    </dialog>
  )
}

export function GatewayTokenDialog({
  gatewayUid,
  token,
  busy,
  error,
  onClose,
}: {
  gatewayUid: string
  token: string | null
  busy: boolean
  error: string | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const copyToken = async () => {
    if (!token || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="admin-confirm gateway-token-dialog"
      aria-labelledby="gateway-token-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <span className="admin-confirm__icon"><KeyRound size={23} aria-hidden="true" /></span>
      <button className="admin-confirm__close" type="button" aria-label="بستن" disabled={busy} onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
      <p className="eyebrow">احراز هویت سخت‌افزار</p>
      <h2 id="gateway-token-title">توکن دریافت {gatewayUid}</h2>
      {busy ? (
        <p>توکن امن در حال ساخت است…</p>
      ) : error ? (
        <div className="admin-form-error" role="alert">{error}</div>
      ) : token ? (
        <>
          <p>این توکن فقط همین‌بار نمایش داده می‌شود. صدور دوباره، توکن قبلی را باطل می‌کند؛ آن را در تنظیمات امن Gateway ذخیره کنید.</p>
          <code className="gateway-token-value" dir="ltr">{token}</code>
          <button className="admin-button admin-button--secondary gateway-token-copy" type="button" onClick={() => void copyToken()}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? 'کپی شد' : 'کپی توکن'}
          </button>
        </>
      ) : null}
      <footer>
        <button className="admin-button admin-button--ghost" type="button" disabled={busy} onClick={onClose}>بستن</button>
      </footer>
    </dialog>
  )
}
