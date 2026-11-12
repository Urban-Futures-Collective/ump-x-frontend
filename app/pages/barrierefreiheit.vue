<script setup lang="ts">
// Accessibility statement. Draft: no full audit yet; the known gaps are listed honestly.
const { t } = useI18n()
useHead({ title: () => t('footer.accessibility') })
</script>

<template>
  <LegalPage :title="t('footer.accessibility')" draft>
    <section>
      <p>
        Wir möchten UMP-X für alle Menschen nutzbar machen. Diese Erklärung beschreibt den aktuellen Stand.
        <span class="gap">[zu prüfen: ob BITV 2.0 bzw. das Hamburgische Barrierefreiheitsgesetz für die verantwortliche Stelle gilt, und die genaue Formulierung danach]</span>
      </p>
    </section>

    <section>
      <h2>Stand der Vereinbarkeit</h2>
      <p>
        Die Website ist noch nicht vollständig geprüft und nach unserer Einschätzung derzeit teilweise mit den
        Anforderungen der WCAG 2.1 auf Stufe AA vereinbar.
      </p>
    </section>

    <section>
      <h2>Bekannte Einschränkungen</h2>
      <ul>
        <li>Gebiete und Punkte lassen sich auf der Karte nur mit der Maus einzeichnen. Eine Eingabe per Tastatur fehlt noch.</li>
        <li>Ergebnisse auf der Karte haben noch keine gleichwertige Darstellung als Text oder Tabelle. Sie lassen sich aber herunterladen.</li>
        <li>Fehlermeldungen in Formularen sind optisch beim Feld zu sehen, werden von Screenreadern aber noch nicht zuverlässig mit dem Feld vorgelesen.</li>
        <li>Die Farbkontraste einiger Hinweistexte sind noch nicht geprüft.</li>
        <li>Beschreibungen von Modellen kommen von den Modellanbietern und sind oft nur auf Englisch.</li>
      </ul>
    </section>

    <section>
      <h2>Erstellung dieser Erklärung</h2>
      <p>Diese Erklärung beruht auf einer Selbsteinschätzung. Stand: <span class="gap">[Datum bei Veröffentlichung]</span>.</p>
    </section>

    <section>
      <h2>Barrieren melden</h2>
      <p>
        Wenn Ihnen Barrieren auffallen, schreiben Sie uns: <span class="gap">[Angabe fehlt: Kontakt]</span>.
      </p>
    </section>

    <section>
      <h2>Schlichtungsverfahren</h2>
      <p><span class="gap">[zu prüfen: zuständige Schlichtungsstelle, falls die BITV gilt]</span></p>
    </section>
  </LegalPage>
</template>
