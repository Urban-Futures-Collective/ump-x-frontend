import { type MapConfig, mapDefaults } from '~/config/mapDefaults'

// Die Naht für die Karten-Einstellung.
//
// Sie soll je Projekt unterschiedlich sein können, und das Ziel ist, sie aus dem
// UMP-Backend zu holen (Rico, 2026-09-16). Heute geht das nicht: UMP kennt gar
// kein Projekt, die API ist OGC API Processes und darüber nichts. Deshalb liegt
// die Einstellung vorerst im Frontend.
//
// Alles, was die Karte braucht, kommt aber schon jetzt durch diese eine Funktion.
// Wenn das Projekt im Backend steht, ändert sich hier die Herkunft und sonst
// nichts.
export function useMapConfig(): MapConfig {
  return mapDefaults
}
