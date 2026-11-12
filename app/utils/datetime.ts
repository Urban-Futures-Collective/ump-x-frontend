// Formats UMP API timestamps (ISO 8601, UTC) for display.
// Missing or invalid timestamps render as a dash instead of "Invalid Date".

// Fixed time zone so server and client render the same string. Otherwise the
// server uses UTC and the browser its local zone, causing a hydration mismatch
// and briefly showing the wrong time.
//
// Project time rather than viewer time: the platform covers German
// municipalities, and a run belongs to the local day it was started.
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

// Duration like "3 min 12 s", since runs take minutes to hours. Time zone
// independent: only the difference between two instants matters.
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
