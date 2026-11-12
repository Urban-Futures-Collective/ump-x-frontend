# Runbook: adding growbike as a UMP model server

A worked example of how a model server is registered in UMP. growbike is itself an OGC
API Processes server (pygeoapi). Instead of attaching it to the frontend separately, we
register it **in UMP**; then it flows through the existing `/ump` seam (catalogue,
execution, result) without model-specific frontend code.

> **Verified on 2026-07-03, but locally.** The whole procedure below was run against a
> local UMP, not against production. What is different on the server is in the last
> section. Please do not transfer it unchecked.
>
> **Outdated since then (2026-10-29):** the `providers.yaml` format changed with UMP 3 (a
> list with `ttw-job-done`, processes as a list with `id`), see
> [`add-new-model-en.md`](./add-new-model-en.md), step 3. The role names are
> `<provider>` and `<provider>:<process-id>` (step 5 there), and the server state from
> August is resolved. The procedure itself (network, register, restart, verify) still
> holds.

## The core in three lines

1. Attach the model server to the same Docker network as the UMP API
2. Add a block to `providers.yaml`
3. Restart the API; it reads the mounted file at start

## Procedure (verified locally)

```bash
# 1. attach growbike to the UMP Docker network, then it is reachable by container name
docker network connect ump_dev pygeoapi-growbike

# 2. check reachability from the API container (internal port 80)
docker exec urban-model-platform-api-1 \
  python -c "import urllib.request,json; print([p['id'] for p in json.loads(urllib.request.urlopen('http://pygeoapi-growbike:80/processes/?f=json').read())['processes']])"
#   -> ['growbike']
```

**3.** Add a model server to UMP's `providers.yaml`. `authentication` is optional;
without it NoAuth applies; growbike has no auth. This is the format of July 2026 (UMP
2.x); for the current one see the note at the top:

```yaml
growbike:
    name: growbike
    url: "http://pygeoapi-growbike:80"
    timeout: 1800
    processes:
      growbike:
        result-storage: "remote"     # inline GeoJSON, growbike returns a FeatureCollection
        anonymous-access: true       # test default, the final sign-in policy is a team decision
```

```bash
# 4. restart the API; it reads the mounted providers.yaml at start
docker compose -f docker-compose-dev.yaml restart api
```

## Verify

```bash
# appears as "growbike:growbike"
# (UMP 3.x: routes under /v1.0, without a trailing slash; with the slash: 404)
curl -s "http://localhost:5003/v1.0/processes" \
  | python3 -c 'import sys,json;print(sorted(p["id"] for p in json.load(sys.stdin)["processes"]))'

# run Oelde (async), poll the job, fetch the result
curl -s -X POST "http://localhost:5003/v1.0/processes/growbike:growbike/execution" \
  -H "Content-Type: application/json" -H "Prefer: respond-async" \
  -d '{"inputs":{"cityname":"Oelde","ranking":"betweenness_centrality"}}'
# answer: 201 with JobStatusInfo (jobID, status, …)
# GET /v1.0/jobs/{jobID} until "successful", then GET /v1.0/jobs/{jobID}/results
```

Expected: a `FeatureCollection` with **92 LineString features** (cycle network of
Oelde), properties `betweenness_centrality`, `length`, `length_cumulative`, `rank`,
`source`, `target`. In the frontend `growbike:growbike` appears in the list; select it,
`cityname: Oelde`, run, and the cycle network appears as lines on the map.

## Pitfalls

| # | Topic | Detail |
|---|---|---|
| 1 | **Network connection is runtime only** | `docker network connect` survives a restart but **not** recreating the container, which is exactly what a deploy does. Permanently, the model server belongs in the compose file with `networks:`. |
| 2 | **Image pin** | The running container had the matching `growbikenet` version installed only *live*; the image had another. On recreation the run breaks. Pin the version in `requirements-docker.txt`. |
| 3 | **`providers.yaml` is not in the repo** | It only exists where it is mounted. See below; on the server this became a problem. |
| 4 | **Anonymous access** | `anonymous-access: true` was set for testing. The sign-in policy is a team decision; afterwards only the flag changes. |

Pitfalls 1 and 3 have one thing in common: both are configuration that only exists at
runtime and disappears with the next deploy. That is the recurring failure in this
setup.

## Roles in Keycloak

The model server's name in `providers.yaml` determines the process ids
(`growbike:growbike`) **and** the role names. To run a process without
`anonymous-access`, an account needs the realm role `<modelserver>` (all processes) or
`<modelserver>:<process>` (one process), here `growbike` or `growbike:growbike`. Since
2026-10-29 access admins assign them in UMP-X under "Access manager".

Only needed with `anonymous-access: false`. With `true` anyone can run the process,
also without signing in.

## State on the server (2026-08-20)

*Resolved since: the `providers.yaml` exists, and on 2026-09-18 the production API
answered with four processes from two model servers. Kept as a record of what went
wrong.*

The situation differed from the local procedure in three points:

**The `providers.yaml` was missing.** In its place was an empty directory that Docker had
created because the file did not exist when the container started:

```
/etc/dokploy/compose/urban-model-platform-backend-wzuoew/code/providers.yaml
```

Because of that the UMP API had failed at start since 2026-07-06:

```
ValidationError: UMP_PROVIDERS_FILE
Path does not point to a file: /home/pythonuser/providers.yaml
```

The empty directory has to go first, otherwise Docker mounts the folder again instead of
the file.

**There probably never was one.** The roles on `ump-client` were called `modelserver`,
`modelserver_hello-world`, `modelserver_squareroot` and `modelserver_hello-geo-world`.
Those are exactly the names from `providers.yaml.example`; there was no role for growbike
or bikebox. Together with the API crashing since the day it was set up, everything
suggested it had never run in production.

**The networks were separate.** According to the Docker logs, `pygeoapi-growbike` and the
API container were in different networks (`bikebox-modelserver-pygeoapi-ayajqr_default`
versus `ump_prod`). A `docker network connect` would help, but per pitfall 1 only until
the next deploy. Permanently this belongs in the compose configuration.

## Related

- `docs/add-new-model-en.md`, overview of which places a new model touches
- `docs/deployment-en.md`, branch chain, environment variables, smoke tests
