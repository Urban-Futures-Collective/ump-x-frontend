// Extract the useful error message from a UMP response.
//
// The API answers per OGC with { type, title, status, detail, instance }, and
// `detail` explains what is missing. ofetch puts that body in `data` and sets
// `message` only to a line like `[POST] "...": 403 Forbidden`. Showing only
// `e.message` would discard the explanation (e.g. which role is missing).
//
// Falls back to the ofetch line, which at least carries the status.
interface OgcErrorBody {
  detail?: unknown
  title?: unknown
}

// Only the explanation from the response, or null if none came. A plain-text
// body counts too (some 500s answer that way), an HTML error page does not.
export function apiErrorExplanation(e: unknown): string | null {
  const data = (e as { data?: unknown } | null)?.data
  if (typeof data === 'string') {
    const text = data.trim()
    return text && !text.startsWith('<') ? text : null
  }
  const body = data as OgcErrorBody | undefined
  for (const candidate of [body?.detail, body?.title]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return null
}

// The HTTP status if there was a response; a network error has none.
export function apiErrorStatus(e: unknown): number | null {
  const err = e as { statusCode?: unknown, status?: unknown } | null
  const status = err?.statusCode ?? err?.status
  return typeof status === 'number' ? status : null
}

export function apiErrorMessage(e: unknown): string {
  const explanation = apiErrorExplanation(e)
  if (explanation) {
    return explanation
  }
  if (e instanceof Error && e.message) {
    return e.message
  }
  return String(e)
}
