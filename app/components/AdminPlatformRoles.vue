<script setup lang="ts">
// The six platform roles of an account, for assigning and revoking. Platform admins only;
// enforced on the server (server/api/admin/platform/...).
//
// Roles from the default roles can be switched off one by one; the server then gives the
// account the other default roles directly (see server/utils/realmRoles.ts). Roles from
// anywhere else (a group, another composite) are locked, as is your own admin role, so
// nobody locks themselves out.
const props = defineProps<{ userId: string, username: string, isSelf: boolean }>()
const { t } = useI18n()

const { data: status, pending, error, refresh } = await useFetch<PlatformRoleStatus[]>(
  () => `/api/admin/platform/users/${props.userId}/roles`,
  { default: () => [] },
)

const saving = ref<string | null>(null)
const saveError = ref<string | null>(null)

function isLocked(s: PlatformRoleStatus) {
  if (s.effective && !s.direct && !s.viaDefault) return true
  return props.isSelf && s.role === ROLE_PLATFORM_ADMIN
}

async function toggle(s: PlatformRoleStatus, on: boolean) {
  saveError.value = null
  saving.value = s.role
  try {
    await $fetch(`/api/admin/platform/users/${props.userId}/roles`, {
      method: on ? 'POST' : 'DELETE',
      body: { role: s.role },
    })
    await refresh()
  }
  catch (e) {
    saveError.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? String(e)
  }
  finally {
    saving.value = null
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
            <template v-if="s.viaDefault">
              · {{ t('admin.roles.viaDefault') }}
            </template>
            <template v-else-if="s.effective && !s.direct">
              · {{ t('admin.roles.inherited') }}
            </template>
            <template v-else-if="isSelf && s.role === ROLE_PLATFORM_ADMIN">
              · {{ t('admin.roles.ownAdmin') }}
            </template>
          </p>
        </div>
        <USwitch
          :model-value="s.effective"
          :disabled="pending || isLocked(s) || saving !== null"
          :loading="saving === s.role"
          :aria-label="t(`admin.roles.names.${s.role}`)"
          @update:model-value="on => toggle(s, on)"
        />
      </li>
    </ul>

    <p v-if="saveError" class="text-sm text-red-600">
      {{ saveError }}
    </p>
    <p class="text-xs text-(--ui-text-muted)">
      {{ t('admin.roles.tokenHint', { name: username }) }}
    </p>
  </div>
</template>
