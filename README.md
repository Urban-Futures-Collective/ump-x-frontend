# UMP-X Frontend

Web frontend for the **Urban Model Platform (UMP)** of the City Science Lab Hamburg.
It makes urban simulation models (OGC API Processes) usable in the browser: browse the
catalogue, run scenarios, see results on a map, and ask an AI chat for help.

Stack: Nuxt 4 · Nuxt UI v4 (Tailwind v4) · OpenLayers via masterportalapi · i18n (DE/EN) ·
TypeScript · Vitest.

## What is in it

| Area | Path | Notes |
|---|---|---|
| Landing page, Commons (model catalogue) | `/`, `/commons` | open without sign-in, search, filters by topic, language and licence |
| Model page | `/commons/<server>:<process>` | model card from the registry: purpose, inputs and outputs, limits, people and literature |
| New scenario | `/run?process=<id>` | form built from the model's JSON Schema: choices, dates, switches, rules checked before sending, areas and points drawn on a map |
| My scenarios, run details | `/jobs`, `/jobs/<id>` | follows long runs, result on the map or as download |
| Administration | `/admin` | platform admins: create accounts with an email invitation, platform roles, disable accounts |
| Access manager | `/access` | access admins: grant and revoke access to a model or a whole model server |
| Contribute, Verify | `/contribute`, `/verify` | model registry: register servers and models, review, publish; with sample data (`NUXT_PUBLIC_PROTOTYPES=true`) or UMP's registry API (`NUXT_PUBLIC_REGISTRY_API=true`) |
| Help, chat | `/hilfe`, chat in the header | bring your own AI provider, or use the MCP server |
| Legal pages | `/impressum`, `/datenschutz`, `/barrierefreiheit` | drafts, missing facts are marked |

Who may see and do what: `docs/frontend-flow-en.md`.

## Setup

```bash
npm install
cp .env.example .env   # fill in Keycloak and the UMP API target
npm run dev            # http://localhost:3000
```

Scripts:

| Script | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build`, `npm run preview` | production build and local preview |
| `npm run lint` | ESLint |
| `npm run typecheck` | vue-tsc via `nuxi typecheck` (check the exit code) |
| `npm test` | Vitest unit tests (`app/utils/*.test.ts`, `server/utils/*.test.ts`, `shared/utils/*.test.ts`) |

## Configuration

All settings come from environment variables; `.env.example` lists them. The important
groups:

- **Keycloak sign-in** (`NUXT_OIDC_*`): client, secrets, redirect URIs. The base URL is a
  build argument, see the trap described in `docs/deployment-en.md`.
- **UMP API** (`NUXT_UMP_API_TARGET`): the server-side proxy `/ump/**` forwards to it and
  adds the user's token.
- **Keycloak service account** (`NUXT_KEYCLOAK_ADMIN_CLIENT_ID`, `NUXT_KEYCLOAK_ADMIN_CLIENT_SECRET`):
  server-side only, for the administration, the access manager and publishing.
- **Model registry** (`NUXT_PUBLIC_PROTOTYPES=true` for sample data,
  `NUXT_PUBLIC_REGISTRY_API=true` for UMP's registry API): shows Contribute and Verify
  and the model cards in the Commons. Off on production.

## Deployment

Hosted with Dokploy. Branch chain: feature branch → `staging` → `main` → `deploy`; details,
environments and Keycloak settings in `docs/deployment-en.md`.

For a plain VPS, `docker compose up -d --build` binds the frontend to `127.0.0.1:3000`
for use behind a reverse proxy.

## Backend

The frontend talks to UMP only over HTTP (OGC API Processes under `/v1.0`) through its
own proxy. All access sits in `app/composables/useUmp*`, which map API responses to the
domain models in `app/types/`; components never see raw JSON. Background and the open
questions to the backend: `docs/frontend-backend-architecture-en.md`.

## Further documents

| Document | Topic |
|---|---|
| `docs/frontend-flow-en.md` | paths through the app, roles, what is missing |
| `docs/frontend-backend-architecture-en.md` | frontend and backend seams |
| `docs/deployment-en.md` | environments, variables, Keycloak |
| `docs/add-new-model-de.md` | adding a model server today (by hand) |
| `docs/runbook-growbike-modelserver-de.md` | model servers and roles, an example |
| `docs/privacy-inventory-en.md` | where personal data is processed |
| `docs/model-access-admin-decision-en.md` | how model access administration was decided (superseded, with the current state) |
