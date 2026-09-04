<script setup lang="ts">
// Der Chat selbst. Kennt seinen Ort nicht: dieselbe Komponente hängt in der
// Schublade der Arbeitsumgebung und später im Schaufenster der Startseite.
//
// Fassung 1 kann nur reden. Werkzeuge (Katalog, Läufe, Ergebnisse) kommen in
// Schritt 2 dazu, deshalb sind die Beispielfragen bewusst welche, die ein
// Modell ohne Zugriff auf das Backend beantworten kann.
import type { Nachricht } from '~/composables/useAiChat'

// Die Startseite reicht die dort getippte Frage herein. Ohne Schlüssel geht sie
// nicht verloren, sondern steht im Eingabefeld, sobald der Zugang steht.
const props = defineProps<{ startfrage?: string }>()
const emit = defineEmits<{ schliessen: [] }>()

const { t } = useI18n()
const { zugang, hatSchluessel } = useAiProvider()
const { nachrichten, status, fehler, laeuft, senden, abbrechen, neu } = useAiChat()

const eingabe = ref('')
const zugangOffen = ref(false)

// Seit der Verlauf das Schließen und das Neuladen überlebt, kann ein Klick ein
// langes Gespräch treffen. Deshalb eine Rückfrage, und keine, die man wegklicken
// und dauerhaft abschalten kann.
const loeschenOffen = ref(false)

function loeschen() {
  neu()
  loeschenOffen.value = false
}

const zeigtFormular = computed(() => !hatSchluessel.value || zugangOffen.value)

const beispiele = computed(() => [t('ai.examples.what'), t('ai.examples.how')])

async function abschicken() {
  const text = eingabe.value
  eingabe.value = ''
  await senden(text)
}

function beispielWaehlen(frage: string) {
  eingabe.value = frage
  abschicken()
}

onMounted(() => {
  const frage = props.startfrage?.trim()
  if (!frage) return
  if (hatSchluessel.value) beispielWaehlen(frage)
  else eingabe.value = frage
})
</script>

<template>
  <div class="flex h-full flex-col bg-(--ui-bg)">
    <!-- Kopfzeile nach dem Entwurf: Titel links, Werkzeuge rechts. -->
    <div class="flex items-center gap-2 border-b border-(--ui-border) px-5 py-3">
      <UIcon name="i-lucide-sparkles" class="size-4.5 text-(--ui-primary)" />
      <span class="text-sm font-medium text-(--ui-text-highlighted)">{{ t('ai.title') }}</span>
      <div class="ms-auto flex items-center gap-1">
        <!-- Beschriftet und nicht nur ein Zeichen: ein Plus las sich wie „noch
             ein Chat daneben", und mehrere Unterhaltungen gibt es hier nicht.
             Der Knopf wirft den Verlauf weg, also steht das auch dran. -->
        <UButton
          v-if="hatSchluessel && nachrichten.length"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="loeschenOffen = true"
        >
          {{ t('ai.clear') }}
        </UButton>
        <UButton
          v-if="hatSchluessel"
          icon="i-lucide-settings"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('ai.settings')"
          @click="zugangOffen = !zugangOffen"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('ai.close')"
          @click="emit('schliessen')"
        />
      </div>
    </div>

    <!-- Ohne Schlüssel gibt es nichts zu chatten, also steht hier das Formular. -->
    <div v-if="zeigtFormular" class="flex-1 overflow-y-auto p-5">
      <AiProviderForm @verbunden="zugangOffen = false" />
    </div>

    <template v-else>
      <div class="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        <div v-if="!nachrichten.length" class="flex flex-1 flex-col justify-center gap-2 text-center">
          <UIcon name="i-lucide-sparkles" class="mx-auto size-8 text-(--ui-primary)" />
          <h2 class="text-lg font-semibold text-(--ui-text-highlighted)">
            {{ t('ai.title') }}
          </h2>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t('ai.empty.lead') }}
          </p>
          <p class="text-xs text-(--ui-text-dimmed)">
            {{ t('ai.empty.connected', { anbieter: t(`ai.providers.${zugang.anbieter}`), modell: zugang.modell }) }}
          </p>
        </div>

        <!-- Eigener content-Slot, weil eine Nachricht bei uns auch Werkzeug-
             Teile enthält. UChatMessage rendert von sich aus nur Text und
             Dateien, alles andere ist unsere Sache. -->
        <UChatMessages
          v-else
          :messages="nachrichten"
          :status="status"
          should-auto-scroll
          :assistant="{ side: 'left', variant: 'naked' }"
          :user="{ side: 'right', variant: 'soft' }"
        >
          <template #content="{ message }">
            <div class="space-y-2">
              <template v-for="(teil, i) in (message as Nachricht).parts" :key="i">
                <AiToolCard v-if="teil.type === 'werkzeug'" :teil="teil" @geoeffnet="emit('schliessen')" />
                <p v-else-if="teil.text" class="whitespace-pre-wrap">
                  {{ teil.text }}
                </p>
              </template>
            </div>
          </template>
        </UChatMessages>

        <p v-if="laeuft && nachrichten.length" class="mt-2 text-xs text-(--ui-text-dimmed)">
          {{ t('ai.streaming') }}
        </p>
      </div>

      <div class="space-y-3 px-5 pb-4">
        <!-- Beispielfragen nur im Leerzustand: danach stünden sie im Weg. -->
        <div v-if="!nachrichten.length" class="flex flex-col items-end gap-2">
          <UButton
            v-for="frage in beispiele"
            :key="frage"
            variant="outline"
            color="neutral"
            size="xs"
            @click="beispielWaehlen(frage)"
          >
            {{ frage }}
          </UButton>
        </div>

        <UAlert
          v-if="fehler"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="t('ai.error', { msg: fehler })"
        />

        <UChatPrompt
          v-model="eingabe"
          :placeholder="t('ai.placeholder')"
          @submit="abschicken"
        >
          <UChatPromptSubmit :status="status" @stop="abbrechen()" />
        </UChatPrompt>

        <p class="text-xs text-(--ui-text-dimmed)">
          {{ t('ai.disclaimer') }}
        </p>
      </div>
    </template>
    <UModal
      v-model:open="loeschenOffen"
      :title="t('ai.clearConfirm.title')"
      :description="t('ai.clearConfirm.body')"
    >
      <template #footer>
        <UButton color="neutral" variant="ghost" @click="loeschenOffen = false">
          {{ t('ai.clearConfirm.cancel') }}
        </UButton>
        <UButton color="error" @click="loeschen()">
          {{ t('ai.clearConfirm.confirm') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>
