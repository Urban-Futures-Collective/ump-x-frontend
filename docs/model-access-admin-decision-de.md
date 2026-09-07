# Modell-Zugriff verwalten: Entscheidungsvorlage (Frontend ↔ Keycloak/Backend)

**Status:** Zur Diskussion
**Datum:** 2026-07-09
**Kontext:** UMP-X (Nuxt-4-Frontend für die Urban Model Platform). Begleitdokument zu `frontend-backend-architecture-de.md`. Diese Vorlage behandelt nur die Teile des geplanten Frontends, die über die Frontend-Grenze hinausreichen und deshalb eine gemeinsame Entscheidung brauchen. Die drei User-Views brauchen das nicht — sie laufen gegen den bestehenden OGC-API-Vertrag und lassen sich unabhängig bauen.

---

## Kurzfassung

Das Frontend bekommt drei User-Views (Modelle / Szenarien / Ausführung), die **keine** Backend-Änderungen erfordern. Der **Admin-View** — in dem ein Admin Modelle für User oder Gruppen freigibt — ist das einzige Stück, das Keycloak berührt, und Keycloak gehört dem Backend. Die Kernfrage: **Spricht das Frontend die Keycloak-Admin-API direkt, oder stellt das Backend einen schlanken Verwaltungs-Endpunkt bereit, den das Frontend aufruft?** Empfehlung: **Das Backend übernimmt es (Option B)**, die Freigabe läuft über **Gruppen**, und es wird eine eigene **App-Admin-Rolle** mit Token-Mapper eingeführt.

---

## Wie der Realm heute aussieht

Ausgelesen auf der Live-Instanz (`auth.urbanfuturescollective.org`, Realm `UrbanModelPlatform`):

- **Ein App-Client:** `ump-client` (confidential, Home `http://localhost:5003`).
- **Modell-Zugriff = Client-Rollen auf `ump-client`:**
  - `modelserver` — Zugriff auf alle Prozesse
  - `modelserver_hello-world`, `modelserver_hello-geo-world`, `modelserver_squareroot` — je ein Modellserver
- **Keine Gruppen** im Realm.
- **Keine App-Admin-Rolle** — das gesamte Rollen-Vokabular dreht sich um Modell-Zugriff. Realm-Admin (`ck71`) ist reine Keycloak-`realm-management`-Berechtigung und taugt nicht als Admin-Gate fürs Frontend.
- **Test-User:** `ump` (alle), `ump-geo`, `ump-sqrt`, `ump-viewer` (keine) — eine Matrix nach Modell-Sichtbarkeit.

Konsequenz fürs Frontend: Die drei User-Views (`/models`, `/jobs`, `/run`) sind für jeden eingeloggten User dieselben Routen. Der einzige echte Routen-Branch ist **Admin vs. Nicht-Admin**.

> **Nachtrag 2026-08-31.** Der ursprüngliche Satz an dieser Stelle lautete, der Inhalt unterscheide sich, weil UMP die Prozessliste serverseitig nach den Rollen filtert. Das gilt so nicht mehr. Seit UMP 3.0.0 hängt die Filterung der Liste an der Server-Einstellung `UMP_PUBLIC_PROCESSES`, und auf Produktion ist sie an: jeder sieht alle Modelle. Die Rollen entscheiden nur noch über das **Ausführen**, und sie heißen `<provider>` oder `<provider>:<prozess-id>`, nicht mehr `modelserver_<id>`. Siehe `docs/add-new-model-de.md`, Schritt 5.

---

## Zu treffende Entscheidungen

### 1. Wer spricht die Keycloak-Admin-API? (die Kernfrage)

| Option | Was das heißt | Bewertung |
|--------|---------------|-----------|
| **A** — Frontend → Keycloak-Admin-API direkt | Frontend hält einen Service-Account mit `realm-management`-Rollen | Öffnet eine **dritte, privilegierte Naht** im Frontend und dupliziert die Keycloak-Admin-Konsole. Widerspricht der „zwei Nähte"-Disziplin aus dem Architektur-Doc. |
| **B** — Backend stellt einen Endpunkt bereit, Frontend ruft ihn auf | z. B. `POST /admin/access`; UMP redet intern mit Keycloak | **Empfohlen.** Frontend bleibt beim HTTP-Vertrag; die Autorisierungslogik bleibt beim Realm-Owner — genau dort, wo der geplante Keycloak-Adapter ohnehin lebt. |
| **C** — Kein Custom-Admin-UI | Admins nutzen die Keycloak-Konsole; Frontend verlinkt nur dorthin | Am billigsten. Für v1 evtl. ausreichend. |

**Frage:** Stellt das Backend (bzw. der neue Keycloak-Adapter) einen Verwaltungs-Endpunkt bereit, oder soll das Frontend die Admin-API selbst bedienen?

Falls Option B: Die geplante Frontend-Fähigkeit (eine `useUmpAccess`-Composable — `listModels / listPrincipals / getGrants / grant / revoke`) ist faktisch schon die API-Skizze. Auf die genaue Form können wir uns abstimmen.

### 2. Freigabe pro User oder pro Gruppe („Rollengruppe")?

Die Produktabsicht ist, Modelle „für bestimmte User **oder Rollengruppen**" freizugeben. Der Realm hat aktuell **keine Gruppen**; Zugriff hängt direkt als Client-Rolle am jeweiligen User. „Modell für ein Team freigeben" sauber abzubilden hieße: Keycloak-**Gruppen** (oder Composite-Rollen) einführen.

**Frage:** Soll Modell-Zugriff auf Gruppen umziehen (dann ist „Modell → Gruppe freigeben" ein Handgriff), oder pro User bleiben?

### 3. App-Admin-Rolle — wem gehört sie, und wo lebt sie?

Es gibt noch keine `ump_admin`-Rolle (o. Ä.). Sie muss definiert werden — als Realm-Rolle oder als Client-Rolle auf `ump-client` — und **`ump-client` muss die Rollen in einen Token-Claim mappen, den die Frontend-Session lesen kann**, sonst kann das Frontend die Admin-Route gar nicht gaten. Das ist Keycloak-Konfiguration auf Backend-Seite.

**Frage:** Wo lebt die Admin-Rolle, und lässt sich der Roles-Mapper auf `ump-client` aktivieren?

---

## Empfehlung

**Option B** (Backend übernimmt die Zugriffsverwaltung) + Freigabe über **Gruppen** + eine eigene **`ump_admin`**-Rolle mit Token-Mapper. Damit bleibt das Frontend schlank und die Autorisierungshoheit beim Backend — während die drei User-Views schon parallel gebaut werden können, bevor der Admin-Endpunkt-Vertrag steht.
