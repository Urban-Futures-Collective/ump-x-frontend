<script setup lang="ts">
// Die sechs Plattformrollen eines Kontos, zum Vergeben und Entziehen. Nur für
// platform admins; geprüft wird auf dem Server (server/api/admin/platform/…).
//
// Rollen, die über die Standardrollen wirken, sind angehakt, aber gesperrt: am Konto
// selbst sind sie nicht vergeben, entziehen ließe sich hier also nichts. Die eigene
// Admin-Rolle ist ebenfalls gesperrt, damit sich niemand aussperrt.
const props = defineProps<{ userId: string, username: string, isSelf: boolean }>()
const { t } = useI18n()

const { data: status, pending, error, refresh } = await useFetch<PlatformRoleStatus[]>(
  () => `/api/admin/platform/users/${props.userId}/roles`,
  { default: () => [] },
)

const speichert = ref<string | null>(null)
const fehler = ref<string | null>(null)

function gesperrt(s: PlatformRoleStatus) {
  if (s.wirksam && !s.direkt) return true
  return props.isSelf && s.role === ROLE_PLATFORM_ADMIN
}

async function umschalten(s: PlatformRoleStatus, an: boolean) {
  fehler.value = null
  speichert.value = s.role
  try {
    await $fetch(`/api/admin/platform/users/${props.userId}/roles`, {
      method: an ? 'POST' : 'DELETE',
      body: { role: s.role },
    })
    await refresh()
  }
  catch (e) {
    fehler.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? String(e)
  }
  finally {
    speichert.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="error" class="text-sm text-red-600">
      {{ t('admin.roles.loadError', { msg: error.data?.statusMessage || error.message }) }}
    </p>

    <ul v-else class="space-y-3">
      <li v-for="s in status" :key="s.role" class="flex items-start justify-between gap-4">
        <div>
          <p class="font-medium">
            {{ t(`admin.roles.names.${s.role}`) }}
          </p>
          <p class="text-xs text-(--ui-text-muted)">
            <code>{{ s.role }}</code>
            <template v-if="s.wirksam && !s.direkt">
              · {{ t('admin.roles.viaDefault') }}
            </template>
            <template v-else-if="isSelf && s.role === ROLE_PLATFORM_ADMIN">
              · {{ t('admin.roles.ownAdmin') }}
            </template>
          </p>
        </div>
        <USwitch
          :model-value="s.wirksam"
          :disabled="pending || gesperrt(s) || speichert !== null"
          :loading="speichert === s.role"
          :aria-label="t(`admin.roles.names.${s.role}`)"
          @update:model-value="an => umschalten(s, an)"
        />
      </li>
    </ul>

    <p v-if="fehler" class="text-sm text-red-600">
      {{ fehler }}
    </p>
    <p class="text-xs text-(--ui-text-muted)">
      {{ t('admin.roles.tokenHint', { name: username }) }}
    </p>
  </div>
</template>
