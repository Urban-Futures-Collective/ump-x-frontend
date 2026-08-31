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

export function apiErrorMessage(e: unknown): string {
  const body = (e as { data?: OgcErrorBody } | null)?.data
  for (const candidate of [body?.detail, body?.title]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  if (e instanceof Error && e.message) {
    return e.message
  }
  return String(e)
}
