// Zentrale Base-URL fürs UMP (Proxy /ump) inklusive Versions-Präfix.
// Einziger Ort, der Base + Version kennt (die „versionierte Base-URL"-Naht):
// UMP 3.x mountet die OGC-Routen unter /v1.0/**, siehe nuxt.config.ts.
export function useUmpBase() {
  const { umpBase, umpApiVersion } = useRuntimeConfig().public
  const base = umpApiVersion ? `${umpBase}/${umpApiVersion}` : umpBase
  return { base }
}
