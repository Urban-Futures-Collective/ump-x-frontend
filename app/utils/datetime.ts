// Zeitstempel der UMP-API (ISO 8601, UTC) für die Anzeige aufbereiten.
// Ein Lauf ohne Zeitstempel zeigt einen Strich statt „Invalid Date".

// Feste Zeitzone, damit Server und Client dieselbe Zeichenkette erzeugen.
// Ohne sie nimmt jede Seite ihre eigene: der Container läuft in UTC, der Browser
// in seiner lokalen Zone. Am 2026-08-31 auf staging gemessen: der Server lieferte
// „31.08.2026, 09:27", der Browser „31.08.2026, 11:27", und Vue meldete beim
// Hydrieren „Hydration completed but contains mismatches". Für einen Moment stand
// damit die falsche Uhrzeit auf dem Schirm.
//
// Die Wahl fällt bewusst auf die Projektzeit und nicht auf die des Betrachters:
// die Plattform beschreibt deutsche Kommunen, und ein Lauf gehört zu dem Tag, an
// dem er dort gestartet wurde. Wer aus einer anderen Zone zusieht, liest deshalb
// deutsche Zeit.
const TIME_ZONE = 'Europe/Berlin'

export function formatDateTime(iso: string | undefined, locale: string): string {
  if (!iso) {
    return '–'
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return '–'
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(d)
}

// Laufzeit als „3 min 12 s". Läufe dauern Minuten bis Stunden, Sekunden allein
// wären unlesbar, Millisekunden nichtssagend. Zeitzonenfrei, weil hier nur die
// Differenz zweier Zeitpunkte zählt.
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
