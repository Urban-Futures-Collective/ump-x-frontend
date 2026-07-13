// Zentrale Base-URL fürs UMP (Proxy /ump). Version vorbereitet für spätere /v1.0-Pfade.
// Einziger Ort, der Base + Version kennt (die „versionierte Base-URL"-Naht).
export function useUmpBase() {
  const { umpBase, umpApiVersion } = useRuntimeConfig().public
  const base = umpApiVersion ? `${umpBase}/${umpApiVersion}` : umpBase
  return { base }
}
