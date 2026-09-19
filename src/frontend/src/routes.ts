import type { SectionId } from './types'

/** Canonical URL path for each app section. */
export const sectionPaths: Record<SectionId, string> = {
  overview: '/',
  gateways: '/gateways',
  devices: '/devices',
  events: '/events',
  parameters: '/parameters',
  protocols: '/protocols',
  simulator: '/simulator',
  management: '/management',
}

/** Resolve a pathname back to a section; unknown paths land on the overview. */
export function sectionFromPath(pathname: string): SectionId {
  const entry = (Object.keys(sectionPaths) as SectionId[]).find(
    (section) => sectionPaths[section] === pathname,
  )
  return entry ?? 'overview'
}
