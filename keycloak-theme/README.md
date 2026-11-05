# UMP-X login theme for Keycloak

The Keycloak sign-in page in the UMP-X look, after the design "Login Page BG 2": teal to
gold gradient, a white card with the logo, "Welcome" and a line below it, rounded fields
and buttons, Poppins. It extends Keycloak's `keycloak.v2` login theme and changes only styles and a
few texts, so Keycloak updates keep working.

Tested with Keycloak 26.3.5 (the version on the UFC server).

```
ump-x/login/
  theme.properties              parent keycloak.v2, extra stylesheet, light mode, en/de
  resources/css/ump-x.css       gradient, card, logo, rounded fields, Poppins (embedded)
  resources/img/logo.svg        the UMP-X logo
  messages/messages_{en,de}.properties   page title, "Welcome", "Continue" ("Du" in German)
```

## Install on the UFC server

Keycloak runs on the UFC server as the Docker container `keycloak` (`start-dev`, so themes
are read from disk and not cached; no build step). Plesk forwards
`auth.urbanfuturescollective.org` to its port `127.0.0.1:18080`.

**Do not deploy the Keycloak compose in Dokploy.** The running container was started by
hand on 2026-07-09 and does not match the compose file there (other container name, no
published port). A Dokploy deploy would start a second Keycloak without port 18080, and
sign-in would stop working. The theme is therefore copied into the running container.

All commands run in Plesk → Extensions → My Extensions → SSH Terminal.

1. Fetch the theme folder from the public repository:

   ```bash
   rm -rf /opt/keycloak-themes/ump-x && mkdir -p /opt/keycloak-themes
   curl -sL https://codeload.github.com/Urban-Futures-Collective/ump-x-frontend/tar.gz/refs/heads/staging \
     | tar -xz -C /opt/keycloak-themes --strip-components=2 ump-x-frontend-staging/keycloak-theme/ump-x
   ls /opt/keycloak-themes/ump-x/login
   ```

   The last line shows `messages  resources  theme.properties`.

2. Copy it into the running container (the `/.` copies the contents, so it also works
   when the folder already exists):

   ```bash
   docker exec keycloak mkdir -p /opt/keycloak/themes/ump-x
   docker cp /opt/keycloak-themes/ump-x/. keycloak:/opt/keycloak/themes/ump-x
   docker exec keycloak ls /opt/keycloak/themes/ump-x/login
   ```

   This survives `docker restart keycloak`. Only a newly created container loses it; then
   run this step again.

3. Switch it on (once): Keycloak admin → realm `UrbanModelPlatform` → Realm settings →
   Themes → Login theme `ump-x` → Save.

4. German and English (once): Realm settings → Localization → Internationalization on,
   supported locales `en` and `de`, default `en`.

Installed this way on 2026-11-05.

## Update

Run steps 1 and 2 again. With `start-dev` the next page load shows the change.

## Try it locally

```bash
docker run --rm -p 18089:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=<choose one> \
  -v "$PWD/keycloak-theme/ump-x:/opt/keycloak/themes/ump-x:ro" \
  quay.io/keycloak/keycloak:26.3.5 start-dev
```

Then create a realm at http://localhost:18089, set its login theme to `ump-x` and open
its account page to see the sign-in.
