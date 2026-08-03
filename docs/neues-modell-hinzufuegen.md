# Ein neues Modell zur UMP hinzufügen

**Kurz gesagt:** Ein neues Modell ist fast vollständig eine **Backend-/Plattform-Sache**
(Repo `urban-model-platform`). Am **Frontend** (`ump-x-frontend`) muss in der Regel **nichts**
geändert werden — es listet automatisch, was der `/processes`-Endpunkt zurückgibt.

Ein Modell ist in UMP ein **eigener OGC-API-Processes-Server** (ein Container, der `/processes`
exponiert — z. B. via pygeoapi). UMP registriert diesen Server und reicht seine Prozesse durch.

Als durchgearbeitetes Beispiel dient die growbike-Einbindung (siehe Runbook-Verweis unten).

---

## Backend (`urban-model-platform`) — hier passiert die Arbeit

### 1. Das Modell als OGC-Server bereitstellen
Der Modell-Container muss einen OGC-API-Processes-Endpunkt anbieten (`GET /processes`,
`POST /processes/{id}/execution`, `GET /jobs/{id}`, `GET /jobs/{id}/results`). Wer ein bestehendes
Modell (Python o. Ä.) einbinden will, verpackt es typischerweise in pygeoapi.

### 2. `docker-compose-dev.yaml` — Container ins UMP-Netz
Den Modell-Container als Service ins Docker-Netz **`ump_dev`** hängen, damit die UMP-`api` ihn
per Containernamen erreicht:

```yaml
  dein-modell:
    image: <dein-image>
    networks: [ump_dev]
    # ports: ... (nur nötig, wenn du ihn auch vom Host testen willst)
```

> Läuft das Modell außerhalb von Compose, reicht es, die Netz-Erreichbarkeit sicherzustellen
> (gleiches Docker-Netz oder erreichbare URL).

### 3. `providers.yaml` — den Modellserver registrieren  *(die zentrale Datei)*
Einen neuen Top-Level-Block ergänzen:

```yaml
deinmodell:
    name: deinmodell
    url: "http://dein-container:80"        # interne Container-URL (Name + interner Port)
    authentication:                         # OPTIONAL — weglassen = kein Auth
      type: "BasicAuth"
      user: "user"
      password: "password"
    timeout: 1800
    processes:
      prozess-id:                           # muss der Prozess-ID auf dem Modell-Server entsprechen
        result-storage: "remote"            # siehe Tabelle unten
        anonymous-access: true              # true = ohne Login sichtbar | false = rollen-gated
```

**`result-storage`:**

| Wert | Bedeutung | Frontend-Aufwand |
|---|---|---|
| `remote` | Ergebnis wird inline als **GeoJSON** geliefert (FeatureCollection) | keiner — läuft out-of-the-box |
| `geoserver` | Ergebnis wird über **GeoServer** als WMS/WFS-Layer publiziert | Ergebnis-Rendering im Frontend nötig (s. u.) |

**`anonymous-access`:**
- `true` — Prozess ist auch ohne Login im Katalog sichtbar/ausführbar.
- `false` — nur mit passender Keycloak-Rolle (Schritt 5).

### 4. UMP-`api` neu starten
Die `api` lädt die gemountete `providers.yaml` beim Start:

```bash
docker compose -f docker-compose-dev.yaml restart api
```

Prüfen, dass das Modell erscheint:

```bash
curl -s "http://localhost:5003/processes/?f=json" \
  | python3 -c 'import sys,json; print(sorted(p["id"] for p in json.load(sys.stdin)["processes"]))'
# -> sollte "deinmodell:prozess-id" enthalten
```

### 5. Keycloak — nur bei `anonymous-access: false`
Für rollen-gated Modelle im Realm `UrbanModelPlatform` eine **Client-Rolle** auf `ump-client` anlegen
und den berechtigten Usern zuweisen:

- `modelserver_<id>` — Zugriff auf **alle** Prozesse dieses Modellservers, oder
- `modelserver_<id>_<prozessId>` — Zugriff auf **einen** Prozess.

(Gleiches Muster wie die bestehende Rolle `modelserver_squareroot`.) UMP filtert die Prozessliste
serverseitig anhand dieser Rollen — das Frontend braucht dafür keine Anpassung.

---

## Frontend (`ump-x-frontend`) — in der Regel nichts

Katalog, Ausführungs-Formular und Karte sind **modell-agnostisch**:
- Katalog: `app/composables/useUmpProcesses.ts` (listet `/processes`)
- Formular: `app/components/ProcessRunner.vue` (baut die Eingaben generisch aus dem OGC-Inputs-Schema)
- Karte: `app/components/UmpMap.client.vue` (rendert generisches GeoJSON)

Ein neues Modell taucht also automatisch auf. **Zwei Ausnahmen**, bei denen doch Frontend-Arbeit anfällt:

1. **Neues Ergebnis-Format** — liefert das Modell **nicht** inline-GeoJSON, sondern
   `result-storage: "geoserver"` (WMS/WFS) oder ein anderes Format, muss die Ergebnis-Naht erweitert
   werden: `app/composables/useUmpResult.ts` + `app/components/UmpMap.client.vue`.
2. **Ungewöhnliche Input-Defaults** — z. B. ein String-Default wie `"auto"` für ein Integer-Feld.
   Dann muss die Wert-Umwandlung im `ProcessRunner.vue` das sauber behandeln (unveränderte Defaults
   nicht mitsenden, nur bei validem Wert casten).

---

## Checkliste

| Datei / Ort | Änderung | Pflicht? |
|---|---|---|
| Modell-Container | OGC-API-Processes-Server bereitstellen | ✅ immer |
| `docker-compose-dev.yaml` | Container ins `ump_dev`-Netz | ✅ bei neuem lokalen Container |
| `providers.yaml` | Modellserver-Block ergänzen | ✅ immer |
| UMP-`api` neu starten | `restart api` | ✅ immer |
| Keycloak `ump-client` | Rolle `modelserver_<id>` | nur bei `anonymous-access: false` |
| `useUmpResult.ts` / `UmpMap.client.vue` | Ergebnis-Rendering | nur bei neuem Ergebnis-Format |
| `ProcessRunner.vue` | Input-Coercion | nur bei schrägen Input-Defaults |

---

## Hinweise

- **`providers.yaml` ist aktuell lokal / nicht committet.** Reproduzierbar (und teilbar) wäre die
  Aufnahme des Modellserver-Blocks per PR ins UMP-Repo.
- **Netz-Verbindung per `docker network connect` ist Laufzeit** — überlebt Container-Restarts, aber
  nicht ein Neuerstellen des Containers. Dauerhaft: den Container mit `networks: [ump_dev]` in ein
  Compose aufnehmen.
- **Voll durchgearbeitetes Beispiel:** die growbike-Einbindung (Netz, `providers.yaml`, Verifikation,
  Stolpersteine) ist als Schritt-für-Schritt-Runbook dokumentiert — bei Bedarf dort nachschlagen.
