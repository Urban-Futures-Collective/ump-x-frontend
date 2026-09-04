<script setup lang="ts">
// Zugang zum eigenen Sprachmodell eintragen.
//
// Bewusst kein eigener Einstellungsbereich: es gibt sonst nichts zu regeln,
// und ein Eintrag in der Seitenleiste würde einen Bereich versprechen, den es
// nicht gibt. Das Formular lebt im Leerzustand des Chats und hinter dem
// Zahnrad in der Kopfzeile.
//
// Die drei Hinweise stehen sichtbar und nicht aufklappbar. Dass wir den
// Schlüssel nicht halten, ist etwas anderes als dass er sicher liegt, und wer
// das erst nach dem Eintragen erfährt, wurde nicht gefragt, sondern überrumpelt.
import type { Anbieter, Zugang } from '~/composables/useAiProvider'

const emit = defineEmits<{ verbunden: [] }>()

const { t } = useI18n()
const { zugang, hatSchluessel, setzeZugang, vergessen } = useAiProvider()

const anbieter = ref<Anbieter>(zugang.value.anbieter)
const modell = ref(zugang.value.modell)
const basisUrl = ref(zugang.value.basisUrl)
const schluessel = ref('')

const auswahl = (['openrouter', 'openai', 'anthropic', 'kompatibel'] as const).map(wert => ({
  label: t(`ai.providers.${wert}`),
  value: wert,
}))

// Nur der freie Fall braucht eine eigene Adresse. Bei den drei bekannten
// Anbietern steht sie fest, ein Feld dafür wäre eine Fehlerquelle ohne Nutzen.
const eigeneAdresse = computed(() => anbieter.value === 'kompatibel')

watch(anbieter, (neu) => {
  const vorgabe = ANBIETER_VORGABEN[neu]
  basisUrl.value = vorgabe.basisUrl
  if (!modell.value || Object.values(ANBIETER_VORGABEN).some(v => v.modell === modell.value)) {
    modell.value = vorgabe.modell
  }
})

const bereit = computed(() => schluessel.value.trim().length > 0 && modell.value.trim().length > 0)

function absenden() {
  if (!bereit.value) return
  setzeZugang(
    { anbieter: anbieter.value, modell: modell.value.trim(), basisUrl: basisUrl.value.trim() } as Zugang,
    schluessel.value.trim(),
  )
  schluessel.value = ''
  emit('verbunden')
}
</script>

<template>
  <div class="flex h-full flex-col gap-5">
    <div class="space-y-3">
      <UIcon name="i-lucide-key-round" class="size-7 text-(--ui-primary)" />
      <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
        {{ t('ai.connect.heading') }}
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        {{ t('ai.connect.lead') }}
      </p>
    </div>

    <div class="space-y-4">
      <UFormField :label="t('ai.connect.provider')">
        <USelect v-model="anbieter" :items="auswahl" value-key="value" class="w-full" />
      </UFormField>

      <UFormField v-if="eigeneAdresse" :label="t('ai.connect.baseUrl')">
        <UInput v-model="basisUrl" class="w-full" placeholder="http://localhost:8000/v1" />
      </UFormField>

      <UFormField :label="t('ai.connect.model')" :description="t('ai.connect.modelHint')">
        <UInput v-model="modell" class="w-full" />
      </UFormField>

      <UFormField :label="t('ai.connect.key')">
        <UInput v-model="schluessel" type="password" class="w-full" placeholder="sk-..." @keyup.enter="absenden" />
      </UFormField>

      <UButton block :disabled="!bereit" @click="absenden">
        {{ t('ai.connect.submit') }}
      </UButton>

      <UButton v-if="hatSchluessel" block variant="ghost" color="neutral" icon="i-lucide-trash-2" @click="vergessen()">
        {{ t('ai.connect.forget') }}
      </UButton>
    </div>

    <div class="mt-auto space-y-3">
      <div class="space-y-2 text-xs text-(--ui-text-muted)">
        <p class="flex items-start gap-2">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0 text-(--ui-warning)" />
          <span>{{ t('ai.connect.warnKey') }}</span>
        </p>
        <p class="text-(--ui-text-dimmed)">
          {{ t('ai.connect.warnData') }}
        </p>
        <p class="text-(--ui-text-dimmed)">
          {{ t('ai.connect.warnScope') }}
        </p>
      </div>

      <USeparator />

      <div class="space-y-1 text-xs">
        <p class="text-(--ui-text-muted)">
          {{ t('ai.connect.mcp') }}
        </p>
        <ULink to="https://mcp.urbanfuturescollective.org/mcp" external target="_blank" class="text-(--ui-primary)">
          mcp.urbanfuturescollective.org
        </ULink>
      </div>
    </div>
  </div>
</template>
