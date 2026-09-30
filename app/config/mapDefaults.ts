// Default map configuration.
//
// Fully specified because otherwise the masterportalapi falls back to its own
// defaults, which target one specific region: EPSG:25832, a fixed extent, a
// ten-step resolution ladder and a preset service catalog. Without a complete
// replacement the map ends up in the wrong place or queries unrelated services.
//
// EPSG:3857 because the base map is global and other global sources use the
// same projection. The trade-off: services in EPSG:25832 need reprojection.

export interface MapConfig {
  epsg: string
  extent: [number, number, number, number]
  startCenter: [number, number]
  startResolution: number
  options: { resolution: number, scale: number, zoomLevel: number }[]
  /** masterportalapi service registry. Empty: layers are added directly. */
  layerConf: unknown[]
  /** Layers visible on start. Empty for the same reason. */
  layers: unknown[]
}

// The whole world in Web Mercator.
const WELT: [number, number, number, number] = [
  -20037508.34, -20037508.34, 20037508.34, 20037508.34,
]

// OpenStreetMap tile levels, so each step matches one tile level exactly and
// nothing is upscaled. resolution = 156543.034 / 2^zoom; scale assumes the OGC
// standard pixel size of 0.28 mm.
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
  // Center of Germany (10.45° E, 51.16° N). Only a placeholder: the map zooms
  // to the result once there is one.
  startCenter: [1163289, 6649645],
  // Zoom level 6, the whole country in view.
  startResolution: 2445.9849051256,
  options: STUFEN,
  layerConf: [],
  layers: [],
}
