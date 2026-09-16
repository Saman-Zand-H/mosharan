import { apiRequest } from '../../lib/api/http'
import type {
  ManagementPayload,
  ManagementRecord,
  ManagementResource,
  ManagementSnapshot,
} from './managementTypes'

const resourcePaths: Record<ManagementResource, string> = {
  users: 'users',
  companies: 'companies',
  gateways: 'gateways',
  devices: 'devices',
  deviceTypes: 'device-types',
  parameters: 'parameters',
  deviceTypeParameters: 'device-type-parameters',
  eventTypes: 'event-types',
  payloadSchemas: 'payload-schemas',
  payloadFields: 'payload-fields',
  projectionRules: 'projection-rules',
  visualizationTabs: 'visualization-tabs',
  visualizations: 'visualizations',
}

export function getManagementSnapshot(signal?: AbortSignal) {
  return apiRequest<ManagementSnapshot>('/management/snapshot', { signal })
}

export function createManagementRecord(
  resource: ManagementResource,
  payload: ManagementPayload,
) {
  return apiRequest<ManagementRecord>(`/management/${resourcePaths[resource]}`, {
    method: 'POST',
    body: payload,
  })
}

export function updateManagementRecord(
  resource: ManagementResource,
  id: number,
  payload: ManagementPayload,
) {
  return apiRequest<ManagementRecord>(
    `/management/${resourcePaths[resource]}/${id}`,
    { method: 'PATCH', body: payload },
  )
}

export function deleteManagementRecord(
  resource: ManagementResource,
  id: number,
) {
  return apiRequest<void>(`/management/${resourcePaths[resource]}/${id}`, {
    method: 'DELETE',
  })
}

export function changeUserPassword(userId: number, password: string) {
  return apiRequest<void>(`/management/users/${userId}/password`, {
    method: 'POST',
    body: { password },
  })
}

export interface GatewayTokenResponse {
  gatewayId: number
  gatewayUid: string
  token: string
}

export function rotateGatewayIngestToken(gatewayId: number) {
  return apiRequest<GatewayTokenResponse>(
    `/management/gateways/${gatewayId}/ingest-token`,
    { method: 'POST' },
  )
}
