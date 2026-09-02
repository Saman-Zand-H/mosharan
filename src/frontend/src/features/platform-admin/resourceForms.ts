import type {
  GatewayRecord,
  ManagementPayload,
  ManagementRecord,
  ManagementResource,
  ManagementSnapshot,
  ParameterRecord,
} from './managementTypes'

export type FormDraft = Record<string, string | boolean>

export interface FormFieldOption {
  value: string
  label: string
}

export interface FormFieldDefinition {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea'
  required?: boolean
  disabled?: boolean
  ltr?: boolean
  wide?: boolean
  help?: string
  options?: FormFieldOption[]
}

export interface FormResult {
  payload: ManagementPayload | null
  errors: Record<string, string>
}

export function updateFormDraft(
  resource: ManagementResource,
  draft: FormDraft,
  name: string,
  nextValue: string | boolean,
): FormDraft {
  const next = { ...draft, [name]: nextValue }
  if (resource === 'visualizations' && name === 'tabId') {
    return { ...next, xAxisId: '', yAxisId: '' }
  }
  if (resource !== 'projectionRules') return next

  if (name === 'payloadSchemaId') {
    return {
      ...next,
      parameterId: '',
      sourceFieldId: '',
      constantValue: '',
      timestampUnit: '',
    }
  }
  if (name === 'parameterId') {
    return {
      ...next,
      sourceFieldId: '',
      constantValue: '',
      timestampUnit: '',
    }
  }
  if (name === 'sourceKind') {
    return { ...next, sourceFieldId: '', constantValue: '' }
  }
  return next
}

const text = (
  name: string,
  label: string,
  options: Partial<FormFieldDefinition> = {},
): FormFieldDefinition => ({ name, label, type: 'text', ...options })

const select = (
  name: string,
  label: string,
  options: FormFieldOption[],
  extras: Partial<FormFieldDefinition> = {},
): FormFieldDefinition => ({ name, label, type: 'select', options, ...extras })

const checkbox = (name: string, label: string): FormFieldDefinition => ({
  name,
  label,
  type: 'checkbox',
  wide: true,
})

const sourceRecord = (record?: ManagementRecord) =>
  (record ?? {}) as unknown as Record<string, unknown>

const draftValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function getInitialDraft(
  resource: ManagementResource,
  record?: ManagementRecord,
): FormDraft {
  const item = sourceRecord(record)
  const commonActive = item.isActive === undefined ? true : Boolean(item.isActive)

  switch (resource) {
    case 'users':
      return {
        username: draftValue(item.username),
        email: draftValue(item.email),
        firstName: draftValue(item.firstName),
        lastName: draftValue(item.lastName),
        password: '',
        isActive: commonActive,
      }
    case 'companies':
      return { name: draftValue(item.name), userId: draftValue(item.userId) }
    case 'gateways':
      return {
        companyId: draftValue(item.companyId),
        uid: draftValue(item.uid),
        title: draftValue(item.title),
        isActive: commonActive,
      }
    case 'devices':
      return {
        gatewayId: draftValue(item.gatewayId),
        deviceTypeId: draftValue(item.deviceTypeId),
        localId: draftValue(item.localId),
        isActive: commonActive,
      }
    case 'deviceTypes':
    case 'eventTypes':
      return { code: draftValue(item.code), title: draftValue(item.title) }
    case 'parameters':
      return {
        code: draftValue(item.code),
        title: draftValue(item.title),
        valueType: draftValue(item.valueType) || 'integer',
        unit: draftValue(item.unit),
      }
    case 'deviceTypeParameters':
      return {
        deviceTypeId: draftValue(item.deviceTypeId),
        parameterId: draftValue(item.parameterId),
      }
    case 'payloadSchemas':
      return {
        eventTypeId: draftValue(item.eventTypeId),
        deviceTypeId: draftValue(item.deviceTypeId),
        version: draftValue(item.version) || '1',
        expectedLength: draftValue(item.expectedLength),
      }
    case 'payloadFields':
      return {
        payloadSchemaId: draftValue(item.payloadSchemaId),
        code: draftValue(item.code),
        name: draftValue(item.name),
        startByte: draftValue(item.startByte) || '0',
        endByte: draftValue(item.endByte) || '1',
        wireCodec: draftValue(item.wireCodec) || 'integer',
        role: draftValue(item.role) || 'metric',
      }
    case 'projectionRules': {
      const timestampUnit = (item.conversionConfig as { timestampUnit?: string })
        ?.timestampUnit
      return {
        payloadSchemaId: draftValue(item.payloadSchemaId),
        parameterId: draftValue(item.parameterId),
        sourceKind: draftValue(item.sourceKind) || 'field',
        sourceFieldId: draftValue(item.sourceFieldId),
        constantValue: draftValue(item.constantValue),
        timestampUnit: timestampUnit ?? '',
      }
    }
    case 'visualizationTabs':
      return {
        deviceTypeId: draftValue(item.deviceTypeId),
        code: draftValue(item.code),
        title: draftValue(item.title),
        sortOrder: draftValue(item.sortOrder) || '0',
        isActive: commonActive,
      }
    case 'visualizations':
      return {
        tabId: draftValue(item.tabId),
        title: draftValue(item.title),
        chartType: draftValue(item.chartType) || 'line',
        xAxisId: draftValue(item.xAxisId),
        yAxisId: draftValue(item.yAxisId),
        sortOrder: draftValue(item.sortOrder) || '0',
        isActive: commonActive,
      }
  }
}

function options<T extends { id: number }>(
  items: T[],
  label: (item: T) => string,
): FormFieldOption[] {
  return items.map((item) => ({ value: String(item.id), label: label(item) }))
}

function namedOption(id: number | null, records: { id: number; name: string }[]) {
  return records.find((item) => item.id === id)?.name ?? 'بدون شرکت'
}

export function getFormFields(
  resource: ManagementResource,
  snapshot: ManagementSnapshot,
  draft: FormDraft,
  record?: ManagementRecord,
): FormFieldDefinition[] {
  const editing = Boolean(record)
  const gatewayCompanyLocked =
    resource === 'gateways' &&
    Boolean(record) &&
    (record as GatewayRecord).companyId !== null
  const companyUserIds = new Set(
    snapshot.companies
      .filter((company) => !record || company.id !== record.id)
      .map((company) => company.userId),
  )
  const userOptions = options(
    snapshot.users.filter(
      (user) => !user.isSuperuser && !companyUserIds.has(user.id),
    ),
    (user) => `${user.username} — ${user.email}`,
  )
  const companyOptions = [
    { value: '', label: 'بدون شرکت / در انتظار تخصیص' },
    ...options(snapshot.companies, (company) => company.name),
  ]
  const gatewayOptions = options(snapshot.gateways, (gateway) => {
    const company = namedOption(gateway.companyId, snapshot.companies)
    return `${gateway.uid} — ${gateway.title} · ${company}`
  })
  const deviceTypeOptions = options(
    snapshot.deviceTypes,
    (deviceType) => `${deviceType.code} — ${deviceType.title}`,
  )
  const parameterOptions = options(
    snapshot.parameters,
    (parameter) => `${parameter.code} — ${parameter.title}`,
  )
  const eventTypeOptions = options(
    snapshot.eventTypes,
    (eventType) => `${eventType.code} — ${eventType.title}`,
  )
  const schemaOptions = options(snapshot.payloadSchemas, (schema) => {
    const eventType = snapshot.eventTypes.find((item) => item.id === schema.eventTypeId)
    const deviceType = snapshot.deviceTypes.find((item) => item.id === schema.deviceTypeId)
    return `${eventType?.code ?? '—'} / ${deviceType?.code ?? '—'} / v${schema.version}`
  })
  const deviceTypeOptionsForDashboard = options(
    snapshot.deviceTypes,
    (deviceType) => `${deviceType.code} — ${deviceType.title}`,
  )
  const selectedVisualizationTab = snapshot.visualizationTabs.find(
    (tab) => tab.id === Number(draft.tabId),
  )
  const assignedDashboardParameterIds = new Set(
    snapshot.deviceTypeParameters
      .filter((item) => item.deviceTypeId === selectedVisualizationTab?.deviceTypeId)
      .map((item) => item.parameterId),
  )
  const chartParameters = snapshot.parameters.filter(
    (parameter) =>
      assignedDashboardParameterIds.has(parameter.id) &&
      (parameter.valueType === 'integer' || parameter.valueType === 'datetime'),
  )
  const dashboardXAxisOptions = [
    { value: '', label: 'زمان مشاهده (observed_at)' },
    ...options(
      chartParameters.filter((parameter) => parameter.id !== Number(draft.yAxisId)),
      (parameter) => `${parameter.code} — ${parameter.title}`,
    ),
  ]
  const dashboardYAxisOptions = options(
    chartParameters.filter((parameter) => parameter.id !== Number(draft.xAxisId)),
    (parameter) => `${parameter.code} — ${parameter.title}`,
  )

  switch (resource) {
    case 'users':
      return [
        text('username', 'نام کاربری', { required: true, ltr: true }),
        { name: 'email', label: 'ایمیل', type: 'email', required: true, ltr: true },
        text('firstName', 'نام', { required: true }),
        text('lastName', 'نام خانوادگی', { required: true }),
        ...(editing
          ? []
          : [{ name: 'password', label: 'گذرواژهٔ اولیه', type: 'password' as const, required: true, ltr: true }]),
        checkbox('isActive', 'حساب فعال باشد'),
      ]
    case 'companies':
      return [
        text('name', 'نام شرکت', { required: true, wide: true }),
        select('userId', 'کاربر نماینده', userOptions, {
          required: true,
          wide: true,
          help: 'هر کاربر فقط می‌تواند نمایندهٔ یک شرکت باشد.',
        }),
      ]
    case 'gateways':
      return [
        text('uid', 'UID سخت‌افزار', {
          required: true,
          disabled: editing,
          ltr: true,
          help: editing ? 'هویت سخت‌افزاری پس از ثبت قابل تغییر نیست.' : undefined,
        }),
        text('title', 'عنوان درگاه', { required: true }),
        select('companyId', 'شرکت مالک', companyOptions, {
          disabled: gatewayCompanyLocked,
          wide: true,
          help: gatewayCompanyLocked
            ? 'انتقال یا لغو مالکیت درگاه تخصیص‌یافته از این API مجاز نیست.'
            : 'درگاه تخصیص‌نیافته را می‌توان به یک شرکت واگذار کرد.',
        }),
        checkbox('isActive', 'درگاه فعال باشد'),
      ]
    case 'devices':
      return [
        select('gatewayId', 'درگاه', gatewayOptions, { required: true }),
        select('deviceTypeId', 'نوع دستگاه', deviceTypeOptions, { required: true }),
        text('localId', 'شناسهٔ محلی', { required: true, ltr: true }),
        checkbox('isActive', 'دستگاه فعال باشد'),
      ]
    case 'deviceTypes':
      return [
        text('code', 'کد پایدار', { required: true, ltr: true }),
        text('title', 'عنوان', { required: true }),
      ]
    case 'parameters':
      return [
        text('code', 'کد پایدار', { required: true, ltr: true }),
        text('title', 'عنوان', { required: true }),
        select(
          'valueType',
          'نوع مقدار',
          [
            { value: 'integer', label: 'عدد صحیح' },
            { value: 'datetime', label: 'تاریخ و زمان' },
            { value: 'string', label: 'رشته' },
            { value: 'boolean', label: 'بولی' },
          ],
          { required: true },
        ),
        text('unit', 'واحد (اختیاری)', { ltr: true }),
      ]
    case 'deviceTypeParameters':
      return [
        select('deviceTypeId', 'نوع دستگاه', deviceTypeOptions, { required: true }),
        select('parameterId', 'پارامتر', parameterOptions, { required: true }),
      ]
    case 'eventTypes':
      return [
        text('code', 'کد پایدار', { required: true, ltr: true }),
        text('title', 'عنوان رویداد', { required: true }),
      ]
    case 'payloadSchemas':
      return [
        select('eventTypeId', 'نوع رویداد', eventTypeOptions, { required: true }),
        select('deviceTypeId', 'نوع دستگاه', deviceTypeOptions, { required: true }),
        { name: 'version', label: 'نسخه', type: 'number', required: true, ltr: true },
        {
          name: 'expectedLength',
          label: 'طول مورد انتظار (بایت)',
          type: 'number',
          ltr: true,
          help: 'در صورت متغیر بودن طول، خالی بگذارید. encoding همیشه UTF-8 است.',
        },
      ]
    case 'payloadFields':
      return [
        select('payloadSchemaId', 'طرح‌واره', schemaOptions, { required: true, wide: true }),
        text('code', 'کد فیلد', { required: true, ltr: true }),
        text('name', 'نام نمایشی', { required: true }),
        { name: 'startByte', label: 'شروع بایت', type: 'number', required: true, ltr: true },
        { name: 'endByte', label: 'پایان بایت (exclusive)', type: 'number', required: true, ltr: true },
        select('wireCodec', 'Codec', [
          { value: 'integer', label: 'عدد صحیح ASCII' },
          { value: 'utf8', label: 'رشتهٔ UTF-8' },
          { value: 'boolean', label: 'بولی' },
        ], { required: true }),
        select('role', 'نقش', [
          { value: 'metric', label: 'متریک' },
          { value: 'timestamp', label: 'زمان دستگاه' },
          { value: 'sequence', label: 'شماره توالی' },
          { value: 'checksum', label: 'Checksum' },
        ], { required: true }),
      ]
    case 'projectionRules': {
      const selectedSchemaId = Number(draft.payloadSchemaId)
      const schema = snapshot.payloadSchemas.find((item) => item.id === selectedSchemaId)
      const assignedParameterIds = new Set(
        snapshot.deviceTypeParameters
          .filter((item) => item.deviceTypeId === schema?.deviceTypeId)
          .map((item) => item.parameterId),
      )
      const allowedParameters = snapshot.parameters.filter((parameter) =>
        assignedParameterIds.has(parameter.id),
      )
      const fieldOptions = options(
        snapshot.payloadFields.filter((field) => field.payloadSchemaId === selectedSchemaId),
        (field) => `${field.code} · [${field.startByte}, ${field.endByte})`,
      )
      const selectedParameter = snapshot.parameters.find(
        (parameter) => parameter.id === Number(draft.parameterId),
      )
      return [
        select('payloadSchemaId', 'طرح‌واره', schemaOptions, { required: true, wide: true }),
        select('parameterId', 'پارامتر مقصد', options(allowedParameters, (parameter) => `${parameter.code} — ${parameter.title}`), {
          required: true,
          help: schema ? 'فقط پارامترهای تخصیص‌یافته به نوع دستگاه نمایش داده می‌شوند.' : 'ابتدا طرح‌واره را انتخاب کنید.',
        }),
        select('sourceKind', 'نوع منبع', [
          { value: 'field', label: 'فیلد payload' },
          { value: 'constant', label: 'مقدار ثابت رویداد' },
        ], { required: true }),
        ...(draft.sourceKind === 'constant'
          ? [{ name: 'constantValue', label: 'مقدار ثابت', type: 'text' as const, required: true, ltr: true, help: constantHelp(selectedParameter) }]
          : [select('sourceFieldId', 'فیلد منبع', fieldOptions, { required: true })]),
        ...(selectedParameter?.valueType === 'datetime'
          ? [select('timestampUnit', 'واحد timestamp', [
              { value: 'seconds', label: 'ثانیه' },
              { value: 'milliseconds', label: 'میلی‌ثانیه' },
            ], { required: true })]
          : []),
      ]
    }
    case 'visualizationTabs':
      return [
        select('deviceTypeId', 'نوع دستگاه', deviceTypeOptionsForDashboard, {
          required: true,
        }),
        text('code', 'کد تب', { required: true, ltr: true }),
        text('title', 'عنوان تب', { required: true }),
        { name: 'sortOrder', label: 'ترتیب نمایش', type: 'number', ltr: true },
        checkbox('isActive', 'تب فعال باشد'),
      ]
    case 'visualizations':
      return [
        select('tabId', 'تب داشبورد', options(snapshot.visualizationTabs, (tab) => {
          const deviceType = snapshot.deviceTypes.find((item) => item.id === tab.deviceTypeId)
          return `${tab.title} — ${deviceType?.code ?? '—'}`
        }), { required: true, wide: true }),
        text('title', 'عنوان نمودار', { required: true }),
        select('chartType', 'نوع نمودار', [
          { value: 'line', label: 'خطی' },
          { value: 'area', label: 'ناحیه‌ای' },
          { value: 'bar', label: 'میله‌ای' },
        ], { required: true }),
        select('xAxisId', 'محور X', dashboardXAxisOptions, {
          help: 'خالی یعنی زمان مشاهدهٔ خوانش.',
        }),
        select('yAxisId', 'محور Y', dashboardYAxisOptions, { required: true }),
        { name: 'sortOrder', label: 'ترتیب نمایش', type: 'number', ltr: true },
        checkbox('isActive', 'نمودار فعال باشد'),
      ]
  }
}

function constantHelp(parameter?: ParameterRecord): string {
  if (!parameter) return 'ابتدا پارامتر مقصد را انتخاب کنید.'
  if (parameter.valueType === 'boolean') return 'یکی از true یا false را وارد کنید.'
  if (parameter.valueType === 'integer' || parameter.valueType === 'datetime') {
    return 'عدد صحیح وارد کنید.'
  }
  return 'متن ثابت را بدون کوتیشن وارد کنید.'
}

const value = (draft: FormDraft, name: string) => String(draft[name] ?? '').trim()

function required(
  draft: FormDraft,
  names: string[],
  errors: Record<string, string>,
) {
  names.forEach((name) => {
    if (!value(draft, name)) errors[name] = 'این فیلد الزامی است.'
  })
}

function integer(
  draft: FormDraft,
  name: string,
  errors: Record<string, string>,
  minimum: number,
): number | null {
  const raw = value(draft, name)
  const parsed = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed) || parsed < minimum) {
    errors[name] = `عدد صحیح ${minimum.toLocaleString('fa-IR')} یا بزرگ‌تر وارد کنید.`
    return null
  }
  return parsed
}

export function buildFormPayload(
  resource: ManagementResource,
  draft: FormDraft,
  snapshot: ManagementSnapshot,
  record?: ManagementRecord,
): FormResult {
  const errors: Record<string, string> = {}
  let payload: ManagementPayload = {}
  const active = Boolean(draft.isActive)

  switch (resource) {
    case 'users':
      required(draft, ['username', 'email', 'firstName', 'lastName'], errors)
      if (!record) required(draft, ['password'], errors)
      if (value(draft, 'email') && !/^\S+@\S+\.\S+$/.test(value(draft, 'email'))) {
        errors.email = 'یک نشانی ایمیل معتبر وارد کنید.'
      }
      if (!record && value(draft, 'password').length < 8) {
        errors.password = 'گذرواژه باید دست‌کم ۸ نویسه داشته باشد.'
      }
      payload = {
        username: value(draft, 'username'),
        email: value(draft, 'email'),
        firstName: value(draft, 'firstName'),
        lastName: value(draft, 'lastName'),
        isActive: active,
        ...(!record
          ? { password: String(draft.password ?? '') }
          : {}),
      }
      break
    case 'companies':
      required(draft, ['name', 'userId'], errors)
      payload = { name: value(draft, 'name'), userId: integer(draft, 'userId', errors, 1) }
      break
    case 'gateways':
      required(draft, ['uid', 'title'], errors)
      payload = {
        ...(!record ? { uid: value(draft, 'uid') } : {}),
        title: value(draft, 'title'),
        companyId: value(draft, 'companyId') ? integer(draft, 'companyId', errors, 1) : null,
        isActive: active,
      }
      break
    case 'devices':
      required(draft, ['gatewayId', 'deviceTypeId', 'localId'], errors)
      payload = {
        gatewayId: integer(draft, 'gatewayId', errors, 1),
        deviceTypeId: integer(draft, 'deviceTypeId', errors, 1),
        localId: value(draft, 'localId'),
        isActive: active,
      }
      break
    case 'deviceTypes':
    case 'eventTypes':
      required(draft, ['code', 'title'], errors)
      payload = { code: value(draft, 'code'), title: value(draft, 'title') }
      break
    case 'parameters':
      required(draft, ['code', 'title', 'valueType'], errors)
      payload = {
        code: value(draft, 'code'),
        title: value(draft, 'title'),
        valueType: value(draft, 'valueType'),
        unit: value(draft, 'unit') || null,
      }
      break
    case 'deviceTypeParameters':
      required(draft, ['deviceTypeId', 'parameterId'], errors)
      payload = {
        deviceTypeId: integer(draft, 'deviceTypeId', errors, 1),
        parameterId: integer(draft, 'parameterId', errors, 1),
      }
      break
    case 'payloadSchemas': {
      required(draft, ['eventTypeId', 'deviceTypeId', 'version'], errors)
      const expectedLength = value(draft, 'expectedLength')
      payload = {
        eventTypeId: integer(draft, 'eventTypeId', errors, 1),
        deviceTypeId: integer(draft, 'deviceTypeId', errors, 1),
        version: integer(draft, 'version', errors, 1),
        expectedLength: expectedLength
          ? integer(draft, 'expectedLength', errors, 1)
          : null,
      }
      break
    }
    case 'payloadFields': {
      required(draft, ['payloadSchemaId', 'code', 'name', 'startByte', 'endByte', 'wireCodec', 'role'], errors)
      const schemaId = integer(draft, 'payloadSchemaId', errors, 1)
      const startByte = integer(draft, 'startByte', errors, 0)
      const endByte = integer(draft, 'endByte', errors, 1)
      if (startByte !== null && endByte !== null && endByte <= startByte) {
        errors.endByte = 'پایان بازه باید از شروع آن بزرگ‌تر باشد.'
      }
      const schema = snapshot.payloadSchemas.find((item) => item.id === schemaId)
      if (schema?.expectedLength && endByte !== null && endByte > schema.expectedLength) {
        errors.endByte = 'پایان فیلد از طول مورد انتظار طرح‌واره عبور می‌کند.'
      }
      payload = {
        payloadSchemaId: schemaId,
        code: value(draft, 'code'),
        name: value(draft, 'name'),
        startByte,
        endByte,
        wireCodec: value(draft, 'wireCodec'),
        role: value(draft, 'role'),
      }
      break
    }
    case 'projectionRules': {
      required(draft, ['payloadSchemaId', 'parameterId', 'sourceKind'], errors)
      const schemaId = integer(draft, 'payloadSchemaId', errors, 1)
      const parameterId = integer(draft, 'parameterId', errors, 1)
      const sourceKind = value(draft, 'sourceKind')
      let sourceFieldId: number | null = null
      let constantValue: unknown = null
      if (sourceKind === 'field') {
        required(draft, ['sourceFieldId'], errors)
        sourceFieldId = integer(draft, 'sourceFieldId', errors, 1)
      } else {
        required(draft, ['constantValue'], errors)
        const parameter = snapshot.parameters.find((item) => item.id === parameterId)
        constantValue = parseConstant(value(draft, 'constantValue'), parameter, errors)
      }
      const timestampUnit = value(draft, 'timestampUnit')
      const parameter = snapshot.parameters.find((item) => item.id === parameterId)
      payload = {
        payloadSchemaId: schemaId,
        parameterId,
        sourceKind,
        sourceFieldId,
        constantValue,
        conversionConfig:
          parameter?.valueType === 'datetime' && timestampUnit
            ? { timestampUnit }
            : {},
      }
      break
    }
    case 'visualizationTabs':
      required(draft, ['deviceTypeId', 'code', 'title'], errors)
      payload = {
        deviceTypeId: integer(draft, 'deviceTypeId', errors, 1),
        code: value(draft, 'code'),
        title: value(draft, 'title'),
        sortOrder: integer(draft, 'sortOrder', errors, 0),
        isActive: active,
      }
      break
    case 'visualizations': {
      required(draft, ['tabId', 'title', 'chartType', 'yAxisId'], errors)
      const xAxisId = value(draft, 'xAxisId')
      payload = {
        tabId: integer(draft, 'tabId', errors, 1),
        title: value(draft, 'title'),
        chartType: value(draft, 'chartType'),
        xAxisId: xAxisId ? integer(draft, 'xAxisId', errors, 1) : null,
        yAxisId: integer(draft, 'yAxisId', errors, 1),
        sortOrder: integer(draft, 'sortOrder', errors, 0),
        isActive: active,
      }
      break
    }
  }

  return { payload: Object.keys(errors).length ? null : payload, errors }
}

function parseConstant(
  raw: string,
  parameter: ParameterRecord | undefined,
  errors: Record<string, string>,
): unknown {
  if (!parameter || parameter.valueType === 'string') return raw
  if (parameter.valueType === 'boolean') {
    if (raw === 'true') return true
    if (raw === 'false') return false
    errors.constantValue = 'برای مقدار بولی true یا false وارد کنید.'
    return null
  }
  if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    errors.constantValue = 'یک عدد صحیح معتبر وارد کنید.'
    return null
  }
  return Number(raw)
}
