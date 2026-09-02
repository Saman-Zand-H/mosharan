import { ArrowLeft, TriangleAlert } from 'lucide-react'

interface AttentionBannerProps {
  onInspect: () => void
}

export function AttentionBanner({ onInspect }: AttentionBannerProps) {
  return (
    <aside className="attention-banner" aria-label="هشدار عملیات">
      <span className="attention-banner__icon">
        <TriangleAlert size={20} aria-hidden="true" />
      </span>
      <div>
        <strong>۳ رویداد نیاز به بررسی دارد</strong>
        <p>طرح‌وارهٔ معتبر برای پیام‌های اخیر «انبار غرب» پیدا نشد.</p>
      </div>
      <button type="button" onClick={onInspect}>
        بررسی رویدادها
        <ArrowLeft size={16} aria-hidden="true" />
      </button>
    </aside>
  )
}
