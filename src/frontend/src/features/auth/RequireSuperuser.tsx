import { ArrowRight, ShieldX } from 'lucide-react'
import type { ReactNode } from 'react'

import type { AuthUser } from './authContext'

export function RequireSuperuser({
  user,
  children,
  onLeave,
}: {
  user: AuthUser
  children: ReactNode
  onLeave: () => void
}) {
  if (user.isSuperuser) return children

  return (
    <section className="access-denied" aria-labelledby="access-denied-title">
      <span><ShieldX size={28} aria-hidden="true" /></span>
      <p className="eyebrow">دسترسی محدود</p>
      <h1 id="access-denied-title">این فضا ویژهٔ مدیر سکو است</h1>
      <p>حساب شما فقط به فضای شرکت و داده‌های درگاه‌های همان شرکت دسترسی دارد.</p>
      <button type="button" onClick={onLeave}>
        <ArrowRight size={17} aria-hidden="true" />بازگشت به نمای کلی
      </button>
    </section>
  )
}
