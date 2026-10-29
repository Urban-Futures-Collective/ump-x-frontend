# Managing model access: decision paper (frontend ↔ Keycloak/backend)

**Status:** Superseded (2026-09-30), see below
**Date:** 2026-07-09

> **Superseded on 2026-09-30.** This paper's recommendation, **option B** (the backend
> offers an administration endpoint and talks to Keycloak internally), no longer applies.
> UMP 3 deliberately dropped its write path to Keycloak: it checks tokens offline against
> JWKS and holds no admin secret. Administration therefore lives in the **frontend**,
> whose server signs in to the Keycloak admin API as its own service account
> `ump-x-admin`. Recorded in concept F11 (`urban-model-platform`, branch
> `v3.0.0alpha/user-management-db`, `reports/REF-F11-role-administration.md`).
>
> What else changed:
> - **No app admin role `ump_admin`**, but the role model from the weekly as realm roles.
>   Since 2026-10-28 they carry the names UMP's model registry checks: `viewer`, `user`,
>   `provider`, `verifier`, `access-admin`, `platform-admin` (before: `user_role_*`).
>   Accounts and platform roles in the administration are for `platform-admin`, model
>   access in the access manager for `access-admin` (`shared/utils/roles.ts`).
> - **Administration** (`server/api/admin/platform/`): list accounts, create them with an
>   invitation email (sent by Keycloak through the mail server on the Plesk host),
>   assign and revoke platform roles, disable and enable accounts.
> - **Model access** is a realm role per model server, `{server}`, and per model,
>   `{server}:{process}`. Publishing a model creates both
>   (`server/api/registry/models/[id]/publish.post.ts`); access admins grant and revoke
>   them in the access manager (`/access`, `server/api/access/`).
> - Protection on the server in every route: the caller's role, plus an allowlist or
>   catalogue of the role names that may be assigned.
> - **Open:** access requests (people asking for access, access admins deciding), which
>   need storage in UMP's database, and the notification emails. In progress in the
>   backend as of 2026-10-29.
> - **Groups** were recommended for granting access (also in F11) but are not used so far.
>
> Setting up the service account: `docs/deployment-en.md`. The rest of this paper stays as
> background on how the question looked in July.

**Context:** UMP-X (Nuxt 4 frontend for the Urban Model Platform). Companion to `frontend-backend-architecture-en.md`. This paper covers only the parts of the planned frontend that reach across the frontend boundary and therefore need a joint decision. The three user views do not: they run against the existing OGC API contract and can be built independently.

---

## Summary

The frontend gets three user views (models / scenarios / execution) that need **no** backend changes. The **admin view**, where an admin releases models to users or groups, is the only piece that touches Keycloak, and Keycloak belongs to the backend. The core question: **does the frontend talk to the Keycloak admin API directly, or does the backend offer a slim administration endpoint the frontend calls?** Recommendation: **the backend handles it (option B)**, access is granted through **groups**, and a dedicated **app admin role** with a token mapper is introduced.

---

## How the realm looks today

Read from the live instance (`auth.urbanfuturescollective.org`, realm `UrbanModelPlatform`):

- **One app client:** `ump-client` (confidential, home `http://localhost:5003`).
- **Model access = client roles on `ump-client`:**
  - `modelserver`: access to all processes
  - `modelserver_hello-world`, `modelserver_hello-geo-world`, `modelserver_squareroot`: one model server each
- **No groups** in the realm.
- **No app admin role**: the whole role vocabulary is about model access. Realm admin (`ck71`) is a plain Keycloak `realm-management` permission and is no use as an admin gate for the frontend.
- **Test users:** `ump` (all), `ump-geo`, `ump-sqrt`, `ump-viewer` (none): a matrix by model visibility.

Consequence for the frontend: the three user views (`/commons`, `/jobs`, `/run`) are the same routes for every signed-in user. The only real route branch is **admin vs. non-admin**.

> **Addendum 2026-08-31.** The original sentence here said the content differs because UMP filters the process list server-side by role. That no longer holds. Since UMP 3.0.0 filtering the list depends on the server setting `UMP_PUBLIC_PROCESSES`, and on production it is on: everyone sees all models. Roles only decide about **running** a model, and they are called `<provider>` or `<provider>:<process-id>`, no longer `modelserver_<id>`. See `docs/add-new-model-en.md`, step 5.

---

## Decisions to make

### 1. Who talks to the Keycloak admin API? (the core question)

| Option | What it means | Assessment |
|--------|---------------|-----------|
| **A**: frontend → Keycloak admin API directly | The frontend holds a service account with `realm-management` roles | Opens a **third, privileged seam** in the frontend and duplicates the Keycloak admin console. Contradicts the "two seams" discipline of the architecture doc. |
| **B**: the backend offers an endpoint, the frontend calls it | e.g. `POST /admin/access`; UMP talks to Keycloak internally | **Recommended.** The frontend stays with the HTTP contract; authorisation logic stays with the realm owner, exactly where the planned Keycloak adapter lives anyway. |
| **C**: no custom admin UI | Admins use the Keycloak console; the frontend only links there | Cheapest. Possibly enough for v1. |

**Question:** Does the backend (or the new Keycloak adapter) offer an administration endpoint, or should the frontend operate the admin API itself?

If option B: the planned frontend capability (a `useUmpAccess` composable: `listModels / listPrincipals / getGrants / grant / revoke`) is in effect already the API sketch. We can agree on the exact shape.

### 2. Grant per user or per group ("role group")?

The product intent is to release models "to certain users **or role groups**". The realm currently has **no groups**; access hangs directly on each user as a client role. Modelling "release a model to a team" cleanly would mean introducing Keycloak **groups** (or composite roles).

**Question:** Should model access move to groups (then "release model → group" is one step), or stay per user?

### 3. App admin role: who owns it, and where does it live?

There is no `ump_admin` role (or similar) yet. It has to be defined, as a realm role or as a client role on `ump-client`, and **`ump-client` must map the roles into a token claim the frontend session can read**; otherwise the frontend cannot gate the admin route at all. That is Keycloak configuration on the backend side.

**Question:** Where does the admin role live, and can the roles mapper on `ump-client` be switched on?

---

## Recommendation

**Option B** (the backend handles access administration) + granting through **groups** + a dedicated **`ump_admin`** role with a token mapper. This keeps the frontend slim and authorisation with the backend, while the three user views can already be built in parallel before the admin endpoint contract is settled.
