// Die Grundeinstellung der Karte.
//
// Sie steht hier vollständig, weil die masterportalapi sonst ihre eigenen
// Vorgaben zieht, und die sind auf Hamburg zugeschnitten: EPSG:25832, ein
// Ausschnitt um die Stadt, eine Auflösungsleiter mit zehn Stufen und ein
// Modellserver-Katalog aus dem LGV. Ohne vollständigen Ersatz landet die Karte
// im Nirgendwo oder fragt Dienste an, die uns nichts angehen.
//
// EPSG:3857 statt 25832 ist eine Entscheidung vom 2026-09-16: die Basiskarte ist
// global, und jede weitere globale Quelle kommt in derselben Projektion. Der
// Preis ist, dass deutsche Fachdienste später umgerechnet werden müssen.

export interface MapConfig {
  epsg: string
  extent: [number, number, number, number]
  startCenter: [number, number]
  startResolution: number
  options: { resolution: number, scale: number, zoomLevel: number }[]
  /** Dienste-Register der masterportalapi. Leer: wir hängen Layer selbst an. */
  layerConf: unknown[]
  /** Layer, die beim Start sichtbar sind. Leer aus demselben Grund. */
  layers: unknown[]
}

// Die ganze Welt in Web Mercator. Wer weiter hinauszoomt, sieht nichts mehr.
const WELT: [number, number, number, number] = [
  -20037508.34, -20037508.34, 20037508.34, 20037508.34,
]

// Die Stufen der OpenStreetMap-Kacheln, damit jede Stufe genau eine Kachelebene
// trifft und nichts hochskaliert wird. resolution = 156543.034 / 2^zoom, der
// Maßstab dazu bei 0,28 mm je Pixel, wie es die OGC rechnet.
const STUFEN = [
  { resolution: 156543.0339280410, scale: 559082264, zoomLevel: 0 },
  { resolution: 78271.5169640205, scale: 279541132, zoomLevel: 1 },
  { resolution: 39135.7584820102, scale: 139770566, zoomLevel: 2 },
  { resolution: 19567.8792410051, scale: 69885283, zoomLevel: 3 },
  { resolution: 9783.9396205026, scale: 34942642, zoomLevel: 4 },
  { resolution: 4891.9698102513, scale: 17471321, zoomLevel: 5 },
  { resolution: 2445.9849051256, scale: 8735660, zoomLevel: 6 },
  { resolution: 1222.9924525628, scale: 4367830, zoomLevel: 7 },
  { resolution: 611.4962262814, scale: 2183915, zoomLevel: 8 },
  { resolution: 305.7481131407, scale: 1091958, zoomLevel: 9 },
  { resolution: 152.8740565704, scale: 545979, zoomLevel: 10 },
  { resolution: 76.4370282852, scale: 272989, zoomLevel: 11 },
  { resolution: 38.2185141426, scale: 136495, zoomLevel: 12 },
  { resolution: 19.1092570713, scale: 68247, zoomLevel: 13 },
  { resolution: 9.5546285356, scale: 34124, zoomLevel: 14 },
  { resolution: 4.7773142678, scale: 17062, zoomLevel: 15 },
  { resolution: 2.3886571339, scale: 8531, zoomLevel: 16 },
  { resolution: 1.1943285670, scale: 4265, zoomLevel: 17 },
  { resolution: 0.5971642835, scale: 2133, zoomLevel: 18 },
  { resolution: 0.2985821417, scale: 1066, zoomLevel: 19 },
]

export const mapDefaults: MapConfig = {
  epsg: 'EPSG:3857',
  extent: WELT,
  // Mitte Deutschlands, 10,45° Ost und 51,16° Nord. Ein Startpunkt ohne Ergebnis
  // ist immer eine Verlegenheit; sobald eines da ist, zoomt die Karte darauf.
  startCenter: [1163289, 6649645],
  // Stufe 6, das ganze Land im Bild.
  startResolution: 2445.9849051256,
  options: STUFEN,
  layerConf: [],
  layers: [],
}
