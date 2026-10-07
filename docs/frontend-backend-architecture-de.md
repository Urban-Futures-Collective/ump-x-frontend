# Frontend ↔ Backend: Architektur-Entscheidung (UMP-X)

**Status:** umgesetzt, Stand 2026-10-07 nachgetragen
**Datum:** 2026-06-21
**Kontext:** UMP-X (Nuxt-4-Frontend für die Urban Model Platform). Das UMP-Backend wird parallel auf eine **hexagonale Architektur** umgestellt (Flask → FastAPI), der Umbau wird aber **voraussichtlich nicht innerhalb der Förderung fertig**.

---

## TL;DR (Entscheidung)

Wir bauen das Frontend gegen die **aktuelle API** (das, was innerhalb der Förderung ausgeliefert wird) — aber so, dass ein späterer Wechsel auf die neue Architektur **lokal begrenzt** bleibt, nicht „problemlos" im Sinne von kostenlos, aber ohne großflächige Umbauten.

Der Schlüssel: Das Frontend hängt am **HTTP-/OGC-API-Vertrag**, nicht an Backend-Internas. Alles Backend-Spezifische lebt in **einer dünnen Anbindungsschicht**. Es gibt genau **zwei Nähte**, die sich beim Umbau ändern werden — auf die richten wir uns aus.

---

## Warum das sicher ist

Im Hexagonal-Entwurf des Backends ist die Web-Schicht (`adapters/web/fastapi.py`, Routen `/processes`, `/jobs`, `/execution`) ein **„Driving Adapter"** — also ein bewusst austauschbarer Eingang, der den OGC-API-Processes-Vertrag bedient. Der Kern (Domain-Modelle, Manager, Ports) wird umgebaut, der **Vertrag soll dabei erhalten bleiben**.

Konsequenz: Der Wechsel Flask → FastAPI ist **über die Leitung unsichtbar**, solange die OGC-Routen und -Formate gleich bleiben. Das Einzige, was uns wirklich treffen kann, ist eine Änderung am **API-Vertrag** — nicht der interne Umbau.

---

## Die zwei Nähte, die sich ändern werden

Das ist der entscheidende Teil. Genau hier setzen wir saubere Grenzen.

### 1. API-Versionierung — seit UMP 3.0.0 eingetreten
Der neue Aufbau hat **versionierte Sub-Apps** und **OpenAPI-Docs pro Version**. Bis 2.x lagen die Routen unter Root (`/processes/`), seit 3.0.0 liegen sie unter `/v1.0/processes`.

Zwei Dinge haben sich dabei geändert, nicht nur eins:

- **Präfix `/v1.0`** vor allen OGC-Routen.
- **Kein Schrägstrich am Ende mehr.** FastAPI läuft dort mit `redirect_slashes=False`; `/v1.0/processes/` ist eine **404**, keine 308-Umleitung auf die Variante ohne. Bis 2.x war es genau umgekehrt — der Schrägstrich war Pflicht.

Nebenbei entfallen: `?f=json` (die API spricht nur noch JSON) und `total_count` in der Job-Liste (jetzt `{ jobs, links }`). `/execution` antwortet mit **201** und einem vollständigen `JobStatusInfo` statt nur `{ jobID, status }` — dieselbe Form wie `/jobs/{id}`.

→ Die Naht hat gehalten: **Base-URL und API-Version zusammen in einer Config** (`runtimeConfig.public.umpBase` + `umpApiVersion`, zusammengesetzt in `useUmpBase()`). Der Pfadwechsel war ein Einzeiler; die Schrägstriche standen verstreut in den Composables und mussten einzeln fallen.

### 2. Ergebnis-Auslieferung (die wichtige!)
Bei den „Planned Adapters" stehen **GeoServer Result Storage** (WFS/WMS publish) und **Idproxy Result Storage** (OGC API Features) hinter einem neuen `ResultStoragePort`. Heute rendern wir **inline-GeoJSON** aus `/jobs/{id}/results`. Künftig könnten Ergebnisse als **OGC-API-Features-Collection** oder **WFS/WMS-Layer** kommen.

→ **„Job-Ergebnis holen → kartenfertiges Layer" in genau einer Funktion/Composable kapseln.** Das ist die einzige Stelle, an der das Frontend echte Arbeit bekommt, wenn der Umbau landet. Hier die Naht am saubersten ziehen.

**Stand 2026-10-07:** Die Naht ist `useUmpResult` plus `resultLayers` (Layer aus dem deklarierten Output). Inline-GeoJSON wird gezeigt, mit den Farben, die ein Modell pro Objekt mitliefert (simplestyle). Noch nicht gezeigt werden Ergebnisse, die aus mehreren Ebenen oder Rastern bestehen. Ein Modellserver (umep) bietet seine Ebenen bereits als OGC-API-Features-Collections an (GeoJSON, ohne Anmeldung lesbar); es fehlt der Link vom Ergebnis zur Collection. UMP holt Ergebnisse ohne Accept-Header ab, ein pygeoapi-Modellserver antwortet dann mit HTML (Issue im UMP-Repo).

### Auth (bleibt)
Der geplante Keycloak-Adapter (JWT, Realm-Roles) ändert das Auth-Konzept nicht. Unser OIDC-Ansatz ist davon nicht betroffen.

---

## Was das konkret fürs Frontend heißt

Prinzipien für die Umsetzung:

1. **Eine Anbindungsschicht.** Sämtlicher UMP-Zugriff in Composables / einem getippten Client (`useUmpProcesses`, `useUmpJob`, `executeProcess`). Das ist die *einzige* Stelle, die Endpunkte und Response-Formen kennt.
2. **Domänen-Modelle.** Rohe API-Antworten dort auf eigene Modelle mappen (`Process`, `Job`, `ResultLayer`). Komponenten konsumieren nur diese Modelle, **nie rohes JSON**. Ändert sich ein Payload, fixen wir das Mapping an einer Stelle — nicht in vielen Components.
3. **Config für Base + Version.** `umpBase` + API-Version zentral und per Env überschreibbar.
4. **Result-Layer isolieren.** Eigenes Modul „Ergebnis → GeoJSON/Layer für die Karte" (siehe Naht 2).
5. **Types generieren.** Sobald die versionierte API mit OpenAPI-Doc steht: TypeScript-Types daraus generieren → Vertragsänderungen werden zu Compile-Fehlern.
6. **UMP-Erweiterungen markieren.** Ensembles, Job-Sharing, Kommentare klar von Standard-OGC trennen — die sind beim Refactor am ehesten beweglich.

### Bewusst NICHT tun (YAGNI)
Die hexagonale Architektur **nicht im Frontend nachbauen** (keine formalen Ports/Adapter/DI). Für einen förderzeitgebundenen Prototyp ist das Overkill. Eine saubere Composable- + Mapping-Grenze gibt ~90 % der Zukunftssicherheit für ~5 % Aufwand. Den „austauschbaren Adapter" lassen wir implizit (ein gut faktorisiertes Modul), nicht als explizites Interface — das lohnt erst, wenn es tatsächlich zwei Backends zu bedienen gibt.

---

## Was wir schon haben

- Serverseitiger Proxy `/ump/**` → `NUXT_UMP_API_TARGET`, hängt das Token der Sitzung an (löst CORS, kein Token im Browser).
- `runtimeConfig.public.umpBase` + `umpApiVersion` als zentrale Backend-Basis (`useUmpBase()`).
- Eine Anbindungsschicht `app/composables/useUmp*` mit Domänen-Modellen in `app/types/`.
- Formular aus dem JSON Schema der Prozessbeschreibung, inklusive Karteneingabe für `format: geojson-geometry`.
- Karte auf OpenLayers über die masterportalapi (Web Mercator, OSM).
- Lange Läufe: Polling ohne Zeitgrenze im Formular, Lauf-Seite lädt sich selbst nach.
- Prototyp des Modellregisters (Beitragen, Prüfen) mit Beispieldaten, Typen nach dem Konzept F12.

---

## Offene Fragen ans Backend-Team

Diese zwei Antworten entscheiden, wie tief wir jetzt schon bauen können:

1. ~~**Bleibt der OGC-Routen-Vertrag** beim FastAPI-Adapter kompatibel, nur unter `/v1.0` versioniert?~~ **Beantwortet mit 3.0.0: ja**, bis auf den Schrägstrich am Ende (siehe Naht 1).
2. **Wie kommen Ergebnisse nach dem Umbau** — inline-GeoJSON, OGC API Features oder WFS/WMS? Das ist die einzige Antwort, die unseren Karten-/Rendering-Code wirklich prägt. **Teilweise beantwortet (2026-10-07):** umep bietet OGC API Features an; offen ist, wie das Ergebnis darauf verweist und wie Raster kommen (COG oder WMS).
3. **Was das Frontend sonst noch vom Backend braucht** (Stand 2026-10-07): Eingaben eines Laufs (`/jobs/{id}/definition`), `x-ump-*` und `metadata` in Prozessbeschreibungen unverändert durchreichen, `Accept` und `Accept-Language` beim Abholen, Endpunkte des Modellregisters (Konzept F12) inklusive Projekten.

---

## Referenzen

- Hexagonal-Architektur-Diagramm des Backends (`__UMP-X/Hexagonal Architektur/…`)
- Plattform-/API-Referenz: `_stack-docs/ump/ump-platform.md`
- Lokales Setup: `_llm-wiki/UMP-X/Runbook — Lokales UMP Setup.md`
