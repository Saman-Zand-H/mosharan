import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Database,
  FlaskConical,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'

import { DecodedPacketPanel } from '../features/packet-simulator/DecodedPacketPanel'
import { PacketByteMap } from '../features/packet-simulator/PacketByteMap'
import { PacketComposer } from '../features/packet-simulator/PacketComposer'
import { parsePayload } from '../features/packet-simulator/packetProtocol'
import {
  createCurrentTimestampDraft,
  createFieldDrafts,
  generatePayload,
  type FieldDrafts,
  type GapByte,
} from '../features/packet-simulator/payloadGenerator'
import {
  loadSimulatorCatalog,
  type CatalogDevice,
  type CatalogPayloadSchema,
  type SimulatorCatalog,
} from '../features/packet-simulator/schemaCatalog'
import { SimulationHistory } from '../features/packet-simulator/SimulationHistory'
import type {
  SimulationPhase,
  SimulationReceipt,
  SimulationRunResult,
} from '../features/packet-simulator/simulatorTypes'

const pause = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))
const receivedAtFormatter = new Intl.DateTimeFormat('fa-IR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
const isReceivableDevice = (device: CatalogDevice) =>
  device.isActive && device.gateway.isActive

export function PacketSimulatorPage() {
  const [catalog, setCatalog] = useState<SimulatorCatalog>()
  const [catalogError, setCatalogError] = useState<string>()
  const [schemaId, setSchemaId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [drafts, setDrafts] = useState<FieldDrafts>({})
  const [gapByte, setGapByte] = useState<GapByte>(0x20)
  const [phase, setPhase] = useState<SimulationPhase>('idle')
  const [receipts, setReceipts] = useState<SimulationReceipt[]>([])
  const [activeReceipt, setActiveReceipt] = useState<SimulationReceipt>()
  const [runResult, setRunResult] = useState<SimulationRunResult>()
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [catalogLoadAttempt, setCatalogLoadAttempt] = useState(0)
  const busyRef = useRef(false)
  const runRef = useRef(0)
  const sequenceRef = useRef(0)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    void loadSimulatorCatalog({ signal: controller.signal })
      .then((loadedCatalog) => {
        const firstSchema = loadedCatalog.schemas[0]
        setCatalog(loadedCatalog)
        if (firstSchema) {
          const firstDevice = loadedCatalog.devices.find(
            (device) =>
              isReceivableDevice(device) &&
              device.deviceTypeCode === firstSchema.deviceType.code,
          )
          setSchemaId(firstSchema.id)
          setDeviceId(firstDevice?.id ?? '')
          setDrafts(createFieldDrafts(firstSchema))
        } else {
          setSchemaId('')
          setDeviceId('')
          setDrafts({})
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setCatalogError(
          error instanceof Error
            ? error.message
            : 'بارگذاری schemaهای پایگاه داده ناموفق بود.',
        )
      })
    return () => {
      controller.abort()
      runRef.current += 1
      busyRef.current = false
    }
  }, [catalogLoadAttempt])

  const selectedSchema = catalog?.schemas.find((schema) => schema.id === schemaId)
  const compatibleDevices = useMemo(
    () => catalog?.devices.filter(
      (device) =>
        isReceivableDevice(device) &&
        device.deviceTypeCode === selectedSchema?.deviceType.code,
    ) ?? [],
    [catalog, selectedSchema],
  )
  const selectedDevice = compatibleDevices.find((device) => device.id === deviceId)
  const generation = useMemo(
    () => selectedSchema
      ? generatePayload(selectedSchema, drafts, { gapByte })
      : { ok: false as const, issues: [] },
    [drafts, gapByte, selectedSchema],
  )
  const preview = useMemo(
    () => selectedSchema && generation.ok
      ? parsePayload(selectedSchema, generation.payload)
      : undefined,
    [generation, selectedSchema],
  )

  const simulateReceive = useCallback(async (
    schema: CatalogPayloadSchema,
    device: CatalogDevice,
    payload: string,
    options?: { scroll?: boolean },
  ) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    const run = ++runRef.current
    const parsed = parsePayload(schema, payload)

    setPhase('receiving')
    await pause(80)
    if (run !== runRef.current) return
    setPhase('stored')
    await pause(80)
    if (run !== runRef.current) return
    setPhase('parsing')
    await pause(80)
    if (run !== runRef.current) return

    const sequence = ++sequenceRef.current
    const payloadBytes = new TextEncoder().encode(payload)
    const baseReceipt = {
      id: `receipt-${sequence}`,
      rawEventId: `RAW-DEMO-${String(sequence).padStart(4, '0')}`,
      schemaId: schema.id,
      schemaVersion: schema.version,
      eventTitle: schema.eventType.title,
      deviceTypeTitle: schema.deviceType.title,
      envelope: {
        gatewayUid: device.gateway.uid,
        deviceLocalId: device.localId,
        eventTypeCode: schema.eventType.code,
        schemaVersion: schema.version,
        messageId: `demo-${Date.now()}-${sequence}`,
      },
      receivedAt: receivedAtFormatter.format(new Date()),
      byteLength: payloadBytes.length,
      payload,
      payloadHex: [...payloadBytes]
        .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(' '),
    }

    if (!parsed.ok) {
      const receipt: SimulationReceipt = {
        ...baseReceipt,
        status: 'failed',
        error: parsed.error,
      }
      setRunResult({ status: 'failed', error: parsed.error })
      setPhase('failed')
      setActiveReceipt(receipt)
      setReceipts((current) => [receipt, ...current].slice(0, 8))
      busyRef.current = false
      setBusy(false)
      if (options?.scroll) {
        window.setTimeout(
          () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
          60,
        )
      }
      return
    }

    setPhase('projecting')
    await pause(80)
    if (run !== runRef.current) return
    const receipt: SimulationReceipt = {
      ...baseReceipt,
      status: 'processed',
      fields: parsed.parsed.fields,
      readings: parsed.parsed.readings,
      deviceTimestamp: parsed.parsed.deviceTimestamp,
    }
    setRunResult({
      status: 'processed',
      readingCount: parsed.parsed.readings.length,
    })
    setPhase('processed')
    setActiveReceipt(receipt)
    setReceipts((current) => [receipt, ...current].slice(0, 8))
    busyRef.current = false
    setBusy(false)
    if (options?.scroll) {
      window.setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
        60,
      )
    }
  }, [])

  useEffect(() => {
    if (
      !streaming ||
      !selectedSchema ||
      !selectedDevice ||
      !generation.ok
    ) return
    const send = () => {
      if (!busyRef.current) {
        void simulateReceive(selectedSchema, selectedDevice, generation.payload)
      }
    }
    send()
    const timer = window.setInterval(send, 1_650)
    return () => window.clearInterval(timer)
  }, [generation, selectedDevice, selectedSchema, simulateReceive, streaming])

  const selectSchema = (id: string) => {
    const schema = catalog?.schemas.find((item) => item.id === id)
    if (!schema) return
    const device = catalog?.devices.find(
      (item) =>
        isReceivableDevice(item) &&
        item.deviceTypeCode === schema.deviceType.code,
    )
    setSchemaId(schema.id)
    setDeviceId(device?.id ?? '')
    setDrafts(createFieldDrafts(schema))
    setPhase('idle')
    setRunResult(undefined)
  }
  const clearSession = () => {
    setStreaming(false)
    runRef.current += 1
    busyRef.current = false
    setBusy(false)
    setPhase('idle')
    setRunResult(undefined)
    setReceipts([])
    setActiveReceipt(undefined)
    sequenceRef.current = 0
  }
  const selectReceipt = (receipt: SimulationReceipt) => {
    const schema = catalog?.schemas.find((item) => item.id === receipt.schemaId)
    const device = catalog?.devices.find(
      (item) =>
        item.gateway.uid === receipt.envelope.gatewayUid &&
        item.localId === receipt.envelope.deviceLocalId,
    )
    if (schema) {
      setSchemaId(schema.id)
      const extracted = Object.fromEntries(
        receipt.fields?.map((field) => [field.id, field.rawText]) ?? [],
      )
      setDrafts(
        Object.keys(extracted).length ? extracted : createFieldDrafts(schema),
      )
    }
    setDeviceId(device?.id ?? '')
    setActiveReceipt(receipt)
    setRunResult(
      receipt.status === 'processed'
        ? { status: 'processed', readingCount: receipt.readings?.length }
        : { status: 'failed', error: receipt.error },
    )
    setPhase(receipt.status === 'processed' ? 'processed' : 'failed')
  }

  if (catalogError) {
    return (
      <div className="simulator-load-state" role="alert">
        <TriangleAlert size={26} aria-hidden="true" />
        <h1>شبیه‌ساز در دسترس نیست</h1>
        <p>{catalogError}</p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            setCatalogError(undefined)
            setCatalogLoadAttempt((attempt) => attempt + 1)
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          تلاش دوباره
        </button>
      </div>
    )
  }
  if (!catalog) {
    return <div className="simulator-load-state" aria-busy="true"><Database size={26} aria-hidden="true" /><h1>در حال بارگذاری schemaها…</h1></div>
  }
  if (!catalog.schemas.length || !selectedSchema) {
    return <div className="simulator-load-state"><Database size={26} aria-hidden="true" /><h1>schema قابل نمایش نیست</h1><p>برای این حساب هنوز PayloadSchema قابل دسترسی وجود ندارد.</p></div>
  }

  return (
    <div className="packet-simulator-page">
      <header className="simulator-page-header">
        <div>
          <div className="eyebrow-row">
            <span className="eyebrow">آزمایشگاه پروتکل</span>
            <span className="demo-label"><FlaskConical size={13} aria-hidden="true" />شبیه‌سازی محلی</span>
          </div>
          <h1>شبیه‌ساز دریافت</h1>
          <p>
            فیلدهای schema را پر کنید، payload دقیق UTF-8 بسازید و دریافت آن را در چهار گام پردازش
            آزمایش کنید. همه‌چیز در مرورگر اجرا می‌شود و چیزی در پایگاه داده ثبت نمی‌شود.
          </p>
        </div>
      </header>

      <div className="simulator-workbench">
        <PacketComposer
          schemas={catalog.schemas}
          schemaId={schemaId}
          devices={compatibleDevices}
          deviceId={deviceId}
          drafts={drafts}
          generation={generation}
          gapByte={gapByte}
          busy={busy}
          streaming={streaming}
          canReceive={Boolean(selectedDevice)}
          runResult={runResult}
          onDeviceChange={setDeviceId}
          onDraftChange={(fieldId, value) => setDrafts((current) => ({ ...current, [fieldId]: value }))}
          onFillTimestamp={(fieldId) => {
            const current = createCurrentTimestampDraft(selectedSchema, fieldId)
            setDrafts((values) => ({ ...values, [fieldId]: current.value }))
          }}
          onGapByteChange={setGapByte}
          onReceive={() => {
            if (generation.ok && selectedDevice) {
              void simulateReceive(selectedSchema, selectedDevice, generation.payload, {
                scroll: true,
              })
            }
          }}
          onReset={() => setDrafts(createFieldDrafts(selectedSchema))}
          onSchemaChange={selectSchema}
          onToggleStream={() => setStreaming((current) => !current)}
        />
        <PacketByteMap
          key={selectedSchema.id}
          generation={generation}
          schema={selectedSchema}
          decodedFields={preview?.ok ? preview.parsed.fields : undefined}
        />
      </div>

      <div className="simulator-results" ref={resultsRef}>
        <DecodedPacketPanel phase={phase} receipt={activeReceipt} />
        <SimulationHistory
          activeReceiptId={activeReceipt?.id}
          selectionDisabled={busy || streaming}
          receipts={receipts}
          onClear={clearSession}
          onSelect={selectReceipt}
        />
      </div>
    </div>
  )
}
