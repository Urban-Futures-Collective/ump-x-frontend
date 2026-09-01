# Deployment: Staging & Prod

Beide Umgebungen laufen über Dokploy hinter einem nginx auf `82.165.91.175`,
**jede mit eigenem Branch**: Staging deployt automatisch aus `staging`, Produktion
aus `deploy`. Ein Merge nach `staging` ist damit sofort auf der Staging-Domain
sichtbar und muss nicht erst die ganze Kette durchlaufen.

| | Prod | Staging |
|---|---|---|
| Domain | `ump-x.urbanfuturescollective.org` | `ump-x-staging.urbanfuturescollective.org` |
| Keycloak-Realm | `UrbanModelPlatform` (geteilt) | `UrbanModelPlatform` (geteilt) |
| Container | `ump-x-frontend`, Port 6000 | `staging-ump-x-frontend`, Port 6500 |
| Autodeploy aus Branch | `deploy` | `staging` |

## Branch-Kette

Eine Änderung läuft immer denselben Weg:

```
feature-branch  →  staging  →  main  →  deploy
                  (testen)   (Team-   (live)
                             stand)
```

1. **Feature-Branch**, PR gegen `staging`. Nicht gegen `main`.
2. Ist auf Staging alles in Ordnung: `staging` → `main`. Das ist der Stand, von dem
   sich alle im Team die aktuelle Version holen.
3. `main` → `deploy`. Dokploy deployt per Autodeploy aus `deploy`, damit ist die
   Änderung live.

Eine Änderung ist also erst dann in Produktion, wenn sie bis `deploy` durchgereicht
wurde. Ein Merge nach `main` allein bewirkt nichts.

**Alle drei Branches enthalten dieselben Dateien.** Was sich pro Umgebung
unterscheidet, steht in den Dokploy Environment Settings, nicht im Repo. Das ist
Absicht und hat einen konkreten Anlass: Vorher trugen `staging` und `main`
verschiedene Container-Namen und Ports in `Dockerfile` und `docker-compose.yml`.
Beim Merge `staging` → `main` wanderten die Staging-Werte nach `main`, ohne einen
Konflikt auszulösen und damit unbemerkt. Wäre das nach `deploy` durchgereicht
worden, hätte der Prod-Container den Namen des laufenden Staging-Containers
bekommen (Namenskollision) und auf dem falschen Port gelauscht (502).

## Die eine Falle: BASE_URL ist Build-Zeit, alles andere Laufzeit

`nuxt-oidc-auth` setzt `authorizationUrl` / `tokenUrl` / `userInfoUrl` / `logoutUrl`
**im Modul-Setup** aus `NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL` zusammen, also während
`nuxt build`. Die zusammengesetzten URLs landen als eigene `runtimeConfig`-Keys im Build.

Folge: Wird `BASE_URL` erst zur Laufzeit gesetzt, existieren diese Keys gar nicht, Nuxts
Env-Override kann sie nicht anlegen, und es greift der relative Preset-Fallback
(`protocol/openid-connect/auth`). Der Login-Redirect zeigt dann auf die eigene Domain
statt auf Keycloak, mit derselben leeren Fehlerseite wie bei fehlender Config.

Deshalb: `BASE_URL` als **Build-Arg** (im Dockerfile als `ARG` mit Default hinterlegt),
alle übrigen Werte als normale Laufzeit-Env.

Die gehostete Keycloak läuft auf 17+ und hat **kein** `/auth`-Pfadpräfix, anders als der
lokale Dev-Stack auf `:8282`:

```
https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform     # richtig
https://auth.urbanfuturescollective.org/auth/realms/UrbanModelPlatform # 404
```

## Environment-Variablen (in Dokploy pro Environment setzen)

Gemeinsam:

```
NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID=ump-client
NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET=<aus Keycloak, Credentials-Tab>
NUXT_UMP_API_TARGET=<interne URL der UMP-API, Port 5003>
```

`NUXT_UMP_API_TARGET` gilt nur fürs Frontend. Im Backend-Environment hat sie keine
Wirkung, alles mit `NUXT_`-Präfix liest ausschließlich Nuxt.

Prod:

```
CONTAINER_NAME=ump-x-frontend
APP_PORT=6000
NUXT_OIDC_PROVIDERS_KEYCLOAK_REDIRECT_URI=https://ump-x.urbanfuturescollective.org/auth/keycloak/callback
NUXT_OIDC_PROVIDERS_KEYCLOAK_LOGOUT_REDIRECT_URI=https://ump-x.urbanfuturescollective.org
```

Staging:

```
CONTAINER_NAME=staging-ump-x-frontend
APP_PORT=6500
NUXT_OIDC_PROVIDERS_KEYCLOAK_REDIRECT_URI=https://ump-x-staging.urbanfuturescollective.org/auth/keycloak/callback
NUXT_OIDC_PROVIDERS_KEYCLOAK_LOGOUT_REDIRECT_URI=https://ump-x-staging.urbanfuturescollective.org
```

`APP_PORT` steuert beides zugleich: worauf Nitro lauscht (`NITRO_PORT`) und was
nach außen gemappt wird. Deshalb können die beiden nicht mehr auseinanderlaufen.

**Wichtig für Staging:** Fehlen `CONTAINER_NAME` und `APP_PORT` dort, greifen die
Defaults aus `docker-compose.yml`, und das sind die Prod-Werte. Staging liefe dann
auf Port 6000 statt 6500 und wäre über seinen Proxy nicht erreichbar. Die Defaults
sind bewusst so gewählt: Ein vergessener Eintrag trifft dann Staging, nicht
Produktion.

Session- und Token-Verschlüsselung, **pro Environment einmal erzeugen und festhalten**:

```
NUXT_OIDC_SESSION_SECRET=<openssl rand -hex 24>       # min. 48 Zeichen
NUXT_OIDC_AUTH_SESSION_SECRET=<openssl rand -hex 24>
NUXT_OIDC_TOKEN_KEY=<openssl rand -base64 32>
```

Sind diese drei nicht gesetzt, würfelt der Nitro-Plugin `provideDefaults` sie bei **jedem
Containerstart neu** (mit Warnung im Log). Der Login funktioniert dann zwar, aber jeder
Redeploy und jeder Neustart wirft alle angemeldeten Nutzer raus, und bei mehr als einer
Replica schlägt die Anmeldung sporadisch komplett fehl.

## Keycloak: `ump-client` (Rico)

Am Client `ump-client` im Realm `UrbanModelPlatform` müssen beide Domains eingetragen sein.
Stand 2026-07-20 zeigten die Redirect-URIs nur auf die UMP-API (`:5003`), nicht auf das
Frontend. Deshalb scheitert der Login auch nach korrekter App-Config noch bei Keycloak
mit `Invalid parameter: redirect_uri`.

Der bestehende Eintrag `/*` (relativ zur Root URL `http://localhost:5003`) bleibt stehen,
den braucht die UMP-API. Ergänzt werden:

- **Valid redirect URIs**
  - `https://ump-x.urbanfuturescollective.org/auth/keycloak/callback`
  - `https://ump-x-staging.urbanfuturescollective.org/auth/keycloak/callback`
- **Valid post logout redirect URIs**: dort steht `+` („dieselben wie die Redirect-URIs").
  Das deckt unser Logout-Ziel nicht ab, weil das die nackte Domain ohne Pfad ist:
  - `https://ump-x.urbanfuturescollective.org/*`
  - `https://ump-x-staging.urbanfuturescollective.org/*`
- **Web origins**: leer lassen. CORS wird nicht gebraucht, der Token-Austausch läuft
  server-seitig (BFF), der Browser spricht nie direkt mit Keycloaks Token-Endpoint.

## TLS Staging

**Erledigt.** Die Staging-Domain hat inzwischen ein eigenes Zertifikat von Let's
Encrypt, geprüft am 2026-08-27:

```
$ curl -sSv https://ump-x-staging.urbanfuturescollective.org/ -o /dev/null
*  subject: CN=ump-x-staging.urbanfuturescollective.org
*  SSL certificate verify ok.
```

Vorher lief die Domain über das Prod-Zertifikat ohne passenden SAN-Eintrag, und
jeder Browser zeigte eine Warnung. Ein OIDC-Flow war über einen solchen Origin
nicht sinnvoll testbar. Das ist behoben.

## Smoke-Test nach dem Deploy

```
curl -sD- -o /dev/null https://<domain>/auth/keycloak/login | grep -i location
```

- `location: https://auth.urbanfuturescollective.org/realms/...` → korrekt.
- `location: /` (plus `set-cookie: nuxt-oidc-auth=; Max-Age=0`) → `Invalid configuration`,
  d.h. `clientId` oder `clientSecret` fehlt zur Laufzeit.
- `location: protocol/openid-connect/auth?...` (relativ) → `BASE_URL` fehlte beim Build.
