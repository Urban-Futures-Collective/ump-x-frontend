// masterportalapi ships JavaScript without type declarations. We use only
// createMap from the OpenLayers entry point; it returns an OpenLayers Map.
declare module '@masterportal/masterportalapi/src/maps/ol/olMap.js' {
  import type Map from 'ol/Map'

  export function createMap(config: Record<string, unknown>, mapMode?: string): Map
}
