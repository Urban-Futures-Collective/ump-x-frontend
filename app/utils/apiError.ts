// Die verwertbare Fehlermeldung einer UMP-Antwort herausziehen.
//
// Die API antwortet nach OGC mit { type, title, status, detail, instance }, und
// `detail` ist der Satz, der erklärt, was fehlt. ofetch legt diesen Rumpf in
// `data` ab und setzt in `message` nur die Zeile „[POST] "…": 403 Forbidden".
// Wer bloß `e.message` anzeigt, wirft also genau die Erklärung weg: Am
// 2026-08-31 stand bei einem fixbike-Lauf „Fehler: [POST] "…": 403" auf dem
// Schirm, während die API „Missing role 'bikebox-modelserver' or
// 'bikebox-modelserver:fixbike'." mitgeschickt hatte.
//
// Fällt zurück auf die ofetch-Zeile, denn die trägt wenigstens den Status.
interface OgcErrorBody {
  detail?: unknown
  title?: unknown
}

// Nur die Erklärung aus der Antwort, oder null, wenn keine mitkam. Ein reiner
// Text-Rumpf zählt auch (so antwortet der Server bei manchen 500ern), eine
// HTML-Fehlerseite nicht.
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

// Der HTTP-Status, falls es eine Antwort gab. Bei einem Netzfehler gibt es keinen.
export function apiErrorStatus(e: unknown): number | null {
  const err = e as { statusCode?: unknown, status?: unknown } | null
  const status = err?.statusCode ?? err?.status
  return typeof status === 'number' ? status : null
}

export function apiErrorMessage(e: unknown): string {
  const erklaerung = apiErrorExplanation(e)
  if (erklaerung) {
    return erklaerung
  }
  if (e instanceof Error && e.message) {
    return e.message
  }
  return String(e)
}
