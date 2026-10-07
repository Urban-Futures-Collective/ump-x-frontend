<script setup lang="ts">
// Privacy policy. Draft, based on docs/privacy-inventory-en.md. Controller, data
// protection officer, legal bases and retention periods still have to be confirmed;
// open points are marked in the text.
const { t } = useI18n()
useHead({ title: () => t('footer.privacy') })
</script>

<template>
  <LegalPage :title="t('footer.privacy')" draft>
    <section>
      <h2>1. Verantwortliche Stelle</h2>
      <p>
        <span class="gap">[Angabe fehlt: Name, Anschrift und Kontakt der verantwortlichen Stelle]</span><br>
        Datenschutzbeauftragte Person: <span class="gap">[Angabe fehlt, falls benannt]</span>
      </p>
    </section>

    <section>
      <h2>2. Überblick</h2>
      <p>
        UMP-X ist ein Web-Frontend für die Urban Model Platform. Sie können Modelle ansehen, Szenarien rechnen lassen
        und die Ergebnisse auf einer Karte betrachten. Wir setzen keine Werkzeuge zur Reichweitenmessung oder Werbung
        ein und binden keine Schriften von Drittanbietern ein.
      </p>
    </section>

    <section class="space-y-3">
      <h2>3. Welche Daten wir verarbeiten</h2>

      <div>
        <h3>Aufruf der Website</h3>
        <p>
          Beim Aufruf verarbeitet der Server technisch notwendige Daten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse
          und Browserkennung, um die Seite auszuliefern und Angriffe zu erkennen.
          Speicherdauer: <span class="gap">[Angabe fehlt]</span>.
          Rechtsgrundlage: <span class="gap">[zu prüfen, z. B. Art. 6 Abs. 1 lit. f DSGVO]</span>.
        </p>
      </div>

      <div>
        <h3>Nutzerkonto und Anmeldung</h3>
        <p>
          Für die Anmeldung nutzen wir einen eigenen Anmeldedienst (Keycloak). Dort werden Name, E-Mail-Adresse,
          Benutzername, Rollen und Anmeldezeitpunkte gespeichert. Nach der Anmeldung setzt UMP-X ein Sitzungs-Cookie,
          das für den Betrieb notwendig ist. Konten können von Administratorinnen und Administratoren angelegt werden;
          die Einladung zum Setzen des Passworts verschicken wir per E-Mail über unseren eigenen Mailserver.
          Änderungen durch Administratorinnen und Administratoren werden 90 Tage protokolliert.
          Rechtsgrundlage: <span class="gap">[zu prüfen]</span>.
        </p>
      </div>

      <div>
        <h3>Modellläufe</h3>
        <p>
          Wenn Sie ein Szenario rechnen lassen, speichert die Plattform die Eingaben, das Ergebnis und, falls Sie
          angemeldet sind, die Kennung Ihres Kontos. Die Eingaben werden an den Modellserver übermittelt, der das Modell
          bereitstellt. Speicherdauer: <span class="gap">[Angabe fehlt, derzeit keine Löschfrist festgelegt]</span>.
        </p>
      </div>

      <div>
        <h3>Karte und Ortssuche</h3>
        <p>
          Die Hintergrundkarte wird von den Servern der OpenStreetMap Foundation (Vereinigtes Königreich) geladen.
          Dabei wird Ihre IP-Adresse dorthin übertragen. Wenn Sie auf der Karte nach einem Ort suchen, geht der Suchbegriff
          an den Suchdienst Nominatim der OpenStreetMap Foundation. Für das Vereinigte Königreich besteht ein
          Angemessenheitsbeschluss der EU-Kommission.
          <span class="gap">[zu prüfen: Rechtsgrundlage, ggf. Kartenkacheln über eigenen Server laden]</span>
        </p>
      </div>

      <div>
        <h3>KI-Chat</h3>
        <p>
          Der Chat ist freiwillig. Sie wählen selbst einen KI-Anbieter und tragen Ihren eigenen Schlüssel ein. Ihre
          Fragen und Zusammenfassungen von Modellen und Läufen gehen direkt von Ihrem Browser an diesen Anbieter, der
          seinen Sitz auch außerhalb der EU haben kann. Für die Verarbeitung dort gelten die Bedingungen des Anbieters.
          Schlüssel und Anbieter speichert Ihr Browser lokal, der Verlauf bleibt nur bis zum Schließen des Tabs. Beim
          Abmelden wird beides gelöscht.
        </p>
      </div>

      <div>
        <h3>Gespeicherte Einstellungen im Browser</h3>
        <ul>
          <li>Sitzungs-Cookie: Anmeldung, notwendig</li>
          <li>Sprache: Ihre gewählte Sprache</li>
          <li>Ansicht der Modelle (Kacheln oder Liste), ein Jahr</li>
          <li>Seitenleiste ein- oder ausgeklappt</li>
        </ul>
        <p>Diese Angaben dienen nur dem Betrieb und Ihren Einstellungen. Wir setzen keine Cookies zu Werbe- oder Analysezwecken.</p>
      </div>
    </section>

    <section>
      <h2>4. Empfänger und Hosting</h2>
      <p>
        Die Server werden bei <span class="gap">[zu prüfen: Hosting-Anbieter, Auftragsverarbeitungsvertrag]</span>
        betrieben. Modellserver werden von den jeweiligen Partnern betrieben
        <span class="gap">[zu prüfen: Rollen und Vereinbarungen zwischen den Partnern]</span>.
      </p>
    </section>

    <section>
      <h2>5. Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
        und Widerspruch. Wenden Sie sich dazu an die verantwortliche Stelle oben. Sie können sich außerdem bei einer
        Datenschutz-Aufsichtsbehörde beschweren, <span class="gap">[Angabe fehlt: zuständige Behörde]</span>.
      </p>
    </section>

    <p class="text-xs text-(--ui-text-muted)">
      Stand: <span class="gap">[Datum bei Veröffentlichung]</span>
    </p>
  </LegalPage>
</template>
