export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

type FieldErrors = Record<string, string[]>

interface ErrorPayload {
  code?: string
  message?: string
  fields?: FieldErrors
  detail?: string | { msg?: string }[]
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: FieldErrors

  constructor(
    message: string,
    options: { status: number; code?: string; fields?: FieldErrors },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code ?? `http_${options.status}`
    this.fields = options.fields ?? {}
  }
}

let csrfToken: string | null = null

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  return match ? decodeURIComponent(match.slice(prefix.length)) : null
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return undefined

  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function errorMessage(payload: ErrorPayload | undefined, status: number): string {
  if (payload?.message) return payload.message
  if (typeof payload?.detail === 'string') return payload.detail
  if (Array.isArray(payload?.detail)) {
    const details = payload.detail
      .map((item) => item.msg)
      .filter((item): item is string => Boolean(item))
    if (details.length) return details.join('، ')
  }

  if (status === 401) return 'برای ادامه باید وارد حساب کاربری شوید.'
  if (status === 403) return 'اجازهٔ انجام این عملیات را ندارید.'
  if (status === 404) return 'رکورد موردنظر پیدا نشد.'
  if (status === 409) return 'این تغییر با داده‌های موجود تداخل دارد.'
  if (status === 422) return 'اطلاعات واردشده معتبر نیست.'
  return 'ارتباط با سرور با خطا روبه‌رو شد.'
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken

  const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Accept-Language': 'fa' },
  })
  const payload = (await parseResponse(response)) as
    | { csrfToken?: string }
    | undefined

  if (!response.ok) {
    throw new ApiError('دریافت مجوز امنیتی ممکن نشد.', {
      status: response.status,
    })
  }

  const token = payload?.csrfToken ?? readCookie('csrftoken')
  if (!token) {
    throw new ApiError('توکن امنیتی پاسخ سرور موجود نیست.', {
      status: 500,
      code: 'csrf_token_missing',
    })
  }
  csrfToken = token
  return token
}

export function resetCsrfToken(): void {
  csrfToken = null
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const mutating = method !== 'GET'
  const headers = new Headers({
    Accept: 'application/json',
    'Accept-Language': 'fa',
  })

  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (mutating) headers.set('X-CSRFToken', await ensureCsrfToken())

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'same-origin',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('سرور در دسترس نیست. اتصال را بررسی کنید.', {
      status: 0,
      code: 'network_error',
    })
  }

  const payload = await parseResponse(response)
  if (!response.ok) {
    const errorPayload = payload as ErrorPayload | undefined
    throw new ApiError(errorMessage(errorPayload, response.status), {
      status: response.status,
      code: errorPayload?.code,
      fields: errorPayload?.fields,
    })
  }

  return payload as T
}
