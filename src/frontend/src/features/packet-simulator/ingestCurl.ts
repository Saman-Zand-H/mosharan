import { API_BASE_URL } from '../../lib/api/http'
import type { SimulationReceipt } from './simulatorTypes'

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/** Build the real-world curl request equivalent to one simulated receipt. */
export function buildIngestCurl(receipt: SimulationReceipt): string {
  const url = `${window.location.origin}${API_BASE_URL}/ingest`
  const body = JSON.stringify({
    deviceLocalId: receipt.envelope.deviceLocalId,
    eventTypeCode: receipt.envelope.eventTypeCode,
    schemaVersion: receipt.envelope.schemaVersion,
    messageId: receipt.envelope.messageId,
    payload: receipt.payload,
  })
  return [
    `curl -X POST ${shellQuote(url)}`,
    `  -H ${shellQuote('Authorization: Bearer <gateway-token>')}`,
    `  -H ${shellQuote(`X-Gateway-UID: ${receipt.envelope.gatewayUid}`)}`,
    `  -H ${shellQuote('Content-Type: application/json')}`,
    `  --data ${shellQuote(body)}`,
  ].join(' \\\n')
}
