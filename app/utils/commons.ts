import type { LangMap, RegistryModel } from '~/types/registry'

// Commons (designs C0, C1): the processes UMP lists for the caller, each with its model
// card from the registry where there is one. The process list decides what is shown
// (UMP filters it by role); the card only adds what OGC does not describe.

export interface CommonsEntry {
  id: string
  title: string
  description: string
  card?: RegistryModel
}

export interface CommonsFilter {
  topics: string[]
  langs: string[]
  licences: string[]
}

export type CommonsSort = 'published' | 'name'

/** Text in the wanted language, else in the card's default language. */
export function pickLang(map: LangMap, lang: string, fallback: 'de' | 'en'): string {
  return map[lang as 'de' | 'en'] || map[fallback] || ''
}

/** The languages a card is written in, default language first. */
export function cardLangs(card: RegistryModel): ('de' | 'en')[] {
  const others = (['de', 'en'] as const).filter(l => l !== card.defaultLang && card.fullName[l])
  return [card.defaultLang, ...others]
}

// Topic tags in the brand colours (design comment: UMP-X colours, not the extra
// magenta and red of the mock-up). The same topic always gets the same colour.
export const TOPIC_TONES = ['gold', 'teal', 'blue', 'plum'] as const
export type TopicTone = typeof TOPIC_TONES[number]

export function topicTone(topic: string): TopicTone {
  // FNV-1a: a plain multiply-and-add hash spreads badly over four buckets.
  let hash = 2166136261
  for (const ch of topic.toLowerCase()) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return TOPIC_TONES[hash % TOPIC_TONES.length]!
}

/** Card registered for a process: the process id is `{server}:{process}`. */
export function cardsByProcess(models: RegistryModel[]): Map<string, RegistryModel> {
  return new Map(models.map(m => [`${m.serverName}:${m.remoteProcessId}`, m]))
}

/** The values each filter offers, sorted, from what is actually listed. */
export function filterOptions(entries: CommonsEntry[]) {
  const topics = new Set<string>()
  const langs = new Set<string>()
  const licences = new Set<string>()
  for (const { card } of entries) {
    if (!card) continue
    card.keywords.forEach(k => topics.add(k))
    cardLangs(card).forEach(l => langs.add(l))
    if (card.license) licences.add(card.license)
  }
  const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b))
  return { topics: sorted(topics), langs: sorted(langs), licences: sorted(licences) }
}

// An empty filter lets everything through. A model without a card matches no set
// filter: nothing is known about its topic, language or licence.
export function matchesFilter(entry: CommonsEntry, filter: CommonsFilter): boolean {
  const { card } = entry
  if (!filter.topics.length && !filter.langs.length && !filter.licences.length) return true
  if (!card) return false
  if (filter.topics.length && !card.keywords.some(k => filter.topics.includes(k))) return false
  if (filter.langs.length && !cardLangs(card).some(l => filter.langs.includes(l))) return false
  if (filter.licences.length && !filter.licences.includes(card.license)) return false
  return true
}

/** Most recently published first (models without a date last), or by name. */
export function sortCommons(entries: CommonsEntry[], by: CommonsSort): CommonsEntry[] {
  const byName = (a: CommonsEntry, b: CommonsEntry) => a.title.localeCompare(b.title)
  if (by === 'name') return [...entries].sort(byName)
  return [...entries].sort((a, b) => {
    const pa = a.card?.publishedAt ?? ''
    const pb = b.card?.publishedAt ?? ''
    return pb.localeCompare(pa) || byName(a, b)
  })
}
