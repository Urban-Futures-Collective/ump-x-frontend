# Runbook: growbike als UMP-Modellserver einbinden

Durchgearbeitetes Beispiel dafür, wie ein Modellserver in UMP registriert wird.
growbike ist selbst ein OGC-API-Processes-Server (pygeoapi). Statt ihn separat ans
Frontend zu hängen, registrieren wir ihn **in UMP**, dann fließt er durch die
vorhandene `/ump`-Naht (Katalog, Ausführung, Ergebnis) ohne modellspezifischen
Frontend-Code.

> **Verifiziert am 2026-07-03, aber lokal.** Der gesamte Ablauf unten wurde gegen ein
> lokales UMP durchgespielt, nicht gegen Produktion. Was auf dem Server anders ist,
> steht im letzten Abschnitt. Bitte nicht ungeprüft übertragen.

## Der Kern in drei Zeilen

1. Modellserver ans selbe Docker-Netz wie die UMP-API hängen
2. Block in `providers.yaml` ergänzen
3. API neu starten, sie liest die gemountete Datei beim Start

## Ablauf (lokal verifiziert)

```bash
# 1. growbike ans UMP-Docker-Netz hängen, dann ist er per Containernamen erreichbar
docker network connect ump_dev pygeoapi-growbike

# 2. Erreichbarkeit aus dem API-Container prüfen (interner Port 80)
docker exec urban-model-platform-api-1 \
  python -c "import urllib.request,json; print([p['id'] for p in json.loads(urllib.request.urlopen('http://pygeoapi-growbike:80/processes/?f=json').read())['processes']])"
#   -> ['growbike']
```

**3.** In UMPs `providers.yaml` einen Modellserver ergänzen. `authentication` ist
optional, ohne Angabe gilt NoAuth; growbike hat keine Auth:

```yaml
growbike:
    name: growbike
    url: "http://pygeoapi-growbike:80"
    timeout: 1800
    processes:
      growbike:
        result-storage: "remote"     # Inline-GeoJSON, growbike liefert eine FeatureCollection
        anonymous-access: true       # Test-Default, finale Login-Policy ist Team-Entscheid
```

```bash
# 4. API neu starten, sie liest die gemountete providers.yaml beim Start
docker compose -f docker-compose-dev.yaml restart api
```

## Verifizieren

```bash
# erscheint als "growbike:growbike"
curl -s "http://localhost:5003/processes/?f=json" \
  | python3 -c 'import sys,json;print(sorted(p["id"] for p in json.load(sys.stdin)["processes"]))'

# Oelde ausführen (async), Job pollen, Ergebnis holen
curl -s -X POST "http://localhost:5003/processes/growbike:growbike/execution" \
  -H "Content-Type: application/json" -H "Prefer: respond-async" \
  -d '{"inputs":{"cityname":"Oelde","ranking":"betweenness_centrality"}}'
# GET /jobs/{id} bis "successful", dann GET /jobs/{id}/results
```

Erwartung: `FeatureCollection` mit **92 LineString-Features** (Radnetz Oelde), Properties
`betweenness_centrality`, `length`, `length_cumulative`, `rank`, `source`, `target`. Im
Frontend erscheint `growbike:growbike` in der Liste, auswählen, `cityname: Oelde`,
ausführen, das Radnetz erscheint als Linien auf der Karte.

## Stolpersteine

| # | Thema | Detail |
|---|---|---|
| 1 | **Netz-Verbindung ist Laufzeit** | `docker network connect` überlebt einen Restart, aber **nicht** das Neuerstellen des Containers, und genau das macht ein Deploy. Dauerhaft gehört der Modellserver mit `networks:` in die Compose-Datei. |
| 2 | **Image-Pin** | Der laufende Container hatte die passende `growbikenet`-Version nur *live* installiert, das Image eine andere. Bei Neuerstellung bricht die Ausführung. Version in `requirements-docker.txt` pinnen. |
| 3 | **`providers.yaml` ist nicht im Repo** | Sie existiert nur dort, wo sie gemountet wird. Siehe unten, das ist auf dem Server zum Problem geworden. |
| 4 | **anonymer Zugang** | `anonymous-access: true` war fürs Testen gesetzt. Die Login-Policy ist ein Team-Entscheid, danach nur das Flag umstellen. |

Stolperstein 1 und 3 haben eines gemeinsam: Beides ist Konfiguration, die nur zur
Laufzeit existiert und beim nächsten Deploy verschwindet. Das ist der wiederkehrende
Fehler in diesem Setup.

## Rollen in Keycloak

Der Name des Modellservers in `providers.yaml` bestimmt die Prozess-IDs
(`growbike:growbike`) **und** die Rollennamen. Wer ein Modell sehen soll, braucht am
`ump-client` die Rolle `<modelserver>` (alle Prozesse) oder
`<modelserver>_<prozess>` (einzelner Prozess).

Nur nötig bei `anonymous-access: false`. Bei `true` sieht jeder den Prozess, auch ohne
Anmeldung.

## Stand auf dem Server (2026-08-20)

Hier weicht die Lage vom lokalen Ablauf ab, und zwar in drei Punkten:

**Die `providers.yaml` fehlt.** An ihrer Stelle liegt ein leeres Verzeichnis, das
Docker angelegt hat, weil die Datei beim Start des Containers nicht existierte:

```
/etc/dokploy/compose/urban-model-platform-backend-wzuoew/code/providers.yaml
```

Daran scheitert die UMP-API seit dem 06.07.2026 beim Start:

```
ValidationError: UMP_PROVIDERS_FILE
Path does not point to a file: /home/pythonuser/providers.yaml
```

Das leere Verzeichnis muss zuerst weg, sonst mountet Docker wieder den Ordner statt
der Datei.

**Es gab dort vermutlich nie eine.** Die Rollen am `ump-client` heißen `modelserver`,
`modelserver_hello-world`, `modelserver_squareroot` und `modelserver_hello-geo-world`.
Das sind exakt die Namen aus `providers.yaml.example`, es gibt keine Rolle für growbike
oder bikebox. Zusammen damit, dass die API seit dem Aufsetztag crasht, spricht alles
dafür, dass sie in Produktion noch nie lief.

**Die Netze sind getrennt.** `pygeoapi-growbike` und der API-Container hingen laut den
Docker-Logs in verschiedenen Netzen (`bikebox-modelserver-pygeoapi-ayajqr_default`
gegen `ump_prod`). Ein `docker network connect` würde helfen, aber nach Stolperstein 1
eben nur bis zum nächsten Deploy. Dauerhaft gehört das in die Compose-Konfiguration.

## Verwandtes

- `docs/add-new-model-de.md`, Übersicht welche Stellen ein neues Modell berührt
- `docs/deployment-de.md`, Branch-Kette, Environment-Variablen, Smoke-Tests
