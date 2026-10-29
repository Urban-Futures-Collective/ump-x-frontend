# Frontend ↔ backend: architecture decision (UMP-X)

**Status:** implemented, updated 2026-10-29
**Date:** 2026-06-21
**Context:** UMP-X (Nuxt 4 frontend for the Urban Model Platform). The UMP backend is being moved to a **hexagonal architecture** in parallel (Flask → FastAPI), but the rebuild will **probably not be finished within the funding period**.

---

## TL;DR (decision)

We build the frontend against the **current API** (what will be delivered within the funding period), but so that a later switch to the new architecture stays **locally contained**: not free, but without sweeping changes.

The key: the frontend depends on the **HTTP / OGC API contract**, not on backend internals. Everything backend-specific lives in **one thin integration layer**. There are exactly **two seams** that will change with the rebuild, and we align with them.

---

## Why this is safe

In the backend's hexagonal design, the web layer (`adapters/web/fastapi.py`, routes `/processes`, `/jobs`, `/execution`) is a **driving adapter**: a deliberately replaceable entry point that serves the OGC API Processes contract. The core (domain models, managers, ports) is rebuilt; the **contract is meant to stay**.

Consequence: the switch from Flask to FastAPI is **invisible over the wire** as long as the OGC routes and formats stay the same. The only thing that can really hit us is a change to the **API contract**, not the internal rebuild.

---

## The two seams that will change

This is the decisive part. This is where we draw clean boundaries.

### 1. API versioning: happened with UMP 3.0.0
The new structure has **versioned sub-apps** and **OpenAPI docs per version**. Up to 2.x the routes sat at the root (`/processes/`); since 3.0.0 they sit under `/v1.0/processes`.

Two things changed, not one:

- **Prefix `/v1.0`** in front of all OGC routes.
- **No trailing slash any more.** FastAPI runs there with `redirect_slashes=False`; `/v1.0/processes/` is a **404**, not a 308 redirect to the variant without. Up to 2.x it was exactly the other way round: the slash was required.

Also dropped: `?f=json` (the API only speaks JSON) and `total_count` in the job list (now `{ jobs, links }`). `/execution` answers with **201** and a complete `JobStatusInfo` instead of only `{ jobID, status }`, the same shape as `/jobs/{id}`.

→ The seam held: **base URL and API version together in one config** (`runtimeConfig.public.umpBase` + `umpApiVersion`, combined in `useUmpBase()`). The path change was a one-liner; the slashes were scattered across the composables and had to go one by one.

UMP's own APIs outside OGC have their own version and path: the model registry lives under `/registry/v1` (see `useRegistryApi`), not under `/v1.0`.

### 2. Result delivery (the important one)
Among the "planned adapters" are **GeoServer result storage** (WFS/WMS publish) and **ldproxy result storage** (OGC API Features) behind a new `ResultStoragePort`. Results used to be rendered as **inline GeoJSON** from `/jobs/{id}/results`. In future they could come as an **OGC API Features collection** or as **WFS/WMS layers**.

→ **Encapsulate "fetch job result → map-ready layer" in exactly one function/composable.** This is the only place where the frontend gets real work when the rebuild lands. Draw this seam most cleanly.

**As of 2026-10-29:** the seam is `useUmpResult` plus `resultLayers` (layers from the declared output). Inline GeoJSON is shown with the colours a model sends per feature (simplestyle), plus key figures and a legend (`x-ump-indicators`, `x-ump-legend`, see `resultExtras`). A result may also **link to layers** instead of carrying them: prepare-city returns `layers` with an `href` per layer to an OGC API Features query on the model server; the map loads each layer only when it is switched on (`linkedLayers`). Since 2026-10-26 UMP passes the `Accept` header on when fetching results, so pygeoapi model servers answer with JSON instead of HTML. Rasters are not shown yet.

### Auth (unchanged)
The planned Keycloak adapter (JWT, realm roles) does not change the auth concept. Our OIDC approach is not affected.

---

## What this means for the frontend

Principles for the implementation:

1. **One integration layer.** All UMP access in composables / a typed client (`useUmpProcesses`, `useUmpJob`, `executeProcess`, `useRegistryApi`). This is the *only* place that knows endpoints and response shapes.
2. **Domain models.** Map raw API responses there to our own models (`Process`, `Job`, `ResultLayer`, `RegistryModel`). Components only consume these models, **never raw JSON**. If a payload changes, we fix the mapping in one place, not in many components.
3. **Config for base and version.** `umpBase` + API version central and overridable per env.
4. **Isolate result layers.** A module of its own for "result → GeoJSON/layer for the map" (see seam 2).
5. **Generate types.** Once the versioned API with an OpenAPI doc is in place: generate TypeScript types from it → contract changes become compile errors.
6. **Mark UMP extensions.** Keep ensembles, job sharing, comments and the `x-ump-*` members clearly apart from standard OGC; they are the most likely to move in the refactor.

### Deliberately NOT doing (YAGNI)
Do **not rebuild the hexagonal architecture in the frontend** (no formal ports/adapters/DI). For a prototype bound to the funding period that is overkill. A clean composable + mapping boundary gives ~90 % of the future-proofing for ~5 % of the effort. The "replaceable adapter" stays implicit (one well-factored module), not an explicit interface; that only pays off once there really are two backends to serve.

---

## What we already have

- Server-side proxy `/ump/**` → `NUXT_UMP_API_TARGET`, adds the session's token (solves CORS, no token in the browser).
- `runtimeConfig.public.umpBase` + `umpApiVersion` as the central backend base (`useUmpBase()`).
- One integration layer `app/composables/useUmp*` and `useRegistry*` with domain models in `app/types/`.
- Form from the JSON Schema of the process description, including map input for `format: geojson-geometry` and a field that takes a place name or a drawn area (`oneOf`).
- Map on OpenLayers via the masterportalapi (Web Mercator, OSM), with linked layers to switch on.
- Long runs: polling without a time limit in the form, the run page reloads by itself.
- Model registry (contribute, verify, publish, Commons cards) against UMP's `/registry/v1` behind a switch, or with sample data.
- Our own server routes that talk to the Keycloak admin API through a service account (administration, access manager, creating model roles on publishing). This is a third seam, deliberately: UMP 3 holds no Keycloak admin secret (see `model-access-admin-decision-en.md`).

---

## Open questions to the backend team

These answers decide how deep we can build already:

1. ~~**Does the OGC route contract** stay compatible with the FastAPI adapter, only versioned under `/v1.0`?~~ **Answered with 3.0.0: yes**, except for the trailing slash (see seam 1).
2. **How do results come after the rebuild:** inline GeoJSON, OGC API Features or WFS/WMS? This is the one answer that really shapes our map/rendering code. **Mostly answered (2026-10-29):** inline GeoJSON or links to OGC API Features collections, both shown; open is how rasters come (COG or WMS).
3. **What else the frontend needs from the backend** (as of 2026-10-29): the inputs of a run (`/jobs/{id}/definition`), `x-ump-*` and `metadata` in process descriptions passed through unchanged, `Accept-Language` when fetching, `anonymous_access` in the registry's model list, storage for access requests, and the switch of the registry to the database.

---

## References

- Hexagonal architecture diagram of the backend (`__UMP-X/Hexagonal Architektur/…`)
- Platform/API reference: `_stack-docs/ump/ump-platform.md`
- Local setup: `_llm-wiki/UMP-X/Runbook — Lokales UMP Setup.md`
