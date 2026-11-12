# Adding a new model to UMP

*As of 2026-09-18, `providers.yaml` format 2026-10-07, roles 2026-10-29. Statements about running systems are dated individually in the text.*

**In short:** a new model is almost entirely a **backend / platform matter**. The
**frontend** usually needs **no** change: it lists whatever the `/processes` endpoint
returns.

**The two repositories involved:**

| | Repo | Role |
|---|---|---|
| Backend | [`citysciencelab/urban-model-platform`](https://github.com/citysciencelab/urban-model-platform) | UMP itself: `docker-compose-dev.yaml`, `providers.yaml`, authorisation |
| Frontend | [`Urban-Futures-Collective/ump-x-frontend`](https://github.com/Urban-Futures-Collective/ump-x-frontend) | this file lives here; catalogue, form, map |

All file paths below without further note refer to the **backend** repo.

In UMP a model is its **own OGC API Processes server** (a container that exposes
`/processes`, e.g. via pygeoapi). UMP registers this server and passes its processes
through.

A worked example is the growbike integration, see
[`runbook-growbike-modelserver-en.md`](./runbook-growbike-modelserver-en.md).

> **Notes:**
> - **This manual route is being replaced** by the model registry (concept F12): register
>   the server in UMP-X under "Contribute", pick its processes, write the model card, have
>   it reviewed and published under "Verify". Publishing creates the access roles (see
>   step 5). Until UMP reads the registry from its database (`UMP_PROVIDERS_SOURCE=db`),
>   the steps below still apply.
> - **Don't forget the role.** A model without `anonymous-access` needs a role in Keycloak
>   (step 5), assigned to the accounts that may run it. Without it UMP refuses every run
>   with "Missing role …". Since 2026-10-29 access admins grant these roles in UMP-X under
>   "Access manager"; it lists roles of the form `<provider>` and `<provider>:<process-id>`.
> - **Form and map are built from the schema.** The more precise the process description
>   (`enum`, `format: date`, `format: geojson-geometry`, `minimum`, `pattern`), the better
>   the form. A guide lives in the umep-modelserver repo (`docs/process-descriptions.md`).

---

## Backend (`urban-model-platform`): this is where the work happens

### 1. Provide the model as an OGC server
The model container must offer an OGC API Processes endpoint (`GET /processes`,
`POST /processes/{id}/execution`, `GET /jobs/{id}`, `GET /jobs/{id}/results`). To wrap an
existing model (Python or similar), pygeoapi is the usual choice.

### 2. `docker-compose-dev.yaml`: put the container into the UMP network
The file is in the root of the backend repo:
[`docker-compose-dev.yaml`](https://github.com/citysciencelab/urban-model-platform/blob/dev/docker-compose-dev.yaml)
(branch `dev`). Next to it are `docker-compose-build.yaml` and `docker-compose-prod.yaml`.

**In the compose file the network is called `dev`, not `ump_dev`.** The difference
matters because you reference the key, not the Docker name:

```yaml
networks:
  dev:
    external: true
    name: ${DOCKER_NETWORK}
```

`ump_dev` is the real Docker name; it comes from `DOCKER_NETWORK` in `.env`. A service
therefore joins with `networks: [dev]`. `external: true` also means Compose does **not**
create the network; if it is missing, run `docker network create ump_dev` once.

Add the model container as a service (template: the service `modelserver` in the same
file):

```yaml
  your-model:
    image: <your-image>
    networks:
      - dev
    # ports: ... (only needed if you also want to test it from the host)
```

The **service name is the DNS name** in the network and thus what goes under `url:` in
step 3.

> If the model runs outside Compose, attach it at runtime:
> `docker network connect ump_dev <containername>`. That survives a restart but **not**
> recreating the container, which is exactly what a deploy does. Permanently, the model
> server belongs in the compose file with `networks:`.

**Check reachability from inside the API container**, not from the host. Only there does
name resolution count:

```bash
docker exec urban-model-platform-api-1 \
  python -c "import urllib.request,json; print([p['id'] for p in json.loads(urllib.request.urlopen('http://your-model:80/processes/?f=json').read())['processes']])"
```

Only once this prints the process ids is step 3 worth doing.

### 3. `providers.yaml`: register the model server  *(the central file)*
Add a new list entry. Since UMP 3 the file is a **list** of model servers, and the
processes are a list with `id` as well. Copying an existing entry is safest, then the
indentation is right (as on staging 2026-10-07):

```yaml
- name: yourmodel
  url: "https://yourmodel.urbanfuturescollective.org"   # public address, see below
  ttw-job-done: 300                     # seconds UMP waits for a run to finish
  authentication:                       # optional; leave out = no authentication
    type: "BasicAuth"
    user: "ump"
    password: "<password of the model server>"
  processes:
    - id: process-id                    # must match the process id on the model server
      result-storage: "remote"          # see table below
      anonymous-access: true            # true = runnable without sign-in, false = role needed
```

On the UFC server UMP reaches the model servers through their public addresses: Plesk
accepts HTTPS (subdomain with Let's Encrypt, nginx directive
`proxy_pass http://127.0.0.1:8085;`) and hands over to Dokploy's Traefik, which routes
by domain to the container (domain entry in Dokploy with HTTPS off). Example:
`osmnx-modelserver`.

**`result-storage`:**

| Value | Meaning | Frontend effort |
|---|---|---|
| `remote` | Result is delivered inline as **GeoJSON** (FeatureCollection) | none, works out of the box |
| `geoserver` | In 2.x: result published through **GeoServer** as a WMS/WFS layer. **Without effect** in UMP 3.0.0, see the note below the table | none at present |

> **On `result-storage` in UMP 3.0.0.** The value is read from `providers.yaml` and
> typed, but used nowhere afterwards: `job_manager` takes a `result_storage_port`, puts it
> in a field and never touches it again, and there is no GeoServer adapter in the
> `deploy` branch. `/v1.0/jobs/{id}/results` instead passes the model server's response
> through unchanged, explicitly without reading the body. What arrives on our map
> therefore depends on the model server, not on this flag. Checked on 2026-08-31; not
> measured, because there was no run against a `geoserver` provider yet.

**`anonymous-access`:** since UMP 3.0.0 the flag only governs **running**, no longer
visibility.

- `true`: the process can be run without sign-in.
- `false`: only with a matching role (step 5).

Whether a process **appears** in the catalogue is decided by the server setting
`UMP_PUBLIC_PROCESSES`. If it is on, everyone sees everything, also signed out; if it is
off, `GET /processes` only shows what the caller could also run. On production it is on:
anonymously, `/v1.0/processes` returns all models, while `/mcp/v1/tools`, which filters
by the run rule, only shows the open ones (measured on 2026-08-31).

> Measured again on 2026-09-18: anonymously,
> `https://ump.urbanfuturescollective.org/v1.0/processes` answers HTTP 200 with four
> processes (`bikebox-modelserver:fixbike`, `bikebox-modelserver:growbike`,
> `modelserver-1:abm-test-model`, `modelserver-1:seir-infection-model`).
> `UMP_PUBLIC_PROCESSES` is therefore still on there.

### 4. Restart the UMP `api`
The `api` loads the mounted `providers.yaml` at start:

```bash
docker compose -f docker-compose-dev.yaml restart api
```

Check that the model appears:

```bash
curl -s "http://localhost:5003/v1.0/processes" \
  | python3 -c 'import sys,json; print(sorted(p["id"] for p in json.load(sys.stdin)["processes"]))'
# -> should contain "yourmodel:process-id"
```

### 5. Keycloak: only with `anonymous-access: false`
Create a role in the realm `UrbanModelPlatform` and assign it to the accounts that may
run the model. **The role name is not free to choose**; UMP compares it literally
(`src/ump/core/services/authorization.py`):

- `<provider>`: access to **all** processes of this model server, e.g.
  `bikebox-modelserver`.
- `<provider>:<process-id>`: access to **one** process, i.e. the full process id with
  colon, e.g. `bikebox-modelserver:fixbike`.

If neither is present, the API answers 403 with the sentence
`Missing role '<provider>' or '<provider>:<process-id>'.`

Create them as **realm roles**. That is what publishing in the model registry does, and
the access manager in UMP-X then lets access admins assign them. Assigning them by hand
in the Keycloak console works too.

Two pitfalls:

- **The old naming scheme `modelserver_<id>` no longer applies.** It comes from UMP 2.x.
  Roles of that name in the realm only work under 3.x if a model server happens to be
  called exactly that.
- **Which claim UMP reads roles from is set in `UMP_JWT_ROLES_CLAIMS`.** The default is
  `realm_access.roles`, i.e. **realm** roles. Client roles on `ump-client` sit under
  `resource_access.ump-client.roles` and are only read if that path is listed there. On
  production **both** were listed on 2026-08-31, so both work there; some older models
  still have client roles (e.g. `bikebox-modelserver`). On another instance, check the
  variable before creating roles.

The process list is only filtered by these roles when `UMP_PUBLIC_PROCESSES` is off. On
production it is on, so everyone sees all models and only fails when running one. The
frontend needs no change for this, but should explain the 403 clearly.

---

## Frontend (`ump-x-frontend`): usually nothing

Catalogue, run form and map are **model-agnostic**:
- Catalogue: `app/composables/useUmpProcesses.ts` (lists `/processes`)
- Form: `app/components/ProcessRunner.vue` (builds the inputs generically from the OGC inputs schema)
- Map: `app/components/UmpMap.client.vue` (renders generic GeoJSON and linked layers)

A new model therefore shows up automatically. **Two exceptions** where frontend work is
needed after all:

1. **A new result format:** if the model delivers **neither** inline GeoJSON **nor**
   links to GeoJSON layers (e.g. WMS/WFS or a raster), the result seam has to be extended:
   `app/composables/useUmpResult.ts` + `app/components/UmpMap.client.vue`.
2. **Unusual input defaults:** e.g. a string default like `"auto"` for an integer field.
   Then the value conversion in `ProcessRunner.vue` has to handle it cleanly (do not send
   unchanged defaults, only cast valid values).

---

## Checklist

| File / place | Change | Required? |
|---|---|---|
| Model container | Provide an OGC API Processes server | ✅ always |
| `docker-compose-dev.yaml` | Attach the container to the network key `dev` (Docker name `ump_dev`) | ✅ for a new local container |
| `providers.yaml` | Add the model server block | ✅ always |
| Restart UMP `api` | `restart api` | ✅ always |
| Keycloak | Realm role `<provider>` or `<provider>:<process-id>`, assigned | only with `anonymous-access: false` |
| `useUmpResult.ts` / `UmpMap.client.vue` | Result rendering | only for a new result format |
| `ProcessRunner.vue` | Input coercion | only for odd input defaults |

---

## Notes

- **`providers.yaml` is currently local / not committed.** Reproducible (and shareable)
  would be adding the model server block to the UMP repo by PR, or, once it is in place,
  the model registry.
- **Network connection via `docker network connect` is runtime only:** it survives
  container restarts but not recreating the container. Permanently: add the container
  with `networks: [dev]` to a compose file.
- **Fully worked example:** the growbike integration (network, `providers.yaml`,
  verification, pitfalls) is in [`runbook-growbike-modelserver-en.md`](./runbook-growbike-modelserver-en.md).
  Its section "State on the server (2026-08-20)" is outdated: the missing
  `providers.yaml` is fixed, and on 2026-09-18 the production API answered with four
  processes from two model servers.
- **Local state on 2026-09-18:** the network `ump_dev` exists, the UMP stack runs seven
  containers on it. `pygeoapi-growbike` is stopped; its network membership is still in the
  Docker configuration, but the name only resolves again once the container runs. The
  local `providers.yaml` still points to it.
