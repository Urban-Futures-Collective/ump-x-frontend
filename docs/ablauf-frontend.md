# Ablauf im Frontend

Welche Wege ein Nutzer durch UMP-X nehmen kann, abhängig von Anmeldung und
Rechten, und was davon gebaut ist.

Englische Fassung: `frontend-flow.md`.

Farben in allen Diagrammen:

- **grün** gebaut und in Betrieb
- **orange** Platzhalter, Seite existiert mit „coming soon"
- **rot** noch nicht vorhanden, aus dem Workshop-Zielbild

## Der Einstieg entscheidet alles

```mermaid
flowchart TD
    Start([Besucher öffnet die Seite])
    Start --> Landing["Startseite<br/>Kurzbeschreibung, Anmelden"]

    Landing --> Frage{Angemeldet?}

    Frage -->|nein| Anon["Modellkatalog<br/><i>nur offene Modelle</i>"]
    Frage -->|Anmelden| KC[/"Keycloak"/]

    KC --> Rollen{Welche Rollen<br/>im Token?}

    Rollen -->|keine besondere| Basis["Modellkatalog<br/><i>nur offene Modelle</i>"]
    Rollen -->|Modellrolle| Mehr["Modellkatalog<br/><i>plus freigegebene Modelle</i>"]
    Rollen -->|ump_admin| Admin["Administration"]

    Anon --> Run
    Basis --> Run
    Mehr --> Run

    Run["Szenario<br/>Parameter setzen, ausführen"]
    Run --> Warten{{"Rechnen<br/>Minuten bis Stunden"}}
    Warten --> Karte["Ergebnis auf der Karte"]

    Basis --> Meine
    Mehr --> Meine
    Meine["Meine Szenarien"]

    Admin --> Matrix["Zugriffsverwaltung<br/>wer darf welches Modell"]

    classDef fertig fill:#1f6f3f,stroke:#2ea05a,color:#fff
    classDef platz fill:#7a4b1f,stroke:#c07a2a,color:#fff
    classDef offen fill:#7a1f2a,stroke:#c02a3a,color:#fff
    classDef extern fill:#2a3550,stroke:#4a6090,color:#fff

    class Landing,Anon,Basis,Mehr,Run,Karte fertig
    class Meine,Admin platz
    class Matrix offen
    class KC extern
```

Der Katalog ist dreimal derselbe Bildschirm, er zeigt nur unterschiedlich viel.
Ohne Anmeldung erscheinen die Modelle mit `anonymous-access: true`, mit
passender Rolle kommen die übrigen dazu.

## Wer darf was

| | ohne Anmeldung | angemeldet | mit Modellrolle | ump_admin |
|---|---|---|---|---|
| Startseite | ja | ja | ja | ja |
| Offene Modelle sehen und ausführen | ja | ja | ja | ja |
| Geschützte Modelle | nein | nein | ja | ja |
| Meine Szenarien | nein | ja | ja | ja |
| Administration | nein | nein | nein | ja |

Zwei verschiedene Rollenarten steuern das:

**Modellzugriff** über Rollen am `ump-client`, benannt nach dem Modellserver:
`<modelserver>` für alle seine Prozesse, `<modelserver>_<prozess>` für einen
einzelnen. Welcher Prozess offen ist, steht dagegen nicht in Keycloak, sondern
in der `providers.yaml` des Backends als `anonymous-access`.

**Administration** über die Realm-Rolle `ump_admin`.

Durchgesetzt wird das im Frontend je Seite über `definePageMeta`, nicht global.
Was der Nutzer im Katalog sieht, entscheidet ohnehin das Backend.

## Was heute fehlt

```mermaid
flowchart LR
    Run["Szenario ausführen"] --> W{{"Rechnen"}}
    W --> K["Karte"]
    W -.->|Seite verlassen<br/>oder neu laden| Weg>"Lauf ist verloren"]
    K -.-> M["Meine Szenarien"]
    Weg -.-> M

    classDef fertig fill:#1f6f3f,stroke:#2ea05a,color:#fff
    classDef platz fill:#7a4b1f,stroke:#c07a2a,color:#fff
    classDef luecke fill:#7a1f2a,stroke:#c02a3a,color:#fff
    class Run,K fertig
    class M platz
    class Weg luecke
```

Der Ablauf endet beim Start des Laufs. Es gibt keinen Fortschritt, keine
Übersicht, kein Wiederfinden. Bei Laufzeiten von Minuten bis Stunden ist das
die auffälligste Lücke, und sie wird größer, sobald Modelle verkettet werden.

Zu entscheiden ist dabei weniger, wie eine Liste aussieht, sondern was in der
Wartezeit passiert: Bleibt jemand auf der Seite? Kommt er später wieder und wird
benachrichtigt? Woran erkennt er einen fehlgeschlagenen Lauf?

## Wohin es gehen soll

Aus dem Workshop, sechs Komponenten. Der heutige Stand deckt Teile von zweien
ab, der Rest fehlt vollständig.

```mermaid
flowchart TD
    Frage([Anliegen: Wie soll sich Mobilität entwickeln?])

    Frage --> Commons
    Commons["<b>Commons</b><br/>Welche Modelle gibt es,<br/>kann ich ihnen trauen?"]
    Daten["<b>Daten</b><br/>Passen meine Daten<br/>zum Modell?"]
    Bauen["<b>Plan zusammenstellen</b><br/>Modelle verketten"]
    Rechnen{{Rechnen}}
    Karte["<b>Karte</b><br/>Was bedeutet das räumlich?"]
    Abwaegen["<b>Abwägung</b><br/>Umwelt, Wirtschaft,<br/>Gesellschaft"]
    Ende([Entscheidung, die jemand vertreten kann])

    Commons --> Daten --> Bauen --> Rechnen --> Karte --> Abwaegen --> Ende
    Abwaegen -.->|Annahme ändern| Bauen
    Karte -.->|anderes Modell| Commons

    Beitrag["<b>Modell einbringen</b>"] --> Commons

    classDef teil fill:#4a6f3f,stroke:#6aa05a,color:#fff
    classDef offen fill:#7a1f2a,stroke:#c02a3a,color:#fff
    classDef ende fill:#2a3550,stroke:#4a6090,color:#fff
    class Commons,Karte teil
    class Daten,Bauen,Abwaegen,Beitrag offen
    class Ende,Frage ende
```

Heller grün heißt: in Ansätzen vorhanden. Der Modellkatalog ist noch kein
Commons, er listet nur auf, was konfiguriert ist. Vertrauen, Herkunft,
Wiederverwendung fehlen. Die Karte zeigt GeoJSON-Ergebnisse, aber nicht
notwendigerweise so, dass sie jemanden überzeugt.

Wichtig an diesem Diagramm sind die gestrichelten Rückwege. Das ist kein
Formular, das man einmal durchläuft: Wer abwägt, ändert Annahmen und rechnet
neu, wer die Karte sieht, merkt dass ein Modell fehlt.

## Nicht alle starten am selben Punkt

Aus dem Persona-Check. Das spricht gegen einen Assistenten, der alle durch
dieselbe Reihenfolge schickt.

```mermaid
flowchart LR
    R([Forschende]) --> R1["Modell einbringen"]
    A([Analyse und Planung]) --> A1["Commons, Plan zusammenstellen"]
    P([Praxis und Entscheidung]) --> P1["Abwägung, Karte"]
    D([Dateninfrastruktur]) --> D1["Daten"]
    K([Kommerzielle Vermittlung]) --> K1["Plan zusammenstellen, Abwägung"]

    classDef persona fill:#2a3550,stroke:#4a6090,color:#fff
    class R,A,P,D,K persona
```

Heute gibt es genau einen Einstieg für alle, nämlich die Startseite mit dem
Modellkatalog dahinter.

## Verwandtes

- `neues-modell-hinzufuegen.md`, welche Stellen ein neues Modell technisch berührt
- `runbook-growbike-als-modellserver.md`, Modellserver und Rollen
- `deployment.md`, Branch-Kette und Umgebungen
