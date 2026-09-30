// Central UMP base URL (proxy /ump) including the version prefix. The only place
// that knows base + version (the "versioned base URL" seam): UMP 3.x mounts the
// OGC routes under /v1.0/**, see nuxt.config.ts.
export function useUmpBase() {
  const { umpBase, umpApiVersion } = useRuntimeConfig().public
  const base = umpApiVersion ? `${umpBase}/${umpApiVersion}` : umpBase
  return { base }
}
