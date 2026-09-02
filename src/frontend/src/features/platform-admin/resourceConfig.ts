import {
  Boxes,
  Braces,
  Building2,
  Cable,
  ChartLine,
  ChartNoAxesCombined,
  Cpu,
  FileCode2,
  Gauge,
  GitBranch,
  ListChecks,
  RadioTower,
  ScanLine,
  Users,
  type LucideIcon,
} from 'lucide-react'

import type { ManagementResource } from './managementTypes'

export type ManagementGroupId =
  | 'accounts'
  | 'fleet'
  | 'catalog'
  | 'protocols'
  | 'dashboard'

export interface ResourceDefinition {
  id: ManagementResource
  label: string
  singular: string
  description: string
  icon: LucideIcon
  columns: string[]
}

export interface ResourceGroup {
  id: ManagementGroupId
  label: string
  resources: ManagementResource[]
}

export const resourceGroups: ResourceGroup[] = [
  {
    id: 'accounts',
    label: 'حساب‌ها و شرکت‌ها',
    resources: ['companies', 'users'],
  },
  {
    id: 'fleet',
    label: 'رجیستری ناوگان',
    resources: ['gateways', 'devices'],
  },
  {
    id: 'catalog',
    label: 'کاتالوگ دستگاه',
    resources: ['deviceTypes', 'parameters', 'deviceTypeParameters'],
  },
  {
    id: 'protocols',
    label: 'طرح‌واره و نگاشت',
    resources: ['eventTypes', 'payloadSchemas', 'payloadFields', 'projectionRules'],
  },
  {
    id: 'dashboard',
    label: 'داشبورد',
    resources: ['visualizationTabs', 'visualizations'],
  },
]

export const resourceDefinitions: Record<
  ManagementResource,
  ResourceDefinition
> = {
  users: {
    id: 'users',
    label: 'کاربران',
    singular: 'کاربر',
    description: 'حساب‌های شرکت‌ها و مدیران سکو، همراه با وضعیت دسترسی.',
    icon: Users,
    columns: ['حساب کاربری', 'نقش', 'وضعیت'],
  },
  companies: {
    id: 'companies',
    label: 'شرکت‌ها',
    singular: 'شرکت',
    description: 'مرز مالکیت داده و کاربر یکتای نمایندهٔ هر شرکت.',
    icon: Building2,
    columns: ['شرکت', 'کاربر نماینده', 'درگاه‌ها'],
  },
  gateways: {
    id: 'gateways',
    label: 'درگاه‌ها',
    singular: 'درگاه',
    description: 'کنترلرهای GSM، مالکیت شرکتی و وضعیت رجیستری.',
    icon: RadioTower,
    columns: ['درگاه', 'شرکت', 'وضعیت'],
  },
  devices: {
    id: 'devices',
    label: 'دستگاه‌ها',
    singular: 'دستگاه',
    description: 'شناسه‌های محلی دستگاه‌ها در هر درگاه و نوع سخت‌افزار.',
    icon: Cpu,
    columns: ['دستگاه محلی', 'درگاه', 'نوع دستگاه'],
  },
  deviceTypes: {
    id: 'deviceTypes',
    label: 'انواع دستگاه',
    singular: 'نوع دستگاه',
    description: 'رده‌های سخت‌افزاری و پارامترهای پشتیبانی‌شده.',
    icon: Boxes,
    columns: ['نوع دستگاه', 'پارامترها', 'دستگاه‌ها'],
  },
  parameters: {
    id: 'parameters',
    label: 'پارامترها',
    singular: 'پارامتر',
    description: 'تعریف‌های تایپ‌شده برای تاریخچهٔ خوانش‌های EAV.',
    icon: Gauge,
    columns: ['پارامتر', 'نوع مقدار', 'واحد'],
  },
  deviceTypeParameters: {
    id: 'deviceTypeParameters',
    label: 'تخصیص پارامتر',
    singular: 'تخصیص پارامتر',
    description: 'پارامترهای مجاز برای هر نوع دستگاه.',
    icon: ListChecks,
    columns: ['نوع دستگاه', 'پارامتر', 'نوع مقدار'],
  },
  eventTypes: {
    id: 'eventTypes',
    label: 'انواع رویداد',
    singular: 'نوع رویداد',
    description: 'معنای پایدار پیام‌های دریافتی از سخت‌افزار.',
    icon: Cable,
    columns: ['نوع رویداد', 'طرح‌واره‌ها', 'رویداد خام'],
  },
  payloadSchemas: {
    id: 'payloadSchemas',
    label: 'طرح‌واره‌های payload',
    singular: 'طرح‌وارهٔ payload',
    description: 'نسخه‌های پایگاه‌داده‌محور برای رمزگشایی payloadهای UTF-8.',
    icon: FileCode2,
    columns: ['طرح‌واره', 'نسخه و طول', 'ساختار'],
  },
  payloadFields: {
    id: 'payloadFields',
    label: 'فیلدهای payload',
    singular: 'فیلد payload',
    description: 'بازه‌های بایتی نیمه‌باز، codec و نقش هر بخش از payload.',
    icon: ScanLine,
    columns: ['فیلد', 'طرح‌واره', 'بازه و codec'],
  },
  projectionRules: {
    id: 'projectionRules',
    label: 'قوانین نگاشت',
    singular: 'قانون نگاشت',
    description: 'نگاشت فیلد یا مقدار ثابت به پارامترهای تایپ‌شده.',
    icon: GitBranch,
    columns: ['پارامتر مقصد', 'طرح‌واره', 'منبع'],
  },
  visualizationTabs: {
    id: 'visualizationTabs',
    label: 'تب‌های داشبورد',
    singular: 'تب داشبورد',
    description: 'گروه‌بندی نمودارها برای هر نوع دستگاه.',
    icon: ChartNoAxesCombined,
    columns: ['تب', 'نوع دستگاه', 'وضعیت'],
  },
  visualizations: {
    id: 'visualizations',
    label: 'نمودارها',
    singular: 'نمودار',
    description: 'تعریف عنوان، نوع و محورهای هر نمودار از داده‌های تله‌متری.',
    icon: ChartLine,
    columns: ['نمودار', 'تب', 'محورها'],
  },
}

export const managementOverviewIcon = Braces
