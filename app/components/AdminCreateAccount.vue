<script setup lang="ts">
// Form for creating an account. The server creates it and sends the invitation; the
// person sets their own password through the link. Checked again on the server.
const emit = defineEmits<{ created: [] }>()
const { t } = useI18n()

const form = reactive({ username: '', email: '', firstName: '', lastName: '' })
const saving = ref(false)
const errorText = ref<string | null>(null)
const result = ref<{ username: string, email: string, invited: boolean } | null>(null)

// Shown per field after the first submit attempt, using the same rules as the server.
const tried = ref(false)
const problems = computed(() => tried.value ? checkNewAccount(form).problems : [])

async function submit() {
  tried.value = true
  errorText.value = null
  const checked = checkNewAccount(form)
  if (!checked.account) return
  saving.value = true
  try {
    const res = await $fetch<{ id: string, invited: boolean }>('/api/admin/platform/users', {
      method: 'POST',
      body: checked.account,
    })
    result.value = { username: checked.account.username, email: checked.account.email, invited: res.invited }
    emit('created')
  }
  catch (e) {
    errorText.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? String(e)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="result" class="space-y-2 text-sm">
    <p v-if="result.invited">
      {{ t('admin.create.invited', { name: result.username, email: result.email }) }}
    </p>
    <p v-else class="text-red-600">
      {{ t('admin.create.notInvited', { name: result.username }) }}
    </p>
  </div>

  <form v-else class="space-y-4" novalidate @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="t('admin.create.firstName')" :error="problems.includes('firstName') ? t('admin.create.required') : undefined" required>
        <UInput v-model="form.firstName" autocomplete="off" class="w-full" />
      </UFormField>
      <UFormField :label="t('admin.create.lastName')" :error="problems.includes('lastName') ? t('admin.create.required') : undefined" required>
        <UInput v-model="form.lastName" autocomplete="off" class="w-full" />
      </UFormField>
    </div>
    <UFormField :label="t('admin.create.email')" :error="problems.includes('email') ? t('admin.create.emailInvalid') : undefined" required>
      <UInput v-model="form.email" type="email" autocomplete="off" class="w-full" />
    </UFormField>
    <UFormField
      :label="t('admin.create.username')"
      :hint="t('admin.create.usernameHint')"
      :error="problems.includes('username') ? t('admin.create.usernameInvalid') : undefined"
      required
    >
      <UInput v-model="form.username" autocomplete="off" class="w-full" />
    </UFormField>

    <p class="text-xs text-(--ui-text-muted)">
      {{ t('admin.create.inviteHint') }}
    </p>
    <p v-if="errorText" class="text-sm text-red-600">
      {{ errorText }}
    </p>

    <div class="flex justify-end">
      <UButton type="submit" icon="i-lucide-send" :loading="saving">
        {{ t('admin.create.submit') }}
      </UButton>
    </div>
  </form>
</template>
