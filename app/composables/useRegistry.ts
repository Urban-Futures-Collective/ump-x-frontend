import type { RegistryModel } from '~/types/registry'

// The model registry for the pages (Contribute, Verify): from UMP when
// NUXT_PUBLIC_REGISTRY_API=true, otherwise from sample data. Both sources offer the
// same functions; what follows from them (my models, the review queue, who may do
// what) is worked out here once.
export function useRegistry() {
  const { registryApi } = useRuntimeConfig().public
  const source = registryApi ? useRegistryApi() : useRegistryPrototype()
  const { models, servers, mySub, myName } = source
  const { isProvider, isVerifier, isPlatformAdmin } = useUmpRoles()
  const { t } = useI18n()

  const myModels = computed(() => models.value.filter(m => m.ownerSub === mySub.value))
  const myServers = computed(() => servers.value.filter(s => s.ownerSub === mySub.value))
  const awaitingReview = computed(() => models.value.filter(m => m.status === 'submitted' && m.ownerSub !== mySub.value))

  function actorFor(m: RegistryModel) {
    return { isOwner: m.ownerSub === mySub.value, isProvider: isProvider.value, isVerifier: isVerifier.value, isPlatformAdmin: isPlatformAdmin.value }
  }

  // The API names no owners, only their ids; until it does, others' models show
  // a neutral label rather than an id nobody can read.
  function ownerLabel(m: RegistryModel) {
    if (m.ownerSub === mySub.value) return myName.value || t('registry.me')
    return m.ownerName || t('registry.otherOwner')
  }

  return { ...source, isLive: !!registryApi, myModels, myServers, awaitingReview, actorFor, ownerLabel }
}
