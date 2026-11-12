// Search in lists (Commons, My scenarios, Contribute, Verify). Every word of the query
// has to appear in one of the fields, ignoring case and accents, so "fix bike" finds
// "fixbike" only if both words appear but "Hitze" finds "Hitzebelastung".
function normalise(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalise(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = normalise(fields.filter(Boolean).join(' '))
  return words.every(w => haystack.includes(w))
}
