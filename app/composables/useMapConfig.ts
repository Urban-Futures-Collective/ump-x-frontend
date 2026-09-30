import { type MapConfig, mapDefaults } from '~/config/mapDefaults'

// Single entry point for the map configuration.
//
// The configuration should eventually vary per project and come from the UMP
// backend, but UMP has no notion of a project (its API is OGC API Processes
// only), so it lives in the frontend for now. Once the backend provides it,
// only this function needs to change.
export function useMapConfig(): MapConfig {
  return mapDefaults
}
