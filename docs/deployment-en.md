# Deployment: staging and production

Both environments run on Dokploy behind nginx on `82.165.91.175`, **each from its own
branch**: staging deploys automatically from `staging`, production from `deploy`. A
merge into `staging` therefore shows up on the staging domain right away and does not
have to go through the whole chain first.

| | Production | Staging |
|---|---|---|
| Domain | `ump-x.urbanfuturescollective.org` | `ump-x-staging.urbanfuturescollective.org` |
| Keycloak realm | `UrbanModelPlatform` (shared) | `UrbanModelPlatform` (shared) |
| Container | `ump-x-frontend`, port 6000 | `staging-ump-x-frontend`, port 6500 |
| Autodeploy from branch | `deploy` | `staging` |

## Branch chain

A change always takes the same path:

```
feature branch  →  staging  →  main  →  deploy
                  (testing)   (team    (live)
                              state)
```

1. **Feature branch**, PR against `staging`. Not against `main`.
2. Once everything is fine on staging: `staging` → `main`. This is the state everyone
   in the team pulls the current version from.
3. `main` → `deploy`. Dokploy autodeploys from `deploy`, so the change is live.

A change is only in production once it has been passed on to `deploy`. A merge into
`main` alone does nothing.

**All three branches contain the same files.** What differs per environment lives in
the Dokploy environment settings, not in the repo. This is deliberate and has a concrete
cause: `staging` and `main` used to carry different container names and ports in
`Dockerfile` and `docker-compose.yml`. Merging `staging` → `main` carried the staging
values into `main` without a conflict, so nobody noticed. Had that reached `deploy`, the
production container would have taken the name of the running staging container (name
clash) and listened on the wrong port (502).

## The one trap: BASE_URL is build time, everything else runtime

`nuxt-oidc-auth` builds `authorizationUrl` / `tokenUrl` / `userInfoUrl` / `logoutUrl`
**in the module setup** from `NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL`, that is during
`nuxt build`. The resulting URLs end up as their own `runtimeConfig` keys in the build.

Consequence: if `BASE_URL` is only set at runtime, these keys do not exist, Nuxt's env
override cannot create them, and the relative preset fallback applies
(`protocol/openid-connect/auth`). The login redirect then points to the app's own
domain instead of Keycloak, with the same empty error page as a missing config.

Therefore: `BASE_URL` as a **build arg** (declared in the Dockerfile as `ARG` with a
default), all other values as normal runtime env.

The hosted Keycloak runs version 17+ and has **no** `/auth` path prefix, unlike the
local dev stack on `:8282`:

```
https://auth.urbanfuturescollective.org/realms/UrbanModelPlatform     # correct
https://auth.urbanfuturescollective.org/auth/realms/UrbanModelPlatform # 404
```

## Environment variables (set per environment in Dokploy)

Shared:

```
NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID=ump-client
NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET=<from Keycloak, Credentials tab>
NUXT_UMP_API_TARGET=<internal URL of the UMP API, port 5003>
```

`NUXT_UMP_API_TARGET` only applies to the frontend. In the backend environment it has
no effect; anything with the `NUXT_` prefix is read by Nuxt only.

Production:

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

`APP_PORT` controls both at once: what Nitro listens on (`NITRO_PORT`) and what is
mapped to the outside. So the two can no longer drift apart.

**Important for staging:** if `CONTAINER_NAME` and `APP_PORT` are missing there, the
defaults from `docker-compose.yml` apply, and those are the production values. Staging
would then run on port 6000 instead of 6500 and be unreachable through its proxy. The
defaults are chosen on purpose: a forgotten entry hits staging, not production.

Session and token encryption, **generate once per environment and keep**:

```
NUXT_OIDC_SESSION_SECRET=<openssl rand -hex 24>       # at least 48 characters
NUXT_OIDC_AUTH_SESSION_SECRET=<openssl rand -hex 24>
NUXT_OIDC_TOKEN_KEY=<openssl rand -base64 32>
```

If these three are not set, the Nitro plugin `provideDefaults` generates them anew on
**every container start** (with a warning in the log). Sign-in still works, but every
redeploy and every restart signs all users out, and with more than one replica sign-in
fails sporadically.

### Keycloak service account (administration, access manager, publishing)

**Server-side only.** The client `ump-x-admin` in the realm has only "Service accounts
roles" switched on, with `view-users`, `query-users`, `manage-users`, `view-realm` and
`manage-realm` from `realm-management`. Anyone holding the secret can administer the
realm; it belongs nowhere else:

```
NUXT_KEYCLOAK_ADMIN_CLIENT_ID=ump-x-admin
NUXT_KEYCLOAK_ADMIN_CLIENT_SECRET=<from Keycloak, client ump-x-admin, Credentials tab>
```

What the server does with it, each route checking the caller's role first:

- **Administration** (`/api/admin/platform/*`, `platform-admin`): list accounts, create
  them with an invitation email, platform roles, enable and disable accounts. The
  invitation is sent by Keycloak through the mail server on the Plesk host.
- **Access manager** (`/api/access/*`, `access-admin`): grant and revoke the model
  access roles `{server}` and `{server}:{process}`. Only names of that form are
  accepted, never platform or Keycloak roles.
- **Publishing** (`/api/registry/models/{id}/publish`, `verifier`): after UMP has set the
  status, creates the two access roles of the model (needs `manage-realm`).

If the variables are missing, these routes answer 503 and name what is missing. The
server reads the realm address from the `tokenUrl` set at build time (see the trap
above); no extra variable is needed. As of 2026-09-30 set on staging only.

### Model registry

Two switches, both read at runtime, no new build needed:

```
NUXT_PUBLIC_PROTOTYPES=true     # Contribute and Verify with sample data
NUXT_PUBLIC_REGISTRY_API=true   # Contribute, Verify and the Commons cards from UMP's /registry/v1
```

`NUXT_PUBLIC_REGISTRY_API` wins when both are set. Leave it off until UMP reads the
registry from its database (`UMP_PROVIDERS_SOURCE=db`); before that the registry is
empty. As of 2026-10-29 staging runs with `NUXT_PUBLIC_PROTOTYPES` so the team can click
through the sample data. Neither is set on production.

## Keycloak: `ump-client` (backend)

The client `ump-client` in the realm `UrbanModelPlatform` must list both domains. As of
2026-07-20 the redirect URIs only pointed to the UMP API (`:5003`), not to the frontend.
That is why sign-in still fails at Keycloak with `Invalid parameter: redirect_uri` even
with a correct app config.

The existing entry `/*` (relative to the root URL `http://localhost:5003`) stays; the UMP
API needs it. Add:

- **Valid redirect URIs**
  - `https://ump-x.urbanfuturescollective.org/auth/keycloak/callback`
  - `https://ump-x-staging.urbanfuturescollective.org/auth/keycloak/callback`
- **Valid post logout redirect URIs**: the field holds `+` ("same as the redirect
  URIs"). That does not cover our logout target, which is the bare domain without a
  path:
  - `https://ump-x.urbanfuturescollective.org/*`
  - `https://ump-x-staging.urbanfuturescollective.org/*`
- **Web origins**: leave empty. CORS is not needed; the token exchange runs server-side
  (BFF), the browser never talks to Keycloak's token endpoint directly.

The realm roles must reach the frontend session: the mapper "realm roles" needs "Add to
ID token" and "Add to userinfo" switched on, not only the access token.

## TLS on staging

**Done.** The staging domain has its own Let's Encrypt certificate, checked on
2026-08-27:

```
$ curl -sSv https://ump-x-staging.urbanfuturescollective.org/ -o /dev/null
*  subject: CN=ump-x-staging.urbanfuturescollective.org
*  SSL certificate verify ok.
```

Before, the domain used the production certificate without a matching SAN entry, and
every browser showed a warning. An OIDC flow could not be tested meaningfully over such
an origin. That is fixed.

## Smoke test after deploying

```
curl -sD- -o /dev/null https://<domain>/auth/keycloak/login | grep -i location
```

- `location: https://auth.urbanfuturescollective.org/realms/...` → correct.
- `location: /` (plus `set-cookie: nuxt-oidc-auth=; Max-Age=0`) → `Invalid configuration`,
  i.e. `clientId` or `clientSecret` is missing at runtime.
- `location: protocol/openid-connect/auth?...` (relative) → `BASE_URL` was missing at
  build time.
