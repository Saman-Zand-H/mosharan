import {
  Boxes,
  Cable,
  Cpu,
  Gauge,
  LayoutDashboard,
  Radio,
  RadioTower,
  ShieldCheck,
} from 'lucide-react'

import type {
  ModuleSectionId,
  ModuleSummary,
  NavigationItem,
} from '../types'

// Navigation metadata is static UI structure; dashboard values come from Django.
export const navigationItems: NavigationItem[] = [
  { id: 'overview', label: 'نمای کلی', icon: LayoutDashboard },
  { id: 'gateways', label: 'درگاه‌ها', icon: RadioTower },
  { id: 'devices', label: 'دستگاه‌ها', icon: Cpu },
  { id: 'events', label: 'رویدادها', icon: Cable },
  {
    id: 'simulator',
    label: 'شبیه‌ساز دریافت',
    icon: Radio,
    superuserOnly: true,
  },
  { id: 'parameters', label: 'پارامترها', icon: Gauge },
  { id: 'protocols', label: 'پروتکل‌ها', icon: Boxes },
  {
    id: 'management',
    label: 'مدیریت سکو',
    icon: ShieldCheck,
    superuserOnly: true,
  },
]

export const moduleSummaries: Record<ModuleSectionId, ModuleSummary> = {
  gateways: {
    title: 'درگاه‌ها',
    description: 'هویت سخت‌افزاری نصب‌ها، وضعیت رجیستری و آخرین رویداد هر درگاه.',
  },
  devices: {
    title: 'دستگاه‌ها',
    description: 'میکروکنترلرهای متصل به هر درگاه و پارامترهای پشتیبانی‌شدهٔ آن‌ها.',
  },
  events: {
    title: 'رویدادها',
    description: 'دفتر کل تغییرناپذیر پیام‌های خام، نتایج پردازش و خطاهای قابل بازیابی.',
  },
  parameters: {
    title: 'پارامترها',
    description: 'تعریف متریک‌های تایپ‌شده و تاریخچهٔ EAV برای هر دستگاه.',
  },
  protocols: {
    title: 'پروتکل‌ها',
    description: 'طرح‌واره‌های نسخه‌بندی‌شده، بازه‌های بایتی و قوانین نگاشت payload.',
  },
}
