# Frontend ↔ Backend: Architecture Decision (UMP-X)

**Status:** Proposal / for discussion
**Date:** 2026-06-21
**Context:** UMP-X (Nuxt 4 frontend for the Urban Model Platform). The UMP backend is being migrated in parallel to a **hexagonal architecture** (Flask → FastAPI), but the migration will **likely not be finished within the funding period**.

---

## TL;DR (Decision)

We build the frontend against the **current API** (what ships within the funding period) — but in a way that keeps a later switch to the new architecture **locally contained**: not "effortless," but without large-scale rework.

The key: the frontend depends on the **HTTP / OGC API contract**, not on backend internals. Everything backend-specific lives in **one thin integration layer**. There are exactly **two seams** that will change during the migration — and we design for them.

---

## Why this is safe

In the backend's hexagonal design, the web layer (`adapters/web/fastapi.py`, routes `/processes`, `/jobs`, `/execution`) is a **"driving adapter"** — a deliberately swappable entry point that serves the OGC API Processes contract. The core (domain models, managers, ports) gets rebuilt, but the **contract is meant to stay the same**.

Consequence: the Flask → FastAPI switch is **invisible over the wire**, as long as the OGC routes and shapes stay the same. The only thing that can actually affect us is a change to the **API contract** — not the internal rebuild.

---

## The two seams that will change

This is the crucial part. This is exactly where we draw clean boundaries.

### 1. API versioning — happened with UMP 3.0.0
The new design has **versioned sub-apps** and **OpenAPI docs per version**. Up to 2.x the routes sat at root (`/processes/`); since 3.0.0 they live under `/v1.0/processes`.

Two things changed here, not just one:

- The **`/v1.0` prefix** in front of every OGC route.
- **No more trailing slash.** FastAPI runs there with `redirect_slashes=False`; `/v1.0/processes/` is a **404**, not a 308 redirect to the variant without it. Up to 2.x it was exactly the other way round — the trailing slash was mandatory.

Gone along the way: `?f=json` (the API only speaks JSON now) and `total_count` in the job list (now `{ jobs, links }`). `/execution` answers with **201** and a full `JobStatusInfo` instead of just `{ jobID, status }` — the same shape as `/jobs/{id}`.

→ The seam held: **base URL and API version together in one config** (`runtimeConfig.public.umpBase` + `umpApiVersion`, joined in `useUmpBase()`). The path change was a one-liner; the trailing slashes were scattered across the composables and had to go one by one.

### 2. Result delivery (the important one!)
Under "Planned Adapters" there are **GeoServer Result Storage** (WFS/WMS publish) and **Idproxy Result Storage** (OGC API Features) behind a new `ResultStoragePort`. Today we render **inline GeoJSON** from `/jobs/{id}/results`. In the future, results could come as an **OGC API Features collection** or **WFS/WMS layers**.

→ Encapsulate **"fetch job result → map-ready layer" in exactly one function/composable**. This is the only place where the frontend gets real work when the migration lands. Draw the cleanest seam here.

### Auth (stays)
The planned Keycloak adapter (JWT, realm roles) does not change the auth concept. Our OIDC approach is unaffected.

---

## What this means concretely for the frontend

Implementation principles:

1. **One integration layer.** All UMP access in composables / a typed client (`useUmpProcesses`, `useUmpJob`, `executeProcess`). This is the *only* place that knows endpoints and response shapes.
2. **Domain models.** Map raw API responses there to our own models (`Process`, `Job`, `ResultLayer`). Components consume only these models, **never raw JSON**. If a payload changes, we fix the mapping in one place — not across many components.
3. **Config for base + version.** `umpBase` + API version, central and overridable via env.
4. **Isolate the result layer.** A dedicated module "result → GeoJSON/layer for the map" (see seam 2).
5. **Generate types.** Once the versioned API with its OpenAPI doc exists: generate TypeScript types from it → contract changes become compile errors.
6. **Mark UMP extensions.** Keep ensembles, job sharing, and comments clearly separate from standard OGC — those are the most likely to move during the refactor.

### Deliberately NOT doing (YAGNI)
Do **not** recreate the hexagonal architecture in the frontend (no formal ports/adapters/DI). For a funding-bound prototype that is overkill. A clean composable + mapping boundary gives ~90% of the future-proofing for ~5% of the effort. We keep the "swappable adapter" implicit (one well-factored module), not an explicit interface — that only pays off once there are actually two backends to serve.

---

## What we already have

- Server-side proxy `/ump/**` → `http://localhost:5003/**` (solves CORS, same pattern as later in prod).
- `runtimeConfig.public.umpBase` as the central backend base.
- Typed interfaces for processes (first domain models).
- Verified end-to-end vertical slice: catalog → execution → job polling → GeoJSON on a MapLibre map.

---

## Open questions for the backend team

These two answers determine how deep we can already build:

1. ~~**Will the OGC route contract stay compatible** with the FastAPI adapter, just versioned under `/v1.0`?~~ **Answered by 3.0.0: yes**, apart from the trailing slash (see seam 1).
2. **How will results be delivered after the migration** — inline GeoJSON, OGC API Features, or WFS/WMS? This is the one answer that really shapes our map/rendering code. Clarify **before** building out the result path deeply.

---

## References

- Backend hexagonal architecture diagram (`__UMP-X/Hexagonal Architektur/…`)
- Platform / API reference: `_stack-docs/ump/ump-platform.md`
- Local setup: `_llm-wiki/UMP-X/Runbook — Lokales UMP Setup.md`
