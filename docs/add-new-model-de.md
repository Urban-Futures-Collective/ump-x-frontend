# Ein neues Modell zur UMP hinzufügen

**Kurz gesagt:** Ein neues Modell ist fast vollständig eine **Backend-/Plattform-Sache**
(Repo `urban-model-platform`). Am **Frontend** (`ump-x-frontend`) muss in der Regel **nichts**
geändert werden — es listet automatisch, was der `/processes`-Endpunkt zurückgibt.

Ein Modell ist in UMP ein **eigener OGC-API-Processes-Server** (ein Container, der `/processes`
exponiert — z. B. via pygeoapi). UMP registriert diesen Server und reicht seine Prozesse durch.

Als durchgearbeitetes Beispiel dient die growbike-Einbindung, siehe
[`runbook-growbike-modelserver-de.md`](./runbook-growbike-modelserver-de.md).

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
        anonymous-access: true              # true = ohne Login ausführbar | false = nur mit Rolle
```

**`result-storage`:**

| Wert | Bedeutung | Frontend-Aufwand |
|---|---|---|
| `remote` | Ergebnis wird inline als **GeoJSON** geliefert (FeatureCollection) | keiner — läuft out-of-the-box |
| `geoserver` | Ergebnis wird über **GeoServer** als WMS/WFS-Layer publiziert | Ergebnis-Rendering im Frontend nötig (s. u.) |

**`anonymous-access`:** Das Flag regelt seit UMP 3.0.0 nur noch das **Ausführen**,
nicht mehr die Sichtbarkeit.

- `true`: Prozess ist ohne Login ausführbar.
- `false`: nur mit passender Rolle (Schritt 5).

Ob ein Prozess im Katalog **erscheint**, entscheidet dagegen die Server-Einstellung
`UMP_PUBLIC_PROCESSES`. Ist sie an, sieht jeder alles, auch abgemeldet; ist sie aus,
zeigt `GET /processes` nur, was der Aufrufer auch ausführen dürfte. Auf Produktion ist
sie an: anonym liefert `/v1.0/processes` alle Modelle, während `/mcp/v1/tools`, das nach
der Ausführungsregel filtert, nur die offenen zeigt (am 2026-08-31 gemessen).

### 4. UMP-`api` neu starten
Die `api` lädt die gemountete `providers.yaml` beim Start:

```bash
docker compose -f docker-compose-dev.yaml restart api
```

Prüfen, dass das Modell erscheint:

```bash
curl -s "http://localhost:5003/v1.0/processes" \
  | python3 -c 'import sys,json; print(sorted(p["id"] for p in json.load(sys.stdin)["processes"]))'
# -> sollte "deinmodell:prozess-id" enthalten
```

### 5. Keycloak — nur bei `anonymous-access: false`
Im Realm `UrbanModelPlatform` eine Rolle anlegen und den berechtigten Usern zuweisen.
**Der Name der Rolle ist nicht frei wählbar**, UMP vergleicht ihn wörtlich
(`src/ump/core/services/authorization.py`):

- `<provider>`: Zugriff auf **alle** Prozesse dieses Modellservers, also z. B.
  `bikebox-modelserver`.
- `<provider>:<prozess-id>`: Zugriff auf **einen** Prozess, also die vollständige
  Prozess-Id mit Doppelpunkt, z. B. `bikebox-modelserver:fixbike`.

Fehlt beides, antwortet die API mit 403 und dem Satz
`Missing role '<provider>' or '<provider>:<prozess-id>'.`

Zwei Fallstricke:

- **Das alte Namensschema `modelserver_<id>` gilt nicht mehr.** Es stammt aus UMP 2.x.
  Rollen dieses Namens im Realm greifen unter 3.x nur noch, wenn ein Modellserver
  zufällig genau so heißt.
- **Aus welchem Claim UMP die Rollen liest, steht in `UMP_JWT_ROLES_CLAIMS`.** Der
  Vorgabewert ist `realm_access.roles`, also **Realm**-Rollen. Client-Rollen auf
  `ump-client` stehen unter `resource_access.ump-client.roles` und werden nur gelesen,
  wenn dieser Pfad dort eingetragen ist. Was auf Produktion konfiguriert ist, ist hier
  nicht nachgesehen; vor dem Anlegen einer Rolle prüfen.

Die Prozessliste wird durch diese Rollen nur gefiltert, wenn `UMP_PUBLIC_PROCESSES` aus
ist. Auf Produktion ist sie an, dort sieht also jeder alle Modelle und scheitert erst
beim Ausführen. Das Frontend braucht dafür keine Anpassung, sollte den 403 aber
verständlich erklären.

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
| Keycloak | Rolle `<provider>` oder `<provider>:<prozess-id>` | nur bei `anonymous-access: false` |
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
  Stolpersteine) steht in [`runbook-growbike-modelserver-de.md`](./runbook-growbike-modelserver-de.md).
  Dort auch der aktuelle Stand auf dem Server: Die Datei fehlt dort und die API läuft deshalb nicht.
