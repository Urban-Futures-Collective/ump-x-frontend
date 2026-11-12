import type { RegistryModel } from '~/types/registry'
import type { ApiModel } from '~/utils/registryApi'
import { modelFromApi } from '~/utils/registryApi'

// Model cards for the Commons, keyed by process id. Unlike useRegistry this needs no
// sign-in: the registry lists published models to everyone. Verifiers also get the
// models under review, which the Commons marks with their status.
//
// With sample data the sample cards are used; without either switch there are no
// cards and the Commons shows what the process list says.
export function useCommonsCards() {
  const { registryApi, prototypes, umpBase } = useRuntimeConfig().public

  if (!registryApi) {
    if (!prototypes) return { cards: computed(() => new Map<string, RegistryModel>()), pending: ref(false) }
    const { models } = useRegistryPrototype()
    return { cards: computed(() => cardsByProcess(models.value.filter(m => m.status !== 'draft'))), pending: ref(false) }
  }

  // useRequestFetch passes the session cookie on during server rendering, so the proxy
  // can add the token there too.
  const request = useRequestFetch()
  const { data, pending } = useAsyncData('commons-cards', async () => {
    const all: RegistryModel[] = []
    let cursor: string | null = null
    try {
      do {
        const page: { models: ApiModel[], next_cursor: string | null } = await request(`${umpBase}/registry/v1/models`, {
          query: { lang: '*', limit: 200, ...(cursor ? { cursor } : {}) },
        })
        all.push(...page.models.map(modelFromApi))
        cursor = page.next_cursor
      } while (cursor)
    }
    catch {
      // Without cards the Commons still lists the processes, just without tags.
    }
    return all.filter(m => m.status !== 'draft')
  }, { default: () => [] })

  return { cards: computed(() => cardsByProcess(data.value)), pending }
}
