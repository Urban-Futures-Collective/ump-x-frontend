# Ein neues Modell zur UMP hinzufügen

*Stand 2026-09-18. Aussagen über laufende Systeme sind im Text einzeln datiert.*

**Kurz gesagt:** Ein neues Modell ist fast vollständig eine **Backend-/Plattform-Sache**.
Am **Frontend** muss in der Regel **nichts** geändert werden — es listet automatisch, was
der `/processes`-Endpunkt zurückgibt.

**Die beiden Repositories, um die es geht:**

| | Repo | Rolle |
|---|---|---|
| Backend | [`citysciencelab/urban-model-platform`](https://github.com/citysciencelab/urban-model-platform) | die UMP selbst: `docker-compose-dev.yaml`, `providers.yaml`, Authorization |
| Frontend | [`Urban-Futures-Collective/ump-x-frontend`](https://github.com/Urban-Futures-Collective/ump-x-frontend) | diese Datei liegt hier; Katalog, Formular, Karte |

Alle Dateipfade unten ohne weitere Angabe beziehen sich auf das **Backend**-Repo.

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
Die Datei liegt im Wurzelverzeichnis des Backend-Repos:
[`docker-compose-dev.yaml`](https://github.com/citysciencelab/urban-model-platform/blob/dev/docker-compose-dev.yaml)
(Branch `dev`). Daneben liegen `docker-compose-build.yaml` und `docker-compose-prod.yaml`.

**Das Netz heißt in der Compose-Datei `dev`, nicht `ump_dev`.** Der Unterschied ist
wichtig, weil man den Schlüssel referenziert und nicht den Docker-Namen:

```yaml
networks:
  dev:
    external: true
    name: ${DOCKER_NETWORK}
```

`ump_dev` ist der echte Docker-Name, er kommt aus `DOCKER_NETWORK` in der `.env`. Ein
Service hängt sich also mit `networks: [dev]` an. `external: true` heißt zudem, dass
Compose das Netz **nicht** anlegt; fehlt es, einmal `docker network create ump_dev`.

Den Modell-Container als Service ergänzen (Vorlage: der Service `modelserver` in
derselben Datei):

```yaml
  dein-modell:
    image: <dein-image>
    networks:
      - dev
    # ports: ... (nur nötig, wenn du ihn auch vom Host testen willst)
```

Der **Servicename ist der DNS-Name** im Netz und damit das, was in Schritt 3 unter `url:`
steht.

> Läuft das Modell außerhalb von Compose, hängt man es zur Laufzeit an:
> `docker network connect ump_dev <containername>`. Das überlebt einen Restart, aber
> **nicht** das Neuerstellen des Containers, und genau das macht ein Deploy. Dauerhaft
> gehört der Modellserver mit `networks:` in die Compose-Datei.

**Erreichbarkeit prüfen, und zwar aus dem API-Container heraus**, nicht vom Host. Nur dort
zählt die Namensauflösung:

```bash
docker exec urban-model-platform-api-1 \
  python -c "import urllib.request,json; print([p['id'] for p in json.loads(urllib.request.urlopen('http://dein-modell:80/processes/?f=json').read())['processes']])"
```

Erst wenn das die Prozess-Ids ausgibt, lohnt sich Schritt 3.

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
| `geoserver` | War in 2.x: Ergebnis wird über **GeoServer** als WMS/WFS-Layer publiziert. In UMP 3.0.0 **wirkungslos**, siehe Hinweis unter der Tabelle | derzeit keiner |

> **Zu `result-storage` in UMP 3.0.0.** Der Wert wird aus der `providers.yaml` gelesen und
> getypt, danach aber nirgends benutzt: `job_manager` nimmt einen `result_storage_port`
> entgegen, legt ihn auf ein Feld und fasst ihn nie wieder an, und einen GeoServer-Adapter
> gibt es im `deploy`-Branch nicht. `/v1.0/jobs/{id}/results` reicht stattdessen die
> Antwort des Modellservers unverändert durch, ausdrücklich ohne den Rumpf zu lesen. Was
> auf unserer Karte ankommt, hängt also am Modellserver, nicht an diesem Flag. Geprüft am
> 2026-08-31; nicht gemessen, weil noch kein Lauf gegen einen `geoserver`-Provider
> vorlag.

**`anonymous-access`:** Das Flag regelt seit UMP 3.0.0 nur noch das **Ausführen**,
nicht mehr die Sichtbarkeit.

- `true`: Prozess ist ohne Login ausführbar.
- `false`: nur mit passender Rolle (Schritt 5).

Ob ein Prozess im Katalog **erscheint**, entscheidet dagegen die Server-Einstellung
`UMP_PUBLIC_PROCESSES`. Ist sie an, sieht jeder alles, auch abgemeldet; ist sie aus,
zeigt `GET /processes` nur, was der Aufrufer auch ausführen dürfte. Auf Produktion ist
sie an: anonym liefert `/v1.0/processes` alle Modelle, während `/mcp/v1/tools`, das nach
der Ausführungsregel filtert, nur die offenen zeigt (am 2026-08-31 gemessen).

> Nachgemessen am 2026-09-18: anonym antwortet `https://ump.urbanfuturescollective.org/v1.0/processes`
> mit HTTP 200 und vier Prozessen (`bikebox-modelserver:fixbike`,
> `bikebox-modelserver:growbike`, `modelserver-1:abm-test-model`,
> `modelserver-1:seir-infection-model`). `UMP_PUBLIC_PROCESSES` ist dort also weiterhin an.

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
  wenn dieser Pfad dort eingetragen ist. Auf Produktion stehen am 2026-08-31 **beide**
  drin, dort funktioniert also beides. Eine Client-Rolle `bikebox-modelserver` auf
  `ump-client` ist an dem Tag angelegt, zugewiesen und mit einem fixbike-Lauf verifiziert
  worden. Auf einer anderen Instanz vor dem Anlegen erst die Variable prüfen.

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
| `docker-compose-dev.yaml` | Container an den Netz-Schlüssel `dev` hängen (Docker-Name `ump_dev`) | ✅ bei neuem lokalen Container |
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
  nicht ein Neuerstellen des Containers. Dauerhaft: den Container mit `networks: [dev]` in ein
  Compose aufnehmen.
- **Voll durchgearbeitetes Beispiel:** die growbike-Einbindung (Netz, `providers.yaml`, Verifikation,
  Stolpersteine) steht in [`runbook-growbike-modelserver-de.md`](./runbook-growbike-modelserver-de.md).
  Der dortige Abschnitt „Stand auf dem Server (2026-08-20)" ist überholt: die fehlende
  `providers.yaml` ist behoben, die API auf Produktion antwortet am 2026-09-18 und liefert
  vier Prozesse aus zwei Modellservern.
- **Lokaler Stand am 2026-09-18:** das Netz `ump_dev` existiert, der UMP-Stack läuft mit
  sieben Containern daran. `pygeoapi-growbike` ist gestoppt; seine Netz-Zugehörigkeit steht
  noch in der Docker-Konfiguration, der Name löst aber erst wieder auf, wenn der Container
  läuft. Die lokale `providers.yaml` verweist weiterhin darauf.
