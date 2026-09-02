import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Check, X } from 'lucide-react'

import {
  buildFormPayload,
  getFormFields,
  getInitialDraft,
  type FormDraft,
  updateFormDraft,
} from './resourceForms'
import { resourceDefinitions } from './resourceConfig'
import type {
  ManagementPayload,
  ManagementRecord,
  ManagementResource,
  ManagementSnapshot,
} from './managementTypes'

export function RecordFormDialog({
  resource,
  snapshot,
  record,
  saving,
  serverError,
  serverFields,
  onClose,
  onSubmit,
}: {
  resource: ManagementResource
  snapshot: ManagementSnapshot
  record?: ManagementRecord
  saving: boolean
  serverError: string | null
  serverFields: Record<string, string[]>
  onClose: () => void
  onSubmit: (payload: ManagementPayload) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<FormDraft>(() =>
    getInitialDraft(resource, record),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const definition = resourceDefinitions[resource]
  const fields = getFormFields(resource, snapshot, draft, record)
  const generalError = serverFields.__all__?.join('؛ ') ?? serverError

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = buildFormPayload(resource, draft, snapshot, record)
    setErrors(result.errors)
    if (!result.payload) {
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }
    onSubmit(result.payload)
  }

  const fieldError = (name: string) => {
    const serverName = name.endsWith('Id') ? name.slice(0, -2) : name
    return errors[name] ?? serverFields[name]?.[0] ?? serverFields[serverName]?.[0]
  }
  const changeDraft = (name: string, value: string | boolean) => {
    setDraft((current) => updateFormDraft(resource, current, name, value))
  }

  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      aria-labelledby="admin-form-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!saving) onClose()
      }}
    >
      <form onSubmit={submit} noValidate>
        <header className="admin-dialog__header">
          <div>
            <p className="eyebrow">{record ? 'ویرایش رکورد' : 'رکورد جدید'}</p>
            <h2 id="admin-form-title">
              {record ? `ویرایش ${definition.singular}` : `افزودن ${definition.singular}`}
            </h2>
            <p>{definition.description}</p>
          </div>
          <button type="button" aria-label="بستن فرم" disabled={saving} onClick={onClose}>
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        {generalError || Object.keys(errors).length ? (
          <div className="admin-form-error" ref={errorRef} role="alert" tabIndex={-1}>
            <AlertCircle size={17} aria-hidden="true" />
            <span>{generalError ?? 'فیلدهای مشخص‌شده را بررسی کنید.'}</span>
          </div>
        ) : null}

        <div className="admin-form-grid">
          {fields.map((field, index) => {
            const error = fieldError(field.name)
            if (field.type === 'checkbox') {
              return (
                <label className="admin-checkbox" key={field.name}>
                  <input
                    type="checkbox"
                    checked={Boolean(draft[field.name])}
                    disabled={saving || field.disabled}
                    onChange={(event) =>
                      changeDraft(field.name, event.target.checked)
                    }
                  />
                  <span><Check size={13} aria-hidden="true" /></span>
                  <strong>{field.label}</strong>
                </label>
              )
            }

            const inputId = `admin-field-${field.name}`
            const descriptionId = error
              ? `${inputId}-error`
              : field.help
                ? `${inputId}-help`
                : undefined
            return (
              <label
                className={`admin-form-field${field.wide ? ' admin-form-field--wide' : ''}`}
                htmlFor={inputId}
                key={field.name}
              >
                <span>{field.label}{field.required ? <b aria-hidden="true">*</b> : null}</span>
                {field.type === 'select' ? (
                  <select
                    id={inputId}
                    value={String(draft[field.name] ?? '')}
                    disabled={saving || field.disabled}
                    aria-invalid={Boolean(error)}
                    aria-describedby={descriptionId}
                    onChange={(event) => changeDraft(field.name, event.target.value)}
                  >
                    {field.required ? <option value="">انتخاب کنید…</option> : null}
                    {field.options?.map((option) => (
                      <option value={option.value} key={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={inputId}
                    value={String(draft[field.name] ?? '')}
                    disabled={saving || field.disabled}
                    dir={field.ltr ? 'ltr' : undefined}
                    aria-invalid={Boolean(error)}
                    aria-describedby={descriptionId}
                    onChange={(event) => changeDraft(field.name, event.target.value)}
                  />
                ) : (
                  <input
                    id={inputId}
                    type={field.type}
                    min={field.type === 'number' ? 0 : undefined}
                    value={String(draft[field.name] ?? '')}
                    disabled={saving || field.disabled}
                    dir={field.ltr ? 'ltr' : undefined}
                    autoFocus={index === 0}
                    aria-invalid={Boolean(error)}
                    aria-describedby={descriptionId}
                    onChange={(event) => changeDraft(field.name, event.target.value)}
                  />
                )}
                {error ? <small className="admin-field-error" id={descriptionId}>{error}</small> : field.help ? <small id={descriptionId}>{field.help}</small> : null}
              </label>
            )
          })}
        </div>

        <footer className="admin-dialog__footer">
          <button className="admin-button admin-button--ghost" type="button" disabled={saving} onClick={onClose}>انصراف</button>
          <button className="admin-button admin-button--primary" type="submit" disabled={saving}>
            {saving ? 'در حال ذخیره…' : record ? 'ذخیرهٔ تغییرات' : `افزودن ${definition.singular}`}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
