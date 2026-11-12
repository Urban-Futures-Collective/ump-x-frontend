<script setup lang="ts">
// Legal notice (§ 5 DDG). Draft: the operator's details are still missing and marked.
const { t } = useI18n()
useHead({ title: () => t('footer.imprint') })
</script>

<template>
  <LegalPage :title="t('footer.imprint')" draft>
    <section>
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        <span class="gap">[Angabe fehlt: Name der verantwortlichen Organisation oder Person]</span><br>
        <span class="gap">[Angabe fehlt: Anschrift]</span>
      </p>
    </section>
    <section>
      <h2>Vertreten durch</h2>
      <p><span class="gap">[Angabe fehlt: vertretungsberechtigte Person]</span></p>
    </section>
    <section>
      <h2>Kontakt</h2>
      <p><span class="gap">[Angabe fehlt: E-Mail-Adresse, ggf. Telefon]</span></p>
    </section>
    <section>
      <h2>Verantwortlich für den Inhalt</h2>
      <p><span class="gap">[Angabe fehlt: Name und Anschrift nach § 18 Abs. 2 MStV, falls erforderlich]</span></p>
    </section>
    <section>
      <h2>Projekt</h2>
      <p>
        UMP-X ist ein Web-Frontend für die Urban Model Platform. Das Projekt wird gefördert vom Prototype Fund.
        <span class="gap">[zu prüfen: genaue Angaben zu Trägern und Förderung, wie im Footer]</span>
      </p>
    </section>
    <section>
      <h2>Quellcode</h2>
      <p>
        Der Quellcode ist offen auf
        <ULink to="https://github.com/Urban-Futures-Collective/ump-x-frontend" external target="_blank" class="text-(--ui-primary)">GitHub</ULink>
        verfügbar.
      </p>
    </section>
    <section>
      <h2>Kartendaten</h2>
      <p>
        Hintergrundkarte und Ortssuche: © OpenStreetMap-Mitwirkende, Daten unter der Open Database License (ODbL).
      </p>
    </section>
  </LegalPage>
</template>
