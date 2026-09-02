import type {
  ManagementRecord,
  ManagementResource,
  ManagementSnapshot,
} from './managementTypes'

export interface RecordCell {
  primary: string
  secondary?: string
  tone?: 'active' | 'inactive' | 'admin' | 'neutral'
  ltr?: boolean
}

const source = (record: ManagementRecord) =>
  record as unknown as Record<string, unknown>

const text = (record: ManagementRecord, key: string) =>
  String(source(record)[key] ?? '')

const number = (record: ManagementRecord, key: string) =>
  Number(source(record)[key])

const bool = (record: ManagementRecord, key: string) =>
  Boolean(source(record)[key])

const byId = <T extends { id: number }>(items: T[], id: number | null) =>
  items.find((item) => item.id === id)

const faNumber = (value: number) => value.toLocaleString('fa-IR')

const valueTypeLabels: Record<string, string> = {
  integer: 'عدد صحیح',
  datetime: 'تاریخ و زمان',
  string: 'رشته',
  boolean: 'بولی',
}

export function getRecordTitle(
  resource: ManagementResource,
  record: ManagementRecord,
  snapshot: ManagementSnapshot,
): string {
  switch (resource) {
    case 'users':
      return text(record, 'username')
    case 'companies':
      return text(record, 'name')
    case 'gateways':
      return text(record, 'uid')
    case 'devices':
      return text(record, 'localId')
    case 'deviceTypes':
    case 'parameters':
    case 'eventTypes':
    case 'payloadFields':
      return text(record, 'code')
    case 'visualizationTabs':
    case 'visualizations':
      return text(record, 'title')
    case 'deviceTypeParameters': {
      const deviceType = byId(snapshot.deviceTypes, number(record, 'deviceTypeId'))
      const parameter = byId(snapshot.parameters, number(record, 'parameterId'))
      return `${deviceType?.code ?? '—'} / ${parameter?.code ?? '—'}`
    }
    case 'payloadSchemas': {
      const eventType = byId(snapshot.eventTypes, number(record, 'eventTypeId'))
      const deviceType = byId(snapshot.deviceTypes, number(record, 'deviceTypeId'))
      return `${eventType?.code ?? '—'} / ${deviceType?.code ?? '—'} / v${text(record, 'version')}`
    }
    case 'projectionRules': {
      const parameter = byId(snapshot.parameters, number(record, 'parameterId'))
      return parameter?.code ?? `#${record.id}`
    }
  }
}

export function getRecordSearchText(
  resource: ManagementResource,
  record: ManagementRecord,
  snapshot: ManagementSnapshot,
): string {
  return [
    getRecordTitle(resource, record, snapshot),
    ...Object.values(source(record)).filter(
      (item): item is string | number =>
        typeof item === 'string' || typeof item === 'number',
    ),
  ]
    .join(' ')
    .toLocaleLowerCase('fa-IR')
}

function statusCell(active: boolean): RecordCell {
  return active
    ? { primary: 'فعال', tone: 'active' }
    : { primary: 'غیرفعال', tone: 'inactive' }
}

export function getRecordCells(
  resource: ManagementResource,
  record: ManagementRecord,
  snapshot: ManagementSnapshot,
): RecordCell[] {
  switch (resource) {
    case 'users':
      return [
        {
          primary: text(record, 'username'),
          secondary: text(record, 'email'),
          ltr: true,
        },
        bool(record, 'isSuperuser')
          ? { primary: 'مدیر سکو', tone: 'admin' }
          : { primary: 'کاربر شرکت', tone: 'neutral' },
        statusCell(bool(record, 'isActive')),
      ]
    case 'companies': {
      const user = byId(snapshot.users, number(record, 'userId'))
      const gatewayCount = snapshot.gateways.filter(
        (item) => item.companyId === record.id,
      ).length
      return [
        { primary: text(record, 'name'), secondary: `شناسه ${faNumber(record.id)}` },
        { primary: user?.username ?? '—', secondary: user?.email, ltr: true },
        { primary: `${faNumber(gatewayCount)} درگاه`, tone: 'neutral' },
      ]
    }
    case 'gateways': {
      const company = byId(snapshot.companies, number(record, 'companyId'))
      return [
        { primary: text(record, 'uid'), secondary: text(record, 'title'), ltr: true },
        { primary: company?.name ?? 'تخصیص‌نیافته', tone: company ? 'neutral' : 'inactive' },
        statusCell(bool(record, 'isActive')),
      ]
    }
    case 'devices': {
      const gateway = byId(snapshot.gateways, number(record, 'gatewayId'))
      const deviceType = byId(snapshot.deviceTypes, number(record, 'deviceTypeId'))
      return [
        { primary: text(record, 'localId'), secondary: bool(record, 'isActive') ? 'فعال' : 'غیرفعال', ltr: true },
        { primary: gateway?.uid ?? '—', secondary: gateway?.title, ltr: true },
        { primary: deviceType?.title ?? '—', secondary: deviceType?.code, ltr: true },
      ]
    }
    case 'deviceTypes': {
      const assignments = snapshot.deviceTypeParameters.filter(
        (item) => item.deviceTypeId === record.id,
      ).length
      const devices = snapshot.devices.filter(
        (item) => item.deviceTypeId === record.id,
      ).length
      return [
        { primary: text(record, 'title'), secondary: text(record, 'code'), ltr: true },
        { primary: `${faNumber(assignments)} پارامتر` },
        { primary: `${faNumber(devices)} دستگاه` },
      ]
    }
    case 'parameters':
      return [
        { primary: text(record, 'title'), secondary: text(record, 'code'), ltr: true },
        { primary: valueTypeLabels[text(record, 'valueType')] ?? text(record, 'valueType') },
        { primary: text(record, 'unit') || 'بدون واحد', ltr: true },
      ]
    case 'deviceTypeParameters': {
      const deviceType = byId(snapshot.deviceTypes, number(record, 'deviceTypeId'))
      const parameter = byId(snapshot.parameters, number(record, 'parameterId'))
      return [
        { primary: deviceType?.title ?? '—', secondary: deviceType?.code, ltr: true },
        { primary: parameter?.title ?? '—', secondary: parameter?.code, ltr: true },
        { primary: valueTypeLabels[parameter?.valueType ?? ''] ?? '—' },
      ]
    }
    case 'eventTypes': {
      const schemas = snapshot.payloadSchemas.filter(
        (item) => item.eventTypeId === record.id,
      ).length
      return [
        { primary: text(record, 'title'), secondary: text(record, 'code'), ltr: true },
        { primary: `${faNumber(schemas)} طرح‌واره` },
        { primary: formatDate(text(record, 'dateUpdated')), tone: 'neutral' },
      ]
    }
    case 'payloadSchemas': {
      const eventType = byId(snapshot.eventTypes, number(record, 'eventTypeId'))
      const deviceType = byId(snapshot.deviceTypes, number(record, 'deviceTypeId'))
      const fields = snapshot.payloadFields.filter(
        (item) => item.payloadSchemaId === record.id,
      ).length
      const rules = snapshot.projectionRules.filter(
        (item) => item.payloadSchemaId === record.id,
      ).length
      const length = source(record).expectedLength
      return [
        { primary: eventType?.title ?? '—', secondary: `${eventType?.code ?? '—'} / ${deviceType?.code ?? '—'}`, ltr: true },
        { primary: `نسخه ${faNumber(number(record, 'version'))}`, secondary: length === null ? 'طول متغیر' : `${faNumber(Number(length))} بایت` },
        { primary: `${faNumber(fields)} فیلد`, secondary: `${faNumber(rules)} قانون نگاشت` },
      ]
    }
    case 'payloadFields': {
      const schema = byId(snapshot.payloadSchemas, number(record, 'payloadSchemaId'))
      const eventType = schema ? byId(snapshot.eventTypes, schema.eventTypeId) : undefined
      return [
        { primary: text(record, 'name'), secondary: text(record, 'code'), ltr: true },
        { primary: eventType?.code ?? '—', secondary: schema ? `v${schema.version}` : undefined, ltr: true },
        { primary: `[${text(record, 'startByte')}, ${text(record, 'endByte')})`, secondary: `${text(record, 'wireCodec')} · ${text(record, 'role')}`, ltr: true },
      ]
    }
    case 'projectionRules': {
      const schema = byId(snapshot.payloadSchemas, number(record, 'payloadSchemaId'))
      const eventType = schema ? byId(snapshot.eventTypes, schema.eventTypeId) : undefined
      const parameter = byId(snapshot.parameters, number(record, 'parameterId'))
      const field = byId(snapshot.payloadFields, number(record, 'sourceFieldId'))
      const sourceKind = text(record, 'sourceKind')
      return [
        { primary: parameter?.title ?? '—', secondary: parameter?.code, ltr: true },
        { primary: eventType?.code ?? '—', secondary: schema ? `v${schema.version}` : undefined, ltr: true },
        sourceKind === 'field'
          ? { primary: 'فیلد payload', secondary: field?.code ?? '—', ltr: true }
          : { primary: 'مقدار ثابت', secondary: JSON.stringify(source(record).constantValue), ltr: true },
      ]
    }
    case 'visualizationTabs': {
      const deviceType = byId(snapshot.deviceTypes, number(record, 'deviceTypeId'))
      const charts = snapshot.visualizations.filter(
        (item) => item.tabId === record.id,
      ).length
      return [
        { primary: text(record, 'title'), secondary: text(record, 'code'), ltr: true },
        { primary: deviceType?.title ?? '—', secondary: deviceType?.code, ltr: true },
        {
          primary: bool(record, 'isActive') ? 'فعال' : 'غیرفعال',
          secondary: `${faNumber(charts)} نمودار`,
          tone: bool(record, 'isActive') ? 'active' : 'inactive',
        },
      ]
    }
    case 'visualizations': {
      const tab = byId(snapshot.visualizationTabs, number(record, 'tabId'))
      const xAxis = byId(snapshot.parameters, number(record, 'xAxisId'))
      const yAxis = byId(snapshot.parameters, number(record, 'yAxisId'))
      return [
        { primary: text(record, 'title'), secondary: text(record, 'chartType'), ltr: true },
        { primary: tab?.title ?? '—', secondary: tab?.code, ltr: true },
        {
          primary: `X: ${xAxis?.code ?? 'زمان مشاهده'}`,
          secondary: `Y: ${yAxis?.code ?? '—'} · ${bool(record, 'isActive') ? 'فعال' : 'غیرفعال'}`,
          ltr: true,
        },
      ]
    }
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(date)
}
