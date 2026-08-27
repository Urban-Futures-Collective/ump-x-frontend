// Zeitstempel der UMP-API (ISO 8601, UTC) für die Anzeige aufbereiten.
// Ein Lauf ohne Zeitstempel zeigt einen Strich statt „Invalid Date".
export function formatDateTime(iso: string | undefined, locale: string): string {
  if (!iso) {
    return '–'
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return '–'
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

// Laufzeit als „3 min 12 s". Läufe dauern Minuten bis Stunden, Sekunden allein
// wären unlesbar, Millisekunden nichtssagend.
export function formatDuration(from: string | undefined, to: string | undefined): string | null {
  if (!from || !to) {
    return null
  }
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) {
    return null
  }
  const s = Math.round(ms / 1000)
  if (s < 60) {
    return `${s} s`
  }
  const m = Math.floor(s / 60)
  if (m < 60) {
    return `${m} min ${s % 60} s`
  }
  return `${Math.floor(m / 60)} h ${m % 60} min`
}
