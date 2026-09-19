import type { DecodedField, ProjectedReading } from './packetProtocol'

export type SimulationPhase =
  | 'idle'
  | 'receiving'
  | 'stored'
  | 'parsing'
  | 'projecting'
  | 'processed'
  | 'failed'

export interface SimulatorEnvelope {
  readonly gatewayUid: string
  readonly deviceLocalId: string
  readonly eventTypeCode: string
  readonly schemaVersion: number
  readonly messageId: string
}

export interface SimulationRunResult {
  readonly status: 'processed' | 'failed'
  readonly readingCount?: number
  readonly error?: string
}

export interface SimulationReceipt {
  readonly id: string
  readonly rawEventId: string
  readonly schemaId: string
  readonly schemaVersion: number
  readonly eventTitle: string
  readonly deviceTypeTitle: string
  readonly envelope: SimulatorEnvelope
  readonly receivedAt: string
  readonly status: 'processed' | 'failed'
  readonly byteLength?: number
  readonly payload: string
  readonly payloadHex: string
  readonly fields?: readonly DecodedField[]
  readonly readings?: readonly ProjectedReading[]
  readonly deviceTimestamp?: string
  readonly error?: string
}
