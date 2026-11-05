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

Keycloak runs as the Dokploy compose project `keycloak-keycloak-k9oyai` with `start-dev`,
so themes are read from disk and not cached: no build step is needed.

1. Put the theme on the server (Plesk → Extensions → SSH Terminal). This fetches only the
   theme folder from the public repository:

   ```bash
   mkdir -p /opt/keycloak-themes
   curl -sL https://codeload.github.com/Urban-Futures-Collective/ump-x-frontend/tar.gz/refs/heads/staging \
     | tar -xz -C /opt/keycloak-themes --strip-components=2 ump-x-frontend-staging/keycloak-theme/ump-x
   ls /opt/keycloak-themes/ump-x/login
   ```

2. Mount it into the container: Dokploy → the Keycloak compose → General → edit the
   compose file and add to the `volumes` of the Keycloak service (create the list if it
   has none):

   ```yaml
       volumes:
         - /opt/keycloak-themes/ump-x:/opt/keycloak/themes/ump-x:ro
   ```

   Save and deploy.

3. Switch it on: Keycloak admin → realm `UrbanModelPlatform` → Realm settings → Themes →
   Login theme `ump-x` → Save.

4. German and English: Realm settings → Localization → Internationalization on, supported
   locales `en` and `de`.

## Update

Run step 1 again. With `start-dev` the next page load shows the change; no redeploy.

## Try it locally

```bash
docker run --rm -p 18089:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=<choose one> \
  -v "$PWD/keycloak-theme/ump-x:/opt/keycloak/themes/ump-x:ro" \
  quay.io/keycloak/keycloak:26.3.5 start-dev
```

Then create a realm at http://localhost:18089, set its login theme to `ump-x` and open
its account page to see the sign-in.
